"""Published Notion snapshots and assets shared by all serverless instances."""
import json
from backend.db import connection


def read_bytes(key):
    with connection() as db:
        row = db.execute('SELECT value FROM cloud_content WHERE key=?', (key,)).fetchone()
    return bytes(row[0]) if row else None


def read_json(key, fallback):
    value = read_bytes(key)
    return json.loads(value) if value else fallback
