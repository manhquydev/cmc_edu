---
title: "Resource-depth Phase 3 — canonical staff surface on /hr/staff (PR #153)"
date: 2026-08-17
summary: "Replaced the modal-first /admin/users surface with the canonical /hr/staff list/new/detail/profile/access routes, migrated every e2e consumer, survived a real ui-e2e regression (leave-blocker vs create-success redirect), and landed both required CI checks green."
---

## What happened

Phase 3 of the resource-depth program shipped the canonical staff surface:

- Routes: `/hr/staff` (list), `/hr/staff/new` (create form), `/hr/staff/:staffId` base →
  replace-redirect to `/profile`, durable `/profile` and `/access` sections. Static `/new`
  precedes `/:staffId`. `/admin/users`(+`/:staffId`) are replace-redirects only.
- `@cmc/links`: `links.staff`, `staffListPath/staffNewPath/staffProfilePath/staffAccessPath`,
  `/go/staff/:id` registered.
- List owns `?q=&page=` URL state (hydrate + write back, deep-link page restore preserved);
  row click opens the profile (never a permission dialog); validated same-origin return
  context; BulkActionBar copy-email preserved.
- One `StaffDetailLayout` owns `user.get` cold start, loading/invalid-id/NOT_FOUND/error/
  forbidden states, `DetailPage` + `EntityHeader`, route-owned section tabs (NavLink +
  `console-section-tabs`), `<Outlet>` carrying `backPath`.
- Profile edits all supported fields via existing `user.update` (leave blocker); Access owns
  roles (`user.updateRoles`, ACTIVE_ROLES-filtered) + reset (`user.resetPassword`) as explicit
  dialogs. Create form gates temp-password length, carries the leave blocker, and
  create-success `replace`-navigates to the created profile.
- Nav: Staff leaf moved from the super_admin-only Quản trị module to HR (`user.manage`).
- e2e migrated: `createStaffViaAdminUi`, `live-ui`, `00-setup-roles`, `14-ops-user-guards`,
  ADM-02 journey (create → edit → roles → reset → legacy redirects), mobile-audit landing,
  acceptance manifest (ADM-02 claims `user.get`/`user.managerPickList`; DOCUMENTED_GAPS
  entries removed), screen-role matrix regenerated, runbook + TL06 doc rows updated.

## Evidence and decision

- Code-reviewer subagent: DONE_WITH_CONCERNS — 11 findings (1 Critical: live user-guards spec
  still on the deleted modal; 5 Important: dead NOT_FOUND branch via wrong tRPC error shape,
  `?page=` deep-link clobber, dormant-role unsavable selection, wrong mobile-audit landing,
  untracked vacuous redirect test; 5 Minor). All fixed in `d762bc4`.
- First PR push: `ui-e2e` failed on EVERY journey that creates a staff account. Root cause:
  the unsaved-edits leave blocker swallowed the create-success navigation — react-router
  evaluates the blocker against the last committed render, which still saw the dirty form.
  Fix (`e0174ca`): onSuccess clears the form and arms `createdId` in state; the redirect runs
  in an effect on the next commit after `useBlocker` re-registers with dirty=false. The
  staff-new unit test now drives a real `createMemoryRouter` (profile target, no mocked
  `useNavigate`) so this regression is caught locally — it asserts `PROFILE_LANDED` renders
  and no confirm dialog appears.
- Local gates on `e0174ca`: workspace test 30/30 (admin 682, api 1261, auth 1116, scripts
  40), typecheck 34/34, lint clean, ratchet 0 new, ui-frames strict clean, doc-authority
  clean, acceptance report 0 untriaged orphans, route-audit 5/5 (tsx --test).
- CI on PR head `e0174ca`: `typecheck-and-test` **pass**, `ui-e2e` **pass** (both required).
  The non-required `e2e` job still fails on the pre-existing live-config collection issue.

## Known limitations

- `/hr/staff/:staffId/activity` does not exist yet — Phase 4 lands it atomically with
  `user.timeline`.
- The non-required ci.yml `e2e` job still fails on the pre-existing live-suite collection
  gate (`tests/live/*.spec.ts` collected by the default api project); Phase 7 owns it.
- Merge of PR #153 awaits the operator's decision (repo governance: human merge approval).

## Next steps

- Merge PR #153, then start Phase 4 (operational timeline + compliance audit separation) as
  PRs 4A/4B.
