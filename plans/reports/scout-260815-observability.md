# Scout: Observability / Audit Pipeline — CMC EDU (branch feat/back-before-design @ 0740c36)

**Date:** 260815 | **Scope:** error-capture + audit end-to-end (client → nginx → API/worker → GlitchTip) | **Mode:** READ-ONLY (no repo file modified; live docker state inspected read-only)
**Related plan:** `plans/260815-1616-uat-live-test-audit/plan.md` (this scout = its P1) and `plans/260810-1550-agent-observability/plan.md` (Tier 0–1 implementation record).

---

## TL;DR

- **Server-side capture is solid and correlated.** pino structured logs + @sentry/node → GlitchTip, pivoting on one **`reqId`** (pino field ↔ Sentry tag). Fail-open when GlitchTip is down. Live stack verified up and reachable.
- **Client-side capture is COMPLETELY ABSENT** — no Sentry browser, no ErrorBoundary, no `window.onerror`/`unhandledrejection`, no error-forwarding endpoint. A pure client runtime error today = white screen + console only, **invisible to GlitchTip and to server logs**. This is the single blocker for the stated goal ("any runtime error captured end-to-end").
- GlitchTip access path is ready: web on `127.0.0.1:8000` (loopback), MCP at `/mcp`, Sentry-compatible REST API (401 without token). User/facility are NOT attached to events (deliberate PII scrub); identity is reconstructable only via reqId → pino log context, and even that is thin (no user/facility fields in the error log lines today).

---

## 1. apps/api/src/lib/instrument.ts — full behavior

- **Init:** `@sentry/node` ^10.69.0, `Sentry.init` **only when `SENTRY_DSN` is set** — fail-open: with an empty DSN every `Sentry.*` call is a no-op, app never blocks/crashes on a down tracker. `environment` = `NODE_ENV`.
- **No tracing / auto-instrumentation** (deliberate, documented in the header): ESM requires `node --import ./instrument.js` for auto-instrumentation; not enabled. Only *manual* `captureException` calls are sent.
- **`beforeSend` scrubs PII** (defence-in-depth over default `sendDefaultPii: false`):
  - `request.headers`: deletes `cookie`, `authorization`, `x-dev-user`, `x-dev-lms-user`
  - deletes `request.cookies`, `request.data` (tRPC inputs), `request.query_string`
  - deletes **all `breadcrumbs`** wholesale
  - `user`: deletes `email`, `username`, `ip_address`
  - Keeps Sentry's default `request.url`/method and `tags`.
- **User / facility / request attachment: NONE.** There is no `Sentry.setUser`/`scope.setUser` anywhere in the repo (verified repo-wide scan). Events carry only tags (`reqId`, `route`/`trpcPath`, `service`) and the worker's `drain` context. This is intentional (PII locality on the laptop) — the trade-off is that a GlitchTip event alone cannot tell you *which user/facility*; you must pivot via reqId to pino logs, and even there the current error lines do **not** include userId/facilityId (only route/path/code/err).
- Exports `Sentry` for the entrypoints; imported first in `server.ts` and `worker/index.ts`.

## 2. server.ts + worker/index.ts — capture sites & correlation

- **reqId:** per HTTP request, `randomUUID` stored on a Symbol slot (`REQ_ID`) on the `IncomingMessage` — NOT on the tRPC Context (deliberate: 14 context construction sites, zero blast radius). Generated server-side; **no inbound `X-Request-Id` header is read** (grep confirms zero handling in apps/api/src).
- **`reportRouteError(req, route, err)`** (server.ts) — used by all 7 raw-http route catches (staff-login, sso-login, sso-callback, exercise-pdf-upload/get, session-photo-upload/get):
  - pino: `log.error({ reqId, route, err }, ...)`
  - Sentry: `scope.setTag('reqId', reqId); scope.setTag('route', route); captureException(err)`
- **tRPC `onError` hook** (server.ts):
  - `EXPECTED_CLIENT_CODES` (13 codes: UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND, CONFLICT, TOO_MANY_REQUESTS, PARSE_ERROR, TIMEOUT, CLIENT_CLOSED_REQUEST, PAYLOAD_TOO_LARGE, UNPROCESSABLE_CONTENT, METHOD_NOT_SUPPORTED, UNSUPPORTED_MEDIA_TYPE) → `log.debug` only, **never** sent to GlitchTip.
  - Everything else (real server faults, incl. INTERNAL_SERVER_ERROR) → `log.error({ reqId, path, type, code, err })` + `captureException` tagged `reqId` + `trpcPath`.
