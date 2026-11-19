"""El artilugio (docs/story-outline.md § The device): the Bomba-G board hidden in the real flat.

The board never takes a connection from the game. It sends each note it plays and each movement its
PIR sees here, and every half second asks what it is meant to be: asleep (mute, until the portal at
El Nucli sends it), alive (it sounds and is heard), awake (the Queen's last fight: its colours burst)
or free (after it). That answer also carries the times the game asked it to sound (Escuchar).
The browser hears its notes as server-sent events and tells this server what the story says it is.

The board's calls carry ARTILUGIO_KEY in `x-artilugio-key` (firmware/artilugio/secrets.h). Without a
key a server at home takes any board; one reachable from the internet (Fly) takes none.
"""
import asyncio
import json
import os
import secrets
import time
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

Mode = Literal["asleep", "alive", "awake", "free"]
NOTES = 8
# The board asks every half second: three without a word and it is gone.
GONE_AFTER = 3.0
# How often an open stream checks whether the board came or went, and says it is still there.
TICK = 2.0


class Board:
    """What the board is meant to be, when it was last heard from, and the browsers listening."""

    def __init__(self):
        self.mode: Mode = "asleep"
        self.seen = 0.0
        self.listen = 0
        self.streams: set[asyncio.Queue] = set()

    @property
    def connected(self) -> bool:
        return time.monotonic() - self.seen < GONE_AFTER

    def status(self) -> dict:
        return {"type": "board", "mode": self.mode, "connected": self.connected}

    def publish(self, event: dict):
        for stream in list(self.streams):
            try:
                stream.put_nowait(event)
            except asyncio.QueueFull:
                # A browser that stopped reading misses notes rather than holding the board up.
                pass


board = Board()
router = APIRouter()


def from_board(request: Request):
    key = os.environ.get("ARTILUGIO_KEY")
    if key and not secrets.compare_digest(request.headers.get("x-artilugio-key", ""), key):
        raise HTTPException(403, "The artilugio needs its key")
    if not key and os.environ.get("FLY_APP_NAME"):
        raise HTTPException(403, "The artilugio needs its key")
    board.seen = time.monotonic()


def from_game(request: Request):
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site requests are not allowed")


@router.get("/api/artilugio/board", response_class=PlainTextResponse)
async def board_asks(request: Request):
    """The board's half-second question: `<mode> <times to sound>`, plain so the firmware reads it
    without a JSON library."""
    from_board(request)
    listen, board.listen = board.listen, 0
    return f"{board.mode} {listen}\n"


@router.post("/api/artilugio/note", status_code=204)
async def board_note(request: Request, n: int = Query(ge=0, lt=NOTES)):
    """A note the board played: a button alone (0–3) or a pair (4–7). Asleep, nobody hears it."""
    from_board(request)
    if board.mode != "asleep":
        board.publish({"type": "note", "note": n})


@router.post("/api/artilugio/motion", status_code=204)
async def board_motion(request: Request):
    """Its PIR saw someone: the game has Gerard take it out."""
    from_board(request)
    if board.mode != "asleep":
        board.publish({"type": "motion"})


class Story(BaseModel):
    mode: Mode


@router.get("/api/artilugio")
async def read_board(request: Request):
    from_game(request)
    return board.status()


@router.put("/api/artilugio", status_code=204)
async def set_mode(story: Story, request: Request):
    """What the story says the board is now."""
    from_game(request)
    if story.mode != board.mode:
        board.mode = story.mode
        board.publish(board.status())


@router.post("/api/artilugio/listen", status_code=204)
async def listen(request: Request):
    """Escuchar: the board sounds in the real flat the next time it asks."""
    from_game(request)
    if board.mode != "asleep":
        board.listen += 1


@router.get("/api/artilugio/events")
async def events(request: Request):
    """The board's notes, movements and comings and goings, as they happen."""
    from_game(request)
    stream: asyncio.Queue = asyncio.Queue(maxsize=64)
    board.streams.add(stream)

    async def send():
        try:
            last = board.status()
            yield f"data: {json.dumps(last)}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(stream.get(), TICK)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        return
                    now = board.status()
                    if now != last:
                        last = now
                        yield f"data: {json.dumps(now)}\n\n"
                    else:
                        yield ": still here\n\n"
                    continue
                if event["type"] == "board":
                    last = event
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            board.streams.discard(stream)

    return StreamingResponse(send(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
