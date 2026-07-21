# Phase 04 — Finance-remaining cluster

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/finance/receipt-list.tsx` (ListPage), `pages/finance/receipt-detail.tsx`, `pages/cockpit.tsx` (dashboard cards)

## Overview
Four screens spanning list + form + dashboard. Largest single cluster by archetype variety.

| Screen | Archetype | State | tRPC | Emoji |
|--------|-----------|-------|------|-------|
| `finance/index.tsx` | list | REAL | `finance.receiptList.useQuery` | NO |
| `finance/receipt-create.tsx` | form | REAL | `crm.opportunityGet`, `crm.opportunityLookup`, `classBatch.list` (queries), `finance.receiptCreate.useMutation` | NO |
| `finance/reconciliation.tsx` | list | REAL | `reconciliation.listFlags.useQuery`, `reconciliation.dismiss/action.useMutation`, `useUtils` | NO |
| `finance/revenue-report.tsx` | dashboard | REAL | `finance.receiptList.useQuery` | NO |

## Key insights
- index: near-identical to the receipt-list exemplar → straightforward `ListPage` adoption.
- receipt-create: multi-source form (opportunity + batch lookups) → `FormPage` (header/children/actions/result slots). `receiptCreate` is money-writing — lock payload precisely.
- reconciliation: flag list + dismiss/action mutations, `ConfirmDialog` → `ListPage` (or Panel list) keeping confirm flows.
- revenue-report: currently `Grid`/`StatCard`/`tokens` — reshape to premium dashboard (`MetricCard`/`StatCard` + `Panel`), keep aggregation logic pure/testable.

## Requirements
- All four adopt their premium archetype; every tRPC input/output unchanged.
- receipt-create: `receiptCreate.mutate` payload byte-identical; result via `ResultPanel` in FormPage `result` slot.
- reconciliation: dismiss/action `mutate` args + invalidate unchanged.

## Architecture / data flow
- receipt-create: opportunity/batch queries hydrate form → submit → `finance.receiptCreate.mutate(payload)` → `ResultPanel`.
- revenue-report: `receiptList` → client aggregation (extract to pure fn, unit-test like cockpit-counter) → cards.

## Related code files
- Modify: `apps/admin/src/pages/finance/{index,receipt-create,reconciliation,revenue-report}.tsx`.
- Create: co-located `*.test.tsx`; extract + unit-test revenue aggregation helper.

## Implementation steps (TDD per screen)
1. index: lock list binding → `ListPage` → green.
2. revenue-report: extract aggregation fn + unit test → reshape cards to premium → render test → green.
3. reconciliation: lock listFlags binding + dismiss/action mutate + confirm flow → refactor → green.
4. receipt-create: lock query hydration + `receiptCreate.mutate` payload + result → `FormPage` refactor → green.
5. Phase gate.

## Todo list
- [x] index → refactor → green
- [x] revenue-report (pure-fn + dashboard) → green
- [x] reconciliation → refactor → green
- [x] receipt-create → FormPage → green
- [x] phase verify gate

## Success criteria
- 4 screens premium (list/form/dashboard); finance + reconciliation + crm-lookup contracts unchanged.
- typecheck + build 14/14 + admin test + lint clean + `@cmc/ui` unchanged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| receipt-create payload drift (money) | Med×High | Test asserts exact `receiptCreate` input before refactor |
| FormPage slots can't express multi-step form | Med×Med | If gap, keep primitive layout inside premium framing; do NOT modify `@cmc/ui` (decision) |
| revenue aggregation regressions | Med×Med | Extract pure fn + unit test independent of render |

## Security considerations
Receipt creation is financial + audited server-side — presentation change must not alter submitted amounts/fields. Tests guard the payload. No client-side auth logic changed.

## Next steps
Proceed to [phase-05](phase-05-attendance-cluster.md).
