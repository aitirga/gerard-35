"""LIFX's LAN protocol, for the bulbs on the home network (docs/home-lights.md).

The cloud API takes up to a second to reach a bulb; on the same network a UDP message takes a few
milliseconds and has no rate limit. Only what the game needs is here: finding the bulbs, reading
them, setting colour and power, and the waveforms behind breathe and pulse.

Writes go out without waiting: a bulb on Wi-Fi takes from a few to a few hundred milliseconds to
answer, and a flash timed to a hit cannot wait behind another bulb's acknowledgement. A listener
thread hears the acknowledgements instead, and every answer is a measure of how long that bulb takes
(`latency`), which the bridge uses to send each bulb its message early enough.
https://lan.developer.lifx.com/docs
"""
import errno
import random
import socket
import struct
import threading
import time
from collections import deque
from statistics import median

PORT = 56700
GET_SERVICE, STATE_SERVICE, ACKNOWLEDGEMENT = 2, 3, 45
GET, SET_COLOR, SET_WAVEFORM, LIGHT_STATE, SET_LIGHT_POWER = 101, 102, 103, 107, 117
WAVEFORMS = {"breathe": 1, "pulse": 4}  # SINE and PULSE
LIGHT_STATE_FORMAT = "<HHHHhH32sQ"


def packet(kind: int, payload: bytes = b"", target: str | None = None, source: int = 2, sequence: int = 0,
           ack: bool = False, response: bool = False) -> bytes:
    """A message: frame, frame address and protocol header, then the payload."""
    flags = 1024 | (1 << 12) | (0 if target else 1 << 13)
    serial = bytes.fromhex(target) + b"\0\0" if target else b"\0" * 8
    header = struct.pack("<HHI", 36 + len(payload), flags, source)
    header += serial + b"\0" * 6 + struct.pack("<BB", (2 if ack else 0) | (1 if response else 0), sequence)
    header += struct.pack("<QHH", 0, kind, 0)
    return header + payload


def parse(data: bytes):
    """(kind, serial, sequence, payload) of a message from a bulb."""
    if len(data) < 36:
        return None
    sequence = data[23]
    kind = struct.unpack_from("<H", data, 32)[0]
    return kind, data[8:14].hex(), sequence, data[36:]


def hsbk(color: dict) -> tuple[int, int, int, int]:
    return (round(color.get("hue", 0) % 360 / 360 * 65535), round(color.get("saturation", 0) * 65535),
            round(color.get("brightness", 1) * 65535), int(color.get("kelvin", 3500)))


def light_state(payload: bytes) -> dict:
    hue, saturation, brightness, kelvin, _, power, label, _ = struct.unpack_from(LIGHT_STATE_FORMAT, payload)
    return {"label": label.rstrip(b"\0").decode("utf-8", "replace"), "power": "on" if power else "off",
            "color": {"hue": round(hue / 65535 * 360, 1), "saturation": round(saturation / 65535, 4), "kelvin": kelvin},
            "brightness": round(brightness / 65535, 4), "connected": True}


def broadcasts() -> list[str]:
    """Where to ask who is there: this machine's /24 and the limited broadcast (macOS refuses that one)."""
    found = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 9))  # No packet is sent: this only picks the outgoing interface.
            found.append(probe.getsockname()[0].rsplit(".", 1)[0] + ".255")
    except OSError:
        pass
    return [*found, "255.255.255.255"]


def color_payload(color: dict, ms: int) -> bytes:
    return struct.pack("<BHHHHI", 0, *hsbk(color), ms)


def power_payload(on: bool, ms: int) -> bytes:
    return struct.pack("<HI", 65535 if on else 0, ms)


def waveform_payload(kind: str, color: dict, period: float, cycles: float, peak: float | None) -> bytes:
    skew = round(((0.5 if peak is None else peak) * 65535) - 32768)
    return struct.pack("<BBHHHHIfhB", 0, 1, *hsbk(color), int(period * 1000), float(cycles), max(-32768, min(32767, skew)), WAVEFORMS[kind])


def one_way(trips) -> float | None:
    """How long a message takes to reach a bulb, from its last round trips (seconds).

    A bulb on Wi-Fi sleeps between the router's beacons, so the router holds what goes *to* it (from
    nothing to a couple of beacons, ~100 ms each); what it sends back goes at once. The quickest trip
    had no wait, so half of it is the way back, and the typical trip less that is the way there.
    """
    trips = list(trips)
    if len(trips) < 3:
        return None
    return max(0.0, median(trips) - min(trips) / 2)


