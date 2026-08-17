---
title: "Phase 1: Contract, Inventory and Decision Freeze"
status: done
---

# Phase 1: Contract, Inventory and Decision Freeze

## Overview

**Priority:** P0 · **Depends on:** none · **Product code changes:** none

Freeze the taxonomy, URL grammar, staff authority and dual-ledger semantics before source changes.
Re-run the inventory at implementation start because this branch is active and the 2026-08-11 matrix is stale.

## Context links

- [Locked decisions](./decisions.md)
- [Source-current inventory](./reports/source-current-resource-depth-inventory.md)
- [Brainstorm + advice](../reports/brainstorm-advise-260817-resource-detail-audit-depth.md)
- `docs/ux-resource-centric-structure.md`
- `docs/06-kien-truc-url-routing.md`

## Requirements

- [ ] Every routed production surface, including create/import/report/auth/alias/lab routes, is
  classified as record/workspace/config/queue/dashboard/workflow/compatibility/non-production.
- [ ] Every record row has explicit list/get/link/detail/create-success/timeline status.
- [ ] Staff actor × target × action matrix matches `decisions.md`.
- [ ] Dual-ledger rule accepted: no director reads global `AuditLog`.
- [ ] Worktree baseline and overlapping plans recorded; unrelated dirty files untouched.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `apps/admin/src/routes/*.routes.tsx` | read | Route inventory |
| `apps/admin/src/shell/nav-registry.ts` | read | IA/RBAC inventory |
| `packages/links/src/index.ts` | read | Canonical link inventory |
| `apps/api/src/router.ts` + domain routers | read | get/list/timeline inventory |
| `plans/.../reports/source-current-resource-depth-inventory.md` | update | Freeze refreshed baseline |
| `plans/.../decisions.md` | update only if source contradicts it | Durable decisions |

## Implementation Steps

1. Record branch, commit, dirty paths and GitNexus freshness.
2. Enumerate route objects, nav leaves, link builders, API get/list procedures and detail pages.
3. Reconcile each surface against the taxonomy; record exceptions with reason.
4. Produce an event-producer map for every planned timeline kind, including cross-domain routers,
   workers and provisioning helpers that mutate the record.
5. Compare with predecessor Phase 05; mark only stale rows superseded.
6. Verify D1-D10 against current source and product docs.
7. Stop before implementation if source changed a material policy, an event producer is unmapped,
   or an unclassified surface remains.

## Test / evidence matrix

| Scenario | Evidence |
|---|---|
| All nav leaves resolve | existing nav-route-resolution test + route inventory |
| No record candidate omitted | route × page × API × links ledger |
| No workspace forced to detail | exception list with source path |
| Timeline completeness | entity × event kind × producer × transaction-owner map |
| Dirty worktree preserved | `git status --short` before/after |

## Success Criteria

- Inventory has zero `unknown` rows.
- Decisions identify one canonical staff path and one timeline substrate.
- No product code changed.
- Phase 2 can start without a business-policy guess.

## Risks

- **Drift during execution:** refresh inventory at each module wave.
- **Overclassification:** require stable identity plus record criteria; popup alone is not proof.
- **Plan overlap:** completed pilots are dependencies, not work to redo.

## Security considerations

No authorization change occurs here. The phase must explicitly reject any plan that exposes global
audit rows to facility roles without a tenant-safe server contract.
