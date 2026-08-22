---
title: "Phase 2: Permission Matrix and Gate Reconciliation"
status: done
---

# Phase 2: Permission Matrix and Gate Reconciliation

**Priority:** P1 · **Depends on:** Phase 1

Give operators a truthful "quyền hạn của từng vai trò" reference. Read-only; registry stays code
(RL3, RL4). Any gate reconciliation not already done in Phase 1's tail lands here.

## Requirements

- [ ] Read-only role→permission matrix screen derived from `@cmc/auth`.
- [ ] `super_admin` shown as "all"; empty-roster keys shown as super_admin-only.
- [ ] Each cell/row annotated "registry door" vs "door + SoD/row rule".
- [ ] Screen gated behind `user.manage`/`super_admin`.
- [ ] Optional second axis: nav-leaf visibility per role (`isNavChildVisible`/`visibleModulesFor`).
- [ ] Unit test the matrix against `PERMISSIONS` so it cannot silently rot.
- [ ] CI green.

## Data source

- `PERMISSIONS` (68 keys), `ACTIVE_ROLES` (5), `ROLE_LABELS` — all public from `@cmc/auth`
  (`packages/auth/src/index.ts`).
- SoD/row-rule annotations (cannot be inferred from the map), verified in source:
  - `crm.opportunityAssign` — ownership (`auth/index.ts:83`).
  - finance SoD — sale has `receiptCreate` but not `receiptList`/`receiptGet` (`auth/index.ts:106`).
  - `kpi.confirm` — `scoreOwner.managerId === caller`.
  - directors cannot mint `super_admin` (`user/router.ts:739`).

## Architecture

A new admin route (e.g. `/admin/permissions` or under HR) rendering a role × permission-key grid.
Rows grouped by module; a legend distinguishes door-only vs door+rule. No mutation endpoints.

## File inventory

| Path | Action |
|---|---|
| `apps/admin/src/pages/admin/permission-matrix.tsx` | create |
| `apps/admin/src/routes/admin.routes.tsx` | register route + `PermissionGate` (`user.manage`) |
| `apps/admin/src/shell/nav-registry.ts` | add leaf (gated) |
| `apps/admin/src/pages/admin/permission-matrix.test.tsx` | matrix ↔ `PERMISSIONS` drift test |
| `scripts/resource-depth-audit.mjs` | classify the new route (dashboard/config exception) |
| `docs/system-architecture.md` / RBAC doc | note the reference screen |

## Acceptance

- Matrix lists all active roles + super_admin correctly (super_admin = all; empty rosters = SA-only).
- Door-vs-rule annotations present for the four flagged keys.
- Screen 403s for roles without `user.manage`.
- Drift test fails if `PERMISSIONS` changes without updating the view source.
- CI green.

## Security

- The matrix is recon-sensitive: gate it; do not expose it to ordinary roles.
- Read-only: no code path mutates roles/permissions from this screen.
