# Phase 7 verification — E2E archetypes and docs

**Plan:** `plans/260817-1354-resource-detail-and-operational-timeline-depth/`
**Phase file:** `phase-07-coverage-gates-e2e-and-documentation.md`
**Mode:** read-only inspection. No source edits.
**Date:** 2026-08-20
**Scope asked:** `apps/e2e/src` (`*.ui.spec.ts` and `journey/`), plus three docs.

---

## Scope note (path mismatch)

- `apps/e2e/src/**/*.ui.spec.ts` — **0 files**. Playwright UI specs live in `apps/e2e/tests/*.ui.spec.ts` and `apps/e2e/tests/journeys/*.journey.ui.spec.ts`.
- `apps/e2e/src/journey/` is **helpers**, not named Playwright tests:
  - `create-staff-via-admin-ui.ts` — drives `/hr/staff/new` → `/hr/staff/:id/profile` (create→detail helper).
  - `menu-nav.ts`, `find-in-list.ts`, `provision-student-via-receipt.ts`, `assert-business.ts`, `mint-lms-session.ts`.
- Coverage below is scored from the actual `*.ui.spec.ts` / `journey/` specs under `apps/e2e/tests/`, which is the only place named tests exist. Live suite (`apps/e2e/tests/live/`) is noted as **out of requested surface**.

Phase 7 file inventory also names `apps/e2e/src/*.ui.spec.ts` as the add target. That path is still empty.

---

## A. E2E archetype coverage

Phase 7 requires: director staff management, cold links, compatibility redirect, cross-role denial; browser proof of create→detail, row→detail, F5, legacy redirect, back.

