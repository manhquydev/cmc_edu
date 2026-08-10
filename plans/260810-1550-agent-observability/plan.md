# Plan: Agent-friendly observability for CMC EDU (production-grade, staged)

**Status:** Ready to execute — Tier 0 → 1 → 2, commit + test gate after each tier
**Created:** 2026-08-10
**Research source:** `plans/reports/research-260810-1550-agent-friendly-observability.md`
**Decisions (user, 2026-08-10):** build ALL 3 tiers; GlitchTip runs ON THE LAPTOP
(PII locality over always-on — correct for a UAT with student data). Built to
carry into real production, not throwaway.

## Outcome
When something breaks on erp/hoc, the AI coding agent can pull the signal
programmatically — structured logs it can `jq`, a correlated request trace, and
the latest exception with full stack trace over an MCP the agent queries
natively — without a human reading dashboards.

## Selection criterion (the axis everything turned on)
Agent-consumability: CLI / HTTP API / MCP server, or structured text an LLM
greps. Human dashboards are secondary. This is why GlitchTip (official built-in
MCP, verified at glitchtip.com/documentation/mcp) beat Sentry-full, and why
Prometheus/Grafana metrics are deliberately excluded.

## Ground truth (scouted, treat as fact)
- api = tRPC over raw `node:http` (`apps/api/src/server.ts`), worker shares the
  same package/image (`apps/api/src/worker/index.ts`, health server on 3001).
- Current logging = raw `console.error('[api] ...', err)` plain text. No pino,
  no @sentry/node in the lockfile (both net-new deps). No `/metrics`.
- Deploy = docker-compose `cmcv2-prod` on the laptop; internet via reverse SSH
  tunnel → VPS Caddy → Cloudflare. Laptop roomy (39GB) but sleeps on lid-close.
- **Concurrency hazard (learned the hard way):** other Claude Code sessions run
  against this same checkout and a snapshot-then-clean routine has wiped
  uncommitted work before. → COMMIT AFTER EACH TIER, do not batch.

## Tier 0 — Structured logging + reqId correlation — ✅ DONE (2026-08-10)
Implemented: added `pino` to `@cmc/api`; new `apps/api/src/lib/logger.ts` (JSON
to stdout, `LOG_LEVEL`-tunable, level-as-name + `levelVal` for jq range filters,
`service` child for api/worker attribution). Replaced all 20 `console.*` calls in
`server.ts` + `worker/index.ts` with structured `logger` calls. `reqId`
(crypto.randomUUID) attached to the request via a `Symbol` slot — NOT the tRPC
Context (14 construction sites; symbol-on-request = zero blast radius). tRPC
`onError` hook logs procedure errors with the same reqId, and demotes expected
client rejections (UNAUTHORIZED/BAD_REQUEST/…) to debug so the error stream stays
signal. Verified: typecheck clean; DB-less unit tests covering touched files green
(router, boot-checks, worker-health, context.trusted-proxy = 40 tests); runtime
smoke proved JSON output, level filtering (debug suppressed at info), reqId
correlation, and the exact agent `jq` queries (`select(.levelVal>=50)` and
`select(.reqId=="…")`). Full DB-integration suite is CI's job (needs the postgres
service — must NOT point at the live cmcv2-prod DB). NOT yet rebuilt/redeployed —
that happens after all tiers land, or on request.

### Tier 0 — original spec
**Files:** `apps/api/package.json` (+pino), a new `apps/api/src/lib/logger.ts`,
`apps/api/src/server.ts`, `apps/api/src/worker/index.ts`, `apps/api/src/context.ts`.
- Add `pino` (prod dep). One `logger.ts` exporting a configured pino instance
  (JSON to stdout, level from `LOG_LEVEL` env, `NODE_ENV`-aware pretty-off in prod).
- Replace the ~8 `console.error('[api] ...')` / `console.log` calls in server.ts
  and worker with `logger.error({ err, ... }, msg)` — keep the messages, gain structure.
