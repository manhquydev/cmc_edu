# Plan 3 entry checklist (after Plan 2 SessionExercise)

**From:** Plan 2 teaching spine (complete spines)  
**To:** `plans/260811-1118-lms-erp-money-bridge-import-cutover/`

## Frozen contracts Plan 3 must not break

| Contract | Source |
|----------|--------|
| `enrollment.enroll` → reserved only; never writes ranges | ADR 0045 + lmsOps freeze |
| Unit ranges via `lmsOps.addWithUnits` / `grantPast` / `revokeFromNext` only | single writer |
| Dual-gate roster D1 | `onRoster` + `EnrollmentUnitRange` |
| `orderGlobal` unique(program, orderGlobal) | ADR 0046 |
| Receipt provision money path (0041) | must call same grant service when wiring units |

## Implement Plan 3 by

1. Product mapping: gói bán → N units / continuous range in program  
2. `provisionFromReceipt` → call shared grant (prefer extract `grantUnitsService` from lmsOps)  
3. Break-glass A + refund `revokeFromNext`  
4. Import dry-run from live cmc-lms  
5. Quality gate → cutover → close old LMS  

## Do not re-open in Plan 3

- SessionExercise delivery model (done)  
- Cancel restamp unify (done)  
- ParentAccount isActive/tokenVersion (done)  

## Optional polish (parallel, not blockers)

- Admin UI for grant range / assignExerciseSequence  
- Submission keyed by SessionExercise (if re-delivery of same exercise needs isolation)  
- Worker auto-cancel restamp  
