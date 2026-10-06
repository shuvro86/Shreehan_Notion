"""One-time explicit provisioning. Password comes from a prompt, never from source."""
import getpass
import os
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.auth import hash_password
from backend.db import connection, initialize_database, now


def provision(password):
    if len(password) < 6:
        raise ValueError("Password must have at least six characters.")
    initialize_database()
    with connection() as db:
        row = db.execute("SELECT id FROM users WHERE username='teacher' COLLATE NOCASE").fetchone()
        if row:
            if not db.execute("SELECT user_id FROM teachers WHERE user_id=?", (row['id'],)).fetchone():
                raise RuntimeError("An existing non-teacher account uses this name; refusing to elevate it.")
            print("Teacher already provisioned; password unchanged.")
            return
        user_id, timestamp = str(uuid4()), now()
        # Reserved non-deliverable address: the teacher's personal email was not supplied.
        db.execute("INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, "teacher", "teacher@accounts.invalid", hash_password(password), timestamp, timestamp))
        db.execute("INSERT INTO teachers VALUES (?)", (user_id,))
    print("Teacher provisioned successfully.")


if __name__ == '__main__':
    provision(os.environ.get('TEACHER_INITIAL_PASSWORD') or getpass.getpass('Initial teacher password: '))