- Generate a `reqId` (crypto.randomUUID) per request in the raw `createServer`
  handler, attach to a child logger, thread it into `createContext` so tRPC
  procedure errors log with the same `reqId` → agent can pull every line for one
  failed request.
- **Gate:** existing tests green; `docker compose logs api | jq 'select(.level>=50)'`
  returns structured error objects; a forced error shows the same reqId across
  the http log line and the tRPC error line. Commit.

## Tier 1 — GlitchTip error tracking + MCP — ✅ CODE DONE (2026-08-10), 1 manual bootstrap left
Implemented:
- `docker-compose.observability.yml` (separate project `cmcv2-obs`, own network/
  volumes — tears down independently of the app). 4 services: glitchtip-web
  (port 127.0.0.1:8000→8080, default `./bin/start.sh` runs migrate+web),
  glitchtip-worker (`./bin/run-worker.sh`), its own postgres:16, valkey:8.
  `GLITCHTIP_ENABLE_MCP=true`. Verified against the official image
  (docker inspect: default CMD `./bin/start.sh`; scripts live in /code/bin).
  Two false starts corrected: the app-sre `run-migrate-and-runserver.sh` command
  doesn't exist in the published image (removed the override), and the worker's
  first-boot `relation "uptime_monitor" does not exist` is a benign migrate race
  that `restart: unless-stopped` recovers. **Stack is UP and web returns 200.**
- `.env.obs` (gitignored, 600) with generated SECRET_KEY + postgres pw.
- `@sentry/node` v10 added to @cmc/api. New `apps/api/src/lib/instrument.ts` —
  imported FIRST in server.ts + worker/index.ts (v10 needs early init). FAIL-OPEN:
  empty SENTRY_DSN → all Sentry.* are no-ops, app never crashes on a down tracker
  (smoke-tested). `beforeSend` scrubs PII (cookies, auth headers, request body/
  query, user email/username/ip) — load-bearing for the on-laptop-student-data
  choice; correlation survives via the reqId tag.
- Error sites wired: a `reportRouteError()` helper logs (pino) AND captures
  (Sentry) with the same reqId tag at all 7 raw-http routes; the tRPC onError
  hook captures server faults tagged with reqId + trpcPath; the worker drain-
  failure catch captures with drain context. reqId is the single pivot key
  across pino ↔ GlitchTip.
- `SENTRY_DSN=` (empty) added to `.env.prod` + documented in `.env.prod.example`.
  api/worker inherit it via their existing `env_file: .env.prod` — no compose edit.
- Verified: typecheck clean; fail-open smoke passed; DB-less tests green (29).

**MANUAL BOOTSTRAP LEFT (needs the operator — can't be fully automated):** open
http://127.0.0.1:8000/register, create the first user + org + a project, copy
its DSN into `.env.prod` `SENTRY_DSN=`, then `claude mcp add --transport http
glitchtip http://127.0.0.1:8000/mcp`. After that: rebuild+redeploy api/worker,
throw a test error, confirm the GlitchTip issue appears and the agent can read it
over MCP (smoke-test the 17 tools before relying on them).

### Tier 1 — original spec
**Files:** `docker-compose.prod.yml` (or a separate `docker-compose.observability.yml`
overlay), `apps/api/package.json` (+@sentry/node), `logger.ts`/`server.ts`/`worker`
Sentry init, `.env.prod` (+GlitchTip DSN + secrets), `.env.prod.example`.
- Add GlitchTip stack (web, worker, its own postgres, redis) as a compose overlay
  with `GLITCHTIP_ENABLE_MCP=True`. Loopback-bind its web port; it's an internal
  tool, reached by the agent locally (or via a dedicated tunnel block if remote
  access is wanted later — deferred).
- Wire `@sentry/node` into api + worker (Sentry-compatible SDK → points at the
  GlitchTip DSN). Capture unhandled errors + the catch blocks that currently only
  console.error. Scrub PII in `beforeSend` per the report's note (student emails
  in breadcrumbs).
