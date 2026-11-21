"""Serve the game and persist each browser's progress on the mounted volume."""
import json
import logging
import os
from contextlib import contextmanager
import sqlite3
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

import httpx
from fastapi import BackgroundTasks, FastAPI, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import daylog
from ai import claude, decision_provider, plan_enemy_turn
from artilugio import router as artilugio_router
from lights import router as lights_router
from tickets import judge as judge_memory

app = FastAPI()
logger = logging.getLogger("uvicorn.error")
# Story progress flags, in story order. Keep in sync with STORY_FLAGS in src/story.ts (a test checks it).
STORY_FLAGS = ("intro", "met-jan", "got-shoes", "got-potion", "got-backpack", "bernat-joined", "bernat-stalled", "dejavu", "minion", "first-fight", "palace", "in-palace", "got-chicle", "matemagico", "wrapper-room", "caught", "got-wrapper", "got-bola", "tv-news", "metro", "rec-comtal", "castle", "palace-tried", "clue-r4", "anima-nuria", "papagato", "papagato-2", "papagato-3", "papagato-4", "papagato-5", "papagato-6", "papagato-7", "matemagico-2", "matemagico-3", "dadaista-2", "dadaista-3", "dadaista-4", "dadaista-5", "dadaista-6", "dadaista-7", "prismatico-2", "prismatico-3", "prismatico-4", "prismatico-5", "prismatico-6", "prismatico-7", "sincopante-2", "sincopante-3", "sincopante-4", "sincopante-5", "sincopante-6", "sincopante-7", "freatica-2", "freatica-3", "freatica-4", "freatica-5", "freatica-6", "freatica-7", "clue-nuria", "cardedeu", "nuria-uri", "luz-nuria", "luz-uri", "clue-uni", "barceloneta-uni", "camping", "candado", "parcelas", "sobremesa", "anima-universidad", "luz-anna-alvaro", "luz-miquel-sarah", "luz-soraya", "luz-nico", "luz-joan", "clue-marta", "alegia-marta", "cuerdas", "voz", "anima-marta", "luz-marta", "clue-emilie", "poble-sec-emilie", "modelo", "converge", "anima-emilie", "luz-emilie", "clue-luca-foto", "clue-sagrada", "clue-sagrada-cartel", "sagrada-luca", "peluqueria", "fran", "anima-luca", "luz-luca", "ticket-cardedeu", "ticket-barceloneta", "ticket-sagrada-familia", "ticket-placa-de-sants", "ticket-poble-sec", "ticket-el-carmel", "ticket-alegia", "ticket-espanya", "clue-bernat", "bernat-nucli", "cortina", "aurelia", "luz-aurelia", "direccion", "luz-mar", "luz-montse", "luz-pilar", "aitor-poseido", "bernat-llama", "bernat-juego", "portal-nucli", "artilugio", "reina", "final-acabar", "final-bajar", "luz-encarnado-1", "luz-encarnado-2", "luz-encarnado-3", "luz-encarnado-4", "luz-encarnado-5", "luz-encarnado-6", "luz-alumnos-1a", "luz-alumnos-1b", "luz-alumnos-1c", "luz-delegada-1", "luz-alumnos-2a", "luz-alumnos-2b", "luz-alumnos-2c", "luz-alumnos-2d", "luz-alumnos-2e", "luz-delegada-2", "luz-alumnos-3a", "luz-alumnos-3b", "luz-alumnos-3c", "luz-alumnos-3d", "luz-delegada-3")


