"""Runtime content APIs moved from Next route handlers for static export."""
from __future__ import annotations

import json
import hashlib
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
SYNC_DIR = Path(os.getenv("NOTION_SYNC_DIR", ROOT / ".notion-sync"))
router = APIRouter(prefix="/api")


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def current_library():
    return read_json(SYNC_DIR / "library.json", read_json(ROOT / "data/library.json", {}))


def active_asset(url: str):
    return any(doc.get("url") == url or any(page.get("image") == url for page in doc.get("pages", [])) for doc in current_library().get("documents", []))


def merged_practice(library, curated, saved):
    documents = [d for d in library.get("documents", []) if d.get("collection") == "Unseen Paper"]
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


def sync_health():
    status = read_json(SYNC_DIR / "status.json", {"state":"starting", "lastSuccess":None})
    worker = read_json(SYNC_DIR / "worker.json", {})
    def age(value):
        try: return (datetime.now(timezone.utc)-datetime.fromisoformat(value.replace("Z", "+00:00"))).total_seconds()
        except (ValueError, TypeError, AttributeError): return float("inf")
    status = {**status, "worker":worker}
    if worker.get("state") == "unconfigured":
        return {**status, "state":"unconfigured", "message":worker.get("message")}
    if age(worker.get("updatedAt")) > 45:
        return {**status, "state":"stale", "message":"Notion sync is not running. Showing the last saved copy."}
    if worker.get("state") == "error":
        return {**status, "state":"error", "message":worker.get("message")}
    if age(status.get("lastSuccess")) > max(180, worker.get("intervalSeconds", 60)*3):
        return {**status, "state":"stale", "message":"Notion updates are delayed. Recovery is running; showing the last saved copy."}
    return status


@router.get("/library")
def library(response: Response):
    response.headers["Cache-Control"] = "no-store"
    data = current_library()
    return {"library": data, "sync": sync_health(), "unseenPractice": merged_practice(data, read_json(ROOT / "data/unseen-practice.json", {}), read_json(SYNC_DIR / "unseen-practice.json", {"documents": {}}))}


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
