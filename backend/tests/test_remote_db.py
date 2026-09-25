import sqlite3
import pytest
from backend.remote_db import Connection


def test_remote_driver_rows_transactions_and_constraints():
    db = Connection(':memory:', '')
    db.executescript('CREATE TABLE content (key TEXT PRIMARY KEY, value BLOB);')
    db.execute('INSERT INTO content VALUES (?,?)', ('snapshot', b'original'))
    db.commit()
    row = db.execute('SELECT key,value FROM content').fetchone()
    assert row['key'] == row[0] == 'snapshot'
    assert row['value'] == b'original'
    assert dict(row) == {'key': 'snapshot', 'value': b'original'}
    db.execute('UPDATE content SET value=?', (b'changed',))
    db.rollback()
    assert db.execute('SELECT value FROM content').fetchone()[0] == b'original'
    with pytest.raises(sqlite3.IntegrityError):
        db.execute('INSERT INTO content VALUES (?,?)', ('snapshot', b'duplicate'))
    db.rollback()
    db.close()
