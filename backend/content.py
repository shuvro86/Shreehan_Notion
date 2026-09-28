"""Runtime content APIs moved from Next route handlers for static export."""
from __future__ import annotations

import json
import hashlib
import asyncio
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
SYNC_DIR = Path(os.getenv("NOTION_SYNC_DIR", ROOT / ".notion-sync"))
router = APIRouter(prefix="/api")
_subject_sync_task: asyncio.Task | None = None
_collection_sync_task: asyncio.Task | None = None
_collection_sync_name: str | None = None
COLLECTION_SYNC_SLUGS = {'Study Note': 'study-note', 'Exam': 'exam', 'Assignment': 'assignment'}


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def current_library():
    if os.getenv("TURSO_DATABASE_URL"):
        from backend.cloud_content import read_json as cloud_json
        data = cloud_json("library.json", {})
    else:
        data = read_json(SYNC_DIR / "library.json", read_json(ROOT / "data/library.json", {}))
    if os.getenv('CONTENT_SOURCE', 'notion') == 'google_drive' and data.get('sourceType') != 'google_drive':
        return {'sourceType':'google_drive', 'documents':[], 'records':[], 'homework':{'sources':[], 'items':[]}, 'expectedAttachments':0, 'missing':[], 'scope':'Waiting for the configured Google Drive folder to sync.'}
    return data


def active_asset(url: str):
    return any(doc.get("url") == url or any(page.get("image") == url for page in doc.get("pages", [])) for doc in current_library().get("documents", []))


def merged_practice(library, curated, saved):
    documents = [d for d in library.get("documents", []) if d.get("collection") == "Unseen Paper" or (d.get('sourceType') == 'google_drive' and d.get('collection') != 'Syllabus')]
    sources = [s for s in curated.get("sources", []) if any(s.get("documentId") == d.get("id") and s.get("sha256") == d.get("sha256") and s.get("subject") == d.get("subject") for d in documents)]
    ids = {s["documentId"] for s in sources}
    questions = [q for q in curated.get("questions", []) if all(s.get("documentId") in ids for s in q.get("sources", []))]
    jobs = []
    for doc in documents:
        if doc["id"] in ids:
            continue
        entry = saved.get("documents", {}).get(doc["id"], {})
        if entry.get("version") == version_key(doc) and entry.get("state") == "ready":
            sources.append({"documentId": doc["id"], "sha256": doc.get("sha256"), "subject": doc.get("subject"), "page": 1, "origin": "ai"})
            questions.extend(entry.get("questions", []))
        current = entry.get("version") == version_key(doc)
        jobs.append({"documentId": doc["id"], "state": entry.get("state", "queued") if current else "queued", "message": entry.get("message", "Waiting for automatic question preparation.") if current else "Waiting for automatic question preparation."})
    return {"level": "Class 2", "sources": sources, "questions": questions, "jobs": jobs}


def version_key(doc):
    pages = [[p.get("number"), p.get("text"), p.get("method"), p.get("confidence")] for p in doc.get("pages", [])]
    value = [doc.get("id"), doc.get("sha256"), doc.get("subject"), doc.get("title"), pages]
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()[:16]


def subject_practice_view(library, saved):
    records = [r for r in library.get('records', []) if r.get('collection') == 'Subject Materials' and r.get('subject')]
    subjects = []
    for subject in sorted({r['subject'] for r in records}):
        related = [r for r in records if r['subject'] == subject]
        urls = {r.get('url') for r in related}
        documents = [d for d in library.get('documents', []) if d.get('subject') == subject and (d.get('notionUrl') in urls or d.get('collection') == 'Subject Materials' or d.get('sourceType') == 'google_drive')]
        sources = sorted([[d.get('id'), d.get('sha256'), version_key(d)] for d in documents])
        entry = saved.get('subjects', {}).get(subject, {})
        saved_sources = entry.get('sources', [])
        current = len(saved_sources) == len(sources) and {tuple(item) for item in saved_sources} == {tuple(item) for item in sources}
        questions = entry.get('questions', []) if current else []
        subjects.append({'name': subject, 'notionUrls': [r.get('url') for r in related], 'documentIds': [d.get('id') for d in documents], 'target': entry.get('target', 15) if current else 15, 'state': entry.get('state', 'queued') if current else 'queued', 'message': entry.get('message', 'Preparing the first 15 questions.') if current else 'Source material changed; preparing fresh questions.', 'questions': questions})
    return {'subjects': subjects}


