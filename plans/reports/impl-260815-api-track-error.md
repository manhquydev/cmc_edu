# Implement: POST /api/track-error (same-origin client error report)

**Date:** 260815 · **Branch:** feat/back-before-design · **Scope:** `apps/api/src/**` only
**Based on:** `plans/reports/scout-260815-observability.md` (client-side gap §3) + `plans/260815-1616-uat-live-test-audit/plan.md` P2-A/P3 contract

---

## Files changed (all under apps/api/src/)

| File | Change |
|---|---|
| `apps/api/src/lib/track-error-route.ts` | **new** — handler + `TRACK_ERROR_PATH` (`/api/track-error`) + `MAX_TRACK_ERROR_BYTES` (64 KB) |
| `apps/api/src/server.ts` | +1 import, +1 raw-route mount block (POST, before the `/trpc/` normalization) |
| `apps/api/src/lib/track-error-route.test.ts` | **new** — 7 focused tests (fake req/res pattern, no DB/server) |

No other files touched — `git status` confirms only these 3 files under `apps/api/src/` (other working-tree changes, incl. the parallel client-side `apps/{admin,lms}/src/lib/error-report.ts` / `error-boundary.tsx`, belong to other jobs and were not modified).

## Route contract

`POST /api/track-error` (raw `node:http` route, same mount pattern as `/auth/*` and `/upload/*`):

- **Body JSON** (leniently parsed): `{ code?: string|null, message: string, stack?: string|null, url?: string|null, userAgent?: string|null, kind?: string|null, extra?: object|null }`
- **200** `{ ok: true, code }` — returns the client's `code` when provided, else the server-generated **reqId** (the same Symbol-slot reqId stamped on the request, passed in from `server.ts` as a 3rd handler arg so pino line and Sentry tags share the correlation pivot).
- **400** — non-JSON body, or `message` missing / not a non-empty string.
- **413** — body > 64 KB (both a `content-length` fast-path and a streaming cap via `readBodyWithLimit`, same technique as `exercise/upload-route.ts`).
- **Log** (pino): `log.error({ reqId, clientCode: code ?? null, kind, url, message, err: undefined }, 'client error report')` — verified live in the test output; pino drops the literal `err: undefined` (no server Error object exists for a client report).
- **Sentry** (fail-open, wrapped in try/catch — a down GlitchTip never 5xxes): `Sentry.captureException(new Error(message), { tags: { clientCode: code ?? null, reqId, kind: kind ?? null, url: url ?? null }, extra: { stack, userAgent, clientExtra: extra } })`. `beforeSend` PII scrub in `lib/instrument.ts` leaves `tags`/`extra` intact (it only strips request headers/cookies/data/breadcrumbs).
- **Auth:** intentionally none — `window.onerror`/`unhandledrejection`/boundary fires are unauthenticated by nature; payload is console-visible error text only. Throttling is delegated to nginx (see concerns).

Deviation from the literal spec: `kind`/`url` tags are coerced `?? null` (spec wrote them bare) — for a spec-compliant client there is zero difference; for a malformed client it avoids an undefined tag value silently vanishing during envelope serialization. `@sentry/core`'s `Primitive` tag type accepts `null` (verified in the installed 10.69.0 types), so this typechecks under strict mode.

## Typecheck

```
pnpm --filter api typecheck   # tsc -p tsconfig.json --noEmit
EXIT: 0   (clean, no errors)
```

## Test status

Raw-route harness exists (fake req/res with `Readable.from`, e.g. `auth/password-routes.test.ts`) → added focused tests:

```
pnpm --filter api exec vitest run src/lib/track-error-route.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Coverage: valid report + client code → 200 `{ok:true, code:<client code>}`; valid report without code → 200 `{ok:true, code:<reqId>}`; missing message → 400; non-string message → 400; malformed JSON → 400; body over 64 KB → 413 (streaming limit); declared `content-length` over cap → 413 (fast path). The test forces `SENTRY_DSN=''` before a dynamic import so `captureException` is a deterministic no-op (fail-open) in any host env.

Full api suite NOT run (requires a live dev Postgres for the integration tests) — the touched behavior is fully covered by the focused suite + typecheck.

## Concerns

1. **nginx rate-limit zone does NOT cover `/api/track-error`** — `infra/nginx/api-locations.conf` has zones only for `/trpc/`, `/auth/`, `= /api/auth/sso/callback`, `/health`, `/upload/`. **Worse:** there is no `location /api/` block at all, so through the production nginx (`nginx.conf` server blocks) a `POST /api/track-error` falls through to `location /` → rewritten to `/admin/...`/`/lms/...` → the SPA container returns `index.html`. The endpoint is fully reachable when hitting the API container directly (local dev, docker network, e2e), but **not through the prod nginx proxy until an nginx location block is added** (e.g. `location = /api/track-error { limit_req zone=api burst=20 nodelay; ... }`). Per task constraints, nginx was NOT edited — this is a required deploy-time follow-up (P4 of the plan), not a code defect.
2. **Client side is a parallel job** — `apps/admin|lms/src/lib/error-report.ts` / `error-boundary.tsx` already exist as untracked files from another P3 worker; this endpoint's contract matches the shared P2-A design so they can consume it as-is.
3. Sentry tag `clientCode` may be `null` when the client sends no code — GlitchTip accepts it (Sentry-compatible ingest normalizes null); no crash path either way thanks to the fail-open try/catch.

Status: DONE_WITH_CONCERNS
Summary: POST /api/track-error implemented as a raw node:http route (64 KB cap → 413, bad JSON/missing message → 400, 200 {ok:true, code} with reqId pivot), logged via pino with the per-request reqId and captured to Sentry/GlitchTip fail-open; api typecheck clean and 7 focused tests green.
Concerns/Blockers: Prod nginx has NO location block or limit_req zone covering /api/track-error — through the nginx proxy the POST currently falls through to the SPA fallback; an nginx `location = /api/track-error` (with a limit_req zone) must be added at deploy time (out of scope for this job, per instructions).