class LanBulbs:
    """The bulbs that answered on this network, by serial (the id the cloud API uses too).

    macOS's Local Network privacy can let a program broadcast but not reach a single address on
    the network ("No route to host"): then every message goes to the network's broadcast address,
    still addressed to its bulb by serial, and only that bulb takes it.
    """

    HEARD_SECONDS = 10
    #: Round trips kept per bulb for `latency`: enough for a median, few enough to follow the Wi-Fi.
    TRIPS = 24
    #: A message nobody acknowledged in this long is not coming back.
    FORGET_SECONDS = 2

    def __init__(self, targets: list[str] | None = None, timeout: float = 0.25):
        self.targets = targets or broadcasts()
        self.timeout = timeout
        self.addresses: dict[str, str] = {}
        #: When each bulb last answered: on Wi-Fi a bulb may miss a read and still be there.
        self.heard: dict[str, float] = {}
        #: Where messages go when this program may only broadcast (see above), else None.
        self.broadcast: str | None = None
        self.reach: str | None = None
        self.source = random.randint(2, 2**31)
        self.sequence = 0
        #: The last round trips of each bulb, in seconds (`latency`).
        self.trips: dict[str, deque] = {}
        #: Messages sent without waiting, by (serial, sequence), and when they left.
        self.waiting: dict[tuple[str, int], float] = {}
        self.lock = threading.Lock()
        #: The socket writes go out on, heard by `_listen` (opened with the first write).
        self.link = None

    def _socket(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(0.02)
        return sock

    @property
    def answered(self) -> set[str]:
        """The bulbs heard from lately: only these are reached on the LAN."""
        now = time.monotonic()
        return {serial for serial, at in self.heard.items() if now - at < self.HEARD_SECONDS}

    def latency(self, serial: str) -> float | None:
        """Seconds a message takes to reach this bulb (`one_way`), None until it has answered a few."""
        with self.lock:
            return one_way(self.trips.get(serial, ()))

    def _trip(self, serial: str, took: float):
        with self.lock:
            self.trips.setdefault(serial, deque(maxlen=self.TRIPS)).append(took)
        self.heard[serial] = time.monotonic()

    def _deliver(self, sock, message: bytes, serial: str):
        if serial not in self.addresses:
            return
        if not self.broadcast:
            try:
                sock.sendto(message, (self.addresses[serial], PORT))
                return
            except OSError as error:
                if error.errno not in (errno.EHOSTUNREACH, errno.EPERM, errno.EACCES) or not self.reach:
                    return
                self.broadcast = self.reach
        try:
            sock.sendto(message, (self.broadcast, PORT))
        except OSError:
            pass

    def _exchange(self, messages: dict[str, bytes], answer: int, timeout: float | None = None) -> dict[str, tuple]:
        """Sends one message per bulb and collects the answers of kind `answer`, sending again once to
        whoever stays quiet past half the timeout."""
        replies: dict[str, tuple] = {}
        timeout = timeout or self.timeout
        first: dict[str, float] = {}
        with self._socket() as sock:
            for attempt in range(2):
                for serial, message in messages.items():
                    if serial not in replies and serial in self.addresses:
                        first.setdefault(serial, time.monotonic())
                        self._deliver(sock, message, serial)
                end = time.monotonic() + timeout / 2
                while time.monotonic() < end and len(replies) < len(messages):
                    try:
                        data, _ = sock.recvfrom(1024)
                    except (TimeoutError, socket.timeout):
                        continue
                    except OSError:
                        break
                    message = parse(data)
                    if message and message[0] == answer and message[1] in messages and message[1] not in replies:
                        replies[message[1]] = message
                        # A trip only counts while nothing was sent again: the answer could be to either.
                        if attempt == 0:
                            self._trip(message[1], time.monotonic() - first[message[1]])
                if len(replies) == len(messages):
                    break
        return replies

    def discover(self, wait: float = 0.6) -> dict[str, str]:
        found: dict[str, str] = {}
        with self._socket() as sock:
            for target in self.targets:
                try:
                    sock.sendto(packet(GET_SERVICE, source=self.source, response=True), (target, PORT))
                except OSError:
                    continue
                self.reach = self.reach or target
            end = time.monotonic() + wait
            while time.monotonic() < end:
                try:
                    data, (address, _) = sock.recvfrom(1024)
                except (TimeoutError, socket.timeout):
                    continue
                except OSError:
                    break
                message = parse(data)
                if message and message[0] == STATE_SERVICE:
                    found[message[1]] = address
        if found:
            self.addresses = found
        return found

    def _next(self) -> int:
        with self.lock:
            self.sequence = (self.sequence + 1) % 256
            return self.sequence

    def _linked(self):
        if self.link is None:
            self.link = self._socket()
            self.link.settimeout(0.5)
            threading.Thread(target=self._listen, args=(self.link,), name="lifx-answers", daemon=True).start()
        return self.link

    def _listen(self, sock):
        """Hears what the bulbs answer to `post`: each answer is a round trip for `latency`."""
        while self.link is sock:
            try:
                data, _ = sock.recvfrom(1024)
            except (TimeoutError, socket.timeout):
                self._forget()
                continue
            except OSError:
                return
            self.heard_answer(parse(data))

    def heard_answer(self, message):
        if not message:
            return
        _, serial, sequence, _ = message
        with self.lock:
            sent = self.waiting.pop((serial, sequence), None)
        if sent is not None:
            self._trip(serial, time.monotonic() - sent)

    def _forget(self):
        now = time.monotonic()
        with self.lock:
            self.waiting = {key: at for key, at in self.waiting.items() if now - at < self.FORGET_SECONDS}

    def post(self, serial: str, kind: int, payload: bytes = b"", response: bool = False) -> tuple[str, int]:
        """Sends one message to a bulb and goes on: `_listen` hears its acknowledgement (or, with
        `response`, its answer). Returns what `acknowledged` asks about."""
        sequence = self._next()
        with self.lock:
            self.waiting[(serial, sequence)] = time.monotonic()
        self._deliver(self._linked(), packet(kind, payload, serial, self.source, sequence, ack=not response, response=response), serial)
        return serial, sequence

    def acknowledged(self, sent: tuple[str, int]) -> bool:
        with self.lock:
            return sent not in self.waiting

    def probe(self, serial: str):
        """Asks a bulb how it is, only to time its answer."""
        return self.post(serial, GET, response=True)

    def read(self) -> list[dict]:
        """Every bulb as the cloud API would list it."""
        messages = {serial: packet(GET, target=serial, source=self.source, sequence=self._next(), response=True)
                    for serial in self.addresses}
        replies = self._exchange(messages, LIGHT_STATE)
        self.heard.update({serial: time.monotonic() for serial in replies})
        return [{"id": serial, **light_state(payload)} for serial, (_, _, _, payload) in replies.items()]

    def set(self, serials: list[str], color: dict | None, power: bool | None, duration: float) -> list[tuple[str, int]]:
        """Colour first, then power: a bulb coming on fades in already in its new colour. Nothing waits."""
        ms = int(duration * 1000)
        sent = []
        for serial in serials:
            if color is not None:
                sent.append(self.post(serial, SET_COLOR, color_payload(color, ms)))
            if power is not None:
                sent.append(self.post(serial, SET_LIGHT_POWER, power_payload(power, ms)))
        return sent

    def waveform(self, serials: list[str], kind: str, color: dict, period: float, cycles: float, peak: float | None) -> list[tuple[str, int]]:
        """Breathe or pulse towards `color` and back (transient), like the cloud API's effects. A flash
        is never sent twice: a second copy arriving late would start it over."""
        payload = waveform_payload(kind, color, period, cycles, peak)
        sent = []
        for serial in serials:
            sent.append(self.post(serial, SET_WAVEFORM, payload))
            # Turned off, a bulb would play it in the dark: the cloud's power_on does the same.
            sent.append(self.post(serial, SET_LIGHT_POWER, power_payload(True, 0)))
        return sent


if __name__ == "__main__":
    # `just lights-latency`: how long each bulb at home takes, read-only (it only asks them how they are).
    import sys
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    bulbs = LanBulbs()
    if not bulbs.discover(1.0):
        sys.exit("No bulbs answered on this network.")
    names = {bulb["id"]: bulb["label"] for bulb in bulbs.read()}
    for _ in range(rounds):
        for serial in bulbs.addresses:
            bulbs.probe(serial)
        time.sleep(0.4)
    time.sleep(0.5)
    for serial in sorted(bulbs.addresses, key=lambda s: names.get(s, s)):
        trips = sorted(bulbs.trips.get(serial, ()))
        if not trips:
            print(f"{names.get(serial, serial):10}  no answer")
            continue
        p90 = trips[min(len(trips) - 1, int(len(trips) * 0.9))]
        print(f"{names.get(serial, serial):10}  reaches it in {bulbs.latency(serial) * 1000 if bulbs.latency(serial) is not None else float('nan'):5.0f} ms"
              f"   round trip: quickest {trips[0] * 1000:4.0f}, typical {median(trips) * 1000:4.0f}, slow (p90) {p90 * 1000:4.0f} ms   ({len(trips)} answers)")
