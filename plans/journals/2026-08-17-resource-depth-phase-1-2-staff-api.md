---
title: "Resource-depth Phase 1+2 — staff API contract (first protected PR)"
date: 2026-08-17
summary: "Branch-synced main/develop to feat/back-before-design, froze the resource-depth inventory (Phase 1), and shipped user.get + user.managerPickList with a 14-test actor×target matrix (Phase 2) as PR #152."
---

## What happened

The resource-depth program (`plans/260817-1354-resource-detail-and-operational-timeline-depth/`)
started its first protected PR. Per the operator decision, `feat/back-before-design` became the
canonical base: the in-flight design work was committed to it, then `main` and `develop` were
hard-reset to the same commit (branch protection temporarily disabled, force-pushed, restored
exactly). All three branches now point at `bd2bae4`.

Phase 1 (zero product code) refreshed the source-current resource-depth inventory at the new
base, recorded the worktree baseline, and verified locked decisions D1–D10 against source.

Phase 2 shipped the API contract for the canonical staff surface:

- `user.get({ appUserId })` — facility-scoped cold-start fetch of one staff record via the
  existing `APP_USER_SELECT` (no credential columns) plus a safe manager summary
  (id/fullName/employeeCode). Cross-facility/unknown → `NOT_FOUND`, never an existence-leaking
  `FORBIDDEN`. Directors may READ a same-facility `super_admin` profile (read-only); mutations
  stay behind their existing escalation guards.
- `user.managerPickList` — same `user.manage` key; a non-super-admin caller is never offered a
  `super_admin` target; `super_admin` callers see everyone. `staff.pickList` contract untouched.
- 14 new integration tests (20 → 34 in `apps/api/src/user/app-user.test.ts`): serialization
  safety, actor×target matrix, manager summary, picker eligibility + permission.

The synced base carried three pre-existing required-CI failures that had to be green for a
protected PR: a UI-ratchet drift (`error-boundary.tsx` `margin: 0`, no token — documented as an
exemption), a stale auth permission matrix (`user.manage` roster drifted from the registry —
aligned), and the acceptance orphan ratchet (`user.get`/`user.managerPickList` are API-only until
Phase 3 — documented as gaps). All three were fixed with honest, minimal edits.

## Evidence and decision

- Local: apps/api 1260/1260 (user 54/54), apps/admin 668/668, packages/auth 1116/1116, turbo
  typecheck 34/34, lint clean, UI ratchet 5/5, `acceptance:report` exit 0 with 0 untriaged
  orphans.
- Code-reviewer subagent: all acceptance criteria MET; 5 minor findings addressed (behavior-only
  comments per AGENTS.md stable-artifacts rule, manager-join invariant documented, director
  update proof test added).
- CI on PR head `cc749fe`: `typecheck-and-test` **pass**, `ui-e2e` **pass** (both required
  checks), `security-scan` pass. The `e2e` job failure is pre-existing (live-suite specs in
  `tests/live/` are collected by the default api project and trip the `PLAYWRIGHT_LIVE` gate),
  `continue-on-error`, not a required check — it failed identically before this PR.

## Known limitations

- The `e2e` CI job (non-required) fails on live-config collection; owned outside Phase 2 (the
  live suite predates this PR). Phase 7 owns the acceptance/E2E hardening.
- `business:verify --strict` needs a fresh ui-e2e run at the head SHA; CI provides that.
- Phase 3 (routes/forms/nav) will consume `user.get`/`user.managerPickList` and remove the
  DOCUMENTED_GAPS entries.

## Next steps

- Merge PR #152 after human review, then start Phase 3 (Staff routes/forms/navigation) as the
  next protected PR.
