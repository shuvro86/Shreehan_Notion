# Vercel deployment

The Next.js frontend is exported during the FastAPI build. FastAPI protects application pages, APIs and document downloads; private responses use `Cache-Control: private, no-store`.

Production requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The official libSQL driver connects directly to the dedicated remote database. Vercel never falls back to a temporary SQLite account database. Local Docker installations continue using SQLite and their existing Notion supervisor.

## Sessions

Session tokens are random, hashed in the database, and sent only in HttpOnly, SameSite=Lax cookies. Production cookies require HTTPS. Sessions expire after 30 minutes without browser interaction, with an absolute maximum of seven days. Set `SESSION_IDLE_MINUTES` to change the idle duration. Library polling does not renew activity. Login replaces the browser's previous token. Password changes rotate the current token and revoke every other session; password reset revokes all sessions. “Sign out all devices” revokes all sessions for the signed-in account. Tabs synchronize account changes, and protected API 401 responses hide private content.

## Notion on the free hosting plan

The `Sync Notion` GitHub Actions workflow runs on a five-minute schedule and supports manual dispatch. GitHub schedules are best effort and may run late; this is not an instant-sync guarantee. The application polls the shared snapshot every 15 seconds while open. It reports stale sync after 30 minutes without success.

The workflow restores the last archive, runs the existing Notion importer and OCR tools, then publishes the manifest and changed assets in one database transaction. Removed documents are removed from the archive and become inaccessible. Failed imports preserve the last successful snapshot. Originals, previews, Homework and generated Class 2 practice are stored centrally; no developer computer is required.

Repository Actions secrets: `NOTION_TOKEN`, `OPENROUTER_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. The Vercel runtime needs only the two Turso variables, `OPENROUTER_API_KEY`, and `APP_ENV=production`. Do not expose these as `NEXT_PUBLIC_` variables.

Existing account passwords and personal workspace data were migrated; old session credentials were not. SMTP settings are required for production signup and password recovery; production never logs verification codes as a substitute for email.

## Release checks

Run backend tests, frontend build, sync tests, and browser navigation/session tests. Use separate accounts or serial browser tests when testing “sign out all devices.” Push the tested revision, deploy that revision to `shreehan-notion`, verify login and document downloads, and verify the GitHub sync workflow completes. No application data or environment files should be committed.
