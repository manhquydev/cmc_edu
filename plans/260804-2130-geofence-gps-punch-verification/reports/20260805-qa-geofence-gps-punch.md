# QA Report — Geofence GPS Punch Verification

**Date:** 2026-08-05 (UTC 2026-08-04T17:07Z)  
**Branch:** `feature/geofence-gps-punch-verification`  
**Agent:** tester (QA Lead)  
**DB:** `cmc-dev-pg` Up (localhost:5433)

## Status: DONE_WITH_CONCERNS

Tests green. Required artifacts present. Typecheck fails on unused locals in test file.

---

## 1. File existence gate

| File | Status |
|------|--------|
| `apps/api/src/checkin/geo-distance.ts` | EXISTS |
| `apps/api/src/checkin/punch-geo-gate.test.ts` | EXISTS |
| `apps/api/src/facility/geofence-router.ts` | EXISTS |
| `packages/db/prisma/migrations/20260804163331_facility_geofence_and_punch_verification/migration.sql` | EXISTS |
| `packages/db/prisma/migrations/20260804170000_verification_rebackfill/migration.sql` | EXISTS |
| `apps/admin/src/lib/capture-geolocation.ts` | EXISTS |
| `docs/decisions/0044-geofence-gps-or-gate.md` | EXISTS |
| `apps/e2e/tests/journeys/checkin-geofence.journey.ui.spec.ts` | EXISTS |

**Result:** 8/8 present.

---

## 2. Test results

### Suite 1 — `@cmc/api` (geofence / checkin / related)

```text
pnpm --filter @cmc/api exec vitest run \
  src/checkin/ \
  src/facility/geofence-router.test.ts \
  src/facility/network-router.test.ts \
  src/context.trusted-proxy.test.ts \
  src/trpc-error-formatter.test.ts \
  src/attendance/resolve-day-credit.test.ts
```

| Metric | Value |
|--------|-------|
| Test files | **12 passed** / 12 |
| Tests | **109 passed** / 109 |
| Failed | 0 |
| Duration | ~8.4s |
| Exit | 0 |

Files:

| File | Tests | Time |
|------|------:|-----:|
| `checkin/punch-geo-gate.test.ts` | 16 | 1043ms |
| `checkin/manual-punch-approval-track.test.ts` | 14 | 895ms |
| `checkin/punch-offsite.test.ts` | 12 | 791ms |
| `facility/network-router.test.ts` | 9 | 444ms |
| `trpc-error-formatter.test.ts` | 10 | 401ms |
| `checkin/ip-match.test.ts` | 17 | 384ms |
| `facility/geofence-router.test.ts` | 5 | 404ms |
| `checkin/schema-shape.test.ts` | 5 | 374ms |
| `checkin/status-check.test.ts` | 3 | 316ms |
| `context.trusted-proxy.test.ts` | 7 | 6ms |
| `attendance/resolve-day-credit.test.ts` | 7 | 6ms |
| `checkin/geo-distance.test.ts` | 4 | 5ms |

### Suite 2 — `@cmc/admin` check-in-out UI

```text
pnpm --filter @cmc/admin exec vitest run src/pages/attendance/check-in-out.test.tsx
```

| Metric | Value |
|--------|-------|
| Test files | **1 passed** / 1 |
| Tests | **19 passed** / 19 |
| Failed | 0 |
| Duration | ~3.0s |
| Exit | 0 |

Notes: jsdom noise only (`HTMLCanvasElement.getContext`, `Window.scrollTo`) — not failures.

### Combined

| Suite | Files | Tests | Pass | Fail |
|-------|------:|------:|-----:|-----:|
| API | 12 | 109 | 109 | 0 |
| Admin | 1 | 19 | 19 | 0 |
| **Total** | **13** | **128** | **128** | **0** |

---

## 3. Optional typecheck (`@cmc/api`)

```text
pnpm --filter @cmc/api exec tsc -p tsconfig.json --noEmit
```

**Result: FAIL** (exit 2), completed under 2 min.

```text
src/checkin/punch-geo-gate.test.ts(37,7): error TS6133: 'HN_FAR' is declared but its value is never read.
src/checkin/punch-geo-gate.test.ts(284,11): error TS6133: 'employee' is declared but its value is never read.
```

| Issue | Location | Fix |
|-------|----------|-----|
| Unused `HN_FAR` | L37 | Remove const, or use in a far-geo negative case |
| Unused `employee` | L284 (`delete geofence after match…`) | Drop binding: `await seedAppUser(...)` without assign |

Vitest does not enforce `noUnusedLocals`; CI `typecheck-and-test` will fail if this gate runs tsc on tests.

---

## 4. Coverage / gaps (diff-aware notes)

Changed surfaces (uncommitted / branch work) include checkin router, geofence router, trusted proxy, error formatter, admin check-in-out, migrations, e2e journey.

**Covered by this run:**

- Geo distance pure unit
- Punch geo gate (OR gate, snapshot radius, delete geofence after match)
- Offsite / IP match / manual punch approval track
- Geofence + network routers
- Trusted proxy context
- tRPC error formatter
- Day credit resolve
- Admin check-in-out page (19 cases)

**Not executed here (out of requested suite):**

- E2E journey `apps/e2e/tests/journeys/checkin-geofence.journey.ui.spec.ts` — file exists, Playwright not run
- Full `@cmc/api` / monorepo suite
- Migration apply smoke against empty DB (assumed already applied on local `cmc-dev-pg`)
- Admin typecheck (`@cmc/admin` tsc)

**Suggested follow-ups:**

1. Fix TS6133 in `punch-geo-gate.test.ts` before merge (blocks typecheck).
2. Run e2e geofence journey in CI / local Playwright when stack up.
3. Confirm both migrations applied on target envs (`20260804163331_*`, `20260804170000_*`).

---

## 5. Critical issues

| Severity | Issue | Blocking merge? |
|----------|-------|-----------------|
| Medium | `tsc` unused locals in `punch-geo-gate.test.ts` | Yes if typecheck required on CI |
| Low | jsdom canvas/scrollTo noise in admin tests | No |
| Info | E2E journey not run in this QA pass | No for unit gate; yes for full acceptance |

---

## 6. Recommendations (priority)

1. **P0** — Remove unused `HN_FAR` + `employee` (or use them) so API typecheck passes.
2. **P1** — Run `checkin-geofence.journey.ui.spec.ts` when Playwright env ready.
3. **P2** — Keep geofence gate tests in PR CI path (already in `src/checkin/` + facility tests).

---

## 7. Unresolved questions

- None on suite scope. Confirm whether CI typechecks test files (likely yes given TS6133).
- Local DB migration state not re-verified this run (container already up 33m).

---

## Summary

- **128/128** unit/integration tests passed (API 109 + admin 19).
- **8/8** required files present.
- **Typecheck FAIL** — 2 unused symbols in `punch-geo-gate.test.ts`.
- E2E journey present, not executed.

**Status: DONE_WITH_CONCERNS**
