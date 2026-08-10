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

## Tier 1 — GlitchTip error tracking + MCP (on the laptop)
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
