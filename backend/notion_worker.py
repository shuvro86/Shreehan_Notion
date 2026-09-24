"""Own and supervise Notion workers for every FastAPI startup path."""
from __future__ import annotations
import asyncio
import contextlib
import json
import logging
import os
import shutil
import signal
import time
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[1]

def timestamp():
    return datetime.now(timezone.utc).isoformat()

def write_status(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value))
    tmp.replace(path)

class NotionSupervisor:
    def __init__(self, store: Path):
        self.store = store
        self.tasks = []
        self.leader = None
        self.interval = max(30, int(os.getenv('NOTION_SYNC_INTERVAL_SECONDS', '60')))
        self.timeout = max(60, int(os.getenv('NOTION_SYNC_TIMEOUT_SECONDS', '600')))

    async def start(self):
        if os.getenv('NOTION_SYNC_DISABLED') == '1':
            return
        self.store.mkdir(parents=True, exist_ok=True)
        # OS releases this lease on exit; PID reuse and container restarts cannot strand it.
        self.leader = (self.store / 'supervisor.lock').open('a+')
        try:
            if os.name == 'nt':
                import msvcrt
                self.leader.seek(0); self.leader.write('1'); self.leader.flush(); self.leader.seek(0)
                msvcrt.locking(self.leader.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.leader, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, BlockingIOError):
            self.leader.close(); self.leader = None
            return
        if not os.getenv('NOTION_TOKEN') or not shutil.which('node'):
            write_status(self.store / 'worker.json', {'state':'unconfigured','updatedAt':timestamp(), 'message':'Notion sync needs a token and Node.js on the server.'})
            return
        self.tasks = [asyncio.create_task(self.loop(['scripts/sync-notion.mjs', '--once', '--sync-only'], self.interval, True))]
        if os.getenv('OPENROUTER_API_KEY'):
            # Question generation never delays the Notion import loop.
            self.tasks.append(asyncio.create_task(self.loop(['scripts/prepare-unseen.mjs'], 120, False)))

    async def stop_child(self, child):
        if child.returncode is not None:
            return
        with contextlib.suppress(ProcessLookupError):
            if os.name != 'nt': os.killpg(child.pid, signal.SIGTERM)
            else: child.terminate()
        try:
            await asyncio.wait_for(child.wait(), 5)
        except asyncio.TimeoutError:
            with contextlib.suppress(ProcessLookupError):
                if os.name != 'nt': os.killpg(child.pid, signal.SIGKILL)
                else: child.kill()
            await child.wait()

    async def loop(self, args, interval, primary):
        while True:
            child = None
            started = time.monotonic()
            failed = False
            try:
                child = await asyncio.create_subprocess_exec('node', *args, cwd=ROOT, env={**os.environ, 'NOTION_SYNC_DIR':str(self.store)}, start_new_session=os.name != 'nt')
                while child.returncode is None:
                    if primary:
                        write_status(self.store / 'worker.json', {'state':'running', 'updatedAt':timestamp(), 'intervalSeconds':interval, 'timeoutSeconds':self.timeout})
                    try:
                        await asyncio.wait_for(child.wait(), 5)
                    except asyncio.TimeoutError:
                        last_progress = time.monotonic()-started
                        if primary:
                            with contextlib.suppress(OSError, ValueError, KeyError):
                                status = json.loads((self.store / 'status.json').read_text())
                                last_progress = time.time()-datetime.fromisoformat(status['updatedAt'].replace('Z','+00:00')).timestamp()
                        if time.monotonic()-started > self.timeout or (primary and last_progress > 180):
                            raise TimeoutError('Notion worker exceeded its time limit')
                if child.returncode:
                    raise RuntimeError('Notion worker exited unsuccessfully')
            except asyncio.CancelledError:
                raise
            except Exception:
                failed = True
                log.warning('Notion %s worker failed; automatic retry scheduled', 'sync' if primary else 'practice')
                if primary:
                    write_status(self.store / 'worker.json', {'state':'error','updatedAt':timestamp(),'message':'Sync interrupted. Retrying automatically; saved content remains available.'})
            finally:
                if child:
                    await self.stop_child(child)
            # Heartbeat continues between checks. Cadence is measured from check start.
            until = time.monotonic()+max(5, interval-(time.monotonic()-started))
            while time.monotonic() < until:
                if primary:
                    write_status(self.store / 'worker.json', {'state':'error' if failed else 'waiting','updatedAt':timestamp(),'intervalSeconds':interval,'timeoutSeconds':self.timeout,'message':'Retrying sync automatically.' if failed else ''})
                await asyncio.sleep(min(5, max(0, until-time.monotonic())))

    async def stop(self):
        for task in self.tasks: task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
        if self.leader:
            self.leader.close()
            self.leader = None