- **Worker drain catch** (worker/index.ts): no request → no reqId. `log.error({ err, consecutiveDrainFailures, maxConsecutiveDrainFailures, healthy })` + `captureException` tagged `service=worker` with `scope.setContext('drain', {...})`. Health endpoint (3001) flips 503 after `WORKER_MAX_DRAIN_FAILURES`.
- **How logs tie to Sentry events:** `reqId` is the single pivot key — pino lines carry it as a JSON field, Sentry events as a tag. Agent workflow: find a GlitchTip issue → read its `reqId` tag → `docker compose -p cmcv2-prod logs api | jq 'select(.reqId=="<id>")'` for the full per-request story. No AuditLog join yet (Tier 3 plan adds a nullable `reqId` column — **not implemented**).
- No `console.*` remains in server.ts / worker/index.ts (all replaced by pino, per the Tier 0 plan).

## 3. CLIENT SIDE GAP — confirmed, and it is the blocker

Searched every file in `apps/admin/src` (175 files) and `apps/lms/src` (19 files) for `@sentry`/sentry/glitchtip, `window.onerror`, `unhandledrejection`, `ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError`, error-report/forward patterns: **zero matches**.

- **package.json** (both apps): no `@sentry/browser` or any error-tracking dep. No errorLink in `lib/trpc.ts`; QueryClient defaultOptions only set `staleTime`/`retry` — no global `onError`.
- **`main.tsx` (both):** bare `createRoot(...).render(...)` — no error boundary around the tree, no window-level handlers. A React render crash = white screen, nothing captured anywhere.
- Only 2 client `console.error(e)` in the whole codebase (admin photo/evidence panels: `apps/admin/src/pages/teaching/panels/evidence-panel.tsx:78`, `apps/admin/src/pages/teaching/session-evidence.tsx:111`) — plain catch-block logging, no forwarding.
- **Consequence:** unhandled promise rejections, React render errors, JS exceptions, and failed non-tRPC fetches on admin/LMS produce **no GlitchTip event and no API log line**. tRPC *server* errors do get captured, but only when the request reaches the API.
- The fix is already designed in `plans/260815-1616-uat-live-test-audit/plan.md` (P3): client global error handler + error boundary + **same-origin report endpoint** (admin/lms → API → GlitchTip) — required because `glitchtip-web` is not resolvable from the browser (loopback bind + private bridge network), so a direct browser DSN is impossible; same-origin forward is the only leak-free path. Acceptance A3/A4 of that plan are exactly the missing pieces.

## 4. GlitchTip access (how to verify events land)

- **Stack:** `docker-compose.observability.yml`, project `cmcv2-obs` (web/worker/postgres/valkey). **Port published loopback-only:** `127.0.0.1:8000 -> 8080` (comment: "never bind 0.0.0.0"). MCP enabled: `GLITCHTIP_ENABLE_MCP=true` at `http://127.0.0.1:8000/mcp`.
- **Live state (verified read-only just now):** all 4 obs containers up (4h); web returns 200, `/_health/` returns `ok`; `cmc-obs-bridge` network exists; prod api/worker are attached to it and healthy. DSN in `.env.prod` is set (`http://e4feff6fd10549519eb734e1fa8fe491@glitchtip-web:8080/1` → project id 1, host `glitchtip-web:8080` over the bridge).
- **Auth key names in `.env.obs` (values redacted, as requested):** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `SECRET_KEY`, `REDIS_URL`, `PORT`, `GLITCHTIP_DOMAIN`, `DEFAULT_FROM_EMAIL`, `EMAIL_BACKEND`, `GLITCHTIP_MAX_EVENT_LIFE_DAYS`, `CELERY_WORKER_AUTOSCALE`, `ENABLE_ORGANIZATION_CREATION`. **There is no GlitchTip admin username/password env key** — GlitchTip users are created through the web UI (`http://127.0.0.1:8000/register`, first-user bootstrap, org creation allowed). `.env.prod` key of interest: `SENTRY_DSN`.
- **Query API (Sentry-compatible):** `GET http://127.0.0.1:8000/api/0/projects/{orgSlug}/{projectSlug}/events/` (and `/issues/`, `/organizations/`) — verified live: returns **401 without an auth token**. Auth = GlitchTip user API token (created in the user settings UI) sent as `Authorization: Bearer <token>` (Sentry-compatible). Documented agent path instead: the built-in MCP — `claude mcp add --transport http glitchtip http://127.0.0.1:8000/mcp` (17 tools: issues, stack traces, …; endpoint confirmed present, 401 until OAuth/token).
- **Verification recipe:** deliberately trigger a server fault (e.g. a bad tRPC call or force a route error), then list issues via the MCP or `/api/0/projects/.../issues/`, confirm the event's `reqId` tag, and grep pino logs by that reqId. Currently only *server* errors can be verified this way — client errors cannot (gap §3).

