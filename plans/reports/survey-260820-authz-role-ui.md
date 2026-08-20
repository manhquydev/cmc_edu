# Survey — Authorization system and per-role UI

**Date:** 2026-08-20
**Mode:** read-only. No source edits.
**Ask:** map RBAC, enforcement, and whether any UI shows or manages “quyền hạn của từng vai trò”.

---

## Verdict

There is **no product screen that views or edits the role→permission matrix**.

What exists:

| Surface | What it does | What it is not |
|---|---|---|
| `@cmc/auth` `PERMISSIONS` | Compile-time map `module.action` → roles | Not stored in DB, not editable at runtime |
| `/hr/staff/:id/access` “Phân quyền” dialog | Assigns **roles** to a staff row (`user.updateRoles`) | Does not list or change which keys that role holds |
| Nav + `PermissionGate` + inline `canDo` | Hide menus / show EmptyState for the **current** session | Never shows the full matrix for any role |
| `apps/e2e/src/screen-role-matrix.ts` | Test capture planner | Not shipped UI |

A “giao diện quyền hạn của từng vai trò” (read-only matrix, or an editor) **does not exist**.

---

## 1. RBAC model

**Single source:** `packages/auth/src/index.ts` (the package is only this file + `index.test.ts`).

### 1.1 Roles

Nine official slugs (`ROLES`, lines 10–20). Five are active (`ACTIVE_ROLES`, 27–33). Four are inert enum leftovers (ADR-D, 24–26): no keys, not assignable via API/UI.

| Slug | Label (`ROLE_LABELS` 38–48) | Status |
|---|---|---|
| `super_admin` | Quản trị hệ thống | Active. **Omitted from every `PERMISSIONS` row**; `can()` returns true for all keys (191–197). |
| `giam_doc_kinh_doanh` | Giám đốc kinh doanh | Active |
| `giam_doc_dao_tao` | Giám đốc đào tạo | Active |
| `sale` | Sale | Active |
| `giao_vien` | Giáo viên | Active |
| `ke_toan` | Kế toán | Dormant |
| `cskh` | CSKH | Dormant |
| `ctv_mkt` | CTV marketing | Dormant |
| `hr` | Nhân sự | Dormant |

There is no `giam_doc` slug.

### 1.2 Permission keys (full list)

`PERMISSIONS` is `Record<string, readonly ActiveRole[]>` (77–185). **68 keys.** Empty roster `[]` = no business role; only `super_admin` passes via bypass.

