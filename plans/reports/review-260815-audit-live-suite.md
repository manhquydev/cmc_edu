# Review — Audit Capture + Live Test Suite (feat/back-before-design)

- **Date:** 2026-08-15
- **Reviewer:** delegated review agent (read-only; no files under review modified)
- **Scope:** `apps/api/src/lib/track-error-route.ts` + test + `server.ts` mount · admin/LMS client capture (`error-report.ts`, `error-boundary.tsx`, `main.tsx`, `app.css`) · `infra/nginx/api-locations.conf` · `apps/e2e` live suite (config, `src/live/*`, `tests/live/*`)
- **Verdict:** **APPROVE_WITH_NOTES**

## Summary of what was verified

The end-to-end contract (client → `/api/track-error` → pino reqId+clientCode → Sentry/GlitchTip tags) is consistent between the two client apps and the server route. The unauthenticated design is acceptable **in principle** (window.onerror/unhandledrejection fire outside session guarantees; the payload is data the browser already has; nginx throttles; 64 KB body cap; CORS preflight blocks cross-origin JSON POSTs) — but the chosen rate budget is far looser than the design intent (see HIGH-1). No log-injection vector via newlines: pino v10 emits JSON lines and escapes string values, and the attacker controls only values, never keys. No correctness bug found in body parsing, error paths, or the fail-open promise; mount placement, provider wiring, and nginx location precedence are all safe. The live suite is gated, paced, read-only w.r.t. the DB, and credentials are gitignored — but it mutates live business data and rotates the production super-admin password (MEDIUM-1/2). No public API/UI contract changed (all additions).

---

## Findings by severity

### CRITICAL
None.

### HIGH

**H1 — Unauthenticated endpoint shares the 60 r/s `api` zone: log/GlitchTip flood + shared-bucket availability impact**
- Evidence:
  - `infra/nginx/api-locations.conf:59-64` — `location = /api/track-error { limit_req zone=api burst=20 nodelay; ... client_max_body_size 64k; }`
  - `infra/nginx/nginx.conf:65` — `limit_req_zone $binary_remote_addr zone=api:10m rate=60r/s;` (shared with `/trpc/`, `api-locations.conf:6-10`)
  - `infra/nginx/nginx.conf:47-53` — after `set_real_ip_from`/`real_ip_header X-Forwarded-For`, `$binary_remote_addr` is the **Cloudflare edge IP** (per the in-file comment), i.e. the bucket is shared by every visitor behind that edge
  - `apps/api/src/lib/track-error-route.ts:28` — 64 KB cap ⇒ each accepted request can push ~64 KB of attacker-chosen text into pino + a Sentry/GlitchTip event
- Impact: (1) a single attacker sustains 60 req/s × up to 64 KB ≈ 3.8 MB/s of attacker-controlled data into pino (Docker json-file rotation ~10 MB × 3 → logs churned away in seconds, i.e. observability loss) and ~60 GlitchTip events/s (issue spam, storage/quota, alert fatigue); (2) because the same bucket throttles `/trpc/`, a continuously saturated bucket starves **legitimate traffic behind the same CF edge IP** (429s on the whole API for those users); (3) fabricated reports can spoof page URLs/kind to mislead the operator.
- Fix (cheap, one file): give this endpoint a dedicated tight zone — e.g. `limit_req_zone $binary_remote_addr zone=trackerr:10m rate=10r/m;` plus `limit_req zone=trackerr burst=10 nodelay;` in the track-error location. Legitimate clients send ≤1 report per 2 s, ≤10 per page load (`error-report.ts:25-26,31-32`), so 10 r/m + burst 10 comfortably covers a NAT'd office without opening the flood gate. Keep `client_max_body_size 64k`. Optionally also add a server-side per-key daily cap or hash-based dedupe for defence in depth.

### MEDIUM

**M1 — Live campaign writes persistent business records into cmc_prod with no automated cleanup**
- Evidence: `tests/live/00-setup-roles.spec.ts:64-71` (4 staff accounts), `01-crm-funnel.spec.ts:44-48` (opportunity), `02-receipt-approve-enroll.spec.ts:48,69-72` (class + real receipt with tuition 5000001; approval provisions Student/ParentAccount), `03-class-attendance.spec.ts:70-74,90-108` (2nd course/class + 2nd receipt + attendance), `src/live/live-state.ts:88-92` and `live-evidence.ts` README "Data created (cleanup log)" (ledger only — nothing enforces deletion).
- Impact: each rerun (≈14 already) accumulates financial receipts, enrollments, classes, audit rows in the "fresh" DB; acceptance metrics and the finance/audit queues get progressively noisier.
- Fix: add a documented cleanup procedure (ideally a guarded, run-scoped cleanup spec deleting by the runId-prefixed identities) and a retention decision for receipts/enrollments; state in the plan that cmc_prod is intentionally a mutable UAT fixture.