## 5. nginx logging (infra/nginx/nginx.conf)

- **Access log:** `access_log /var/log/nginx/access.log main` with `log_format main '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"'`.
- **Real client IP: yes (with a caveat).** `set_real_ip_from 172.28.0.0/16; real_ip_header X-Forwarded-For; real_ip_recursive on` → `$remote_addr` in the access log reflects the XFF client, not the docker bridge. Comment states the recovered address is currently the **Cloudflare edge IP**, not the end user's IP — the other half (Caddy trusting `CF-Connecting-IP`) is not done. `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` passes the chain to the API; API trusts only `TRUSTED_PROXY_CIDRS=172.28.0.10/32,127.0.0.1/32`.
- **Request-id passthrough: NOT present.** nginx sets no `X-Request-Id`; the API generates its own reqId and never reads a header. To add: `proxy_set_header X-Request-Id $request_id` in `infra/nginx/api-locations.conf` (nginx built-in `$request_id`) + API falls back to it before `randomUUID` — trivial, but requires API change + redeploy. Currently the browser has no correlation id it can echo back to support staff.

## 6. Existing error-report / tracking routes — NONE

- No `/error-report`, `/api/track`, or client→server error-forwarding endpoint anywhere in `apps/api/src` (all routers grepped; `router.ts` mounts 40+ domain routers — none reporting-related). No such endpoint in either client app. There is currently **no way** for the browser to report an error to the API.

## 7. Log structure (pino vs winston)

- **pino** ^10.3.1 in `apps/api/package.json` (no winston anywhere). `apps/api/src/lib/logger.ts`: one JSON object per line to **stdout**, ISO timestamps, level as name + numeric `levelVal`, `base: undefined`, per-service child logger (`service: 'api' | 'worker'`). Level tunable via `LOG_LEVEL`.
- Docker: both compose files use json-file driver, `max-size: 10m`, `max-file: 3` per container.
- Query: `docker compose -p cmcv2-prod logs api | jq 'select(.levelVal >= 50)'` for errors; `select(.reqId=="…")` for one request.

---

## Verdict vs. the goal

The goal — "any runtime error on the LIVE system is captured end-to-end and traceable from a user report" — is **NOT currently met**, for one dominant reason (client-side blindness) plus two secondary weaknesses (no user/facility on events; no browser-visible correlation id). Server-side (API + worker) capture is complete, correlated via reqId, and live-verified.

Status: DONE_WITH_CONCERNS
Summary: Server-side error capture (pino + reqId + @sentry/node → GlitchTip) is fully implemented, correlated, fail-open, and verified live; but client-side (admin/LMS) has zero error capture — no Sentry browser, no error boundary, no window.onerror/unhandledrejection, and no client→server report route — so pure client runtime errors are untraceable, and GlitchTip events carry no user/facility context and nginx/API have no browser-visible request-id.
Concerns/Blockers: (1) Client gap is the blocker for the end-to-end goal — P3 of plans/260815-1616-uat-live-test-audit (same-origin report endpoint + global error handler + boundary) is the designed fix, with A3/A4 acceptance. (2) Events are anonymized by design (beforeSend) — reqId is the only join key; consider adding userId/facilityId as Sentry tags on the server side if grouping-by-user is wanted (PII trade-off already accepted on-laptop). (3) nginx access log lacks X-Request-Id and the end-user IP is currently the Cloudflare edge IP (Caddy side unfinished). (4) GlitchTip REST/MCP queries need a user API token (bootstrap is manual via /register — no token in .env.obs). (5) AuditLog table has no reqId column yet (Tier 3), so business actions cannot yet join to errors.
