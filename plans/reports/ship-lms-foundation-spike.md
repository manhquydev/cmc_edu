# Ship note — LMS foundation spike (Plan 1)

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Plan:** `plans/260811-1117-lms-foundation-adr-va-spike-unit-range/`

## Delivered

| Area | What |
|------|------|
| ADRs | `docs/decisions/0045-course-unit-entitlement-and-dual-gates.md`, `0046-order-global-stability.md` |
| Domain | `@cmc/domain-lms` (unit-progression port + 19 tests) |
| Schema | Migration `20260811120000_lms_foundation_unit_range` — orderGlobal, neo anchors, EnrollmentUnitRange+FORCE RLS, archivedAt |
| API | `lmsOps.createClassWithUnits`, `lmsOps.addWithUnits`, `lmsOps.rosterForSession` |
| RBAC | `enrollment.grantUnits` → GĐĐT only (sale excluded) |
| Tests | on-roster unit + lms-ops int (3) + auth matrix; provision/finance regression 30 green |

## Procedure freeze (for Plan 2/3)

| Procedure | Status | Ranges |
|-----------|--------|--------|
| `enrollment.enroll` | reserved only | never |
| Receipt provision | → active | none yet (Plan 3) |
| `lmsOps.addWithUnits` | requires active | writes EnrollmentUnitRange |
| `lmsOps.rosterForSession` | dual-gate | requires active ∩ range ∩ stamp |

## Side effects / known

- Stamping sessions feeds ADR 0038 open-tier when sessions end — kill-switch is Plan 2.
- Legacy `classBatch.create` still creates unstamped sessions.
- orderGlobal backfill on existing CurriculumUnit rows by level/monthIndex.

## Post code-review fixes (same cook)

- C1: e2e `seedCurriculumUnit` + `scripts/ensure-curriculum-units.ts` set `orderGlobal`
- H1: `addWithUnits` `SELECT … FOR UPDATE` on Enrollment
- H2: archive day-gate uses `ictDateOnlyOf` + `ictToUtc`

## Plan 2 entry checklist

- [ ] Read 0045/0046  
- [ ] Extend class engine cancel restamp  
- [ ] Server flag for open-tier  
- [ ] Family principal  