| Archetype | Status | Evidence (`file`:`test name`) |
|---|---|---|
| director staff management | **MISSING** | No `*.ui.spec.ts` / journey test logs in as `giam_doc_*` and manages `/hr/staff`. Closest in-scope: `apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts`:`a super admin creates, edits, assigns roles and resets password on /hr/staff` (actor is `super_admin`, not director). `apps/e2e/tests/journeys/payroll-roster.journey.ui.spec.ts`:`GĐ reaches Chốt lương via the real side-nav and sees a non-empty staff roster` is director + staff **names on payroll**, not staff management. Out of scope: `apps/e2e/tests/live/14-ops-user-guards.spec.ts`:`GĐKD cố tạo super_admin bị chặn; tạo sale OK; reset mật khẩu user hiện hữu OK`. |
| cold deep-link load | **COVERED** (non-staff sample) | `apps/e2e/tests/deeplink-detail-gates.ui.spec.ts`:`student detail cold-navigates by id (no location.state)`; same file:`receipt detail cold-navigates by id (receiptGet holder)`; same file:`class detail cold-navigates by id (class.create holder)`. `apps/e2e/tests/deeplink-go.ui.spec.ts`:`cold-nav opportunity detail renders contact name`. `apps/e2e/tests/attendance-deeplink.ui.spec.ts`:`URL with classBatchId + sessionId selects the right class/session`. `apps/e2e/tests/workspace-deeplink.ui.spec.ts`:`session-evidence URL hydrates class + session selectors`. **Staff `/hr/staff/:id` cold-nav is MISSING.** ADM-02 comment claims `user.get` cold-start after create navigation, not a fresh typed URL. |
| legacy compatibility redirect | **COVERED** | `apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts`:`a super admin creates, edits, assigns roles and resets password on /hr/staff` — `page.goto('/admin/users')` → `/hr/staff`; `page.goto('/admin/users/:uuid')` → `/hr/staff/:uuid/profile`. |
| cross-role denial | **COVERED** (non-staff sample) | `apps/e2e/tests/deeplink-detail-gates.ui.spec.ts`:`role without crm.opportunityList sees 403 EmptyState on opportunity URL`. `apps/e2e/tests/journeys/receipt-approve-negation.journey.ui.spec.ts`:`sale creates a receipt and gets a real permission-denied banner on it; a different GĐKD finds and approves it`. `apps/e2e/tests/journeys/gift-config-nav.journey.ui.spec.ts`:`GĐKD creates a gift via the real Quà tặng screen; sale never sees the entry in its own side-nav`. `apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts`:`sale punches offsite (real ticket created), GĐĐT never sees it in inbox, a real GĐKD approves it`. **Staff `/hr/staff` ordinary-role negative (Phase 7 nav/RBAC “ordinary negative”) is MISSING.** |
| create→detail | **COVERED** | `apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts`:`a super admin creates, edits, assigns roles and resets password on /hr/staff` — submit `/hr/staff/new` → `/hr/staff/:id/profile`. Helper `apps/e2e/src/journey/create-staff-via-admin-ui.ts` asserts the same URL (no `test()` name). Also `apps/e2e/tests/journeys/aftersale-case-lifecycle.journey.ui.spec.ts`:`a director walks an after-sale case from open through to closed` → `/crm/aftersale/:id`. `apps/e2e/tests/journeys/crm-opportunity-lost.journey.ui.spec.ts`:`a sale creates a lead, opens it, and closes it as lost` → `/crm/opportunities/:id`. |
| row→detail | **COVERED** (non-staff sample) | `apps/e2e/tests/journeys/enrollment-second-class.journey.ui.spec.ts`:`receipt approval activates the student, then sale looks them up by name and enrolls them into a second class` — list row click → `/finance/:id`. `apps/e2e/tests/journeys/finance-receipt.journey.ui.spec.ts`:`sale creates a receipt for a real class, a different GĐ finds it by its displayed student name and approves it, and the notification email reaches "sent"` — row click → `/finance/:id/overview`. `apps/e2e/tests/journeys/crm-opportunity-lost.journey.ui.spec.ts`:`a sale creates a lead, opens it, and closes it as lost` — board name click → opportunity detail. **Staff list row → `/hr/staff/:id` is MISSING** (ADM-02 goes `goto('/hr/staff/new')`, never clicks a staff row). |
| F5 / back-navigation | **MISSING** | Zero `page.goBack()`, `history.back`, or Back/Forward assertions under `apps/e2e`. `page.reload()` exists only as data-refresh (`crm-rotting.journey.ui.spec.ts`, `entrance-test-appointment.journey.ui.spec.ts`, `lms-grade-parent-view.journey.ui.spec.ts`, `recon-exceeds-threshold.journey.ui.spec.ts`) — not F5-on-detail URL persistence. `crm-receipt.journey.ui.spec.ts` comment says “deep-link param + back” but the test (`sale advances a real Opportunity to O4_TESTED…`) only toggles table/kanban buttons; it never presses Back. |

### Phase 7 gate vs this inventory

| Phase 7 browser gate | Result |
|---|---|
| director Staff positive | Fail (super_admin only in-scope) |
| ordinary Staff negative | Fail |
| create→detail | Pass (staff + other modules) |
| row→detail | Pass as sample; fail for staff |
| F5 | Fail |
| legacy redirect | Pass |
| back | Fail |
| cold links | Pass as sample; fail for staff |

---

## B. Docs content

Asked claims: dual-ledger (`AuditLog` = compliance vs `RecordEvent` = user timeline); canonical staff URL `/hr/staff`; resource-depth taxonomy / exception rule.

### `docs/06-kien-truc-url-routing.md`