def current_subject_practice(library):
    if os.getenv('TURSO_DATABASE_URL'):
        from backend.cloud_content import read_json as cloud_json
        saved = cloud_json('subject-practice.json', {'subjects': {}})
    else:
        saved = read_json(SYNC_DIR / 'subject-practice.json', {'subjects': {}})
    return subject_practice_view(library, saved)


def sync_health():
    if os.getenv("TURSO_DATABASE_URL"):
        from backend.cloud_content import read_json as cloud_json
        status = cloud_json("status.json", {"state": "starting", "lastSuccess": None})
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(status["lastSuccess"].replace("Z", "+00:00"))).total_seconds()
        except (ValueError, TypeError, KeyError):
            age = float("inf")
        source = 'Google Drive' if os.getenv('CONTENT_SOURCE', 'notion') == 'google_drive' else 'Notion'
        return {**status, "state": status.get("state", "ready") if age < 1800 else "stale", "message": f"Scheduled {source} sync; GitHub scheduling may be delayed." if age < 1800 else f"{source} sync is delayed. Showing the last successful copy.", "intervalSeconds": 300}
    status = read_json(SYNC_DIR / "status.json", {"state":"starting", "lastSuccess":None})
    worker = read_json(SYNC_DIR / "worker.json", {})
    def age(value):
        try: return (datetime.now(timezone.utc)-datetime.fromisoformat(value.replace("Z", "+00:00"))).total_seconds()
        except (ValueError, TypeError, AttributeError): return float("inf")
    status = {**status, "worker":worker}
    if worker.get("state") == "unconfigured":
        return {**status, "state":"unconfigured", "message":worker.get("message")}
    if age(worker.get("updatedAt")) > 45:
        return {**status, "state":"stale", "message":"Source sync is not running. Showing the last saved copy."}
    if worker.get("state") == "error":
        return {**status, "state":"error", "message":worker.get("message")}
    if age(status.get("lastSuccess")) > max(180, worker.get("intervalSeconds", 60)*3):
        return {**status, "state":"stale", "message":"Source updates are delayed. Recovery is running; showing the last saved copy."}
    return status


@router.get("/library")
def library(response: Response):
    response.headers["Cache-Control"] = "no-store"
    data = current_library()
    saved = read_json(SYNC_DIR / "unseen-practice.json", {"documents": {}})
    if os.getenv("TURSO_DATABASE_URL"):
        from backend.cloud_content import read_json as cloud_json
        saved = cloud_json("unseen-practice.json", {"documents": {}})
    return {"library": data, "sync": sync_health(), "unseenPractice": merged_practice(data, read_json(ROOT / "data/unseen-practice.json", {}), saved), "subjectPractice": current_subject_practice(data)}


def subject_material_sync_status():
    return read_json(SYNC_DIR / "subject-materials-sync.json", {"state":"idle", "phase":"idle", "percent":0, "message":"Ready to sync Subject Materials."})


def collection_sync_status(collection: str):
    slug = COLLECTION_SYNC_SLUGS.get(collection)
    if not slug:
        raise HTTPException(404, 'Collection sync is not available.')
    status = read_json(SYNC_DIR / f'collection-sync-{slug}.json', {'state':'idle', 'phase':'idle', 'collection':collection, 'message':f'Ready to sync {collection}.'})
    if status.get('state') == 'running' and (_collection_sync_task is None or _collection_sync_task.done() or _collection_sync_name != collection):
        return {**status, 'state':'error', 'phase':'error', 'message':f'{collection} sync was interrupted. Try again.'}
    return status