**M2 — Campaign rotates the LIVE super-admin password and leaves staff accounts with known plaintext passwords**
- Evidence: `src/live/live-auth.ts:187-199` (freshStaffLogin performs the forced rotation and persists the **new** password to `apps/e2e/.live-credentials.json`), `00-setup-roles.spec.ts:44-47` (bootstrap login forces the rotation), `live-credentials.ts:82-87` (plaintext store).
- Impact: the documented `SUPER_ADMIN_PASSWORD` in `.env.prod` becomes stale; the only working password lives in the gitignored file (loss ⇒ DB-level reset); the 4 role accounts remain active in production with passwords known to whoever has the file.
- Fix: after the campaign, rotate the super-admin password back (or record the handoff outside git), and deactivate/rotate the campaign staff accounts; consider a campaign-end cleanup spec.

**M3 — Full page URL (incl. query string) is persisted to pino + GlitchTip `url` tag; deep links carry staff UUIDs**
- Evidence: `apps/admin/src/lib/error-report.ts:86` and `apps/lms/src/lib/error-report.ts:86` (`url: ... window.location.href`), `apps/api/src/lib/track-error-route.ts:122-137` (message/url logged and tagged), `lib/instrument.ts:39-54` (beforeSend strips request.query_string but **not** the custom `url` tag or event message), `infra/nginx/nginx.conf:97` (comment: "Deep links may carry staff UUIDs (e.g. payroll ?userId=)").
- Fix: send `window.location.origin + window.location.pathname` (drop query/hash) from the client, or strip `?.*`/`#.*` server-side before logging/tagging.

### LOW

**L1 — Admin `reportError` is not fully fail-open (LMS copy is)**
- Evidence: `apps/admin/src/lib/error-report.ts:93-100` — only the fetch is `.catch`ed; `JSON.stringify(body)` can throw on an odd/circular `extra` from a future caller and escape into the window.onerror handler (re-enters the capture loop; self-limited by the 2 s dedupe but noisy). `apps/lms/src/lib/error-report.ts:70-98` wraps the whole path in try/catch.
- Fix: mirror the LMS try/catch around body construction + fetch; add `keepalive: true` for parity so unload-time reports are not dropped.

**L2 — Client sends `route` (pathname) that the server ignores**
- Evidence: `apps/admin/src/lib/error-report.ts:88`, `apps/lms/src/lib/error-report.ts:87` vs `apps/api/src/lib/track-error-route.ts:108-117` (only code/kind/url/stack/userAgent/extra read).
- Fix: drop `route` from the payloads or log it server-side (the pathname is arguably more useful than the full URL for M3).

**L3 — Empty-string `code` returns 200 with `code: ''` instead of the reqId fallback**
- Evidence: `apps/api/src/lib/track-error-route.ts:108` (`toNullableString('') → ''`) and `:146` (`code ?? reqId` keeps `''`).
- Fix: treat empty as null — `toNullableString` returns null for empty strings, or use `code || reqId`.

**L4 — Stream-abort errors are mislabeled as 413; body isn't explicitly drained after the cap**
- Evidence: `apps/api/src/lib/track-error-route.ts:39-50` (readBodyWithLimit throws on **any** error, incl. client abort) + `:86-91` (every throw → 413 to a possibly dead socket).
- Fix: throw a tagged `PAYLOAD_TOO_LARGE` for the cap and a distinct error for stream/abort; optionally `req.destroy()` after the 413 so connection state is deterministic. Cosmetic today (browsers send content-length, so nginx 413s first).

**L5 — local-sim nginx config does not mirror the new location (drift)**
- Evidence: `infra/nginx/local-sim-api-locations.conf` has no `/api/track-error` block (grep-verified) vs `infra/nginx/api-locations.conf:59-64`.
- Fix: copy the location into local-sim config (or document the intentional omission) so local simulation exercises the same proxy behavior.

**L6 — Plaintext live credentials file uses default permissions**
- Evidence: `src/live/live-credentials.ts:86` (`writeFileSync` default mode); observed `apps/e2e/.live-credentials.json` is `-rw-rw-r--` and holds the super-admin + 4 staff passwords + session cookies.
- Fix: write with `{ mode: 0o600 }` and chmod the existing file.

**L7 — live-otp builds SQL by string interpolation**
- Evidence: `src/live/live-otp.ts:78-101` (`"... ILIKE '%" + emailLower + "%' ..."` as postgres superuser via docker exec).
- Risk is low (input is a test-generated email, no quotes/%/_), but parameterize via psql `-v` variables or validate the email charset to keep the read-only claim airtight.

