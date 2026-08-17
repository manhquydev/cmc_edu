---
title: "Phase 3: Staff Routes Forms and Navigation"
status: todo
---

# Phase 3: Staff Routes Forms and Navigation

## Overview

**Priority:** P0 · **Depends on:** Phase 2

Replace the modal-first `/admin/users` surface with canonical Staff list/new/detail pages under HR.
Use one work surface; keep role and password operations explicit secondary actions.

## Requirements

- [ ] Canonical routes `/hr/staff`, `/hr/staff/new`, `/hr/staff/:staffId/{profile,access}`.
- [ ] Add `links.staff`, staff list/new builders and `/go/staff/:id`.
- [ ] `/admin/users` and `/admin/users/:staffId` redirect with `replace`.
- [ ] Directors see Staff under HR when `user.manage`; ordinary staff do not.
- [ ] Row click opens profile; create-success opens created profile.
- [ ] Staff list URL state is `?q=&page=`; the list hydrates from and writes those keys
  deterministically. Add future filters only with an explicit query key.
- [ ] Profile edits fullName, email, position, managerId, isActive using existing `user.update`.
- [ ] Access section owns roles/reset password; row click never opens a permission dialog.
- [ ] Row navigation carries a validated same-origin `{ pathname, search }` return context.
- [ ] Explicit Back/breadcrumb uses that context; direct/F5/`/go` falls back to `/hr/staff`.
- [ ] Create-success uses `replace`, so Back never returns to a submitted `/new` form.
- [ ] Unsaved edits use the existing leave blocker.

## Architecture

List remains an index. New/profile/access are route-owned pages under `hr.routes.tsx`; `/activity`
does not exist until Phase 4 lands atomically with `user.timeline`.
One `StaffDetailLayout` owns `user.get`, loading/error/not-found state, `DetailPage`, identity,
tabs and an outlet/context consumed by each section.
Do not create empty payslip/shift tabs. `DetailPage`, `CmcTabs`/route links and existing form fields
remain the visual authority.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `apps/admin/src/pages/admin/users.tsx` | refactor or replace with redirect-owned legacy entry | remove modal-first authority |
| `apps/admin/src/pages/hr/staff/index.tsx` | create | staff list |
| `apps/admin/src/pages/hr/staff/staff-new.tsx` | create | full create form |
| `apps/admin/src/pages/hr/staff/staff-detail.tsx` | create | shared detail shell |
| `apps/admin/src/pages/hr/staff/profile.tsx` | create | profile edit |
| `apps/admin/src/pages/hr/staff/access.tsx` | create | roles + reset |
| `apps/admin/src/routes/hr.routes.tsx` | modify | canonical/static-before-param routes |
| `apps/admin/src/routes/admin.routes.tsx` | modify | compatibility redirects |
| `apps/admin/src/shell/nav-registry.ts` | modify | Staff leaf under HR |
| `packages/links/src/index.ts` | modify | staff builders/go registration |
| `apps/e2e/src/journey/create-staff-via-admin-ui.ts` | modify in the same PR | replace modal contract |
| `apps/e2e/src/live/live-ui.ts` + live setup/user-guard specs | modify in the same PR | replace legacy staff path |
| `apps/e2e/src/erp-mobile-route-audit.test.ts` | modify | canonical role landing |
| `apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts` | modify | director/super-admin staff route and full edit journey |
| `scripts/acceptance-report/flow-manifest.ts` | modify | canonical journey path |
| all `/admin/users` consumers from source grep | verify/update | no stale emitter except redirect tests |
| adjacent tests | modify/create | route/nav/link/form behavior |

## Implementation Steps

1. Add failing link, `/go`, nav-role and route-order tests.
2. Add staff route shell and compatibility redirects.
3. Move list behavior without changing search/bulk-copy semantics.
4. Move create fields to `/new`; on success replace with the returned `AppUser.id` profile URL.
5. Build detail shell on `user.get`; implement profile update.
6. Move role/reset actions into access section with explicit buttons/dialogs.
7. Add leave guard, loading/not-found/forbidden states, typed return-context validation and
   `q/page` URL hydration.
8. Update every source consumer of `/admin/users` and `createStaffViaAdminUi`, including live UI,
   mobile route audit and acceptance manifest, before merging the route change.
9. Add the first machine-readable staff route/link/depth assertion; Phase 7 generalizes it.
10. Extend the real browser journey to prove director list/row/profile edit/access, super-admin
    privileged action, ordinary-role denial, legacy redirect, F5 and Back/query behavior.
11. Remove modal row-click behavior; retain only bounded action dialogs.

## Test scenario matrix

| Scenario | Proof |
|---|---|
| Director nav | HR shows Staff; Admin module need not appear |
| Ordinary role | no Staff nav; typed URL gated |
| Create success | URL becomes `/hr/staff/{id}/profile` |
| Back after create | returns to the page before `/new`, never the submitted form |
| Row click | same canonical detail |
| Legacy URL | replace redirect, no duplicate screen |
| F5/cold start | `user.get` renders without list state |
| Edit profile | all existing update fields persist |
| Access action | role/reset requires explicit action |
| Unsaved form | internal navigation prompts |
| Unknown section / malformed id | route not-found / invalid-id without API call |

## Success Criteria

- Directors have a discoverable, functional staff management interface.
- One canonical URL exists for each staff record.
- Full supported profile data is editable; access actions are not the default row interaction.
- Admin/link/nav focused tests and typecheck pass.
- The Staff browser journey passes on the PR head SHA.
- Required `typecheck-and-test` and push-triggered `ui-e2e` checks are terminal green on the exact
  PR head SHA before merge; the old modal E2E helper is not left broken.

## Risks

- **Duplicate authority:** legacy route redirects only.
- **Route collision:** register `staff/new` before `staff/:staffId`.
- **Regression in E2E helper:** update `createStaffViaAdminUi` after UI contract is stable.
- **Hidden legacy consumers:** grep the whole repo for `/admin/users` and helper imports; only
  compatibility tests may intentionally retain the old path.
- **Large component:** split by route section, not arbitrary presentational fragments.

## Rollback

- API additions from Phase 2 remain backward compatible.
- If the new UI must roll back, restore `/admin/users` as the temporary emitter while retaining
  `/hr/staff` redirects only in the rollback commit; never leave two editable surfaces deployed.
- Extra route/link builders are harmless but must not point to an unavailable detail page.

## Security considerations

Every route uses `PermissionGate user.manage`, but API guards remain decisive. Temporary passwords
stay dialog-local and are never placed in URL, router state, toast text, timeline payload or logs.