- Connect Claude Code: `claude mcp add --transport http glitchtip http://<local>/mcp`.
- **Gate:** a deliberately thrown test error appears as a GlitchTip issue with
  stack trace; the agent can retrieve it over MCP (smoke-test the 17 tools before
  relying on them — the built-in MCP is new). Commit.

## Tier 2 — Uptime dead-man's-switch
**Files:** `apps/api/src/worker/index.ts` (ping), `.env.prod(.example)`.
- healthchecks.io (SaaS free tier, real REST API) or self-hosted. Worker pings
  the check URL each successful cycle. Grace period tuned so a scheduled laptop
  sleep does NOT alert, but an unexpected multi-hour gap does.
- **Gate:** stopping the worker triggers the check to go down after grace; the
  agent can read check state via the healthchecks REST API. Commit.

## Tier 3 — Full-context capture (added 2026-08-10, from research-260810-1615)
Scope grew: operator wants to capture ALL user actions + debug with full
situational context (user did X → frontend → API → backend error), not just
backend signal. Research verdict (`plans/reports/research-260810-1615-full-context-capture-agent-debug.md`):
- **Session replay = OpenReplay self-hosted** (NOT PostHog — PostHog self-host
  replay is officially unsupported/hobby-scale, conflicts with the PII-self-host
  requirement). OpenReplay is self-host-first, official MCP works with self-host,
  input-masking default-on. Operator chose **full capture with careful masking**.
- **Correlation backbone = a `sessionId` header** from the React/@trpc client,
  propagated into pino logs + GlitchTip tag + OpenReplay event. NOT OpenTelemetry
  (overkill for a one-host monolith — a header string achieves the same agent-pivot).
  Builds directly on the Tier 0 `reqId`.
- **AuditLog gap**: add ONE nullable `reqId` column (schema migration) so the 56
  captured business actions join to errors/sessions. Do NOT add ip/userAgent
  (avoid widening PII surface on the compliance table — reqId join is enough).
- **PII / minors**: session replay records real students. Masking default-on, but
  PII-dense screens (grading, attendance, CRM) need manual block-selector rules.
  Operator accepted this with careful masking.
- **Agent debug loop**: GlitchTip MCP (error+stack) + OpenReplay MCP (replay) +
  `jq` pino by reqId + AuditLog by reqId — four sources, one join key.
- Order: finish Tier 1 (GlitchTip) first, then Tier 3 (OpenReplay + sessionId +
  AuditLog.reqId), then Tier 2 (uptime).

## Deliberately NOT building (report §7 — over-engineering for a solo UAT)
Prometheus + Grafana metrics stack, Loki, full Sentry self-host, Uptime Kuma
(no official REST API). Revisit only if the UAT extends into sustained production
with SLO/trend questions an agent actually needs to answer.

## Risks / rollback
- GlitchTip adds ~1.5–2GB RAM on the laptop — fine at 39GB, but it's 4 more
  containers to keep healthy. Overlay file keeps it separable (`down` the overlay
  without touching the app stack).
- Sentry SDK init must be fail-open: if GlitchTip is down (laptop just booted,
  GlitchTip slower to start), the app must not block or crash on a dead DSN.
- PII: `beforeSend` scrubbing is load-bearing for the on-laptop-with-student-data
  choice — review it before pointing real traffic at it.
- Rollback per tier: each tier is its own commit; revert the commit + redeploy.

## Open questions
1. GlitchTip overlay: fold into `docker-compose.prod.yml` or keep a separate
   `docker-compose.observability.yml`? (Leaning separate — cleaner teardown.)
2. healthchecks.io SaaS vs self-host — SaaS is less to run but pings leave the
   network; self-host keeps everything local. Decide at Tier 2.
