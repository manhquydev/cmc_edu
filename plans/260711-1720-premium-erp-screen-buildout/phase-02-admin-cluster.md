# Phase 02 — Admin cluster

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/finance/receipt-list.tsx` (ListPage), `pages/students/index.tsx` (list)

## Overview
Two real lists + two stubs. `users.tsx` is the heavy item (roles CRUD, dialogs).

| Screen | Archetype | State | tRPC | Emoji→Icon |
|--------|-----------|-------|------|-----------|
| `admin/facilities.tsx` | list | REAL | `facility.list.useQuery` | 🔒→`building` |
| `admin/users.tsx` | list | REAL | `user.list.useQuery`, `user.create.useMutation`, `user.updateRoles.useMutation`, `useUtils` | 🔒→`building` |
| `admin/network-ip.tsx` | stub (premium coming-soon) | **BLOCKED — no mgmt backend** | none | 🌐→`globe` |
| `admin/shift-config.tsx` | stub (premium coming-soon) | **BLOCKED — no read backend** | none | ⏰→`clock` |

## Key insights
- facilities has a permission-gated `EmptyState` fallback → keep the gate, premium the EmptyState (icon `building`).
- users: `MultiSelector` roles + create `Dialog` + `updateRoles` mutation; imports `ACTIVE_ROLES` from `@cmc/auth` — preserve. Wrap table in `ListPage`.
- Stubs stay **coming-soon** — icons now exist (phase-00 added `globe`/`clock`): network-ip→`globe`, shift-config→`clock`.
  Real builds are BLOCKED (deferred to phase-08): network-ip has a `FacilityNetwork` model but **no management endpoint**
  (`checkin/router.ts:48` only reads it during punch); shift-config has write mutations `shift.createGroup`/`createTemplate`
  (`shift/router.ts:77,96`) but **no list/read query**. Neither is buildable without an `apps/api` change + spec.

## Requirements
- facilities + users adopt `ListPage`; users keeps create/updateRoles flows + `ACTIVE_ROLES` source unchanged.
- network-ip / shift-config: premium `EmptyState` + `LineIcon` (`globe`/`clock`), no emoji, stay coming-soon. Do NOT
  build real features here — deferred to [phase-08](phase-08-stub-real-features.md). Do NOT add backend.
- No `apps/api` edits; role enum + permission checks unchanged.

## Architecture / data flow
- users: `user.list`→rows→`DataTable`; create→`user.create.mutate` then `useUtils().user.list.invalidate()`; role edit→`user.updateRoles.mutate({userId, roles})` (all unchanged).

## Related code files
- Modify: `apps/admin/src/pages/admin/{facilities,users,network-ip,shift-config}.tsx`.
- Create: co-located `*.test.tsx` (jsdom).
- Read-only ref: `@cmc/auth` `ACTIVE_ROLES`.

## Implementation steps (TDD per screen)
1. facilities: test list binding + gated-empty → ListPage refactor + icon → green.
2. users: test list + create→mutate + updateRoles→mutate + invalidate → ListPage refactor (keep dialogs/MultiSelector) → green.
3. network-ip / shift-config: test premium EmptyState (no emoji node) → swap emoji→`LineIcon` (`globe`/`clock`) → green. Stays coming-soon.
4. Phase gate.

## Todo list
- [x] facilities test → refactor → green
- [x] users test → refactor → green
- [x] network-ip → refactor → green
- [x] shift-config → refactor → green
- [x] phase verify gate

## Success criteria
- 4 screens premium; users/facilities on `ListPage`; 0 emoji; user.* + facility.list contracts unchanged.
- typecheck + build 14/14 + admin test + lint clean + `@cmc/ui` unchanged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| users role-CRUD regression (321 loc, 2 mutations) | Med×High | Lock create + updateRoles mutate args + invalidate in tests first |
| Dialog/MultiSelector layout shift under ListPage | Med×Low | Keep dialog logic; only relocate table into template slot |
| network-ip/shift-config scope-creep into real build | Med×Med | Explicitly deferred to phase-08; coming-soon EmptyState only, no backend |

## Security considerations
Role assignment is sensitive — tests must assert `user.updateRoles` payload is byte-identical to current behavior so RBAC is not silently altered. Presentation-only; no new exposure.

## Next steps
Proceed to [phase-03](phase-03-crm-cluster.md). Blocked network-ip + shift-config real builds tracked in
[phase-08](phase-08-stub-real-features.md).