| Key | Roles (excluding implicit `super_admin`) |
|---|---|
| `crm.opportunityList` | GĐKD, sale |
| `crm.opportunityLookup` | GĐKD, sale |
| `crm.opportunityCreate` | GĐKD, sale |
| `crm.opportunityAdvance` | GĐKD, sale |
| `crm.opportunityMarkLost` | GĐKD, sale |
| `crm.opportunityAssign` | GĐKD, sale |
| `crm.report` | GĐKD, sale |
| `crm.opportunityTimeline` | GĐKD, sale |
| `crm.opportunityAddNote` | GĐKD, sale |
| `finance.receiptCreate` | GĐKD, sale |
| `finance.receiptApprove` | GĐKD, GĐĐT |
| `finance.refundCreate` | GĐKD |
| `finance.receiptList` | GĐKD, GĐĐT |
| `finance.receiptGet` | GĐKD, GĐĐT |
| `enrollment.enroll` | GĐKD, GĐĐT, sale |
| `enrollment.grantUnits` | GĐĐT |
| `enrollment.blockLms` | GĐKD, GĐĐT |
| `guardian.approveLink` | GĐKD, GĐĐT, sale, GV |
| `guardian.listPendingLinks` | GĐKD, GĐĐT, sale, GV |
| `student.lookup` | GĐKD, GĐĐT, sale, GV |
| `student.setLifecycle` | GĐKD, GĐĐT |
| `studentAccount.resetPassword` | GĐKD, GĐĐT |
| `facility.create` | `[]` (super_admin only) |
| `facility.list` | `[]` |
| `facility.manage` | `[]` |
| `audit.list` | `[]` |
| `facilityNetwork.manage` | `[]` |
| `compensationPolicy.manage` | `[]` |
| `course.manage` | GĐĐT |
| `room.manage` | GĐĐT |
| `class.create` | GĐĐT |
| `class.read` | GĐKD, GĐĐT, sale, GV |
| `classRoster.read` | GV, GĐĐT |
| `schedule.generate` | GĐĐT |
| `attendance.mark` | GV, GĐĐT |
| `exercise.manage` | GĐĐT |
| `exercise.view` | GV, GĐĐT |
| `parentAccount.read` | GĐKD, GĐĐT, sale |
| `parentAccount.updateEmail` | GĐKD, sale |
| `parentAccount.setActive` | GĐKD, GĐĐT |
| `submission.grade` | GV, GĐĐT |
| `assessment.draft` | GV, GĐĐT |
| `assessment.confirm` | GV |
| `sessionEvidence.upsert` | GV |
| `sessionEvidence.publish` | GV |
| `user.manage` | GĐKD, GĐĐT |
| `staff.pickList` | GĐKD, GĐĐT |
| `checkIn.punch` | GĐKD, GĐĐT, sale, GV |
| `manualPunch.approve` | GĐKD, GĐĐT |
| `shift.manage` | GĐĐT, GĐKD |
| `shift.submit` | GĐĐT, GĐKD, GV, sale |
| `shift.approve` | GĐĐT, GĐKD |
| `salaryTier.manage` | GĐKD, GĐĐT |
| `payslip.assemble` | GĐKD, GĐĐT |
| `payslip.finalize` | GĐKD, GĐĐT |
| `payslip.reopen` | GĐKD, GĐĐT |
| `kpi.refresh` | GV, sale, GĐĐT, GĐKD |
| `kpi.submitSlip` | GV, sale, GĐĐT, GĐKD |
| `kpi.confirm` | GĐĐT, GĐKD |
| `kpi.approve` | GĐĐT, GĐKD |
| `kpi.bulkApprove` | GĐĐT, GĐKD |
| `gift.upsert` | GĐKD, GĐĐT |
| `gift.list` | GĐKD, GĐĐT, sale |
| `rewards.manage` | GĐKD, GĐĐT, sale |
| `parentMeeting.manage` | GĐKD, GĐĐT, sale |
| `testAppointment.manage` | GĐKD, GĐĐT, sale |
| `afterSale.manage` | GĐKD, GĐĐT, sale |
| `reconciliation.review` | GĐĐT, GĐKD |

`can()` (`packages/auth/src/index.ts:191-203`): null subject → false; `super_admin` → true; else key lookup + role intersection. Unknown `module.action` → false.

Registry is **not** the whole story. Procedure-layer rules sit on top: CRM assign ownership (`index.ts:83-85`), finance SoD (sale drafts, cannot approve/list/get), KPI `managerId` / `viewerCanConfirm`, last-super-admin + director-cannot-mint-super_admin (`apps/api/src/user/router.ts:739-745`), facility RLS via `scoped()`.

Docs snapshot: `docs/system-architecture.md:365-384`.

---

## 2. Enforcement

### 2.1 API (authoritative)

`apps/api/src/trpc.ts:264-274`:

```ts
export function requirePermission(module: string, action: string) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.subject, module, action)) {
      throw forbidden(`Missing permission ${module}.${action}.`);
    }
    return next();
  });
}
```

Chain: session (`requireSession` 197–202) → valid facility (`requireValidFacility` 225–243; `super_admin` bypasses facility existence) → `can()`.

LMS procedures (`lmsProcedure` 257–262) **do not** use staff `can()`. Staff cookie never opens LMS.

Almost every business procedure is `requirePermission('module','action')` (CRM, finance, user, class, …). A few writes use `protectedProcedure` plus owner checks instead of a key (`manualPunch.resubmit`, `shift.cancel` — comments at `index.ts:151-152`).

### 2.2 Admin SPA — three layers, none is a matrix

**Session mirror.** `apps/admin/src/lib/session-context.tsx:17-18,33-35` — `canDo` calls the same `can()` on `session.me.roles`. Comment: server remains authoritative.

**Nav.** `apps/admin/src/shell/nav-registry.ts`

- Module `roles` array: only Quản trị is `roles: ['super_admin']` (161–166).
- Child `permission: { module, action }` → `isNavChildVisible` (183–187) / `visibleModulesFor` (202–219).
- HR leaves **without** a key (visible to every authenticated staff): Chấm công, Đăng ký ca, Của tôi, KPI (141–144).

**Screen / route gates.**