**L8 — Attendance slot math is flaky near midnight ICT**
- Evidence: `tests/live/03-class-attendance.spec.ts:41-47` (`ictHhmmMinus(1)` = 23:xx **yesterday** when the run starts 00:00–00:30 ICT) + `:67-74`.
- Fix: clamp the slot into an already-open window (e.g. max(now−1 h, 07:00)) or assert the picked session's mark window is open before clicking.

**L9 — Skipped-spec evidence depends on afterEach running after in-body `test.skip()`; `recordSkipped*` looks unused**
- Evidence: `tests/live/04-parent-otp.spec.ts:32` (`test.skip(...)` in body), `src/live/live-evidence.ts:102-115,233-235` (`recordSkippedSpec`/`recordSkipped` never called by the specs).
- Fix: verify Playwright runs afterEach for skipped tests (it does for skipped-in-body, but confirm), else the evidence misses skipped specs; remove the unused helpers.

---

## Verified non-issues / confirmations (per review focus)

- **(a) Log injection:** no newline-injection vector — pino v10 (`apps/api/package.json:36`) serializes values as JSON on one line (`lib/logger.ts:27-40`; stdout only, no transport); attacker-controlled fields are values only, keys are fixed (`track-error-route.ts:122-125`). Sensitive leakage: only M3 applies.
- **(b) Contract match:** client body keys `code/message/stack/url/userAgent/kind/extra` (admin `error-report.ts:82-91`, lms `error-report.ts:82-91`) exactly match the server's reads (`track-error-route.ts:108-117`); 200 `{ok, code}` / 400 missing-message / 413 cap all covered by tests (`track-error-route.test.ts:56-116`, incl. content-length fast path and streaming cap). Fail-open verified end to end: `lib/instrument.ts:28-30` (no init without SENTRY_DSN ⇒ no-op), route try/catch (`track-error-route.ts:129-141`), server outer catch (`server.ts:204-211`) logs + reports instead of crashing.
- **(c) Side effects:** mount sits before the `/trpc/` normalization and matches a distinct path (`server.ts:203-212`); nginx exact-match `= /api/track-error` has highest precedence, no conflict with `/trpc/`, `/auth/`, `/upload/`, `= /health`, `= /api/auth/sso/callback`, or the SPA `location /` on either vhost, and both vhosts `include` the shared file (`nginx.conf:113,141`) so same-origin works on erp **and** hoc. Client handlers use `addEventListener` (no overwrites) registered pre-render; the ErrorBoundary wraps the providers but the fallback uses global token CSS vars only (`app.css` diff, `data-astryx-theme="neutral"`), so it renders without providers without breaking them.
- **(d) Live suite safety:** `PLAYWRIGHT_LIVE=1` gate (`playwright.live.config.ts:29-35`), workers=1 (`:64`), no webServer + health-only globalSetup (`:71`, `live-global-setup.ts:15-31`), DB access is read-only SELECTs (`live-otp.ts:33-40`), login pacing 20 s floor (`live-auth.ts:49-59`, at most 5 real logins), cookie replay on reruns; credentials gitignored (`apps/e2e/.gitignore:6-7`) and `.env.prod` gitignored (`.gitignore:55`). No self-inflicted rate-limit exhaustion (suite traffic is far below all zones; OTP path uses the tight auth zone once).
- **(e) Public contracts:** all additions — new POST route, new nginx location, client wrappers, separate gated Playwright config; no existing route/UI/config changed (verified against working tree diffs). e2e typecheck includes the new config (`apps/e2e/tsconfig.json:8`).

---

## Verdict

**APPROVE_WITH_NOTES**

The audit-capture design is sound and proven by the live campaign (0 client/server errors, end-to-end capture verified). H1 is a genuine hardening gap (rate budget ~3 orders of magnitude looser than the client's own dedupe, shared with core API, keyed on CF edge IP) but is a one-line nginx fix and does not invalidate the approach for the current single-operator UAT; M1–M3 need operational follow-up decisions (cleanup + retention, password/account handling, URL sanitization). No correctness, regression, or contract-break issues found. Recommend landing the H1 zone change and an explicit cleanup/password handoff before treating the live environment as long-lived.

---

Status: DONE_WITH_CONCERNS
Summary: The audit-capture pipeline (client → /api/track-error → pino/Sentry with reqId pivot) is correct, fail-open, and safely mounted with no log-injection or contract mismatches; the live suite is gated, paced, and read-only against the DB. Main concerns: the unauthenticated endpoint's 60 r/s shared nginx budget enables log/GlitchTip flooding and shared-bucket 429s (H1, cheap fix), and the campaign rotates the live super-admin password and accumulates business records in cmc_prod with cleanup left to the coordinator (M1/M2).
Concerns/Blockers: H1 rate-zone tightening; M1 cleanup/retention procedure; M2 super-admin password handoff + staff-account deactivation; M3 query-string leakage into logs/GlitchTip; L1–L9 as listed.
