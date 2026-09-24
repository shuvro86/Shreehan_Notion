#!/bin/sh
set -eu
# FastAPI owns the worker and its recovery, on every platform/startup path.
exec uv run --no-sync uvicorn backend.main:app --host 0.0.0.0 --port 8000
