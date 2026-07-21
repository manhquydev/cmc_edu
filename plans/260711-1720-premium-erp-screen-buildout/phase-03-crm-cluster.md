# Phase 03 — CRM cluster

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/cockpit.tsx` (FunnelBar/Panel/MetricCard dashboard), `pages/crm/opportunity-detail.tsx`

## Overview
Single pipeline dashboard (O1→O5 stages) with a stage-advance mutation.

| Screen | Archetype | State | tRPC | Emoji |
|--------|-----------|-------|------|-------|
| `crm/pipeline.tsx` | dashboard | REAL | `crm.opportunityList.useQuery`, `crm.opportunityAdvance.useMutation`, `useUtils` | → in label text |

## Key insights
- Reuse cockpit's `FunnelBar` + `Panel` for the O1→O5 funnel; `STAGE_LABELS` map already exists in cockpit — DRY: keep local or lift only if trivial (do NOT modify `@cmc/ui`).
- The `→` is a typographic arrow inside stage-advance labels, not a pictographic emoji — low priority; replace with `LineIcon name="chevron"` where it functions as an icon, else keep as text (decision, non-blocking).
- Currently uses `Spinner`/`Banner`/ad-hoc `Stack` — replace loading/error with premium `Panel` + `Skeleton` pattern from cockpit.

## Requirements
- Pipeline adopts premium dashboard layout (Panel + FunnelBar); keep `opportunityList` query + `opportunityAdvance` mutation + invalidate identical.
- Preserve stage ordering + counts logic.

## Architecture / data flow
- `opportunityList` → group by `stage` → `FunnelBar` per stage; advance action → `opportunityAdvance.mutate({opportunityId, …})` → `useUtils().crm.opportunityList.invalidate()` (unchanged).

## Related code files
- Modify: `apps/admin/src/pages/crm/pipeline.tsx`.
- Create: `pipeline.test.tsx` (jsdom).
- Ref (no edit): `pages/cockpit.tsx` funnel pattern.

## Implementation steps (TDD)
1. Test: renders stage bars from mocked `opportunityList`; advance→`opportunityAdvance.mutate` args; loading + error states.
2. Refactor to Panel + FunnelBar premium layout; replace Spinner/Banner with Skeleton/premium error.
3. Green + phase gate.

## Todo list
- [x] pipeline test locking stages + advance mutate
- [x] refactor to premium dashboard
- [x] resolve `→` (LineIcon vs text)
- [x] phase verify gate

## Success criteria
- Pipeline uses Panel/FunnelBar; no ad-hoc Spinner/Banner; crm contract unchanged.
- typecheck + build 14/14 + admin test + lint clean + `@cmc/ui` unchanged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Stage-advance mutation regresses | Med×High | Lock mutate payload + invalidate in test first |
| Duplicating STAGE_LABELS violates DRY | Low×Low | Keep one local copy; do not add to `@cmc/ui` |

## Security considerations
Presentation-only; advance authorization unchanged (server-enforced).

## Next steps
Proceed to [phase-04](phase-04-finance-remaining-cluster.md).
