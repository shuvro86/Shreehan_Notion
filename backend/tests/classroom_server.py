"""Run an isolated classroom for Playwright: python -m backend.tests.classroom_server."""
import os
import tempfile
from pathlib import Path


def main():
    with tempfile.TemporaryDirectory(prefix='shreehan-classroom-') as directory:
        os.environ.update(DATABASE_PATH=str(Path(directory)/'classroom.db'), TURSO_DATABASE_URL='',
                          NOTION_SYNC_DISABLED='1', APP_ENV='development', VERCEL='')
        from backend.db import connection, initialize_database, now
        from backend.auth import hash_password
        initialize_database()
        with connection() as db:
            for name in ('teacher', 'classroom_student'):
                db.execute('INSERT INTO users VALUES (?,?,?,?,?,?)',
                           (name, name, name+'@example.test', hash_password('classroom-test'), now(), now()))
            db.execute('INSERT INTO teachers VALUES (?)', ('teacher',))
        import uvicorn
        uvicorn.run('backend.main:app', host='127.0.0.1', port=8017)


if __name__ == '__main__':
    main()
