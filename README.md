# Shreehan HQ

**Source pivot in progress:** the app connects directly to Shreehan HQ in Notion and imports study files from its linked [Class II half-yearly Google Drive folder](https://drive.google.com/drive/folders/1pg3lbrlzwxJClmKCMQEpZg-9aMIrHnwr). See [docs/PIVOT_PROJECT.md](docs/PIVOT_PROJECT.md) for the source inventory, integration diagram, Q&A examples, 30-second persistent-worker contract, and deployment status. Server-side Drive credentials are required for complete linked-file sync.

A Class II learning workspace with one five-column Kanban board, a Notion-backed document library, source-linked practice, and an OpenRouter study assistant. The Next.js frontend is statically exported and served by a Python FastAPI backend. Accounts, board cards, dashboard tasks, and practice completion persist in SQLite.

## Run locally

Install Node.js 22, Python 3.12+, and uv. Copy `.env.example` to `.env`, then set `OPENROUTER_API_KEY` and `NOTION_TOKEN` as needed. Public direct Drive files linked in Notion can import without a Drive API credential; syncing all files in linked folders requires the read-only Drive settings in `.env.example`. For real signup/recovery email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and a provider-approved `SMTP_FROM` in `.env`, then restart the app. Port 587 uses STARTTLS; port 465 uses implicit TLS. Without SMTP, development OTPs appear only in the server log, and the signup page says so.

```sh
npm ci --prefix frontend
uv sync
npm --prefix frontend run build
uv run --no-sync uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000`. Stop the foreground server with Ctrl+C. A named Docker volume preserves SQLite and synchronized files when running the `Dockerfile` image.

## Verify

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:sync
uv run pytest -q
docker build -t shreehan-hq .
```

The Next.js App Router routes live in `frontend/app/`; shared UI and pure helpers are in its private `_components/` and `_lib/` folders. The FastAPI app and HTTP security boundary live in `backend/`, the Notion/Drive importers in `server/`, and executable entry points in `scripts/`. Baseline content is in `data/` and `frontend/public/documents/`. Generated databases, secrets, Next.js output, and machine files are ignored. The browser integration test `frontend/tests/cr1.spec.ts` needs a verified local account and `E2E_BASE_URL`, `E2E_USERNAME`, and `E2E_PASSWORD` environment variables. See [docs/PROJECT.md](docs/PROJECT.md) for the full map, API contracts, integrations, and deployment design.

## Notion synchronization

FastAPI automatically starts and supervises Notion sync, including when launched directly with `npm --prefix frontend start`. Checks run on startup and every 30 seconds on a persistent server; open pages refresh every 15 seconds. Importing/scanning larger files takes longer. Linked Drive files also require a server-side Drive credential. Additions, edits, replacements and deletions update the active library. New top-level pages must be shared with the integration. The current Vercel deployment still uses a five-minute GitHub schedule; see [docs/PIVOT_PROJECT.md](docs/PIVOT_PROJECT.md).

A worker heartbeat and the full last-sync date/time expose stale data. Crashed or stalled workers restart automatically; failures keep the last complete library available. Process-start-aware locks prevent a Docker restart from blocking sync when process numbers are reused. Class 2 question preparation runs separately from imports.

The authoritative status is `/api/library` from the running app; for a direct local run, its content snapshot is in `.notion-sync`. Runtime details and regression coverage are in `docs/PROJECT.md`.
