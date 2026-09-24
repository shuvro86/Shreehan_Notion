# CR 1 database approach

The proposed [database schema](DATABASE_SCHEMA.json) uses SQLite with one board per verified account. Each new account receives the same five named columns and sample cards; only column names and cards are mutable. Board data, dashboard tasks, and practice completion are scoped to the signed-in user and accessed through FastAPI. The browser holds only an HttpOnly session cookie, not the source of truth.

SQLite is created automatically on startup with foreign keys enabled and WAL mode. The schema is versioned for future migrations. The runtime database path is configurable with `DATABASE_PATH`, and Docker mounts its storage directory as a volume. Passwords, OTPs, and session tokens are stored as hashes; OTPs expire after ten minutes and have an attempt limit. Email is sent through configured SMTP; local development can use a clearly marked console mailer.

**Decision requested:** approve the tables and one-board-per-account scope in `DATABASE_SCHEMA.json` before treating this as the final schema. Changes can still be made before the data layer is finalized.
