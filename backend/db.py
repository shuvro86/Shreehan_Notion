"""SQLite initialization and account-scoped application data."""
from __future__ import annotations

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = ["Ideas", "Up next", "In progress", "Review", "Done"]
SAMPLE_CARDS = [
    [("Build a better morning routine", "Pick a calm start that leaves room for breakfast, a little reading, and getting ready without rushing."), ("Make a mini weather journal", "Notice the sky each day and draw one small picture of the weather.")],
    [("Choose a book for this week", "Find a story that sounds fun and read a few pages together."), ("Plan a paper airplane challenge", "Fold three designs and see which one flies the farthest.")],
    [("Create a neighbourhood map", "Add the park, the library, and a path between a few favourite places."), ("Practise multiplication facts", "Try a short round of the 2, 5, and 10 times tables each afternoon.")],
    [("Finish the solar system poster", "Check the planet order, add labels, and make sure every planet has a colour.")],
    [("Organise the art supplies", "Put pencils, paper, and paints back in their home so the next idea is easy to start."), ("Read a story aloud", "Take turns reading and share a favourite part at the end.")],
]
SAMPLE_TASKS = [("Revise fractions & decimals", "Mathematics", "High", 0), ("Finish the science worksheet", "Science", "Medium", 0), ("Read the next literature chapter", "English Literature", "Low", 1)]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def database_path() -> Path:
    return Path(os.getenv("DATABASE_PATH", ROOT / "data/shreehan.db")).resolve()


@contextmanager
def connection():
    if os.getenv("TURSO_DATABASE_URL"):
        from backend.remote_db import Connection
        db = Connection(os.environ["TURSO_DATABASE_URL"], os.environ["TURSO_AUTH_TOKEN"])
    else:
        if os.getenv("VERCEL"):
            raise RuntimeError("Persistent database credentials are required on Vercel")
        path = database_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(path, timeout=10)
        db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_database():
    with connection() as db:
        if not os.getenv("TURSO_DATABASE_URL"):
            db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS cloud_content (key TEXT PRIMARY KEY, value BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT, verified_at TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS otp_challenges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL CHECK(purpose IN ('signup','password_reset')), code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS columns (id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 4), name TEXT NOT NULL, UNIQUE(board_id, position));
        CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE, position INTEGER NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS dashboard_tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, subject TEXT NOT NULL, priority TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS practice_progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL, known INTEGER NOT NULL, PRIMARY KEY(user_id,item_id));
        CREATE INDEX IF NOT EXISTS ix_otp_user_purpose ON otp_challenges(user_id,purpose,created_at);
        CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS ix_columns_board ON columns(board_id,position);
        CREATE INDEX IF NOT EXISTS ix_cards_column ON cards(column_id,position);
        CREATE INDEX IF NOT EXISTS ix_tasks_user ON dashboard_tasks(user_id,position);
        """)
        columns = {row["name"] for row in db.execute("PRAGMA table_info(sessions)")}
        if "last_active_at" not in columns:
            db.execute("ALTER TABLE sessions ADD COLUMN last_active_at TEXT")
            db.execute("UPDATE sessions SET last_active_at=created_at")
        db.execute("CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions(expires_at)")
        if not os.getenv("TURSO_DATABASE_URL"):
            db.execute("PRAGMA user_version=2")


def create_starter_data(db: sqlite3.Connection, user_id: str):
    board_id = str(uuid.uuid4())
    timestamp = now()
    db.execute("INSERT INTO boards VALUES (?,?,?,?)", (board_id, user_id, "My project board", timestamp))
    for index, name in enumerate(NAMES):
        column_id = str(uuid.uuid4())
        db.execute("INSERT INTO columns VALUES (?,?,?,?)", (column_id, board_id, index, name))
        for position, (title, details) in enumerate(SAMPLE_CARDS[index]):
            db.execute("INSERT INTO cards VALUES (?,?,?,?,?,?,?)", (str(uuid.uuid4()), column_id, position, title, details, timestamp, timestamp))
    for position, (title, subject, priority, done) in enumerate(SAMPLE_TASKS):
        db.execute("INSERT INTO dashboard_tasks VALUES (?,?,?,?,?,?,?)", (str(uuid.uuid4()), user_id, title, subject, priority, done, position))


def get_board(db: sqlite3.Connection, user_id: str):
    board = db.execute("SELECT id FROM boards WHERE user_id=?", (user_id,)).fetchone()
    if not board:
        return []
    columns = db.execute("SELECT id,name FROM columns WHERE board_id=? ORDER BY position", (board["id"],)).fetchall()
    return [{"id": c["id"], "name": c["name"], "cards": [{"id": row["id"], "title": row["title"], "details": row["details"]} for row in db.execute("SELECT id,title,details FROM cards WHERE column_id=? ORDER BY position", (c["id"],))]} for c in columns]


def get_tasks(db: sqlite3.Connection, user_id: str):
    return [{"id": row["id"], "title": row["title"], "subject": row["subject"], "priority": row["priority"], "done": bool(row["done"])} for row in db.execute("SELECT * FROM dashboard_tasks WHERE user_id=? ORDER BY position", (user_id,))]
