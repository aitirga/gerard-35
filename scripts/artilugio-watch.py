"""Watch the artilugio from any computer at home (`just artilugio-watch`).

What its server hears (artilugio.py's event stream): each note, pair and movement, and the board
coming and going with its mode; and what the board itself says (its /health): whether it has been
found since the story sent it. The server is the board's own (SERVER_URL in
firmware/artilugio/secrets.h) unless another is given. Ctrl-C to stop.
"""
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.request
from pathlib import Path

# The same tables as firmware/artilugio/notes.h and src/castle.ts (ARTILUGIO_NOTES, MELODY).
NOTES = ["Sol", "Si", "Re", "Fa", "La♭", "Do", "Mi♭", "Sol agudo"]
BUTTONS = ["rojo", "amarillo", "verde", "azul"]
PAIRS = [(0, 1), (1, 2), (2, 3), (3, 0)]
MELODY = [0, 4, 5, 7, 3, 2]
ANSI = ["31", "33", "32", "34"]

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def say(text: str, colour: str | None = None):
    if COLOR and colour:
        text = f"\033[{colour}m{text}\033[0m"
    print(f"{time.strftime('%H:%M:%S')}  {text}", flush=True)


def default_server() -> str:
    secrets = Path(__file__).resolve().parent.parent / "firmware/artilugio/secrets.h"
    found = re.search(r'^#define SERVER_URL "(.*)"', secrets.read_text(), re.M) if secrets.exists() else None
    return found.group(1) if found else "http://127.0.0.1:8035"


def note(n: int, played: list[int]):
    if n < len(BUTTONS):
        say(f"● {NOTES[n]:<10} {BUTTONS[n]}", ANSI[n])
    else:
        a, b = PAIRS[n - len(BUTTONS)]
        say(f"◐ {NOTES[n]:<10} {BUTTONS[a]} + {BUTTONS[b]}", "1")
    played.append(n)
    del played[:-len(MELODY)]
    if played == MELODY:
        say("♪ la melodía, entera", "1")


def events(server: str):
    """The server's stream, again and again if it drops; says so only when that changes."""
    url = server.rstrip("/") + "/api/artilugio/events"
    board: tuple | None = None
    reachable: bool | None = None
    played: list[int] = []
    while True:
        try:
            with urllib.request.urlopen(url, timeout=15) as stream:
                if reachable is not True:
                    say(f"servidor {server}: escuchando")
                reachable = True
                for raw in stream:
                    line = raw.decode("utf-8", "replace").strip()
                    if not line.startswith("data:"):
                        continue
                    event = json.loads(line[5:])
                    if event.get("type") == "note":
                        note(event["note"], played)
                    elif event.get("type") == "motion":
                        say("· alguien delante", "2")
                    elif event.get("type") == "board":
                        now = (event.get("connected"), event.get("mode"))
                        if now != board:
                            say(f"placa {'conectada' if now[0] else 'desconectada'} · modo {now[1]}", "1")
                        board = now
        except Exception as error:  # a dropped stream, a server restarting, no network
            if reachable is not False:
                say(f"servidor {server}: sin respuesta ({getattr(error, 'reason', error)}); sigo intentándolo")
            reachable = False
        time.sleep(3)


STARTED = {"power": "al enchufarla", "restart": "tras una actualización", "brownout": "por una bajada de corriente",
           "crash": "por un fallo", "watchdog": "por quedarse colgada"}
# The ESP32's reasons for losing the Wi-Fi (wifi_err_reason_t), the usual ones.
DROPPED = {2: "caducó la autenticación", 4: "caducó la conexión", 8: "se desconectó ella", 15: "el router no completó el saludo",
           200: "dejó de oír al router", 201: "no encuentra la red", 202: "contraseña rechazada"}


def health(board: str):
    """The board's own word every two seconds: found or not, restarts and why, and whether it answers at all."""
    last: dict | None = None
    up = None
    while True:
        try:
            host = socket.getaddrinfo(board, 80, socket.AF_INET)[0][4][0]
            with urllib.request.urlopen(f"http://{host}/health", timeout=3) as response:
                now = json.load(response)
            why = STARTED.get(now.get("started"), "por otra causa")
            if up is None and "up" in now:
                say(f"placa {now.get('ip')}: encendida hace {now['up'] // 60} min {now['up'] % 60} s, {why} · Wi-Fi {now.get('rssi')} dBm")
            elif up is not None and now.get("up", 0) < up:
                say(f"placa {now.get('ip')}: se ha reiniciado, {why}", "1")
                last = None
            up = now.get("up", up)
            if last and now.get("drops", 0) > last.get("drops", 0):
                say(f"placa: perdió el Wi-Fi ({DROPPED.get(now.get('lastDrop'), 'motivo ' + str(now.get('lastDrop')))}) · señal {now.get('rssi')} dBm", "1")
            if now.get("slowest", 0) > 1000:
                say(f"placa: se quedó parada {now['slowest'] / 1000:.1f} s", "1")
            if "pir" in now and (not last or now["pir"] != last.get("pir")):
                say(f"sensor: {'ve a alguien' if now['pir'] else 'no ve a nadie'}", "2")
            if not last or now.get("found") != last.get("found"):
                say(f"placa {now.get('ip')}: {'encontrada' if now.get('found') else 'sin encontrar'}", "1")
            last = now
        except Exception:
            if last != {}:
                say(f"placa {board}: no responde")
            last = {}
        time.sleep(2)


def main():
    server = (sys.argv[1] if len(sys.argv) > 1 else "") or default_server()
    board = (sys.argv[2] if len(sys.argv) > 2 else "") or "artilugio.local"
    say(f"el artilugio · servidor {server} · placa {board} · Ctrl-C para salir")
    threading.Thread(target=health, args=(board,), daemon=True).start()
    try:
        events(server)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
