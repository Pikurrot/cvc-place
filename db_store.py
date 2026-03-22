"""
SQLite persistence for cvc-place with JSON mirror export for debugging.
"""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Any, Optional

_BASE_DIR: Optional[str] = None
_DB_PATH: Optional[str] = None
_USERS_FILE: Optional[str] = None
_PLACEMENTS_FILE: Optional[str] = None
_CONTRIBUTIONS_FILE: Optional[str] = None


def configure(base_dir: str) -> None:
    global _BASE_DIR, _DB_PATH, _USERS_FILE, _PLACEMENTS_FILE, _CONTRIBUTIONS_FILE
    _BASE_DIR = base_dir
    _DB_PATH = os.path.join(base_dir, "cvc_place.db")
    _USERS_FILE = os.path.join(base_dir, "users.json")
    _PLACEMENTS_FILE = os.path.join(base_dir, "placements.json")
    _CONTRIBUTIONS_FILE = os.path.join(base_dir, "contributions.json")


def get_conn() -> sqlite3.Connection:
    if not _DB_PATH:
        raise RuntimeError("db_store.configure() not called")
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            real_name TEXT NOT NULL DEFAULT '',
            points INTEGER NOT NULL,
            total_spent INTEGER NOT NULL DEFAULT 0,
            approved INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS placements (
            file TEXT PRIMARY KEY,
            x REAL NOT NULL,
            y REAL NOT NULL,
            w REAL NOT NULL,
            h REAL NOT NULL,
            username TEXT NOT NULL,
            contributors_json TEXT
        );

        CREATE TABLE IF NOT EXISTS contributions (
            id TEXT PRIMARY KEY,
            file TEXT NOT NULL,
            target INTEGER NOT NULL,
            funded INTEGER NOT NULL DEFAULT 0,
            placed INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS contribution_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contribution_id TEXT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            amount INTEGER NOT NULL
        );
        """
    )
    conn.commit()


def _atomic_write_json(path: str, data: Any) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def export_json_mirror(conn: sqlite3.Connection) -> None:
    if not _USERS_FILE:
        return
    users = []
    for row in conn.execute(
        "SELECT username, password_hash, salt, real_name, points, total_spent, approved FROM users ORDER BY username"
    ):
        users.append(
            {
                "username": row["username"],
                "password_hash": row["password_hash"],
                "salt": row["salt"],
                "real_name": row["real_name"] or "",
                "points": row["points"],
                "total_spent": row["total_spent"],
                "approved": bool(row["approved"]),
            }
        )
    placements = []
    for row in conn.execute(
        "SELECT file, x, y, w, h, username, contributors_json FROM placements ORDER BY file"
    ):
        p: dict[str, Any] = {
            "file": row["file"],
            "x": row["x"],
            "y": row["y"],
            "w": row["w"],
            "h": row["h"],
            "username": row["username"],
        }
        cj = row["contributors_json"]
        if cj:
            try:
                p["contributors"] = json.loads(cj)
            except json.JSONDecodeError:
                p["contributors"] = []
        placements.append(p)

    contribs = []
    for row in conn.execute(
        "SELECT id, file, target, funded, placed FROM contributions ORDER BY rowid"
    ):
        lines = []
        for ln in conn.execute(
            "SELECT username, amount FROM contribution_lines WHERE contribution_id = ? ORDER BY id",
            (row["id"],),
        ):
            lines.append({"username": ln["username"], "amount": ln["amount"]})
        contribs.append(
            {
                "id": row["id"],
                "file": row["file"],
                "target": row["target"],
                "funded": row["funded"],
                "contributors": lines,
                "placed": bool(row["placed"]),
            }
        )

    _atomic_write_json(_USERS_FILE, users)
    _atomic_write_json(_PLACEMENTS_FILE, placements)
    _atomic_write_json(_CONTRIBUTIONS_FILE, contribs)


def migrate_from_legacy_json_if_empty(conn: sqlite3.Connection, admin_username: str) -> None:
    n = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if n > 0:
        export_json_mirror(conn)
        return

    if os.path.exists(_USERS_FILE):
        with open(_USERS_FILE, "r") as f:
            legacy_users = json.load(f)
        for u in legacy_users:
            approved = 0 if u.get("approved") is False else 1
            if u.get("username") == admin_username:
                approved = 1
            conn.execute(
                """INSERT INTO users (username, password_hash, salt, real_name, points, total_spent, approved)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    u["username"],
                    u["password_hash"],
                    u["salt"],
                    u.get("real_name", ""),
                    u["points"],
                    u.get("total_spent", 0),
                    approved,
                ),
            )

    if os.path.exists(_PLACEMENTS_FILE):
        with open(_PLACEMENTS_FILE, "r") as f:
            legacy_p = json.load(f)
        for p in legacy_p:
            cj = None
            if p.get("contributors"):
                cj = json.dumps(p["contributors"])
            conn.execute(
                """INSERT OR REPLACE INTO placements (file, x, y, w, h, username, contributors_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (p["file"], p["x"], p["y"], p["w"], p["h"], p["username"], cj),
            )

    if os.path.exists(_CONTRIBUTIONS_FILE):
        with open(_CONTRIBUTIONS_FILE, "r") as f:
            legacy_c = json.load(f)
        for c in legacy_c:
            conn.execute(
                """INSERT OR REPLACE INTO contributions (id, file, target, funded, placed)
                   VALUES (?, ?, ?, ?, ?)""",
                (c["id"], c["file"], c["target"], c["funded"], 1 if c.get("placed") else 0),
            )
            conn.execute("DELETE FROM contribution_lines WHERE contribution_id = ?", (c["id"],))
            for entry in c.get("contributors", []):
                conn.execute(
                    "INSERT INTO contribution_lines (contribution_id, username, amount) VALUES (?, ?, ?)",
                    (c["id"], entry["username"], entry["amount"]),
                )

    conn.commit()
    export_json_mirror(conn)


def user_get(conn: sqlite3.Connection, username: str) -> Optional[dict[str, Any]]:
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        return None
    return {
        "username": row["username"],
        "password_hash": row["password_hash"],
        "salt": row["salt"],
        "real_name": row["real_name"] or "",
        "points": row["points"],
        "total_spent": row["total_spent"],
        "approved": bool(row["approved"]),
    }


def user_is_approved(conn: sqlite3.Connection, username: str) -> bool:
    row = conn.execute("SELECT approved FROM users WHERE username = ?", (username,)).fetchone()
    return bool(row and row["approved"])


def list_placements(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out = []
    for row in conn.execute(
        "SELECT file, x, y, w, h, username, contributors_json FROM placements ORDER BY file"
    ):
        p: dict[str, Any] = {
            "file": row["file"],
            "x": row["x"],
            "y": row["y"],
            "w": row["w"],
            "h": row["h"],
            "username": row["username"],
        }
        cj = row["contributors_json"]
        if cj:
            try:
                p["contributors"] = json.loads(cj)
            except json.JSONDecodeError:
                p["contributors"] = []
        out.append(p)
    return out


def list_contributions_unplaced(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    out = []
    for row in conn.execute(
        "SELECT id, file, target, funded, placed FROM contributions WHERE placed = 0 ORDER BY rowid"
    ):
        lines = []
        for ln in conn.execute(
            "SELECT username, amount FROM contribution_lines WHERE contribution_id = ? ORDER BY id",
            (row["id"],),
        ):
            lines.append({"username": ln["username"], "amount": ln["amount"]})
        out.append(
            {
                "id": row["id"],
                "file": row["file"],
                "target": row["target"],
                "funded": row["funded"],
                "contributors": lines,
                "placed": False,
            }
        )
    return out


def contribution_get(conn: sqlite3.Connection, cid: str) -> Optional[dict[str, Any]]:
    row = conn.execute(
        "SELECT id, file, target, funded, placed FROM contributions WHERE id = ?", (cid,)
    ).fetchone()
    if not row:
        return None
    lines = []
    for ln in conn.execute(
        "SELECT username, amount FROM contribution_lines WHERE contribution_id = ? ORDER BY id",
        (cid,),
    ):
        lines.append({"username": ln["username"], "amount": ln["amount"]})
    return {
        "id": row["id"],
        "file": row["file"],
        "target": row["target"],
        "funded": row["funded"],
        "placed": bool(row["placed"]),
        "contributors": lines,
    }


def list_pending_users(conn: sqlite3.Connection, admin_username: str) -> list[dict[str, str]]:
    rows = conn.execute(
        "SELECT username, real_name FROM users WHERE approved = 0 AND username != ? ORDER BY username",
        (admin_username or "",),
    ).fetchall()
    return [{"username": r["username"], "real_name": r["real_name"] or ""} for r in rows]


@contextmanager
def mutating_transaction(conn: sqlite3.Connection):
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield
        conn.commit()
        export_json_mirror(conn)
    except Exception:
        conn.rollback()
        raise


