"""Restore/publish the sync archive. Credentials are read only from the environment."""
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.db import connection, initialize_database

root = Path(os.getenv('NOTION_SYNC_DIR', '.notion-sync'))
root.mkdir(parents=True, exist_ok=True)
initialize_database()
if sys.argv[1] == 'restore':
    with connection() as db:
        rows = db.execute('SELECT key,value FROM cloud_content').fetchall()
    for row in rows:
        target = (root / row['key']).resolve()
        if target.is_relative_to(root.resolve()):
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(bytes(row['value']))
    print(f'Restored {len(rows)} archive entries')
elif sys.argv[1] == 'publish':
    library = json.loads((root / 'library.json').read_text())
    keys = {'library.json', 'status.json', 'cache.json', 'unseen-practice.json'}
    for doc in library.get('documents', []):
        for url in [doc.get('url', ''), *(page.get('image', '') for page in doc.get('pages', []))]:
            if url.startswith('/api/documents/'):
                keys.add('assets/' + url.removeprefix('/api/documents/'))
            elif url.startswith('/documents/'):
                keys.add(url.lstrip('/'))
    # All asset writes and the manifest switch commit together, preserving the last good snapshot.
    with connection() as db:
        old = {r['key']: hashlib.sha256(bytes(r['value'])).digest() for r in db.execute('SELECT key,value FROM cloud_content')}
        for key in sorted(keys):
            path = root / key
            if not path.is_file() and key.startswith('documents/'):
                path = Path('frontend/public') / key
            if not path.is_file():
                if key.startswith(('assets/', 'documents/')):
                    raise RuntimeError('A referenced document asset is missing')
                continue
            value = path.read_bytes()
            if old.get(key) != hashlib.sha256(value).digest():
                db.execute('INSERT INTO cloud_content(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, value))
        for key in old.keys() - keys:
            db.execute('DELETE FROM cloud_content WHERE key=?', (key,))
    print(f'Published {len(library.get("documents", []))} documents and {len(keys)} archive entries')
else:
    raise SystemExit('Use restore or publish')