@contextmanager
def connect():
    path = Path(os.environ.get("DATABASE_PATH", "data/game.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    try:
        with db:
            db.execute("CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, score INTEGER NOT NULL)")
            # Databases from before chapter 1 gain the story column in place.
            columns = {row[1] for row in db.execute("PRAGMA table_info(players)")}
            if "story" not in columns:
                db.execute("ALTER TABLE players ADD COLUMN story TEXT NOT NULL DEFAULT '[]'")
            # Chapter 2's days (src/days.ts): the day, the hour and the mornings to go back to.
            if "days" not in columns:
                db.execute("ALTER TABLE players ADD COLUMN days TEXT NOT NULL DEFAULT 'null'")
            daylog.ensure(db)
            yield db
    finally:
        db.close()


def player(request: Request, response: Response):
    token = request.cookies.get("gerard_player", "")
    try:
        return str(UUID(token))
    except ValueError:
        token = str(uuid4())
        response.set_cookie("gerard_player", token, max_age=31536000, httponly=True,
                            secure=request.url.scheme == "https", samesite="lax")
        return token


@app.get("/healthz")
def health():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok"}


@app.get("/api/state")
def get_state(request: Request, response: Response):
    token = player(request, response)
    response.headers["Cache-Control"] = "no-store"
    with connect() as db:
        row = db.execute("SELECT score, story, days FROM players WHERE id = ?", (token,)).fetchone()
    return {"score": row[0], "story": known_flags(json.loads(row[1])), "days": json.loads(row[2])} if row else {"score": 0, "story": [], "days": None}


# Flags that changed name; old saves keep working (src/story.ts has the same map). Nil's light is
# gone (Nuria's household gives two), so a save that had it keeps Uri's.
RENAMED_FLAGS = {"noista": "matemagico", "luz-nil": "luz-uri"}


def known_flags(flags):
    flags = {RENAMED_FLAGS.get(flag, flag) for flag in flags}
    return [flag for flag in STORY_FLAGS if flag in flags]


class Clock(BaseModel):
    day: int = Field(strict=True, ge=1, le=999)
    hour: int = Field(strict=True, ge=0, le=24)


class Morning(BaseModel):
    day: int = Field(strict=True, ge=1, le=999)
    story: list[Literal[STORY_FLAGS]] = Field(max_length=len(STORY_FLAGS))


class Boost(BaseModel):
    """What the last afternoon spent left the party (src/days.ts `EVENINGS`), and the last day it lasts."""
    id: Literal["sofa", "cocina", "gimnasio", "coro"]
    until: int = Field(strict=True, ge=1, le=999)


class Days(BaseModel):
    """Chapter 2's countdown (src/days.ts). `epoch` grows when the player goes back a day."""
    epoch: int = Field(strict=True, ge=0, le=1000000)
    clock: Clock
    mornings: list[Morning] = Field(default_factory=list, max_length=2)
    boost: Boost | None = None


class State(BaseModel):
    score: int = Field(strict=True, ge=0, le=2147483647)
    story: list[Literal[STORY_FLAGS]] = Field(default_factory=list, max_length=len(STORY_FLAGS))
    days: Days | None = None


@app.put("/api/state")
def save_state(state: State, request: Request, response: Response):
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site writes are not allowed")
    token = player(request, response)
    with connect() as db:
        # Late requests or another tab must never erase already saved progress: the score only
        # grows and story flags only accumulate. The first write locks the row for the merge.
        db.execute("INSERT INTO players (id, score) VALUES (?, ?) ON CONFLICT(id) DO UPDATE "
                   "SET score = MAX(players.score, excluded.score)", (token, state.score))
        score, saved, saved_days = db.execute("SELECT score, story, days FROM players WHERE id = ?", (token,)).fetchone()
        story, days = merge_progress(json.loads(saved), json.loads(saved_days), state)
        db.execute("UPDATE players SET story = ?, days = ? WHERE id = ?", (json.dumps(story), json.dumps(days), token))
    response.headers["Cache-Control"] = "no-store"
    return {"score": score, "story": story, "days": days}


def merge_progress(saved: list, saved_days: dict | None, state: State):
    """Flags only accumulate, except when the player went back a day (a newer `epoch`): then the
    flags and days they send replace the saved ones. A tab still on an older epoch changes nothing."""
    incoming = state.days.model_dump(exclude_none=True) if state.days else None
    epoch = saved_days["epoch"] if saved_days else 0
    if incoming and incoming["epoch"] > epoch:
        return known_flags(state.story), incoming
    if incoming and saved_days and incoming["epoch"] < epoch:
        return known_flags(saved), saved_days
    story = known_flags({*saved, *state.story})
    if not incoming:
        return story, saved_days
    later = not saved_days or (incoming["clock"]["day"], incoming["clock"]["hour"]) >= (saved_days["clock"]["day"], saved_days["clock"]["hour"])
    return story, incoming if later else saved_days


class Ally(BaseModel):
    id: Literal["gerard", "bernat", "aitor"]
    hp: int = Field(ge=0, le=999)
    max_hp: int = Field(ge=1, le=999)
    guarding: bool = False


class Foe(BaseModel):
    id: Literal["dog-0", "dog-1", "dog-2", "dog-3"]
    hp: int = Field(ge=0, le=999)
    max_hp: int = Field(ge=1, le=999)


class EnemyTurn(BaseModel):
    allies: list[Ally] = Field(min_length=1, max_length=2)
    foes: list[Foe] = Field(min_length=1, max_length=4)


@app.post("/api/battle/enemy-turn")
def enemy_turn(turn: EnemyTurn, request: Request):
    """AI target choices for the dogs; the browser falls back to its own rule on any error."""
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site requests are not allowed")
    provider = decision_provider("battle")
    if not provider:
        raise HTTPException(503, "Battle AI is not configured")
    try:
        targets = plan_enemy_turn(provider, turn.allies, turn.foes)
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
        logger.warning("Battle AI failed: %r", error)
        raise HTTPException(502, "Battle AI is unavailable")
    return {"provider": provider.name, "targets": targets}


class Memory(BaseModel):
    text: str = Field(min_length=1, max_length=280)


@app.post("/api/transit/ticket")
def ticket(memory: Memory, request: Request):
    """The station tablet (src/travel-ui.ts): which station the memory opens, if any (tickets.py)."""
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site requests are not allowed")
    verdict, judge = judge_memory(memory.text)
    return {**verdict.model_dump(), "judge": judge}


@app.post("/api/log")
def log_day(batch: daylog.Batch, request: Request, response: Response, background: BackgroundTasks):
    """What the player did (src/day-log.ts), kept for a future boss; each day over gets its summary
    after the response (daylog.py, docs/day-log.md)."""
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site writes are not allowed")
    token = player(request, response)
    with connect() as db:
        daylog.record(db, token, batch.events)
        finished = daylog.claim_finished(db, token)
    for epoch, day in finished:
        background.add_task(summarize_day, token, epoch, day)
    return {"logged": len(batch.events)}


def summarize_day(token: str, epoch: int, day: int):
    """The model is asked outside the database's lock, which a summary can take seconds to write."""
    with connect() as db:
        events = daylog.events_of(db, token, epoch, day)
    facts, reading = daylog.summarize(events, claude())
    with connect() as db:
        daylog.store(db, token, epoch, day, facts, reading)


app.include_router(lights_router)
app.include_router(artilugio_router)


class Game:
    """The built game in dist/. While `just dev` runs, the game is Vite's (with the development
    picker) and GERARD_GAME_URL says where: this address then sends the browser there, path and
    query kept, instead of serving dist/, which is an old build or none."""

    def __init__(self):
        self.files = StaticFiles(directory="dist", html=True, check_dir=False)

    async def __call__(self, scope, receive, send):
        dev_game = os.environ.get("GERARD_GAME_URL")
        if dev_game and scope["type"] == "http":
            query = scope.get("query_string", b"").decode()
            target = dev_game.rstrip("/") + scope["path"] + (f"?{query}" if query else "")
            await RedirectResponse(target, status_code=307)(scope, receive, send)
            return
        await self.files(scope, receive, send)


app.mount("/", Game(), name="game")
