# Cook report — P0 ship / P1 form tests / P2 demote dual HITL

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Commit:** `ba66214`  
**PR:** https://github.com/manhquydev/cmc_edu/pull/110  

## Outcome

Shipped the locked structure package:

| Phase | Result |
|-------|--------|
| **P0** | `scripts/ratchet-baseline.json` updated for densify inline styles (was failing CI `typecheck-and-test`). `pnpm test:ui-frames` + `node scripts/ui-ratchet.mjs` green locally. |
| **P1** | Form unit HITL: `aftersale-detail.test.tsx` (new), expand `kpi-detail.test.tsx` + `shifts-detail.test.tsx` mutate/confirm paths. |
| **P2** | List demote: aftersale + KPI rows → **Mở phiếu** only. KPI **bulk period settle** kept. Parents link-request Duyệt **not** demoted. E2E journeys walk form path. |

## Structure lock (resource-centric)

- **List** = index + open form (+ KPI period bulk only).
- **Form** = document HITL (`advance`/`resolve`/`close`, `confirm`/`override`, shift approve/reject).
- **Parents** link-request list Duyệt stays (exception already locked).

## Validation (local)

```
apps/admin: 60 files, 589 tests passed
focused: aftersale, aftersale-detail, kpi, kpi-detail, shifts-detail → 35 passed
ui-ratchet: no regression vs baseline
ui-frames: 3/3 passed
```

## GitNexus `detect_changes` (pre-commit)

- Risk: **medium**
- Touched: `AfterSalePage`, `KpiPage`
- Affected processes: aftersale list → actions/picker (list no longer hosts lifecycle mutate)

## Out of scope / residual

- Local full `typecheck-and-test` with Postgres not re-run; CI is authority.
- `screen-role-matrix.json` timestamp-only dirty left uncommitted.
- Dual-path gone in this commit; CI ui-e2e must re-prove aftersale + KPI journeys on form.

## Next

Babysit PR #110 required checks (`typecheck-and-test`, `ui-e2e`) on `ba66214`.
