"""The lights at home follow the game (docs/home-lights.md).

The browser decides what each bulb shows; this bridge sends it to the LIFX Cloud API through the
house's own library, vendor/geraitor_domotic_house (a git submodule), without going over LIFX's 120
requests a minute. Colour changes are merged while one is on its way, so only the latest state of
each bulb is ever sent; flashes skip that queue because they are timed to a hit. Giving the house
its lights back when the game lets go is the browser's job: it knows the flat (src/home-lights.ts).
"""
import logging
import os
import secrets
import sys
import threading
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

LIBRARY = Path(__file__).parent / "vendor" / "geraitor_domotic_house"
if str(LIBRARY) not in sys.path:
    sys.path.append(str(LIBRARY))
try:
    from geraitor_domotic_house.source.lifx_api import LifxApiClient
    from geraitor_domotic_house.utils.color import Color
except ImportError:  # The submodule is not checked out: git submodule update --init
    LifxApiClient = Color = None

logger = logging.getLogger("uvicorn.error")


class Budget:
    """A token bucket under LIFX's 120 requests a minute, leaving room for the house's own apps."""

    def __init__(self, per_minute: float = 100, burst: float = 8, clock=time.monotonic):
        self.rate, self.burst, self.clock = per_minute / 60, burst, clock
        self.tokens, self.at = burst, clock()
        self.lock = threading.Lock()

    def _refill(self):
        now = self.clock()
        self.tokens = min(self.burst, self.tokens + (now - self.at) * self.rate)
        self.at = now

    def take(self) -> bool:
        with self.lock:
            self._refill()
            if self.tokens < 1:
                return False
            self.tokens -= 1
            return True

    def wait(self) -> float:
        """Seconds until the next request may go."""
        with self.lock:
            self._refill()
            return max(0.0, (1 - self.tokens) / self.rate)


def lifx_color(shade: dict | None, brightness: float | None = None) -> str | None:
    if shade is None and brightness is None:
        return None
    return Color.from_mapping({**(shade or {}), "brightness": brightness}).to_lifx_string()


class HomeLights:
    """The bulbs as last read, and the states and flashes waiting to be sent to them."""

    #: A read of every bulb is reused for this long: the game polls while it mirrors the flat.
    READ_SECONDS = 1.5

    def __init__(self, api, budget: Budget | None = None, clock=time.monotonic, worker: bool = True):
        self.api, self.clock = api, clock
        self.budget = budget or Budget(clock=clock)
        self.wake = threading.Condition()
        self.pending: dict[str, dict] = {}
        self.effects: list[dict] = []
        self.inventory: list[dict] = []
        self.read_at = -float("inf")
        #: Seconds a request to LIFX takes, smoothed: the game shows it to set the lead.
        self.latency: float | None = None
        if worker:
            threading.Thread(target=self._run, name="home-lights", daemon=True).start()

    # ------------------------------------------------------------------ reading
    def _timed(self, method: str, path: str, **kwargs):
        start = self.clock()
        result = self.api.request(method, path, **kwargs)
        took = self.clock() - start
        self.latency = took if self.latency is None else self.latency * 0.8 + took * 0.2
        return result

    def lights(self, fresh: bool = False) -> list[dict]:
        """Every bulb as the game reads it, from a recent read when there is one."""
        if (fresh or self.clock() - self.read_at > self.READ_SECONDS) and self.budget.take():
            raw = self._timed("GET", "lights/all")
            if isinstance(raw, list):
                self.inventory, self.read_at = raw, self.clock()
        return [{
            "label": light["label"],
            "group": light.get("group", {}).get("name"),
            "connected": light.get("connected", False),
            "power": light.get("power") == "on",
            "hue": light["color"]["hue"],
            "saturation": light["color"]["saturation"],
            "kelvin": light["color"]["kelvin"],
            "brightness": light["brightness"],
        } for light in self.inventory]

    def selector(self, labels: list[str]) -> str:
        """Bulbs by id, which is stable; a label nobody knows is passed on as a label."""
        if any(label not in {light["label"] for light in self.inventory} for label in labels):
            self.lights(fresh=True)
        ids = {light["label"]: light["id"] for light in self.inventory}
        return ",".join(f"id:{ids[label]}" if label in ids else f"label:{label}" for label in labels)

    # ------------------------------------------------------------------ writing
    def set(self, states: list[dict], duration: float):
        """Queues states; a bulb already waiting keeps only the newest."""
        with self.wake:
            for state in states:
                self.pending[state["light"]] = {**state, "duration": duration}
            self.wake.notify()

    def flash(self, effect: dict):
        """Queues an effect ahead of the states. Late flashes are worthless, so only a few wait."""
        with self.wake:
            self.effects = [*self.effects[-2:], effect]
            self.wake.notify()

    def _send(self, kind: str, payload):
        if kind == "effect":
            target = self.selector(payload["lights"])
            if payload["kind"] == "off":
                self._timed("POST", f"lights/{target}/effects/off", json={"power_off": False})
                return
            body = {key: payload[key] for key in ("period", "cycles", "persist", "peak") if payload.get(key) is not None}
            body["color"] = lifx_color(payload.get("color"), payload.get("brightness"))
            if payload.get("from_color") or payload.get("from_brightness") is not None:
                body["from_color"] = lifx_color(payload.get("from_color"), payload.get("from_brightness"))
            body["power_on"] = True
            self._timed("POST", f"lights/{target}/effects/{payload['kind']}", json=body)
            return
        groups: dict[tuple, list[str]] = {}
        for label, state in payload.items():
            color = lifx_color(state.get("color"), state.get("brightness"))
            groups.setdefault((state["power"], color, state["duration"]), []).append(label)
        if len(groups) == 1:
            # One look for every bulb: the single-state call answers without waiting for the bulbs.
            ((power, color, duration), labels), = groups.items()
            body = {"power": "on" if power else "off", "duration": duration, "fast": True}
            if color:
                body["color"] = color
            self._timed("PUT", f"lights/{self.selector(labels)}/state", json=body)
            return
        states = [{"selector": self.selector(labels), "power": "on" if power else "off", "duration": duration, **({"color": color} if color else {})}
                  for (power, color, duration), labels in groups.items()]
        reply = self._timed("PUT", "lights/states", json={"states": states})
        # LIFX answers per bulb; one that timed out keeps its old colour, so it goes again, once.
        missed = {result.get("label") for operation in (reply or {}).get("results", []) if isinstance(operation, dict)
                  for result in operation.get("results", []) if result.get("status") != "ok"}
        retry = {label: {**state, "retried": True} for label, state in payload.items() if label in missed and not state.get("retried")}
        if retry:
            logger.warning("LIFX did not confirm %s; sending them again", ", ".join(sorted(retry)))
            with self.wake:
                self.pending = {**retry, **self.pending}
                self.wake.notify()

    def next_request(self):
        """What goes next, flashes first; None when nothing waits."""
        with self.wake:
            if self.effects:
                return "effect", self.effects.pop(0)
            if self.pending:
                pending, self.pending = self.pending, {}
                return "states", pending
        return None

    def _run(self):
        while True:
            with self.wake:
                while not self.effects and not self.pending:
                    self.wake.wait()
            time.sleep(self.budget.wait())
            if not self.budget.take():
                continue
            job = self.next_request()
            if job:
                try:
                    self._send(*job)
                except Exception:  # A bad request must never stop the worker.
                    logger.exception("Home lights request failed")


