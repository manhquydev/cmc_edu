# Phase 06 — HR cluster

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/students/student-detail.tsx` (DetailPage + CmcTabs), `pages/classes/class-detail.tsx`

## Overview
Two large detail screens with multi-step approval workflows. High complexity (357 + 445 loc, 4–5 mutations each).

| Screen | Archetype | State | tRPC | Emoji |
|--------|-----------|-------|------|-------|
| `hr/kpi.tsx` | detail | REAL | `kpi.getForUser.useQuery`, `kpi.confirm/approve.useMutation`, `user.list.useQuery` | → in label |
| `hr/payroll.tsx` | detail | REAL | `payslip.getForUser.useQuery`, `payslip.assemble/finalize/reopen.useMutation`, `user.list.useQuery` | ← in label |

## Key insights
- Both are per-user detail views (select user → view record → confirm/approve or assemble/finalize/reopen).
- Adopt `DetailPage` (header + optional `CmcTabs` + content); keep `user.list` picker + `getForUser` query.
- `→`/`←` are navigation arrows in labels → replace with `LineIcon name="chevron"` where they act as icons; else keep as text.
- Payroll finalize/reopen is money-state transition — lock every mutation payload before touching layout.

## Requirements
- Both adopt `DetailPage`; keep all queries/mutations + invalidate patterns identical.
- Preserve status transitions + permission gating (confirm/approve/finalize).

## Architecture / data flow
- kpi: pick user (`user.list`) → `kpi.getForUser` → confirm→`kpi.confirm.mutate` / approve→`kpi.approve.mutate` → invalidate.
- payroll: pick user → `payslip.getForUser` → assemble/finalize/reopen mutations → invalidate.

## Related code files
- Modify: `apps/admin/src/pages/hr/{kpi,payroll}.tsx`.
- Create: co-located `*.test.tsx`.

## Implementation steps (TDD per screen)
1. kpi: lock user-pick binding + getForUser + confirm/approve mutate args + status states → `DetailPage` refactor → green.
2. payroll: lock getForUser + assemble/finalize/reopen mutate args + state transitions → `DetailPage` refactor → green.
3. Phase gate.

## Todo list
- [x] kpi test → DetailPage → green
- [x] payroll test → DetailPage → green
- [x] phase verify gate

## Success criteria
- Both on `DetailPage`; kpi + payslip contracts unchanged; status transitions intact.
- typecheck + build 14/14 + admin test + lint clean + `@cmc/ui` unchanged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Payroll finalize/reopen regression (money-state) | Med×High | Lock all 3 mutation payloads + resulting UI state in tests first |
| Largest files (445 loc) → refactor scope creep | Med×Med | Presentation-only diff; keep handlers/state hooks untouched |
| Arrow chars removal changes label semantics | Low×Low | Decision (non-blocking); prefer chevron LineIcon |

## Security considerations
KPI approval + payroll finalization are audited, authorization-sensitive flows. Tests guarantee identical mutation payloads so no approval/amount is silently altered. No client authz removed.

## Next steps
Proceed to [phase-07](phase-07-teaching-cluster.md).
