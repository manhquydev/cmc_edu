---
phase: 3
title: "Nav-Consolidation-Role-Gating"
status: pending
priority: P2
dependencies: [2]
effort: "M"
---

# Phase 3: Nav-Consolidation-Role-Gating

# Overview
Restructure the sidebar to the prototype's 4 groups (G1), hide deferred-role surfaces per ADR-D (G6),
and add the persistent top-bar "+ Ghi danh" CTA (completes G2). Touches routing for every screen, so it
lands after the money-flow phases.

## Requirements
- Functional:
  - **G1 — 4-group nav.** Regroup `NAV_MODULES` to match the prototype:
    - **Tổng quan** → `/cockpit`
    - **Giảng dạy** → schedule, attendance, grading, session-evidence, exercises (existing teaching children)
    - **Lớp & Học sinh** → students (moved out of "Quản trị") + classes
    - **Tài chính & Điều hành** → Phiếu thu (`/finance`), CRM (`/crm`), Doanh thu, Đối soát
    - **Quản trị** (super_admin only) → users, facilities (network/IP)
  - **G6 — hide deferred-role surfaces.** Remove the "Nhân sự" (hr) module from the staff nav. NOTE: it
    currently appears because `checkIn.punch` is granted to all 8 roles (`packages/auth/src/index.ts:128`),
    so a permission filter will not hide it — remove/relocate the module explicitly per ADR-D (hr deferred,
    `docs/14 §1`). Chấm công/Ca/Lương are deferred surfaces; drop them from nav (routes may remain
    reachable by direct URL for super_admin, but not surfaced).
  - **G2 completion — persistent CTA.** Add "+ Ghi danh" to `shell.tsx` header (top bar), opening the same
    O4-opportunity picker from Phase 2. Visible to roles that can create receipts (sale, GĐKD, super_admin).
  - Keep the existing per-child permission filter (`shell.tsx:52`) for anything still permission-gated.
- Non-functional: all existing routes still resolve; no orphaned links; role filtering unchanged for the
  4 active roles + IT; typecheck + build clean.

## Architecture
- `nav-registry.ts` is the single nav source — rewrite `NAV_MODULES` to the 4+admin groups. Add an optional
  `roles?: Role[]` field on `NavModule` for group-level gating (Quản trị = super_admin) so hr/admin
  surfaces are hidden by explicit role, independent of the broad `checkIn.punch` permission.
- `shell.tsx` reads the new registry; extend the group-visibility check to honor `mod.roles` (hide the
  module if `me.roles` intersects none). Add the header CTA next to the role badge.
- Routes in the router stay as-is; only the nav grouping/labels change. Verify no nav item points at a
  removed route.

## Related Code Files
- Modify: `apps/admin/src/shell/nav-registry.ts` (4-group restructure + optional `roles` gating)
- Modify: `apps/admin/src/shell/shell.tsx` (group role-gating + "+ Ghi danh" header CTA)
- Read (to confirm routes exist): `apps/admin/src/routes` / router entry, `pages/students`, `pages/classes`
- Create (test): `apps/admin/src/shell/nav-registry.test.ts` (pure-function nav visibility — no DOM needed)

## Implementation Steps (TDD)
1. **RED — nav visibility unit test.** `nav-registry.test.ts`: a small `visibleModulesFor(roles, canDo)`
   helper returns (a) exactly the 4 groups for `sale`/`giam_doc_kinh_doanh`/`giao_vien`/`giam_doc_dao_tao`;
   (b) 5th "Quản trị" group ONLY for `super_admin`; (c) NO "Nhân sự"/hr module for any active role; (d)
   "Lớp & Học sinh" present and contains students.
2. **GREEN.** Extract the shell's inline visibility logic into that pure helper; restructure `NAV_MODULES`;
   add `roles` gating.
3. **Shell wiring.** Point `shell.tsx` at the helper; add the "+ Ghi danh" header CTA (reuse Phase-2 picker).
4. **Route audit.** Grep every `path` in the new registry against the router; fix/remove any dangling link.
5. **Verify.** `pnpm --filter @cmc/admin typecheck` + `build`; run nav test; manual: log in as each of the
   5 dev roles (RoleSwitcher) → confirm 4 groups (+admin for super_admin), no Nhân sự, students under
   Lớp & Học sinh, "+ Ghi danh" in header.

## Success Criteria
- [ ] Nav shows exactly the 4 prototype groups for active non-admin roles; "Quản trị" only for super_admin.
- [ ] "Nhân sự"(hr) module is absent from the nav for every role (test-enforced).
- [ ] Students appear under "Lớp & Học sinh", not "Quản trị".
- [ ] "+ Ghi danh" CTA present in the top bar for receipt-creating roles; opens the O4 picker.
- [ ] `nav-registry.test.ts` green; admin typecheck + build clean; no dangling nav links.

## Risk Assessment
- **Broad `checkIn.punch` grant** makes permission-gating insufficient to hide hr → explicit `roles`
  gating / module removal is the fix; test 1c enforces it. Do NOT change the `checkIn.punch` roster in
  `packages/auth` (out of scope; would ripple into attendance).
- **Removing a nav group could orphan a still-needed route** (e.g. payroll for a future phase) → routes
  remain registered; only nav surfacing is removed. Document which routes become URL-only.
- **Every-route blast radius** → nav-only change; no route path edits. Land after Ph1/Ph2 to avoid churn.
- Rollback: revert `nav-registry.ts` + `shell.tsx` to restore the 5-module nav.