async def _run_subject_material_sync():
    try:
        process = await asyncio.create_subprocess_exec(
            'node', 'scripts/sync-subject-materials.mjs', cwd=ROOT,
            env={**os.environ, 'NOTION_SYNC_DIR': str(SYNC_DIR)},
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(process.wait(), timeout=1800)
        status = subject_material_sync_status()
        if process.returncode and status.get('state') not in ('error', 'partial'):
            atomic_write_json(SYNC_DIR / 'subject-materials-sync.json', {**status, 'state':'error', 'phase':'error', 'message':'Sync or analysis failed. Your previously saved materials are still available.', 'updatedAt':datetime.now(timezone.utc).isoformat()})
    except asyncio.CancelledError:
        raise
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        status = subject_material_sync_status()
        atomic_write_json(SYNC_DIR / 'subject-materials-sync.json', {**status, 'state':'error', 'phase':'error', 'message':'Sync took too long. Your previously saved materials are still available.', 'updatedAt':datetime.now(timezone.utc).isoformat()})
    except Exception:
        status = subject_material_sync_status()
        atomic_write_json(SYNC_DIR / 'subject-materials-sync.json', {**status, 'state':'error', 'phase':'error', 'message':'Could not start the sync worker. Your previously saved materials are still available.', 'updatedAt':datetime.now(timezone.utc).isoformat()})


def atomic_write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.replace(path)


@router.get('/subject-materials/sync')
def subject_material_sync_progress(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return subject_material_sync_status()


@router.post('/subject-materials/sync')
async def start_subject_material_sync():
    global _subject_sync_task
    if os.getenv('VERCEL'):
        raise HTTPException(503, 'Manual sync needs the persistent local worker.')
    if not os.getenv('NOTION_TOKEN'):
        raise HTTPException(503, 'Notion sync is not configured on the server.')
    if _collection_sync_task and not _collection_sync_task.done():
        raise HTTPException(409, 'A collection sync is running. Try again after it finishes.')
    if _subject_sync_task and not _subject_sync_task.done():
        return JSONResponse(subject_material_sync_status(), status_code=202)
    atomic_write_json(SYNC_DIR / 'subject-materials-sync.json', {'state':'running', 'phase':'starting', 'percent':1, 'message':'Starting Notion sync…', 'updatedAt':datetime.now(timezone.utc).isoformat()})
    _subject_sync_task = asyncio.create_task(_run_subject_material_sync())
    return JSONResponse(subject_material_sync_status(), status_code=202)


async def _run_collection_sync(collection: str):
    path = SYNC_DIR / f'collection-sync-{COLLECTION_SYNC_SLUGS[collection]}.json'
    process = None
    try:
        process = await asyncio.create_subprocess_exec(
            'node', 'scripts/sync-collection.mjs', collection, cwd=ROOT,
            env={**os.environ, 'NOTION_SYNC_DIR': str(SYNC_DIR)},
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(process.wait(), timeout=1800)
        status = collection_sync_status(collection)
        if process.returncode and status.get('state') != 'error':
            atomic_write_json(path, {**status, 'state':'error', 'phase':'error', 'message':f'Could not sync {collection}. Saved content is still available.', 'updatedAt':datetime.now(timezone.utc).isoformat()})
    except asyncio.CancelledError:
        raise
    except asyncio.TimeoutError:
        if process and process.returncode is None:
            process.kill()
            await process.wait()
        status = collection_sync_status(collection)
        atomic_write_json(path, {**status, 'state':'error', 'phase':'error', 'message':f'{collection} sync took too long. Saved content is still available.', 'updatedAt':datetime.now(timezone.utc).isoformat()})
    except Exception:
        status = collection_sync_status(collection)
        atomic_write_json(path, {**status, 'state':'error', 'phase':'error', 'message':f'Could not start {collection} sync. Saved content is still available.', 'updatedAt':datetime.now(timezone.utc).isoformat()})


@router.get('/collections/{collection}/sync')
def get_collection_sync(collection: str, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return collection_sync_status(collection)


@router.post('/collections/{collection}/sync')
async def start_collection_sync(collection: str):
    global _collection_sync_task, _collection_sync_name
    collection_sync_status(collection)
    if os.getenv('VERCEL'):
        raise HTTPException(503, 'Manual collection sync needs the persistent local worker.')
    if not os.getenv('NOTION_TOKEN'):
        raise HTTPException(503, 'Notion sync is not configured on the server.')
    if _subject_sync_task and not _subject_sync_task.done():
        raise HTTPException(409, 'Subject Materials sync is running. Try again after it finishes.')
    if _collection_sync_task and not _collection_sync_task.done():
        if _collection_sync_name == collection:
            return JSONResponse(collection_sync_status(collection), status_code=202)
        raise HTTPException(409, 'Another collection sync is running. Try again after it finishes.')
    status = {'state':'running', 'phase':'starting', 'collection':collection, 'message':f'Starting {collection} sync…', 'updatedAt':datetime.now(timezone.utc).isoformat()}
    atomic_write_json(SYNC_DIR / f'collection-sync-{COLLECTION_SYNC_SLUGS[collection]}.json', status)
    _collection_sync_name = collection
    _collection_sync_task = asyncio.create_task(_run_collection_sync(collection))
    return JSONResponse(status, status_code=202)


@router.post('/subject-practice/{subject}/generate-more')
async def generate_more_subject_questions(subject: str):
    if os.getenv('VERCEL'):
        raise HTTPException(503, 'Interactive question generation needs a persistent worker.')
    if subject not in {r.get('subject') for r in current_library().get('records', []) if r.get('collection') == 'Subject Materials'}:
        raise HTTPException(404, 'Subject Materials subject not found.')
    if not os.getenv('OPENROUTER_API_KEY'):
        raise HTTPException(503, 'Question generation is not configured on the server.')
    process = await asyncio.create_subprocess_exec('node', 'scripts/prepare-subject-practice.mjs', '--more', subject, cwd=ROOT, env={**os.environ, 'NOTION_SYNC_DIR': str(SYNC_DIR)}, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        await asyncio.wait_for(process.communicate(), timeout=300)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise HTTPException(504, 'Question generation took too long. Please try again.')
    if process.returncode == 2:
        raise HTTPException(409, 'Questions are already being prepared. Try again shortly.')
    if process.returncode == 3:
        raise HTTPException(409, 'The first 15 questions are still being prepared.')
    if process.returncode:
        raise HTTPException(502, 'Questions could not be generated. Please try again.')
    return current_subject_practice(current_library())


class Message(BaseModel):
    role: str
    content: str


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mode: str = "chat"
    history: list[Message] = Field(default_factory=list)


def retrieve(library, question):
    terms = {term for term in re.findall(r"\w+", question.lower()) if len(term) > 2}
    candidates = []
    for doc in library.get("documents", []):
        for page in doc.get("pages", []):
            page_text = (page.get("text") or "").strip()
            if len(page_text) <= 20:
                continue
            haystack = f"{doc.get('title', '')} {doc.get('subject', '')} {doc.get('collection', '')} {page_text}".lower()
            score = sum(2 if f"{term} " in haystack else 1 if term in haystack else 0 for term in terms)
            candidates.append((score, doc, page, page_text))
    candidates.sort(key=lambda row: row[0], reverse=True)
    matched = [row for row in candidates if row[0] > 0][:8] or candidates[:4]
    return [{"id": f"S{i}", "documentId": doc.get("id"), "title": doc.get("title"), "page": page.get("number"), "url": doc.get("url"), "documentUrl": doc.get("url"), "text": text[:5500]} for i, (_, doc, page, text) in enumerate(matched, 1)]


@router.post("/assistant")
async def assistant(body: AssistantRequest):
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise HTTPException(503, "OPENROUTER_API_KEY is not configured on the server.")
    mode = "qa" if body.mode == "qa" else "chat"
    sources = retrieve(current_library(), body.message.strip())
    context = "\n\n".join(f"[{s['id']}] {s['title']} — page {s['page']}\n{s['text']}" for s in sources)
    system = "You are Shreehan Digital Twin, a careful study assistant for the Shreehan learning workspace. Answer using only the supplied library context. If it does not contain the answer, say so clearly and suggest what to look for. Never invent facts or claim to be the real Shreehan. Cite supporting context inline as [S1], [S2]. Keep explanations clear and age-appropriate.\n\nLIBRARY CONTEXT:\n" + (context or "No usable library text was found.")
    question = f'Create 5 study questions and model answers from the library context for this request: {body.message}. Return JSON only in this shape: {{"items":[{{"question":"...","answer":"...","difficulty":"Easy|Medium|Hard","sources":["S1"]}}]}}. Each item must cite at least one source ID.' if mode == "qa" else body.message
    payload = {"model": "openai/gpt-oss-120b", "messages": [{"role": "system", "content": system}, *[item.model_dump() for item in body.history[-10:] if item.role in ("user", "assistant")], {"role": "user", "content": question}], "temperature": 0.35 if mode == "qa" else 0.55, "max_tokens": 1800 if mode == "qa" else 1200}
    if mode == "qa":
        payload["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers={"Authorization": f"Bearer {key}", "HTTP-Referer": "http://localhost:8000", "X-OpenRouter-Title": "Shreehan Digital Twin"})
        result = response.json()
        if response.status_code >= 400:
            raise HTTPException(502, {"error": result.get("error", {}).get("message", "OpenRouter could not answer right now.")})
        content = result["choices"][0]["message"]["content"]
        if not content:
            raise ValueError("empty response")
        if mode == "qa":
            try:
                return {"mode": mode, "qa": json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())), "sources": sources}
            except json.JSONDecodeError:
                return {"mode": mode, "qa": {"items": [{"question": "The model returned an unstructured study set.", "answer": content, "difficulty": "Medium", "sources": []}]}, "sources": sources}
        return {"mode": mode, "answer": content, "sources": sources}
    except httpx.TimeoutException:
        raise HTTPException(502, "The model took too long to respond. Please try again.")
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        raise HTTPException(502, "The assistant is temporarily unavailable.")


NATIONAL_DAYS = {
    "02-21": [{"text": "Language Martyrs' Day in Bangladesh honours the people who stood up for Bangla. Today is also International Mother Language Day.", "region": "Bangladesh", "sourceUrl": "https://bdembjp.mofa.gov.bd/public/storage/pdf/Country_Profile.pdf"}],
    "03-26": [{"year": 1971, "text": "Bangladesh declared independence. This date is remembered as Independence Day.", "region": "Bangladesh", "sourceUrl": "https://beautifulbangladesh.gov.bd/district-event/dhaka/events/40"}],
    "12-16": [{"year": 1971, "text": "Bangladesh achieved victory in the Liberation War. This date is celebrated as Victory Day.", "region": "Bangladesh", "sourceUrl": "https://beautifulbangladesh.gov.bd/district-event/dhaka/events/40"}],
}


@router.get("/day-context")
async def day_context():
    now = datetime.now(ZoneInfo("Asia/Dhaka"))
    date = now.strftime("%m-%d")
    # Wikimedia rejects anonymous library defaults; identify this app as required by its API policy.
    async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "ShreehanHQ/1.1 (https://github.com/shuvro86/Shreehan_Notion/issues; educational dashboard)"}) as client:
        results = await __import__("asyncio").gather(client.get("https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,weather_code&timezone=Asia%2FDhaka"), client.get(f"https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{now.month}/{now.day}"), return_exceptions=True)
    weather_response, history_response = results
    current = weather_response.json().get("current", {}) if isinstance(weather_response, httpx.Response) and weather_response.is_success else {}
    feed = history_response.json().get("events", []) if isinstance(history_response, httpx.Response) and history_response.is_success else []
    events = list(NATIONAL_DAYS.get(date, []))
    world = []
    for item in feed:
        event_text = item.get("text", "").strip()
        if not event_text:
            continue
        pages = item.get("pages") or []
        source = next((p.get("content_urls", {}).get("desktop", {}).get("page") for p in pages if p.get("content_urls", {}).get("desktop", {}).get("page", "").startswith("https://en.wikipedia.org/")), None)
        region = "Bangladesh" if re.search(r"\b(Bangladesh(?:i)?|East Pakistan|East Bengal|Dhaka|Dacca|Chittagong|Chattogram|Sheikh Mujibur Rahman)\b", event_text + " " + " ".join(p.get("titles", {}).get("normalized", "") for p in pages), re.I) else "World"
        event = {"text": event_text, "year": item.get("year"), "region": region, "sourceUrl": source}
        (events if region == "Bangladesh" else world).append(event)
    return {"date": date, "dateLabel": f"{now:%B} {now.day}", "location": "Dhaka", "weather": {"temperature": current.get("temperature_2m"), "code": current.get("weather_code")}, "events": events + world[:8], "historyUnavailable": not isinstance(history_response, httpx.Response) or not history_response.is_success}
