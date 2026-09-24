# Shreehan HQ — Code Review

**Review date:** 2026-09-23
**Repository:** `shreehan-hq`
**Review type:** Application code, integration, data-flow, and test review
**Companion specification:** [PROJECT.md](./PROJECT.md)

## Executive summary

The application builds, type-checks, and passes its current automated test suites. The review covered the Next.js pages and API handlers, browser persistence, the Kanban module, the Notion synchronization worker, AI question generation, committed data, environment configuration, and deployment assumptions.

The largest deployment risk is access control: the repository has no sign-in or authorization layer, while its library and document endpoints expose learning content and its assistant endpoint can make paid provider calls. Keep the service on a trusted private network or add authentication and abuse controls before making it public. The assistant also needs stricter request validation and clearer separation of retrieved document text from trusted instructions.

This is a source review of the checked-out repository. It is not a penetration test, a review of a live production host, or an audit of the Notion/OpenRouter accounts.

## Findings

### High — Workspace content and APIs have no access control

**Evidence:** `app/api/library/route.ts:9-13` returns the current library and practice data without checking identity. `app/api/documents/[...path]/route.ts:4` serves saved attachments without authorization. The application has no middleware or route-level authentication layer.

**Impact:** Anyone who can reach the application can read imported study materials and source records. The same deployment boundary also exposes the assistant endpoint. The document API path checks prevent traversal, but they do not decide who may read the files.

**Recommendation:** Keep deployments behind a private network or add authentication and authorization before public exposure. Apply the same access policy to page routes, `/api/library`, `/api/documents/*`, and AI endpoints. Re-review caching behavior after adding identity-aware access.

### High — The assistant endpoint can be called repeatedly and accepts unbounded history content

**Evidence:** `app/api/assistant/route.ts:42-62` has no user authentication, rate limit, or request-size limit. The current user message is capped at 4,000 characters, but `history` is only limited to ten array entries; each entry’s content has no length cap. Its role check at line 49 accepts any truthy role rather than only `user` or `assistant`, then forwards that value to OpenRouter at line 56.

**Impact:** A reachable endpoint can incur provider cost through repeated requests. Very large history entries can also increase memory and provider usage. A caller can supply an unexpected role, including another `system` message, which may alter model behavior.

**Recommendation:** Require the same authentication as the workspace, add per-user and per-IP rate limits and request-body limits, accept only `user`/`assistant` history roles, cap each history entry and the total history size, and reject malformed requests. Add route tests for each rejected case and for the missing-key path.

### Medium — Retrieved study text is placed inside the trusted system message

**Evidence:** `app/api/assistant/route.ts:50-56` interpolates page text directly into the system message under `LIBRARY CONTEXT`. Unlike the unseen-question generator, the assistant’s system prompt does not explicitly state that source text is untrusted data and must never be followed as instructions.

**Impact:** If an imported Notion page contains instruction-like text, it can act as indirect prompt injection and influence the assistant’s response. The document content is the retrieval source and may not be written by the application developer.

**Recommendation:** Keep stable behavior instructions separate from retrieved content. Tell the model to treat documents as quoted data, never as instructions, and put the retrieved passages in a distinct user/context message with clear boundaries. Test with source text containing malicious instructions and verify the assistant follows the user’s study question instead.

### Medium — Generated assistant Q&A accepts any parseable JSON shape

**Evidence:** `app/api/assistant/route.ts:68-73` parses provider content with `JSON.parse` and returns the result without checking that it has an `items` array, valid question/answer fields, allowed difficulty values, or source IDs that refer to the selected `sources`.

**Impact:** A syntactically valid but malformed or unsupported answer can reach the UI. A model can cite nonexistent source IDs or return a shape that the client does not render as intended. This validation is less strict than the evidence validation used for Unseen Paper generation.

**Recommendation:** Validate the response schema, cap field sizes and item count, and reject source IDs outside the request’s selected source set. If the response fails validation, return a clear structured provider error rather than treating arbitrary JSON as a successful study set.

### Medium — Runtime library read failures silently fall back to seed data