_house: HomeLights | None = None
_house_lock = threading.Lock()


def lifx_token() -> str | None:
    return os.environ.get("LIFX_TOKEN") or os.environ.get("lifx_token")


def house() -> HomeLights | None:
    global _house
    token = lifx_token()
    if LifxApiClient is None or not token:
        return None
    with _house_lock:
        if _house is None:
            _house = HomeLights(LifxApiClient(token))
        return _house


def why_unavailable(request: Request) -> str | None:
    """None when this request may drive the lights. On a server reachable from the internet
    (Fly sets FLY_APP_NAME) the browser must carry HOME_LIGHTS_KEY, set with `just deploy-lights`."""
    if LifxApiClient is None:
        return "library"
    if not lifx_token():
        return "token"
    key = os.environ.get("HOME_LIGHTS_KEY")
    if key:
        return None if secrets.compare_digest(request.headers.get("x-lights-key", ""), key) else "key"
    return "key" if os.environ.get("FLY_APP_NAME") else None


def driving(request: Request) -> HomeLights:
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site requests are not allowed")
    reason = why_unavailable(request)
    if reason == "key":
        raise HTTPException(403, "The lights need the house key")
    lights = house() if not reason else None
    if not lights:
        raise HTTPException(503, "The lights at home are not configured")
    return lights


class Shade(BaseModel):
    """A LIFX colour without its brightness: a hue, or a white by its temperature."""
    hue: float = Field(0, ge=0, le=360)
    saturation: float = Field(0, ge=0, le=1)
    kelvin: int = Field(3500, ge=1500, le=9000)


Label = Field(min_length=1, max_length=40)


class LightState(BaseModel):
    light: str = Label
    power: bool
    color: Shade | None = None
    brightness: float | None = Field(None, ge=0, le=1)


class LightsUpdate(BaseModel):
    states: list[LightState] = Field(min_length=1, max_length=16)
    duration: float = Field(0.5, ge=0, le=60)


class LightsEffect(BaseModel):
    lights: list[str] = Field(min_length=1, max_length=16)
    kind: Literal["breathe", "pulse", "off"]
    color: Shade | None = None
    brightness: float | None = Field(None, ge=0, le=1)
    from_color: Shade | None = None
    from_brightness: float | None = Field(None, ge=0, le=1)
    period: float = Field(1.0, ge=0.05, le=60)
    cycles: float = Field(1, ge=0.5, le=1000)
    peak: float | None = Field(None, ge=0, le=1)
    persist: bool = False


router = APIRouter()


@router.get("/api/lights")
def read_lights(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    reason = why_unavailable(request)
    lights = house() if not reason else None
    if not lights:
        return {"available": False, "reason": reason, "lights": []}
    return {"available": True, "lights": lights.lights(),
            "latency": round(lights.latency * 1000) if lights.latency is not None else None}


@router.put("/api/lights", status_code=204)
def set_lights(update: LightsUpdate, request: Request):
    driving(request).set([state.model_dump() for state in update.states], update.duration)


@router.post("/api/lights/effect", status_code=204)
def flash_lights(effect: LightsEffect, request: Request):
    driving(request).flash(effect.model_dump())
