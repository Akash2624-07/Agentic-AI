"""SQLite store for runs: one row per run, per replayed week and per registry event."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    policy TEXT NOT NULL,
    mode TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS weeks (
    run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    detail TEXT NOT NULL,
    PRIMARY KEY (run_id, week)
);
CREATE TABLE IF NOT EXISTS events (
    run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    event TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(config.DB_PATH, timeout=30)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def now() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def save(run_id: str, policy: str, mode: str, replay, created_at: str | None = None) -> None:
    """Write (or overwrite) a run with everything the replay has done so far."""
    with connect() as conn:
        row = conn.execute("SELECT created_at FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        created = row[0] if row else (created_at or now())
        conn.execute("DELETE FROM runs WHERE run_id = ?", (run_id,))
        conn.execute("INSERT INTO runs VALUES (?, ?, ?, ?)", (run_id, policy, mode, created))
        conn.executemany(
            "INSERT INTO weeks VALUES (?, ?, ?)",
            [(run_id, w, json.dumps(d, default=_jsonable)) for w, d in sorted(replay.weeks.items())],
        )
        conn.executemany(
            "INSERT INTO events VALUES (?, ?, ?)",
            [(run_id, e["seq"], json.dumps(e, default=_jsonable)) for e in replay.events],
        )


def _jsonable(o):
    if hasattr(o, "item"):
        return o.item()
    if isinstance(o, set):
        return sorted(o)
    raise TypeError(f"not JSON serialisable: {type(o).__name__}")


def runs() -> list[dict]:
    order = {p: i for i, p in enumerate(config.POLICY_NAMES)}
    with connect() as conn:
        rows = conn.execute("SELECT run_id, policy, mode, created_at FROM runs").fetchall()
    out = [{"run_id": r[0], "policy": r[1], "mode": r[2], "created_at": r[3]} for r in rows]
    evals = sorted((r for r in out if r["mode"] == "eval"), key=lambda r: order.get(r["policy"], 99))
    lives = sorted((r for r in out if r["mode"] != "eval"), key=lambda r: r["created_at"], reverse=True)
    return evals + lives


def run(run_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT run_id, policy, mode, created_at FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    return None if row is None else {"run_id": row[0], "policy": row[1], "mode": row[2], "created_at": row[3]}


def weeks(run_id: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT detail FROM weeks WHERE run_id = ? ORDER BY week", (run_id,)
        ).fetchall()
    return [json.loads(r[0]) for r in rows]


def week(run_id: str, week: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT detail FROM weeks WHERE run_id = ? AND week = ?", (run_id, week)
        ).fetchone()
    return None if row is None else json.loads(row[0])


def events(run_id: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT event FROM events WHERE run_id = ? ORDER BY seq", (run_id,)
        ).fetchall()
    return [json.loads(r[0]) for r in rows]
