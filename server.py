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
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ai import decision_provider, plan_enemy_turn
from lights import router as lights_router

app = FastAPI()
logger = logging.getLogger("uvicorn.error")
# Story progress flags, in story order. Keep in sync with STORY_FLAGS in src/story.ts (a test checks it).
STORY_FLAGS = ("intro", "met-jan", "got-shoes", "got-potion", "got-backpack", "bernat-joined", "bernat-stalled", "dejavu", "minion", "first-fight", "palace", "in-palace", "got-chicle", "noista", "wrapper-room", "caught", "got-wrapper", "tv-news", "metro", "rec-comtal", "castle", "palace-tried", "clue-r4", "anima-nuria", "anima-uri", "papagato", "papagato-2", "papagato-3", "cardedeu", "nuria-uri", "luz-nuria", "luz-uri", "luz-nil")


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


def known_flags(flags):
    return [flag for flag in STORY_FLAGS if flag in flags]


class Clock(BaseModel):
    day: int = Field(strict=True, ge=1, le=999)
    hour: int = Field(strict=True, ge=0, le=24)


class Morning(BaseModel):
    day: int = Field(strict=True, ge=1, le=999)
    story: list[Literal[STORY_FLAGS]] = Field(max_length=len(STORY_FLAGS))


class Days(BaseModel):
    """Chapter 2's countdown (src/days.ts). `epoch` grows when the player goes back a day."""
    epoch: int = Field(strict=True, ge=0, le=1000000)
    clock: Clock
    mornings: list[Morning] = Field(default_factory=list, max_length=2)


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
    incoming = state.days.model_dump() if state.days else None
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


app.include_router(lights_router)
app.mount("/",StaticFiles(directory="dist", html=True, check_dir=False), name="game")
