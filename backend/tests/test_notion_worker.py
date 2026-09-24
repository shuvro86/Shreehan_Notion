import asyncio
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from backend import content
from backend.notion_worker import NotionSupervisor


def test_old_success_and_dead_worker_are_not_reported_as_synced(tmp_path, monkeypatch):
    monkeypatch.setattr(content, 'SYNC_DIR', tmp_path)
    now = datetime.now(timezone.utc)
    (tmp_path/'status.json').write_text(json.dumps({'state':'ok','lastSuccess':(now-timedelta(days=1)).isoformat()}))
    assert content.sync_health()['state'] == 'stale'
    (tmp_path/'worker.json').write_text(json.dumps({'state':'waiting','updatedAt':now.isoformat(),'intervalSeconds':60}))
    assert content.sync_health()['state'] == 'stale'
    (tmp_path/'status.json').write_text(json.dumps({'state':'ok','lastSuccess':now.isoformat()}))
    assert content.sync_health()['state'] == 'ok'
    (tmp_path/'worker.json').write_text(json.dumps({'state':'running','updatedAt':(now-timedelta(minutes=2)).isoformat()}))
    assert content.sync_health()['state'] == 'stale'


def test_supervisor_starts_on_app_lifecycle_and_lease_survives_restart(tmp_path, monkeypatch):
    monkeypatch.delenv('NOTION_SYNC_DISABLED')
    monkeypatch.setenv('NOTION_TOKEN', 'test')
    monkeypatch.delenv('OPENROUTER_API_KEY', raising=False)
    monkeypatch.setattr('backend.notion_worker.shutil.which', lambda _: '/usr/bin/node')
    calls=[]
    async def fake_loop(self, args, interval, primary):
        calls.append(args)
        await asyncio.Event().wait()
    monkeypatch.setattr(NotionSupervisor,'loop',fake_loop)
    async def scenario():
        first=NotionSupervisor(tmp_path);second=NotionSupervisor(tmp_path)
        await first.start();await asyncio.sleep(0)
        await second.start();await asyncio.sleep(0)
        assert len(calls)==1
        assert calls[0]==['scripts/sync-notion.mjs','--once','--sync-only']
        await first.stop()
        await second.start();await asyncio.sleep(0)
        assert len(calls)==2
        await second.stop()
    asyncio.run(scenario())


def test_crashed_child_is_retried_and_reaped(tmp_path, monkeypatch):
    from backend import notion_worker as module
    clock=[0.0];spawns=[]
    real_sleep=asyncio.sleep
    class Child:
        returncode=None
        async def wait(self):
            self.returncode=1
            return 1
    async def spawn(*args, **kwargs):
        spawns.append(args)
        if len(spawns)==2: raise asyncio.CancelledError()
        return Child()
    async def sleep(seconds):
        clock[0]+=seconds
        await real_sleep(0)
    monkeypatch.setattr(module.asyncio,'create_subprocess_exec',spawn)
    monkeypatch.setattr(module.asyncio,'sleep',sleep)
    monkeypatch.setattr(module.time,'monotonic',lambda:clock[0])
    async def scenario():
        supervisor=NotionSupervisor(tmp_path)
        try: await supervisor.loop(['worker'],30,True)
        except asyncio.CancelledError: pass
        assert len(spawns)==2
        assert json.loads((tmp_path/'worker.json').read_text())['state']=='error'
    asyncio.run(scenario())


def test_removed_documents_and_previews_cannot_be_downloaded(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from backend import main
    from backend.auth import current_user
    assets=tmp_path/'assets'/'file-version';assets.mkdir(parents=True)
    (assets/'original.pdf').write_bytes(b'%PDF test')
    public=tmp_path/'public';(public/'documents').mkdir(parents=True)
    (public/'documents'/'seed.pdf').write_bytes(b'%PDF seed')
    monkeypatch.setattr(content,'SYNC_DIR',tmp_path)
    monkeypatch.setattr(main,'STATIC_DIR',public)
    monkeypatch.setenv('DATABASE_PATH',str(tmp_path/'test.db'))
    monkeypatch.setattr(main,'current_user',lambda request:{'id':'test'})
    main.app.dependency_overrides[current_user]=lambda:{'id':'test'}
    library={'documents':[{'url':'/api/documents/file-version/original.pdf','pages':[]},{'url':'/documents/seed.pdf','pages':[]}]}
    monkeypatch.setattr(content,'current_library',lambda:library)
    try:
        with TestClient(main.app) as browser:
            for url in ['/api/documents/file-version/original.pdf','/documents/seed.pdf']:
                assert browser.get(url).status_code==200
            library['documents']=[]
            for url in ['/api/documents/file-version/original.pdf','/documents/seed.pdf']:
                assert browser.get(url).status_code==404
    finally:
        main.app.dependency_overrides.pop(current_user,None)
