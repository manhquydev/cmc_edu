# Ship note — LMS teaching spine API ops (Plan 2 slice)

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Plan:** `plans/260811-1118-lms-teaching-spine-api-ui-family/`  
**Commits:** `7e4034b` (API), `30cf3de` (tests)

## Delivered this cook

| Area | What |
|------|------|
| Class engine | `lmsOps.cancelSessionAndRestamp` — cancel + restamp non-cancelled sessions from neo |
| Enrollment ops | `grantPast`, `revokeFromNext`, `archiveEnrollment`, `unarchiveEnrollment` |
| Open-tier | `LMS_OPEN_TIER_ENABLED` kill-switch (default ON); `LMS_ENTITLEMENT_GATE` range intersect (default OFF) |
| Tests | +4 lms-ops int; +3 open-tier flag tests; on-roster unit unchanged green |

## Validation

```
pnpm --filter @cmc/domain-lms exec vitest run  → 38 pass
pnpm --filter @cmc/api exec vitest run \
  src/lms-ops src/exercise/open-tier.test.ts src/enrollment/block-lms.test.ts
  → 33 pass
pnpm --filter @cmc/auth exec vitest run src/index.test.ts → 534 pass
```

## Env flags (ops)

| Var | Default | Effect |
|-----|---------|--------|
| `LMS_OPEN_TIER_ENABLED` | ON (`unset`/`1`/`true`) | OFF=`0`/`false`/`off` → empty homework open set |
| `LMS_ENTITLEMENT_GATE` | OFF | ON=`1`/`true`/`on` → open units ∩ EnrollmentUnitRange |

## Not in this slice (Plan 2 remaining)

- Phase 4: ParentAccount `isActive` / `tokenVersion` (family login already has dummy-hash + ownership sinks)
- Phase 5: attendance window / journal / photoConsent polish
- Phase 6 remainder: SessionExercise library delivery + grading cron
- Phase 7: teacher/admin/family UI spines

## Procedure freeze (unchanged)

| Procedure | Ranges |
|-----------|--------|
| `enrollment.enroll` | reserved only |
| `lmsOps.addWithUnits` | active + not before current unit |
| `lmsOps.grantPast` | active + allows past (admin backfill) |
| `lmsOps.revokeFromNext` | truncate/delete from order onward (no past subtract) |
| `lmsOps.rosterForSession` | dual-gate + archive day-gate |

## Post code-review fixes (same cook)

| ID | Fix |
|----|-----|
| C1 | `revokeFromNext` rejects `fromOrderGlobal < class.currentOrder` |
| C2 | `restampBatchSessions` freezes `done` stamps (still counts them for progression) |
| H1 | `grantPast` / `revokeFromNext` re-fetch ranges after `FOR UPDATE` |
| H3 | `addWithUnits` rejects archived enrollments |
| OT | Entitlement gate scopes ranges by program; static `isEntitled` import; load ranges only when gate ON |

## Known risks

- Dual cancel path: legacy `classSession.cancel` still does not restamp — UI must use `lmsOps.cancelSessionAndRestamp` until unified.
- Entitlement gate off by default so ADR 0038 open-tier behavior unchanged until ops flip the flag.
- UI spines / family schema (`isActive`/`tokenVersion`) / SessionExercise delivery not started.
- realignHistory / slot edit deferred from phase 2.