**Evidence:** `app/api/library/route.ts:8` catches every read or JSON parse error and returns the supplied fallback. `app/api/assistant/route.ts:19-22` uses the same broad fallback for the current library.

**Impact:** A malformed or unreadable `.notion-sync/library.json` can silently make the app and assistant use an older committed snapshot. The UI may appear healthy while users see stale data, making disk or serialization failures difficult to diagnose.

**Recommendation:** Use the seed only when the runtime file is absent (`ENOENT`). Log other read/parse failures without secrets, preserve the last known valid snapshot, and expose a distinct degraded status so operators can tell that runtime data could not be loaded. Add tests for missing versus malformed files.

### Medium — Kanban drag and drop has no keyboard alternative

**Evidence:** `app/kanban/page.tsx:79-96` implements native drag events, and cards are marked `draggable` at lines 120-123. No keyboard move command or accessible move control is present.

**Impact:** Users who cannot perform pointer drag-and-drop have no equivalent way to move cards. Native drag behavior can also vary on touch devices.

**Recommendation:** Preserve drag-and-drop, but add a small accessible move action or keyboard interaction that chooses one of the five existing columns. Verify the move action with keyboard-only and touch-sized browser checks.

### Low — The background worker retries permanent configuration errors every 30 seconds

**Evidence:** `scripts/serve.mjs:8-9` restarts the sync worker after every exit on a fixed 30-second timer. `scripts/sync-notion.mjs:5-6` exits when the Notion token is missing or the environment is Vercel.

**Impact:** A missing token or unsupported runtime causes a repeated worker launch and repeated error output for as long as the web server stays up. It does not prevent the committed baseline from serving.

**Recommendation:** Treat missing configuration and known-unsupported runtimes as non-retryable until configuration changes, or use bounded backoff and a clear one-time status message. Keep automatic restart for recoverable failures.

## Positive controls observed

- Secrets are server-side; the example environment file does not use `NEXT_PUBLIC_` variables.
- Notion attachment downloads require HTTPS, resolve addresses before connecting, reject private addresses, limit redirects, cap downloads at 100 MB, and time out.
- Sync and unseen-generation workers use lock files to avoid concurrent processing, and snapshots are written using a temporary file followed by rename.
- A failed Notion sync preserves the last successful library snapshot.
- Unseen Paper question generation checks each answer against a verbatim excerpt from the exact source page and invalidates answers when source checksums change.
- The document route validates path segments, sets `X-Content-Type-Options: nosniff`, and applies a restrictive sandbox policy to served files.
- The Kanban board has one fixed five-column schema, stores card business data as title and details, validates saved browser state on load, and persists locally without introducing a database or third-party board dependency.

## Verification performed

The application was tested on 2026-09-23 against the current checked-out source:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run build` | Passed; Next.js generated all page and API routes |
| `npm run test:sync` | Passed: 10 tests |
| `npx playwright test` | Passed: 18 tests, including dashboard, library, practice, date/history, sync/import UI paths, and Kanban rename/add/delete/persistence/drag flows |

The first browser run exposed three outdated text assertions. Those assertions were updated to match the current dashboard and Unseen Paper UI, after which the full suite passed. The browser suite uses the project’s configured local server and test fixtures; it does not exercise live OpenRouter billing or make this review a live Notion permission audit.

## Review limits and follow-up order

The most useful next steps are:

1. Decide and enforce the intended network boundary or authentication model before public deployment.
2. Add assistant authentication, request-size limits, rate limits, strict history validation, and prompt-injection handling.
3. Validate generated assistant Q&A against a strict response schema and allowed source IDs.
4. Distinguish a missing runtime snapshot from a corrupt or unreadable one.
5. Add an accessible Kanban card-move control and improve worker handling of permanent configuration failures.

## Review log

### 2026-09-23 — Initial code review

- Reviewed UI routes, route handlers, local and runtime persistence, Notion synchronization, OpenRouter calls, OCR/PDF extraction, the Kanban module, configuration, and existing tests.
- Recorded seven risk findings and the observed safeguards above.
- Confirmed the production build, TypeScript check, sync/generation unit tests, and full Playwright suite pass as listed in Verification performed.
