# QA Report — P1 CRM Báo cáo tuyển sinh

**Branch:** `feature/crm-p1-bao-cao-tuyen-sinh`  
**Date:** 2026-08-09  
**Mode:** focused validation (required gates + admin suite + structural acceptance)  
**DB:** synth `@ localhost:55432` (`cmc-synth-pg` up)

## Diff-aware mode

Changed (feature, uncommitted):
- `packages/auth/src/index.ts` + `index.test.ts` — `crm.report`
- `apps/api/src/crm/opportunity-report.ts` + `.test.ts` + `router.ts`
- `apps/admin/src/pages/crm/report.tsx`, `routes/crm.routes.tsx`, `shell/nav-registry.ts`
- `apps/e2e/tests/journeys/crm-report.journey.ui.spec.ts`
- `scripts/acceptance-report/flow-manifest.ts` — P1-10

Mapped tests:
- Strategy A: `opportunity-report.test.ts` (new)
- Strategy C: CRM suite `list/owner-source/stage` (shared CRM router/facility)
- Strategy A/matrix: `@cmc/auth` permission matrix
- Admin: full suite (nav/shell fan-out + no page unit test for report)

Unmapped / weak:
- [!] No unit test for `apps/admin/src/pages/crm/report.tsx` (filters, date ISO +07, inverted range, empty tables)
- [!] No nav-registry/nav-route assertion for `/crm/report` path
- [!] Journey `crm-report.journey.ui.spec.ts` **not executed** in browser this session

## Test Results Overview

| Command | Result | Detail |
|---------|--------|--------|
| `pnpm --filter @cmc/auth test` | **PASS** | 2 files, **1042** tests (src 525 + dist 517 pre-rebuild; post-rebuild still green) |
| `pnpm --filter @cmc/api exec vitest run src/crm/opportunity-report.test.ts src/crm/list.test.ts src/crm/owner-source.test.ts src/crm/stage.test.ts` | **PASS** | 4 files, **35** tests, ~5.6s |
| `pnpm --filter @cmc/api exec tsc -p tsconfig.json --noEmit` | **PASS** | exit 0 |
| `pnpm --filter @cmc/admin exec tsc -p tsconfig.json --noEmit` | **PASS** | exit 0 |
| `pnpm --filter @cmc/admin test` | **PASS** | 55 files, **556** tests, ~28.5s |
| `pnpm acceptance:report` | **FAIL (expected structural)** | exit 1 — stale e2e results vs HEAD; not feature logic fail |

**Totals executed (required + admin):** 1042 + 35 + 556 = **1633 unit tests pass**, 0 fail.  
**Typecheck:** api + admin clean.

### CRM opportunity-report cases covered (8/8 pass)
1. forbids role without `crm.report` (hr → FORBIDDEN)
2. funnelSnapshot current open+won, excludes lost
3. createdAt cohort vs closedAt outcomes (cross-period)
4. lostByReason aggregation in period
5. sale own-only `byAssignee`; facility-wide funnel/source
6. facility isolation (B not in A)
7. right-censoring near-now period
8. no right-censoring historical closed period

## Coverage Metrics

Not full istanbul run. Qualitative:

| Surface | Coverage signal |
|---------|-----------------|
| Permission `crm.report` | Auth matrix test + API forbid test |
| tRPC `crm.opportunityReport` | Strong unit/integration (time semantics, RLS facility, sale own-only) |
| Helper `opportunity-report.ts` | Exercised via procedure tests |
| Admin page `report.tsx` | **None** (render/filter/date helpers untested) |
| Nav `/crm/report` | Registry entry present; no dedicated assert in nav tests |
| Journey P1-10 | Spec exists; **browser not run** |
| Flow manifest P1-10 | Structural OK after auth dist rebuild |

## Failed Tests

None in required suites.

## Performance Metrics

- Auth: ~0.3s
- CRM 4 files: ~5.6s
- Admin full: ~28.5s
- Slow admin tests pre-existing (shifts, session-evidence, check-in, etc.) — not introduced by this feature
- No flaky fail observed in this run (act() warnings pre-existing on schedule/list pages)

## Build Status

- tsc api/admin: OK
- Auth package **source** has `crm.report`; local **`dist/` was stale** (gitignored).  
  - Before rebuild: `acceptance:report` actor-audit → **IDLE-ACTOR P1-10 · sale / giam_doc_kinh_doanh** (false alarm: dist `can()` lacked key)
  - After `pnpm --filter @cmc/auth build`: actor-audit **0 findings**
- CI must build `@cmc/auth` before runtime/acceptance that import package `default` export (`dist`)

## Critical Issues

None blocking unit/type gates.

## Concerns (non-blocking for claimed unit proof)

1. **UI e2e not run** — journey added, browser proof absent. Do not claim P1-10 journey green.
2. **No admin unit test for report page** — date helpers (`+07:00`, inverted range, default month) and empty/loading/error banners untested.
3. **acceptance:report exit 1** — stale Playwright results commit ≠ HEAD; 0/39 proven run. Structural: P1-10 wired (journey path + trpc + actors clean post auth build).
4. **Auth dist rebuild** required locally for actor-audit / any consumer of `@cmc/auth` default export.

## Recommendations

1. Add `apps/admin/src/pages/crm/report.test.tsx` — mock `trpc.crm.opportunityReport`, assert 3 blocks + filter ISO + inverted banner.
2. Extend `nav-registry` / `nav-route-resolution` tests for path `/crm/report` + permission gate for sale/gdkd vs hr.
3. Run ui-e2e journey `crm-report.journey.ui.spec.ts` on CI before acceptance claim.
4. Ensure CI builds packages (auth) before acceptance actor-audit.

## Next Steps (priority)

1. P0 for ship claim: browser journey P1-10 once stack up  
2. P1: admin page unit tests for filters/time labels  
3. P2: nav path regression lock  
4. Re-run `pnpm acceptance:report` after fresh ui-e2e artifacts on this HEAD

## Unresolved questions

- Does CI already build `@cmc/auth` before `acceptance:report` in the same job? (local failure mode depends on that)
- Should journey also cover `giam_doc_kinh_doanh` (manifest lists both actors; journey only drives `sale`)?

---

**Status:** DONE_WITH_CONCERNS  
**Summary:** All required unit/type gates green (auth 1042, CRM 35, api/admin tsc, admin 556). Journey not browser-run; no admin page unit tests; acceptance structural fail only on stale e2e results (actor-audit clean after auth rebuild).
