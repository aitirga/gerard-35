"""Serve the game and persist each browser's progress on the mounted volume."""
import os
from contextlib import contextmanager
import sqlite3
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI()


@contextmanager
def connect():
    path = Path(os.environ.get("DATABASE_PATH", "data/game.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    try:
        with db:
            db.execute("CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, score INTEGER NOT NULL)")
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
        row = db.execute("SELECT score FROM players WHERE id = ?", (token,)).fetchone()
    return {"score": row[0] if row else 0}


class State(BaseModel):
    score: int = Field(strict=True, ge=0, le=2147483647)


@app.put("/api/state")
def save_state(state: State, request: Request, response: Response):
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site writes are not allowed")
    token = player(request, response)
    with connect() as db:
        # Late requests or another tab must never erase already saved progress.
        db.execute("INSERT INTO players VALUES (?, ?) ON CONFLICT(id) DO UPDATE "
                   "SET score = MAX(players.score, excluded.score)", (token, state.score))
        score = db.execute("SELECT score FROM players WHERE id = ?", (token,)).fetchone()[0]
    response.headers["Cache-Control"] = "no-store"
    return {"score": score}


app.mount("/", StaticFiles(directory="dist", html=True, check_dir=False), name="game")