| Claim | Present? | Exact heading / lines |
|---|---|---|
| Dual-ledger semantics | **NO** | No `AuditLog`, `RecordEvent`, or dual-ledger wording. Closest: §3.C “Nhân sự” notes `` `/{id}/activity` theo timeline Phase 4 `` (line 95); CRM table has `/{id}/timeline` (line 82). |
| Canonical staff URL `/hr/staff` | **YES** | Heading `### C. Tài chính & Nhân sự–Lương` (line 86): `\| Nhân sự \| \`/hr/staff\` → \`/hr/staff/{id}\` \| \`/{id}/profile\` · \`/{id}/access\` (\`/activity\` theo timeline Phase 4) \|` (line 95). Heading `### D. Định danh & Quản trị` (line 104): `Người dùng đã chuyển sang \`/hr/staff\` — \`/admin/users\` chỉ còn redirect` (line 107). |
| Resource-depth taxonomy / exception rule | **NO** | No exception registry, category/reason/owner, or depth-audit taxonomy. Document is URL grammar + route map (`## 2. Ngữ pháp URL chuẩn`, `## 8. Checklist chuẩn hoá URL`). |

### `docs/ux-resource-centric-structure.md`

| Claim | Present? | Exact heading / lines |
|---|---|---|
| Dual-ledger semantics | **NO** | No `AuditLog` / `RecordEvent`. L7 is only “Workers, audit” (line 38). |
| Canonical staff URL `/hr/staff` | **NO** | File never mentions `/hr/staff`. Canonical recipe is shifts/KPI only (`## 6. Canonical recipe`, lines 85–87). |
| Resource-depth taxonomy / exception rule | **YES** | Heading `## 8. Resource-depth audit exceptions` (line 97): “The source-derived depth audit classifies every production route. A route that is not a durable record must declare an explicit exception with a category, reason and owner (for example: workspace, config catalog, resolver, compatibility redirect, or a documented timeline gap). New record routes must provide the canonical detail contract (`get`, authorized actions and timeline) or fail the audit.” (lines 99–104). |

### `docs/system-architecture.md`

| Claim | Present? | Exact heading / lines |
|---|---|---|
| Dual-ledger semantics | **YES** | Heading `## Resource-depth rollout status (2026-08-19)` (line 651): “`RecordEvent` is the facility-scoped, append-only user-facing operational timeline; `AuditLog` remains the global compliance ledger and is not a director timeline.” (line 653). Older mentions treat `AuditLog` only as compliance (`**Compliance:**` / `` `AuditLog` — immutable action log `` at line 263; `` `AuditLog` — immutable compliance log `` at line 415) without the `RecordEvent` contrast. |
| Canonical staff URL `/hr/staff` | **YES** | Same heading: “Canonical staff surface remains `/hr/staff`; `/admin/users` is a compatibility redirect.” (line 655). |
| Resource-depth taxonomy / exception rule | **PARTIAL** | Same heading points at residual exceptions: “Remaining gap-only detail exceptions are recorded in `plans/reports/phase-06-module-6-gap-only-audit.md`; Phase 7 source-derived coverage and URL/history gates remain open.” (line 656). Does **not** state the category/reason/owner taxonomy. |

### Docs matrix

| Doc | Dual-ledger | `/hr/staff` | Taxonomy / exception rule |
|---|---|---|---|
| `docs/06-kien-truc-url-routing.md` | missing | present | missing |
| `docs/ux-resource-centric-structure.md` | missing | missing | present |
| `docs/system-architecture.md` | present | present | partial (pointer only) |

Phase 7 success criterion “Docs state dual-ledger semantics and canonical staff URLs” is met **only** in `docs/system-architecture.md`. The three-doc split in the phase file inventory is incomplete: 06 has staff paths, UX has the exception rule, architecture has dual-ledger + staff; no single doc carries all three, and 06/UX omit dual-ledger.

---

## Verdict

Phase 7 E2E + docs gates are **not closed**.

- Missing in-scope browser proof: director staff management, staff ordinary-role denial, staff row→detail, staff cold-link, F5, Back.
- Present samples: cold-link (other entities), legacy `/admin/users` redirect, cross-role denial (other entities), create→detail (including staff via super_admin), row→detail (receipt/CRM).
- Docs: dual-ledger + `/hr/staff` live in `docs/system-architecture.md`; taxonomy/exception rule lives in `docs/ux-resource-centric-structure.md` §8; `docs/06-kien-truc-url-routing.md` has `/hr/staff` as-built paths only.
