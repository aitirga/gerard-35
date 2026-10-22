"""LIFX's LAN protocol, for the bulbs on the home network (docs/home-lights.md).

The cloud API takes up to a second to reach a bulb; on the same network a UDP message takes a few
milliseconds and has no rate limit. Only what the game needs is here: finding the bulbs, reading
them, setting colour and power, and the waveforms behind breathe and pulse.
https://lan.developer.lifx.com/docs
"""
import random
import socket
import struct
import time

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


class LanBulbs:
    """The bulbs that answered on this network, by serial (the id the cloud API uses too)."""

    def __init__(self, targets: list[str] | None = None, timeout: float = 0.25):
        self.targets = targets or broadcasts()
        self.timeout = timeout
        self.addresses: dict[str, str] = {}
        self.source = random.randint(2, 2**31)
        self.sequence = 0

    def _socket(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(0.02)
        return sock

    def _exchange(self, messages: dict[str, bytes], answer: int, timeout: float | None = None) -> dict[str, tuple]:
        """Sends one message per bulb and collects the answers of kind `answer`, sending again once to
        whoever stays quiet past half the timeout."""
        replies: dict[str, tuple] = {}
        timeout = timeout or self.timeout
        with self._socket() as sock:
            for attempt in range(2):
                for serial, message in messages.items():
                    if serial not in replies:
                        try:
                            sock.sendto(message, (self.addresses[serial], PORT))
                        except (OSError, KeyError):
                            pass
                end = time.monotonic() + timeout / 2
                while time.monotonic() < end and len(replies) < len(messages):
                    try:
                        data, _ = sock.recvfrom(1024)
                    except (TimeoutError, socket.timeout):
                        continue
                    except OSError:
                        break
                    message = parse(data)
                    if message and message[0] == answer and message[1] in messages:
                        replies[message[1]] = message
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
        self.sequence = (self.sequence + 1) % 256
        return self.sequence

    def read(self) -> list[dict]:
        """Every bulb as the cloud API would list it."""
        messages = {serial: packet(GET, target=serial, source=self.source, sequence=self._next(), response=True)
                    for serial in self.addresses}
        replies = self._exchange(messages, LIGHT_STATE)
        return [{"id": serial, **light_state(payload)} for serial, (_, _, _, payload) in replies.items()]

    def set(self, serials: list[str], color: dict | None, power: bool | None, duration: float):
        """Colour first, then power: a bulb coming on fades in already in its new colour."""
        ms = int(duration * 1000)
        if color is not None:
            self._exchange({s: packet(SET_COLOR, struct.pack("<BHHHHI", 0, *hsbk(color), ms), s, self.source, self._next(), ack=True)
                            for s in serials}, ACKNOWLEDGEMENT)
        if power is not None:
            self._exchange({s: packet(SET_LIGHT_POWER, struct.pack("<HI", 65535 if power else 0, ms), s, self.source, self._next(), ack=True)
                            for s in serials}, ACKNOWLEDGEMENT)

    def waveform(self, serials: list[str], kind: str, color: dict, period: float, cycles: float, peak: float | None):
        """Breathe or pulse towards `color` and back (transient), like the cloud API's effects."""
        skew = round(((0.5 if peak is None else peak) * 65535) - 32768)
        payload = struct.pack("<BBHHHHIfhB", 0, 1, *hsbk(color), int(period * 1000), float(cycles), max(-32768, min(32767, skew)), WAVEFORMS[kind])
        self._exchange({s: packet(SET_WAVEFORM, payload, s, self.source, self._next(), ack=True) for s in serials}, ACKNOWLEDGEMENT)
        # Turned off, a bulb would play it in the dark: the cloud's power_on does the same.
        self._exchange({s: packet(SET_LIGHT_POWER, struct.pack("<HI", 65535, 0), s, self.source, self._next(), ack=True)
                        for s in serials}, ACKNOWLEDGEMENT)
