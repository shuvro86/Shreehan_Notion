"""FastAPI entry point and static Next.js export host."""
from __future__ import annotations

import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

from backend.notion_worker import NotionSupervisor
from backend import content
from backend.auth import auth_router, current_user
from backend.db import initialize_database
from backend.workspace import router as workspace_router

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
STATIC_DIR = Path(os.getenv("APP_STATIC_DIR", str(ROOT / "frontend" / "out"))).resolve()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    supervisor = NotionSupervisor(content.SYNC_DIR)
    await supervisor.start()
    try:
        yield
    finally:
        await supervisor.stop()


app = FastAPI(title="Shreehan HQ API", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(content.router, dependencies=[Depends(current_user)])
app.include_router(workspace_router)


@app.exception_handler(HTTPException)
async def api_error(_request: Request, exc: HTTPException):
    detail = exc.detail
    return JSONResponse({"error": detail if isinstance(detail, str) else detail.get("error", "Request failed")}, status_code=exc.status_code)


@app.get("/api/documents/{document_id}/{filename}")
def private_document(document_id: str, filename: str, _user=Depends(current_user)):
    for part in (document_id, filename):
        if not part or part in (".", "..") or not all(c.isalnum() or c in "._-" for c in part):
            raise HTTPException(404, "Document not found")
    if not content.active_asset(f"/api/documents/{document_id}/{filename}"):
        raise HTTPException(404, "Document is no longer in the active Notion library")
    asset_root = content.SYNC_DIR / "assets"
    path = (asset_root / document_id / filename).resolve()
    if not path.is_file() or not path.is_relative_to(asset_root.resolve()):
        raise HTTPException(404, "Document not found")
    media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, headers={"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'"})


@app.get("/{path:path}", include_in_schema=False)
def site(path: str, request: Request):
    if path.startswith("api/"):
        raise HTTPException(404, "API route not found")
    clean = Path(path)
    if clean.is_absolute() or ".." in clean.parts:
        raise HTTPException(404, "Page not found")
    if path != "login" and not path.startswith("_next/") and path not in ("favicon.ico", "robots.txt"):
        try:
            current_user(request)
        except HTTPException:
            return RedirectResponse("/login", status_code=303)
    if path == "documents/import-report.json":
        return JSONResponse(content.current_library(), headers={"Cache-Control":"no-store"})
    if path.startswith("documents/") and not content.active_asset("/" + path):
        raise HTTPException(404, "Document is no longer in the active Notion library")
    requested = STATIC_DIR / clean
    candidates = [requested, STATIC_DIR / f"{path}.html", requested / "index.html"] if path else [STATIC_DIR / "index.html"]
    for candidate in candidates:
        if candidate.is_file() and candidate.resolve().is_relative_to(STATIC_DIR):
            return FileResponse(candidate)
    raise HTTPException(404, "Page not found")
