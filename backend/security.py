"""HTTP boundary checks shared by the FastAPI site and API."""
from __future__ import annotations

import os
from urllib.parse import urlsplit

from fastapi import Request, Response


SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def cross_origin_write(request: Request) -> bool:
    if request.method in SAFE_METHODS:
        return False
    if request.headers.get("sec-fetch-site") in {"cross-site", "same-site"}:
        return True
    origin = request.headers.get("origin")
    if not origin:
        return False
    try:
        parsed = urlsplit(origin)
    except ValueError:
        return True
    host = request.headers.get("host", "")
    if (parsed.scheme not in {"http", "https"} or not parsed.netloc
            or parsed.netloc.lower() != host.lower() or parsed.path or parsed.query or parsed.fragment
            or parsed.username or parsed.password):
        return True
    return bool((os.getenv("APP_ENV") == "production" or os.getenv("VERCEL")) and parsed.scheme != "https")


def apply_security_headers(request: Request, response: Response) -> Response:
    if not request.url.path.startswith("/_next/"):
        response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers.setdefault("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'none'; object-src 'none'")
    if (os.getenv("APP_ENV") == "production" or os.getenv("VERCEL")) and (
        request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    ):
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    vary = {item.strip() for item in response.headers.get("Vary", "").split(",") if item.strip()}
    vary.update({"Cookie", "Origin", "Sec-Fetch-Site"})
    response.headers["Vary"] = ", ".join(sorted(vary))
    return response