| Pattern | Where |
|---|---|
| Shared `PermissionGate` → EmptyState “Không có quyền truy cập” + named key | `apps/admin/src/lib/permission-gate.tsx:25-46`. Used on CRM/finance/admin **routes** (`crm.routes.tsx`, `finance.routes.tsx`, `admin.routes.tsx`). |
| Inline `if (!canDo(...))` EmptyState | Staff list/new/detail (`pages/hr/staff/index.tsx:177-190`, `staff-new.tsx:111-124`, `staff-detail.tsx:33-48`); facilities, audit-log, network-ip, classes list, shift-config. |
| Action-level `canDo` (button/tab hide) | Check-in inbox tab (`check-in-out.tsx:594`), shift approve, refund write, KPI confirm/override, cockpit widgets (`cockpit.tsx:443-446`). |
| **No route `PermissionGate`** | Entire `hr.routes.tsx` — staff/payroll/kpi rely on page-local `canDo` or server 403. |

Typed URL past a hidden nav item is expected. Gate comment: hiding a menu is not access control (`permission-gate.tsx:5-8`).

### 2.3 Per-role nav (derived from registry + nav, not a UI)

| Role | Typical visible modules |
|---|---|
| `super_admin` | All leaves (`can()` always true) + Quản trị |
| `giam_doc_kinh_doanh` | Lịch dạy; Học viên + Phụ huynh; almost all Tài chính & Điều hành; Quà tặng + Đổi thưởng; full HR including Nhân viên / Chốt lương / Bậc lương / Ca làm việc |
| `giam_doc_dao_tao` | Teaching except nhật ký (teacher-only upsert); Lớp + Khoá (not Phụ huynh nav); finance minus CRM pipeline/report/bulk; engagement; full HR staff/payroll |
| `sale` | Lịch dạy; Học viên + Phụ huynh; CRM / nhập lead / báo cáo / họp / sau bán / xếp lớp (not phiếu thu list, đối soát, hoàn tiền); Đổi thưởng only; HR self leaves only |
| `giao_vien` | Teaching (incl. nhật ký, nhận xét, điểm danh, chấm bài; not Bài tập manage); Học viên; HR self leaves only |
| Dormant 4 | Parsed on session if leftover in token; `can()` false on every key (`index.test.ts` deferred-denial) |

---

## 3. Is there a UI to view/manage role→permission mappings?

**No.**

Closest product UI: staff Access section.

- Path: `/hr/staff/:id/access` — `apps/admin/src/pages/hr/staff/access.tsx`
- Dialog title **“Phân quyền — {fullName}”** (line 122)
- Body: MultiSelector of `ACTIVE_ROLES` labels only (22–25, 128–135)
- Mutation: `user.updateRoles` (`apps/api/src/user/router.ts:723-727`)
- Same role picker on create: `staff-new.tsx:29-32, 209-216`
- Zod rejects slugs ∉ `ACTIVE_ROLES` (`router.ts:168-171`)
- Extra: directors cannot grant/revoke `super_admin` (739–745)

That assigns **which hats a person wears**. It never shows `crm.opportunityList`, `finance.receiptApprove`, etc.

No admin page imports `PERMISSIONS` for display. Grep of `apps/admin/src` for “permission matrix” / “quyền hạn” / `PERMISSIONS` as data: none.

Developer-only matrix: `apps/e2e/src/screen-role-matrix.ts` (route × role capture; excludes `super_admin` because bypass proves nothing, lines 14–21). Not a user-facing screen.

Historical “users.tsx” role modal is gone; comments still mention it (`docs/16-brief-quyet-dinh-thiet-ke-adr.md:123` — “UI Phân quyền chỉ hiện 5 role”).

---

## 4. Gaps

### 4.1 Missing product: per-role permission matrix

No screen answers “vai trò X được những quyền / màn nào”. Operators must read `packages/auth/src/index.ts` or infer from a live login. That is the missing “giao diện quyền hạn của từng vai trò”.

### 4.2 Roles without a management surface for *permissions*

- Role **assignment** exists (directors + super_admin).
- Role **catalog** is code (`ACTIVE_ROLES`). Adding a role needs an ADR + registry + UI + tests (`index.ts:9`).
- Permission **rosters** are code-only. No CRUD, no facility override.

Dormant `ke_toan` / `cskh` / `ctv_mkt` / `hr` still have labels and enum values but cannot be assigned and hold zero keys.

### 4.3 API keys invisible or mismatched in UI

