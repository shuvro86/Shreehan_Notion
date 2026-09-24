# Shreehan HQ

A Class II learning workspace with one five-column Kanban board, a Notion-backed document library, source-linked practice, and an OpenRouter study assistant. The Next.js frontend is statically exported and served by a Python FastAPI backend. Accounts, board cards, dashboard tasks, and practice completion persist in SQLite.

## Run locally

Install Node.js 22, Python 3.12+, and uv. Copy `.env.example` to `.env`, then set `OPENROUTER_API_KEY` and `NOTION_TOKEN` as needed. For real signup/recovery email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and a provider-approved `SMTP_FROM` in `.env`, then restart the app. Port 587 uses STARTTLS; port 465 uses implicit TLS. Without SMTP, development OTPs appear only in the server log, and the signup page says so.

```sh
npm ci --prefix frontend
uv sync
./scripts/start.sh
```

Open `http://localhost:8000`. Use `./scripts/stop.sh` to stop. On Windows use `scripts/start.ps1` and `scripts/stop.ps1` in PowerShell. For Docker use `./scripts/start.sh --docker` or `./scripts/start.ps1 -Docker`; a named volume preserves SQLite and synchronized files.

## Verify

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:sync
uv run pytest -q
docker build -t shreehan-hq .
```

The Next.js app, static assets, npm files, and Playwright tests live under `frontend/`. Shared seed data, the FastAPI backend, Notion worker, and runtime scripts remain at the repository root. The browser integration test `frontend/tests/cr1.spec.ts` needs a verified local account and `E2E_BASE_URL`, `E2E_USERNAME`, and `E2E_PASSWORD` environment variables. See [docs/PROJECT.md](docs/PROJECT.md) for the complete requirements, API contracts, stack, integrations, deployment design, and change log. The proposed database schema is in [docs/DATABASE_SCHEMA.json](docs/DATABASE_SCHEMA.json).

## Notion synchronization

FastAPI automatically starts and supervises Notion sync, including when launched directly with `npm --prefix frontend start`. Checks run on startup and approximately every 60 seconds; open pages refresh every 15 seconds. Importing/scanning larger files takes longer. Additions, edits, replacements and deletions update the active library. New top-level pages must be shared with the integration.

A worker heartbeat and the full last-sync date/time expose stale data. Crashed or stalled workers restart automatically; failures keep the last complete library available. Process-start-aware locks prevent a Docker restart from blocking sync when process numbers are reused. Class 2 question preparation runs separately from imports.

Docker must be running for this local app to sync. Keep the `shreehan-data` volume when replacing containers. The authoritative status is `/api/library` from the running app, not a separate host `.notion-sync` folder. Runtime details and regression coverage are in `docs/PROJECT.md`.
# Shreehan_Notion