| Key / behavior | UI gap |
|---|---|
| `classRoster.read` | Intentionally API-only (`index.ts:121-124`). No nav leaf. |
| `staff.pickList` | Dropdowns only; no screen named after it. |
| `parentAccount.read` vs nav `updateEmail` | GĐĐT has **read** (`index.ts:131`) so `/admin/parents/:id` route gate (`admin.routes.tsx:128-130`) can open; nav “Phụ huynh” uses `updateEmail` (`nav-registry.ts:55`) → GĐĐT does not see the leaf. |
| `gift.list` vs nav `gift.upsert` | Sale has `gift.list` (`index.ts:178`). Nav hides Quà tặng (`nav-registry.ts:119-123`). Route gate is `gift.list` (`admin.routes.tsx:182`) → sale can **type** the URL and pass the SPA gate; mutations still 403 on `gift.upsert`. |
| `enrollment.grantUnits`, `enrollment.blockLms`, `student.setLifecycle`, `studentAccount.resetPassword`, `parentAccount.setActive` | Enforced on API; no dedicated nav leaves. Buried in student/parent detail actions or absent. |
| `room.manage` | Key exists; no matching nav child found in `NAV_MODULES`. |
| `exercise.view` | Teachers view via other teaching screens; no “view exercises” leaf (Bài tập nav is `exercise.manage`). |
| Empty-roster keys (`facility.*`, `audit.list`, `facilityNetwork.manage`, `compensationPolicy.manage`) | Super_admin-only. Shift-config still special-cases `compensationPolicy.manage` as a second tab (`shift-config.tsx:287-298`) that no director can open. |

### 4.4 Inconsistent gating style

- CRM/finance/engagement details: route `PermissionGate`.
- Staff/HR: page-local EmptyState; `hr.routes.tsx` has **zero** `PermissionGate`.
- Some HR nav leaves have no permission key (self-service). KPI board is “everyone sees the menu; server scopes rows” (`nav-registry.ts:134,144`).
- Cockpit shortcuts are a fourth, partial `canDo` list (`cockpit.tsx:443-446`) — not generated from `NAV_MODULES` or `PERMISSIONS`.

### 4.5 Extra rules the matrix would miss even if built from `PERMISSIONS` alone

- Sale + `crm.opportunityAssign` ≠ reassign anyone (procedure ownership).
- Sale + `finance.receiptCreate` ≠ see `/finance` list (`receiptList` withheld).
- `kpi.confirm` also requires `scoreOwner.managerId === caller`.
- Director + `user.manage` ≠ create/update `super_admin`.

A honest matrix UI must label **registry door** vs **row/SoD rule**.

---

## Files (authority)

| Path | Role |
|---|---|
| `packages/auth/src/index.ts` | Roles, labels, 68-key `PERMISSIONS`, `can()` |
| `packages/auth/src/index.test.ts` | Matrix drift tests vs `PERMISSIONS` |
| `apps/api/src/trpc.ts` | `requirePermission` / session / facility |
| `apps/api/src/user/router.ts` | `updateRoles`, escalation + last-admin guards |
| `apps/admin/src/lib/session-context.tsx` | Client `canDo` |
| `apps/admin/src/lib/permission-gate.tsx` | EmptyState 403 page |
| `apps/admin/src/shell/nav-registry.ts` | Per-role menu |
| `apps/admin/src/pages/hr/staff/access.tsx` | Role assignment (“Phân quyền”) |
| `apps/admin/src/routes/{crm,finance,admin,hr}.routes.tsx` | Route gates (HR: none) |
| `apps/e2e/src/screen-role-matrix.ts` | Test-only screen×role planner |
| `docs/system-architecture.md:365-384` | As-built RBAC note |

---

## Implication for “giao diện quyền hạn của từng vai trò”

Build a **new** read-only (or later editable) screen. Nothing to extend except:

1. Data: export/iterate `PERMISSIONS` + `ACTIVE_ROLES` + `ROLE_LABELS` (already public from `@cmc/auth`).
2. Optional second axis: `NAV_MODULES` leaves via `isNavChildVisible` / `visibleNavPathsFor`.
3. Annotate procedure-only SoD (cannot be inferred from the map).
4. Gate the screen itself — likely `super_admin` or `user.manage`.

Do not treat `/hr/staff/:id/access` as that UI; it only writes role slugs onto `AppUser.roles`.
