# CMC EDU v2 — Codebase Summary

**Status:** SSO landing complete (P1) · Flow audit complete (P3) · P2-P4 workflows BUILT & TESTED · UI migration COMPLETE (Astryx 100% admin+lms, Mantine fully removed) + premium design-language layer promoted to @cmc/ui + **premium ERP screen build-out merged to main** (21/21 non-blocked screens now on premium templates/composites, 8-phase TDD complete) + **HR remediation (shift/KPI/payroll) phases 1-6 complete**: salary-tier model, KPI auto-score lifecycle, session-done engine, e2e verify loop  
**Last Updated:** 2026-07-26 (số liệu hiện hành nằm ở các banner bên dưới; khối "Build State" giữ nguyên làm ảnh chụp lịch sử 2026-07-12)  
**Build State (2026-07-12, verified this session — HR remediation phase 6):** @cmc/api 695 tests passing (81 test files, live Postgres); @cmc/admin 229 tests passing (32 test files); @cmc/e2e 19 passed + 1 pre-existing skip (20 spec files, incl. new `shift-lifecycle.spec.ts` + `kpi-lifecycle.spec.ts`, dev-header mode); 14/14 apps build clean. See `docs/project-changelog.md` for the dated entry.

> **Updated 2026-07-17 (acceptance-review audit):** test counts above predate 3 later merge waves (43 happy-path gaps, review-gap fixes, super-admin completion). Current as of 2026-07-17: apps/api 99 files/889 tests, apps/admin 33 files/258 tests, apps/e2e 11 spec files. **(Số liệu 07-17 — đã bị thay thế; số hiện hành ở banner 2026-07-26 bên dưới.)**
>
> **Updated 2026-07-24 (UAT prep — journey infrastructure + e2e capture/smoke):** Phase 4–5 added 13 new journey-related spec files (3 regression + 10 core flows in `apps/e2e/tests/journeys/*.journey.ui.spec.ts`). ~~Current e2e count: ~21+ spec files… (9/38 total flows covered)~~ — **superseded, xem banner 2026-07-26 ngay dưới.**
>
> **Updated 2026-07-26 (nghiệm thu journey + CI khôi phục):** e2e hiện có **39 spec file** — gồm **27 journey UI** (`apps/e2e/tests/journeys/*.journey.ui.spec.ts`); project `ui-chromium` chạy **34 spec, xanh trên CI**. Sổ nghiệm thu: **27/38 luồng đã chứng minh chạy** (commit `22bbead`), cấu trúc 37 built / 1 partial / 0 missing, actor-audit 0 phát hiện. **Trần khả thi qua journey = 31/38**: 7 luồng `no-ui-path` (không có UI nên journey không lái được), 4 luồng chưa viết journey. Đây là bằng chứng đầu tiên do CI sinh (`gitDirty:false`) — trước 2026-07-26 chỉ có run cục bộ mang nhãn tham khảo. **Giới hạn:** journey ở mức smoke — chứng minh luồng *chạy thông*, KHÔNG chứng minh *đúng số học nghiệp vụ*; UAT người thật (M0) vẫn chưa chạy. Test đơn vị/tích hợp đo trên CI cùng commit: `@cmc/api` 104 file/988 test, `@cmc/admin` 39 file/396 test, `@cmc/ui` 12/45, `@cmc/domain-payroll` 2/38, `@cmc/domain-time` 1/31, `@cmc/domain-finance` 5/17.

> **Cập nhật 2026-07-23 — đợt gỡ lỗi phân quyền + siết sổ nghiệm thu.**
> Đo tại `main` (`35d4df0`): `pnpm typecheck` 27/27 · `pnpm lint` sạch · `pnpm test` 22/22 task (api **977**, admin **352**) · `pnpm --filter @cmc/e2e test` 20 pass, **0 facility rò** · runtime capture 102 tổ hợp màn×vai **0 denied** (chạy 2026-07-22; phạm vi ma trận sau khi thêm nav entry 2026-07-23 là **98** cặp và **chưa** capture lại — xem `docs/runbook-uat-golive.md` §1).
> *(Số e2e "20 pass" đo 2026-07-23; sau đó thêm 27 journey spec — CI 2026-07-26 chạy `ui-chromium` **34 spec xanh** tại commit `22bbead`. Số api/admin cập nhật cùng ngày: api **988**, admin **396**.)*
>
> **Ba luồng chưa từng chạy được từ 2026-07-06 đã gỡ.** Quyền đọc lớp bị gộp vào quyền tạo lớp ⇒ không vai nghiệp vụ nào thu nổi học phí, giáo viên thấy menu nhưng dropdown rỗng, hai giám đốc mở màn chốt lương mà danh sách nhân viên trống. Tách `class.read` · `classRoster.read` (hẹp hơn — trả họ tên trẻ em) · `staff.pickList` (key riêng, không mượn quyền tiền). **Không nới quyền ghi nào**; `class.create` vẫn chỉ GĐĐT, ADR-B nguyên vẹn.
>
> **Sổ nghiệm thu: 38/38 built → 37 built / 1 partial.** `acceptance:report` giờ nhận diện màn giữ chỗ (`EmptyState` không gọi procedure, và `ComingSoon`) — P1-08 rời `built` vì `/finance/refund` chưa xây. Thêm `actor-audit`: đối chiếu actor khai trong manifest với registry quyền, hiện **0 phát hiện** (từ 26). Gate `acceptance:report` đã vào CI ở mức **cảnh báo** (`continue-on-error`), chưa chặn merge.
>
> **Bổ sung 2026-07-26 — tầng *đã chứng minh chạy*:** con số `built` ở trên là quét TĨNH (mã có tồn tại không).
> Tầng mạnh hơn là **journey UI thật chạy xanh**: hiện **27/38 luồng** tại commit `22bbead`, sinh từ artifact
> CI `ui-e2e` (`gitDirty:false`) — trước 2026-07-26 chỉ có run cục bộ mang nhãn tham khảo. Trần khả thi qua
> journey = **31/38** (7 luồng `no-ui-path`, 4 luồng chưa viết journey).
>
> **Giới hạn phải đọc là "chưa phủ", không phải "sạch":** 26 procedure ngoài tầm registry (owner-check, `lmsProcedure`, public) và 2 cặp (luồng, vai) audit không kết luận được. Runtime capture cũng không thấy được gate `canDo()` phía client — màn không gọi gì thì không có request để bắt.
>
> **UAT người thật (Phase 4 plan `260707-2308`) VẪN CHƯA CHẠY** — xem `docs/runbook-uat-golive.md`.

---

## Monorepo Structure

```
D:\project\vip\CMC
├── apps/
│   ├── admin/           # Vite+React ERP SPA — 30 routes, 100% Astryx, tRPC client (phases 02–06, Phase 3 UI complete)
│   ├── lms/             # Vite+React LMS SPA — parent+student, kind guards, mobile-first (phase 07)
│   ├── api/             # tRPC backend (Node.js + Prisma + Postgres) — 27 routers
│   └── e2e/             # Playwright — API-driven specs + browser-based UI tests (phase 08)
│       ├── src/global-setup.ts         # Fixed API port + health-wait for UI-mode runs (PLAYWRIGHT_UI=1)
│       ├── tests/*.api.spec.ts         # tRPC API contracts (e2e backend testing)
│       └── tests/*.ui.spec.ts          # Real browser UI specs (admin-shell, lms-login; Phase 2 added, Phase 3 validated)
├── packages/
│   ├── auth/            # RBAC registry (single source of truth for roles/permissions)
│   ├── db/              # Prisma schema, migrations, seed — 48 models
│   ├── domain-finance/  # Finance domain logic (SO receipt codes, refund cap, phone dedup)
│   ├── domain-identity/ # Identity domain logic (phone normalization)
│   └── ui/              # Design system: Astryx barrel + premium design-language layer — LineIcon (Feather + 5 premium icons: globe/clock/trophy/gift/star, data-icon attr), MetricCard, Panel, TaskRow, FunnelBar, AppFrame/SideNav, page templates (ListPage/DetailPage/FormPage); Inter Variable font; 45+ vitest component tests. **21/21 non-blocked admin ERP screens now on premium templates (2026-07-12).** (Mantine fully removed 2026-07-10)
├── docs/                # Design docs (TL00-TL31, frozen design corpus)
└── plans/               # Session reports (audits, remediation, deep reviews)
```

**Stack:**  
- **Monorepo:** pnpm + Turbo  
- **Language:** TypeScript (ESM)  
- **API:** tRPC 11 (procedure-based, not REST)  
- **Database:** Postgres + Prisma ORM with row-level security (RLS)  
- **Frontend:** Vite + React — apps/admin (ERP, 30 routes) + apps/lms (LMS, parent+student kind gate)  
- **Auth:** Registry-driven RBAC (centralized in `@cmc/auth`)
- **UI Testing:** Playwright (browser-based e2e; `PLAYWRIGHT_UI=1` gate) with Vite dev/preview proxy for same-origin API calls

**Dev/Preview Infrastructure (Phase 2 — 2026-07-10):**
- **apps/admin/vite.config.ts, apps/lms/vite.config.ts:** Dev & preview mode proxy config (routes /trpc, /upload, /auth, /health → api server) — workaround for lack of CORS in tRPC handler (see Known Issues). Enables real browser testing without modifying production API security posture.
- **apps/e2e/src/global-setup.ts:** Fixed API port reservation for UI-mode runs (prevents port-clash between concurrent e2e sessions).
- **Specs added:** apps/e2e/tests/admin-shell.ui.spec.ts (admin app load, shell render), apps/e2e/tests/lms-login.ui.spec.ts (LMS login flow against real API).

---

## P1 Routers (tRPC Procedures)

All procedures are **authenticated** and **facility-scoped**. RLS enforces facility isolation at the database layer.

### 1. CRM Router (`apps/api/src/crm/router.ts`)
Lead-to-Opportunity pipeline (WF-P1-01).

**Procedures:**
- `crm.opportunityCreate(contactName, phone, email)` → Opportunity (O1_LEAD)  
- `crm.opportunityAdvance(opportunityId, toStage)` → Opportunity (O1→O4 state machine)  
- `crm.opportunityMarkLost(opportunityId, lostReason?, reopen?)` → mark O2+ as closed  
- `crm.opportunityLookup(phone)` → { exists: bool } (dedup gate)  
- `crm.opportunityList(stage?, page?, pageSize?)` → paginated pipeline view

**Test Coverage:** 2 test files, ~30+ test cases (create, advance, mark lost, lookup, pagination)

---

### 2. Finance Router (`apps/api/src/finance/router.ts`)
Money gate & receipt lifecycle (WF-P1-02, WF-P1-03, WF-P1-08).

**Procedures:**
- `finance.receiptCreate(opportunityId?, studentId?, studentName, parentPhone, amount, classBatchId?)` → Receipt (draft)  
- `finance.receiptApprove(receiptId)` → Receipt (approved) + triggers provisioning (idempotent)  
- `finance.receiptCancel(receiptId)` → revert opportunity O4→O3, void enrollment  
- `finance.refundCreate(receiptId, amount)` → append-only refund ledger (capped at netAmount)  
- `finance.receiptList(page?, pageSize?, status?)` → K3 remediation: paginated, filterable receipts (facility-scoped)

**Business Rules:**
- **APPROVAL_SECOND_EYE_THRESHOLD = 20,000,000 VND** — above threshold requires `giam_doc_dao_tao` or `super_admin` approval (independent second eye, ADR-B)  
- **Refund cap:** sum of all refunds ≤ receipt.netAmount (protected by `FOR UPDATE`)  
- **Receipt code:** globally unique (shared counter, not facility-scoped) — fixed in Wave A  
- **Email:** best-effort (enqueue outside provisioning try/catch) — Wave C isolation

**Test Coverage:** 5 test files (create, approve, cancel/refund, receipt list, RLS negative)

---

### 3. Enrollment Router (`apps/api/src/enrollment/router.ts`)
Student enrollment lifecycle (WF-P1-05, WF-P1-07).

**Procedures:**
- `enrollment.enroll(studentId, classBatchId, opportunityId?)` → Enrollment (reserved)  
- `enrollment.blockLms(studentId)` → set Student.lifecycle='blocked_lms' (K8 remediation)  
- `enrollment.mine()` → [EnrollmentDto] approved children (LMS parent-facing read)

**Invariants:**
- `active` status only set by `finance.receiptApprove` (inside provisioning) — never by direct mutation  
- `enrolled.mine` reads only `Guardian`-approved children (separated from student creation)

**Test Coverage:** 3 test files (enroll, blockLms, reserved→active transition, LMS read)

---

### 4. Guardian Router (`apps/api/src/guardian/router.ts`)
Parent account linking & linking requests (WF-P1-04, WF-P1-06).

**Procedures:**
- `guardian.requestLink(studentRef, requestingEmail?)` → GuardianLinkRequest (pending)  
- `guardian.approveLink(requestId)` → Guardian + LMS parent account  
- `guardian.pendingLinks()` → [GuardianLinkRequest] awaiting approval (K3 remediation)  
- `guardian.getApprovedChildren()` → [Student] with Guardian (excludes blocked_lms)

**Tests:** 2 test files (link request, approval, reading approved children)

---

### 5. Student Router (`apps/api/src/student/router.ts`)
Student identity (minimal in P1).

**Procedures:**
- `student.lookup(phone)` → { exists: bool, studentId?: uuid } — **MISSING FULLY QUALIFIED LOOKUP** (K4 deferred to P2)

**Status:** Stub (full student lookup deferred; provisioning creates Student inline)

---

### 6. LMS Auth Router (`apps/api/src/lms-auth/router.ts`)
Parent/student login & session (WF-P1-07 — enrollment.mine read).

**Procedures:**
- `lmsAuth.requestOtp(phone, loginKind)` → { requested: bool } (enqueue email OTP)  
- `lmsAuth.verifyOtp(phone, otp)` → JWT token + { children: [EnrollmentDto] } for parent; basic student data for student

**Session:** JWT (issued in `verifyOtp`); parent reads `enrollment.mine`, student reads basic data

**Test Coverage:** 1 test file (OTP flow, enrollment retrieval)

---

### 7. Facility Router (`apps/api/src/facility/router.ts`)
Facility bootstrap (R2 remediation).

**Procedures:**
- `facility.create(name, address?, facilityId?)` → Facility (R2: super_admin bypass for bootstrap)

**Status:** Stub (actual facility provisioning defer; dev seed in `packages/db/prisma/seed.mjs`)

---

## P2-P4 Routers (Class Operations, HR/Payroll, Redemption)

All P2-P4 procedures are **authenticated** and **facility-scoped** per the same RLS enforcement as P1.

### 8. Session Evidence Router (`apps/api/src/session-evidence/`)
Teacher session summary & photo consent (WF-P2-08).

**Procedures:**
- `sessionEvidence.publish(sessionId, summary, photos)` → publish evidence  
- Session-evidence photo access control (consent-gated read for parents)

**Test Coverage:** `session-evidence/publish.test.ts` · `session-evidence/photo-access.test.ts`

---

### 9. Assessment Router (`apps/api/src/assessment/`)
Student work review & AI-draft comments (WF-P2-07).

**Procedures:**
- `assessment.draftComment(studentId, submissionId)` → AI-generated draft  
- `assessment.confirm(draftId)` → teacher-approved comment

**Test Coverage:** `assessment/draft-confirm.test.ts`

---

### 10. Submission Router (`apps/api/src/submission/`)
Student PDF exercise submissions & grading (WF-P2-05, WF-P2-06).

**Procedures:**
- `submission.saveDraft(exerciseId, annotations)` → local draft (browser-only)  
- `submission.submit(exerciseId, pdfBytes)` → finalize & lock  
- `submission.grade(submissionId, score, comment)` → teacher marks + star rewards  
- `submission.listForChild(childId)` → student self-read

**Test Coverage:** `submission/annotate-submit.test.ts` · `submission/grade.test.ts` · `submission/teacher-annotation.test.ts` · `submission/list-for-child.test.ts`

---

### 11. Attendance Router (`apps/api/src/attendance/`)
Daily class attendance tracking (WF-P2-02).

**Procedures:**
- `attendance.mark(sessionId, studentId, present)` → mark one student  
- `attendance.markAll(sessionId, presentStudents[])` → bulk mark

**Test Coverage:** `attendance/gate.test.ts` · `attendance/list-for-child.test.ts`

---

### 12. Exercise Router (`apps/api/src/exercise/`)
Curriculum exercise & tier-based unlock (WF-P2-03, WF-P2-04).

**Procedures:**
- `exercise.openForStudent(studentId, tier)` → unlock tier A/B based on progress  
- `exercise.publish(unitId, pdfUrl)` → teacher uploads exercise

**Test Coverage:** `exercise/open-tier.test.ts` · `exercise/publish.test.ts`

---

### 13. Check-In Router (`apps/api/src/checkin/`) — daily in/out pairing (ADR 0043)
Staff daily punch pair tracking (WF-P3-01, WF-P3-02).

**Procedures:**
- `checkInOut.punch({reason?})` → appends a `TimePunch` (day's first = in, last = out).
  `withinNetwork` = true when no active `FacilityNetwork` exists OR caller IP matches one (not GPS).
  Offsite is never rejected; the first offsite punch of a day with a registered shift and no ticket
  yet requires `reason` (`appCode: OFFSITE_REASON_REQUIRED`) and auto-creates a `pending`
  `ManualAttendanceTicket` carrying that day's first/last punch as `checkInAt`/`checkOutAt`. A ticket
  that has left `pending`/`resubmitted` is frozen — later punches never retroactively change it.
  10s cooldown (`appCode: COOLDOWN`).
- `manualPunch.approve/reject(ticketId, note?)` → GĐ of the ticket owner's role track
  (sale→`giam_doc_kinh_doanh`, giao_vien→`giam_doc_dao_tao`) or `super_admin`, anti-self-approve,
  TOCTOU-safe; approving after the period's Payslip is `finalized` returns `warning: 'PAYSLIP_FINALIZED'`
- `manualPunch.resubmit({ticketId, reason})` → ticket owner only, only from `rejected`, updates the
  same row (no new-row path — `manualPunch.create` was removed, no arbitrary-date manual ticket anymore)
- `manualPunch.list({scope: 'inbox'|'mine', status?})` → inbox = tickets in caller's track (or all for
  `super_admin`), mine = own tickets

**Test Coverage:** `checkin/punch-offsite.test.ts` · `checkin/manual-punch-approval-track.test.ts` · `checkin/ip-match.test.ts` · `checkin/status-check.test.ts` · `apps/e2e/tests/attendance-lifecycle.spec.ts`

---

### 14. Shift Router (`apps/api/src/shift/`) — HR remediation
Staff shift registration & approval, gated by ROLE + ShiftGroup type (WF-P3-03, WF-P3-04, WF-P3-07; ADR 0040).

**Procedures:**
- `shift.createGroup/createTemplate` → ShiftGroup/ShiftTemplate catalog (`shift.manage`, GĐKD/GĐĐT)
- `shift.submit({shiftGroupId, fromDate, toDate, entries[]})` → ticket-lock (1 `submitted`/employee),
  overlap guard (1 active date-range/person regardless of group), group-type must match
  `resolveShiftGroup(position)`, `fromDate` must be a future ICT date
- `shift.approve/reject(registrationId, reason?)` → gate = role matching `ShiftGroup.type`
  (`GIAO_VIEN`→`giam_doc_dao_tao`, `KINH_DOANH`→`giam_doc_kinh_doanh`, `super_admin` bypasses both) +
  anti-self; `reject` requires a reason, frees the ticket-lock + overlap guard
- `shift.listGroups` / `myRegistrations` / `pendingForApproval` → catalog / self-scoped / approval inbox

**Test Coverage:** `shift/register-approve.test.ts` · `shift/reject-validate.test.ts` · `shift/status-check.test.ts` · `shift/list-procedures.test.ts` · `apps/e2e/tests/shift-lifecycle.spec.ts`

---

### 15. Payroll Router (`apps/api/src/payroll/`) — salary-tier model (HR remediation, ADR 0044)
Monthly payslip assembly from a per-facility `SalaryTier` catalog (WF-P3-05).

**Procedures:**
- `salaryTier.list/create/update` → tier catalog (`baseSalary`, `unitRate`, `requiredShifts`,
  `requiredMetric`, `type`), `salaryTier.manage` (GĐKD/GĐĐT)
- `compensation.assignTier({appUserId, tierId})` → assigns a sale/giao_vien employee to a tier
  (tier.type must match target role); `compensation.upsertRate` REMOVED
- `compensationPolicy.get/upsert` → per-facility late/early penalty rates (`super_admin` only,
  fallback 500đ/phút muộn, 1000đ/phút sớm)
- `payslip.assemble({appUserId, period})` → live recompute from TimePunch + ShiftRegistration +
  KpiScore + SalaryTier: `baseSalary(tier) + kpiBonus(KpiScore.value) − penaltyAmount` (day-level
  in/out pairing via `resolveDayCredit`/`computeDayAttendance`, ADR 0043 — a day's punch pair or an
  approved offsite ticket's frozen checkInAt/checkOutAt credits every registered shift it overlaps);
  FORBIDDEN if no tier assigned
- `payslip.finalize/reopen` → lock/unlock a period; `payslip.my/getForUser` → self/privacy-gated read

**Test Coverage:** `payroll/policy-model.test.ts` · `payroll/policy-rates.test.ts` · `payroll/penalty-posttax.test.ts` · `payroll/manual-ticket-exemption.test.ts` · `payroll/payslip-my.test.ts` · `apps/e2e/tests/kpi-lifecycle.spec.ts`

---

### 16. KPI Router (`apps/api/src/kpi/`) — auto-score lifecycle (HR remediation, ADR 0044)
Auto-scored KPI lifecycle: `draft → submitted → confirmed → approved` (WF-P3-06, WF-P3-08, WF-P3-09).
`kpi.submit`/`kpi.approve` (standalone)/`kpi.getForUser` REMOVED — `approved` is reachable ONLY via `bulkApprove`.

**Procedures:**
- `kpi.refresh({period, appUserId?})` → recompute + upsert `draft` (idempotent, never overwrites
  `submitted`+); formula `value = min(1,shiftActual/requiredShifts) × min(1,metricValue/requiredMetric)
  × unitRate` (`auto-score.ts`'s `computeKpiValue`)
- `kpi.submitSlip({period})` → owner submits own draft, opens day 3 of next ICT month; auto-refreshes first
- `kpi.confirm({kpiScoreId})` → direct manager (`managerId`) or `super_admin`, anti-self
- `kpi.override({kpiScoreId, value, overrideReason})` → director sets value directly; editing an
  `approved` slip requires `super_admin` AND the period's Payslip reopened to `draft`
- `kpi.bulkApprove({period})` → 2 GĐ tất toán every `confirmed` slip whose Payslip is `finalized`,
  branch-scoped by target `AppUser.roles` (not `position`), excludes caller's own slip, idempotent
- `kpi.list({period, status?})` / `kpi.myScore({period})` → director inbox (branch-scoped) / self read

**Test Coverage:** `kpi/auto-score.test.ts` · `kpi/lifecycle.test.ts` · `kpi/override-tree.test.ts` · `apps/e2e/tests/kpi-lifecycle.spec.ts`

---

### 16b. Session-done engine (`apps/api/src/class/session-done.ts`, `apps/api/src/worker/session-done-sweep.ts`) — HR remediation, ADR 0044
Sweep-only (no event hooks) worker that marks a session `done` once 3 conditions hold (≥1 `present`
attendance, every `present` student has a `confirmed` QualitativeAssessment, `published` SessionEvidence
with ≥1 photo) and `now >= endTime`. `doneAt` freezes at the latest condition's timestamp. Feeds
`creditFactor(doneAt, endTime)` (24h→1.0, 48h→0.5, else 0) into KPI's `collectTeacherHours`. A second
sweep auto-cancels 0-`present` sessions past `endTime + 24h` and tail-appends a makeup session onto the
recurring slot (room conflict skips auto-creation, reported for manual handling).

**Test Coverage:** `class/session-done.test.ts` · `worker/session-done-sweep.test.ts`

---

### 17. Rewards Router (`apps/api/src/rewards/`)
Star redemption & gift catalog (WF-P4-01, WF-P4-02).

**Procedures:**
- `rewards.redeem(studentId, giftId)` → claim gift via stars  
- `rewards.approve/deliver(redeemId)` → manager fulfills order  
- `gift.upsert/archive(giftId)` → admin gift catalog mgmt

**Test Coverage:** `rewards/redeem-refund.test.ts`

---

### 18. Meeting Router (`apps/api/src/meeting/`)
Parent meeting scheduling & reminders (WF-P4-03).

**Procedures:**
- `parentMeeting.schedule(staffId, parentId, date)` → create meeting slot  
- `parentMeeting.complete(meetingId)` → mark attended

**Test Coverage:** `meeting/parent-meeting.test.ts`

---

### 19. Appointment Router (`apps/api/src/appointment/`)
Entry test & periodic assessment scheduling (WF-P4-04).

**Procedures:**
- `testAppointment.schedule(opportunityId, date)` → schedule entry test  
- `testAppointment.complete(appointmentId, result)` → record result

**Test Coverage:** `appointment/appointment-lifecycle.test.ts`

---

### 20. After-Sale Router (`apps/api/src/after-sale/`)
Post-enrollment case management (WF-P4-05).

**Procedures:**
- `afterSale.advance(caseId, status)` → case state machine  
- `student.setLifecycle(studentId, status)` → mark withdrawn or blocked

**Test Coverage:** `after-sale/after-sale.test.ts`

---

### 21. Course Router (`apps/api/src/course/`)
Class/batch course definitions.

**Test Coverage:** `course/course-crud.test.ts`

---

### 22. Room Router (`apps/api/src/room/`)
Physical classroom & resource booking.

**Test Coverage:** `room/room-crud.test.ts`

---

## Worker/Background Jobs

### `apps/api/src/worker/reconcile-orphaned-receipts.ts`
Detects and recovers mid-provision failures (K2 partial remediation).

**Trigger:** On-demand (manual run, or future scheduler)  
**Scope:** Receipts with approved status but missing Guardian/StudentAccount/Enrollment  
**Recovery:** Reruns `provisionFromReceipt` (idempotent design)  
**Tests:** 5 test cases (crash-no-marker, marker-recovery, fully-provisioned no-touch, renewal no-touch, R1 mid-provision failure)

---

### `apps/api/src/worker/relay-email-outbox.ts`
Sends queued emails via EmailOutbox (R3 atomic claim); transport wired (Brevo/Graph).

**Concurrency:** Atomic claim via `updateMany` with new `sending` status (prevents double-send)  
**OTP hygiene (M1 P4):** `sweepStaleOtpPayloads` scrubs stale OTP payloads (whole-object equality,
avoids NULL-trap on unscrubbed rows); `pruneTerminalOutbox` deletes `sent`/`dead` rows past
`EMAIL_OUTBOX_RETENTION_DAYS` (default 30d); indexed on `[status, createdAt]`  
**Tests:** unit + integration suite (concurrent drain safety, idempotency, retry, failed email, OTP
scrub/sweep, terminal-row prune)

---

## Provisioning Engine

### `apps/api/src/provisioning/provision-from-receipt.ts`

**Triggered by:** `finance.receiptApprove` (atomic with receipt status change)

**Workflow (K1 remediation — creates Guardian):**
1. Resolve student: reuse existing (renewal) or create new  
2. Create StudentAccount (LMS login identity)  
3. **Create Guardian (parent account link)** — K1 fix  
4. Create/activate Enrollment  
5. Enqueue receipt email (best-effort, outside try/catch)

**Idempotency:** All steps check existence before create; reruns are safe (R1 recovery pattern)

**Tests:** 3 test files (guardian provisioning, idempotency, renewal-reuse)

---

## Data Model (P1)

**Prisma Schema:** `packages/db/prisma/schema.prisma` (393 lines)

### Core Tables (13 + 4 RLS-protected)

| Table | Purpose | RLS | Notes |
|-------|---------|-----|-------|
| `Facility` | Tenant boundary | ✓ | Bootstrap enabled (R2); seed-only initially |
| `Role` | RBAC registry (enum-like) | | Single source (docs/TL14) |
| `AppUser` | Staff/admin accounts | ✓ | `super_admin`, `giam_doc_*`, `sale`, `giao_vien` |
| `Contact` | Lead details | ✓ | Phone, name, email |
| `Opportunity` | Sales pipeline | ✓ | O1–O5 stages; RLS on created_by |
| `ParentAccount` | Guardian identity | ✓ | Phone+parent_type+facilityId unique |
| `Guardian` | Parent→student link | ✓ | Created by provisioning (K1 fix) |
| `Student` | Child identity | ✓ | lifecycle: active/blocked_lms/withdrawn |
| `StudentAccount` | LMS login | ✓ | Created by provisioning |
| `Enrollment` | Student→class seat | ✓ | status: reserved/active/withdrawn |
| `Receipt` | Payment record | ✓ | Globally unique code; status: draft/approved/cancelled |
| `RefundRecord` | Append-only refund ledger | ✓ | Immutable (UPDATE/DELETE denied in RLS) |
| `AuditLog` | Compliance log | ✓ | Immutable; all mutations logged |

### Support Tables (non-RLS)

| Table | Purpose |
|-------|---------|
| `EmailOutbox` | Queued emails + status (pending/sending/sent/failed) |
| `ReceiptCodeCounter` | Global receipt code atomic counter |
| `StudentLifecycle` | Enum (active, blocked_lms, withdrawn) |
| `OpportunityStage` | Enum (O1_LEAD ... O5_ENROLLED) |

### Migrations (5 total)

1. **20260706025956_p1_identity_enrollment** — Initial schema (Student, Guardian, Enrollment, Receipt, etc.)  
2. **20260706054322_p1_remediation_wave1_schema_rls** — RLS policies (6 tables), `withFacility` trigger, GRANT refinement  
3. **20260706140000_p1_remediation_wave2_logic_fixes** — Guardian creation in provisioning (K1), email enqueue isolation (R5)  
4. **20260706150000_p1_remediation_wavea_privilege_hardening** — REVOKE UPDATE/DELETE on ledger+audit (K5 append-only)  
5. **20260706160000_p1_remediation_wavec_outbox_atomic_claim** — New `sending` status for EmailOutbox (R3 atomic claim)

---

## Shared Packages

### `@cmc/auth` (Role/Permission Registry)
Single RBAC source of truth. Consulted by every mutation via `requirePermission(domain, action)`.

**Roles (9 staff + 2 LMS-only):** `super_admin`, `giam_doc_dao_tao`, `giam_doc_kinh_doanh`, `sale`, `giao_vien`, `ke_toan`, `cskh`, `ctv_mkt`, `hr` · (LMS-only: `phu_huynh`, `hoc_sinh`)  
**Pattern:** Each procedure declares which role(s) can call it; `can()` checked at procedure entry.

**ADR-B second-eye note:** `SECOND_EYE_ROLES = ['giam_doc_dao_tao', 'super_admin']` — `giam_doc_kinh_doanh` alone does **NOT** satisfy the ≥20M VND second-eye gate (`finance/router.ts:41`).

---

### `@cmc/domain-finance`
- `nextReceiptCode(facilityId, counter)` — atomic counter read/write  
- `computeReceiptKind(studentId, classBatchId)` — new vs renewal  
- `duplicatePhoneWarning(db, phone)` — K12: warn on reuse (not enforced)  
- `RefundCapExceededError` — cap validation  
- `assertRefundWithinCap(receipts, refund)` — idempotent check

---

### `@cmc/domain-identity`
- `normalizeLoginPhone(phone)` — Vietnamese phone normalization (09xxx → 84+xxx)

---

### `@cmc/db`
- Prisma client export & type definitions  
- `withFacility(db, facilityId, callback)` — transactional facility-scoped context  
- RLS context setup (hidden session variable)

---

## Security (RLS + Append-Only)

### Row-Level Security (RLS)
6 tables enforce facility isolation via `facility_id` column:
- Opportunity, Student, Enrollment, Receipt, RefundRecord, AuditLog

**Pattern:** `CREATE POLICY "facility_isolation" ON table_name FOR SELECT USING (facilityId = current_setting('app.facility_id')::uuid)`

**Dev Auth:** Fail-closed stub in `apps/api/src/context.ts` — no token processing in dev mode (all requests granted)

### Append-Only Ledger (K5 remediation)
- **RefundRecord:** `REVOKE UPDATE, DELETE` (RLS allows INSERT/SELECT only)  
- **AuditLog:** `REVOKE UPDATE, DELETE` (RLS allows INSERT/SELECT only)  
- **Enforcement:** Database layer (migration 20260706150000)

---

## Test Coverage & Validation

**Test Framework:** Vitest  
**Test Count:** 532 passing tests · 0 skipped · 64 test files (2026-07-11, live run — `lms-auth-two-tier` stub deleted 2026-07-10, coverage moved to e2e)

| Domain | Tests | Coverage (Statements) | Notes |
|--------|-------|----------------------|-------|
| finance | ~40 | 97.88% | Highest coverage; receipt lifecycle critical |
| provisioning | ~20 | 95.9% | Idempotency + recovery testing |
| guardian | ~15 | (>90%) | Link approval, approved-children reads |
| enrollment | ~15 | (>90%) | reserved→active, blockLms, LMS read |
| crm | ~20 | (>90%) | Pipeline state machine, pagination |
| lms-auth | ~10 | (>90%) | OTP, enrollment retrieval |
| auth | ~5 | (>90%) | Permission registry |
| security/RLS | ~10 | (>90%) | Facility isolation, append-only enforcement |
| **P2-P4 (built & tested)** | | | |
| session-evidence | ~8 | (>90%) | Publish + photo access control |
| assessment | ~5 | (>90%) | Draft-confirm workflow |
| submission | ~15 | (>90%) | Annotate, submit, grade, list |
| attendance | ~8 | (>90%) | Mark, bulk mark, list for child |
| exercise | ~8 | (>90%) | Tier-based unlock, publish |
| checkin | ~6 | (>90%) | IP-match, manual punch |
| shift | ~6 | (>90%) | Register, approve, fallback |
| payroll | ~5 | (>90%) | Finalize, rate upsert, penalty |
| kpi | ~5 | (>90%) | Score, confirm, override-tree |
| rewards | ~8 | (>90%) | Redeem, approve, gift catalog |
| meeting | ~4 | (>90%) | Schedule, complete |
| appointment | ~5 | (>90%) | Schedule, lifecycle |
| after-sale | ~4 | (>90%) | Case state machine, lifecycle |
| course | ~3 | (>90%) | CRUD |
| room | ~3 | (>90%) | CRUD |

**Gateway:** All test suites must pass before merge. Coverage thresholds: ≥90% statements / ≥80% branches.

---

## Phases 3–4 Completion (Astryx UI Migration) — 2026-07-10

**Mantine 7 → Astryx Design System Migration (Phases 3–4 COMPLETE):**
- **Phase 1 (complete):** Verified Astryx (@astryxdesign/core@0.1.4 beta, Facebook OSS) production readiness: precompiled CSS (no bundler plugin), clean build/typecheck/HMR, zero supply-chain vulnerabilities (audit+signature), token override via CSS custom properties, CSS footprint favorable vs. Mantine.
- **Phase 2 (complete):** All 10 components migrated (status-badge → data-table). Theme rebuild: `cmcTheme` deleted, replaced with `AstryxCmcProvider` (CSS-only wrapper, `data-astryx-theme="neutral"`). peerDependencies: @astryxdesign/core@0.1.4 + @stylexjs/stylex@0.18.3. MantineProvider + AstryxCmcProvider coexist (strangler). Workspace: typecheck + build + test all green. Browser e2e: 4 passing, 1 fixme, 0 failing.
- **Phase 3 (complete, 2026-07-10):** **apps/admin 100% migrated** — all 34 page/lib files + shell rewritten from Mantine to Astryx. New single-door barrel `@cmc/ui/primitives` (thin re-export of Astryx primitives). Apps import ALL UI from `@cmc/ui` only; `rg "@mantine" apps/admin/src` = 0. Migration order (risk-first): shell/AppShell → login → 5 business-area clusters (CRM/finance/teaching/HR+attendance/students). **ESLint flat config added** (`eslint.config.js`, first linter in repo): `no-restricted-imports` rule banning `@mantine/*` + `@astryxdesign/*` in `apps/admin/**` (one-door enforcement), whitelist `apps/admin/src/main.tsx` (sole entry for reset/theme CSS + providers). New devDeps: eslint, typescript-eslint, eslint-formatter-compact. `pnpm lint` added. **Reset flip:** `apps/admin/src/main.tsx` imports `@astryxdesign/core/reset.css`, dropped MantineProvider + `@mantine/core/styles.css` (zero Mantine components now; avoids double-reset conflict). Mantine deps in package.json until Phase 5 (rollback policy) — only runtime usage removed. Sandbox deleted: `apps/admin/src/pages/sandbox/`. Verification: workspace typecheck + build clean; per-cluster gates green; e2e 4 passed, 1 fixme; auth-screen: Astryx reset applied cleanly, focus-visible brand-colored (#0071E3), disabled buttons inert. Code-review: Approve, 0 Critical.
- **Phase 4 (complete, 2026-07-10):** **apps/lms 100% migrated** — all 13 files (login + 10 parent/student pages + routes + main.tsx) rewritten from Mantine to Astryx. `rg "@mantine" apps/lms/src` = 0. **New @cmc/ui composites:** `TextField` (forwards standard HTML input attributes—inputMode, maxLength, autoComplete, pattern—that Astryx TextInput omits but passes via ...rest at runtime) and `PasswordInput` (Astryx lacks native password input; composes TextField + show/hide toggle). `ProgressBar` added to primitives barrel. **LMS login hardening preserved & e2e-verified:** OTP field autoComplete="one-time-code" + inputMode="numeric" + maxLength=6; password autoComplete="current-password"; phone inputMode="tel"; email type. New non-skippable e2e test asserts these land on real DOM. Generic no-leak error messages preserved. Astryx deps exact-pinned (0.1.4) so ...rest behavior can't regress. **Theme-level fixes (LMS mobile QA):** `:focus-visible` brand-outline fallback on form controls + `@media (max-width:768px)` 44px min-height touch-target rule (Astryx ~32px < TL12 §7's 44px). **ESLint one-door rule extended to apps/lms/**. **Reset flip:** apps/lms/src/main.tsx imports @astryxdesign/core/reset.css + drops MantineProvider; @astryxdesign/core added as lms devDep. **Known trade-off:** Astryx TabList renders tabs as plain buttons (no ARIA role=tab/aria-selected)—a11y regression vs Mantine; beta-Astryx limitation, flagged for future @cmc/ui ARIA wrapper. Verification: lms typecheck + build clean; lint (admin+lms) clean; UI e2e 5 passed + 1 fixme; API e2e 17 passed. Code-review: Approve (0 Critical; 1 Important fragility mitigated by exact-pin + e2e attr test).
- **Bugs fixed (PR #27):** (1) tRPC basePath missing → 404 on browser clients — fixed. (2) finance/receipt-get.test.ts DB write missing withFacility() — fixed. (3) student/change-password.tsx session timing — unfixed, test.fixme(), not Astryx-related.
- **Strategy:** Strangler pattern — both CSS/providers coexist through Phase 4; Mantine removed Phase 5.
- **Roadmap:** Phase 5 (remove Mantine package deps entirely + full e2e QA + TL12 docs) is final phase.
- **Plan:** `plans/260710-0236-astryx-ui-migration/` (5 phases, tracked development context).

---

## Known Deferrals (Not Built in P1)

> Snapshot as of P1 completion (2026-07-06). Several rows below have since shipped — see "Resolved since" column, verified against git history 2026-07-17.

| Item | Category | Reason | Target Phase | Resolved since |
|------|----------|--------|--------------|-----------------|
| **Student lookup (full)** | Data | PH don't have child UUIDs; requires enrollment → student name lookup | P2 | Still open |
| **Email relay** | Workers | Transport layer (Brevo/Graph) not wired | Comms phase | Transport wired 2026-07-07/10 (Brevo+Graph); production key/IP-allowlist verification still open — see project-changelog `[2026-07-10]`/`[2026-07-11]` |
| **SSO / Real OAuth** | Auth | Dev stub sufficient for P1 enrollment flow | Post-P1 | Landed 2026-07-08 (PR #24, Entra SSO) |
| **Facility creation UI** | Frontend | Admin dashboard not built; seed-only for now | Admin phase | **Landed 2026-07-17 (PR #34)** — facility mgmt + network CRUD + audit log now real |
| **Graph/Brevo integration** | Infra | Email, SMS transports deferred | Comms phase | Same as Email relay row above |
| **Class provisioning** | P2+ | classBatchId scalars not validated (FK created in P2) | P2 | Still open |
| **Withdrawal/cancellation UI** | Frontend | Backend ready; UI not yet built | Frontend phase | Still open (verify before relying on this row) |
| **tRPC basePath** | API | Missing in standalone handler; PR #27 ready, not yet merged | Post-P1 validation | **Merged 2026-07-10** (`638e64b`) |

---

## Debt & Known Issues (Documented)

### Critical (Fixed)
- **K1:** Guardian not created by provisioning → **FIXED** (Wave 2)  
- **K2:** Money orphan on mid-provision crash → **PARTIAL** (reconciler + worker, no active retry scheduler)  
- **K3:** No receiptList/pending-link queue → **FIXED** (Wave C)  
- **K5:** Ledger not append-only → **FIXED** (Wave A)  

### Medium (Documented, deferred)
- **K4:** Student lookup requires PH→name→UUID path (P2 requirement)  
- **K6:** Email relay transport not wired (communications phase)  
- **K12:** FK scalars `createdById`, `approvedById`, `classBatchId` not enforced (P2 backfill planned)  

### Low (Documented in code comments)
- **R4:** Unbounded failed-audit spam (documented, left unfixed per task scope)  
- Enum cleanup (completed/transferred/sent/graph deferred)

---

## Build & Verification

**Commands:**
```bash
pnpm install                    # install workspace
pnpm typecheck                  # tsc + turbo (12 tasks)
pnpm --filter @cmc/api exec vitest run      # 137 tests
pnpm --filter @cmc/api exec vitest run --coverage
pnpm build                      # turbo build (7 tasks)
```

**Current State:**
- ✅ 532/532 tests passing (0 skipped — `lms-auth-two-tier` 0-assertion stub deleted 2026-07-10, coverage moved to e2e)
- ✅ Type checking green (26 packages)
- ✅ Build successful
- ✅ Migrations applied & schema up-to-date
- ✅ Phase 3 flow audit complete: 0 CRITICAL · 3 HIGH · 13 MEDIUM · REDEPLOY NOT REQUIRED
- ✅ All 9 staff roles verified in UAT Section 2 (28/28 WF traced: 22 FULL · 6 PARTIAL)

---

## Design Artifacts Preserved

P1 implementation adheres to frozen design corpus (docs/TL00-TL31):

- **TL01** — Backend invariants (I1–I11): all implemented  
- **TL10** — Data model: Prisma schema matches  
- **TL11** — API contract: tRPC procedures + error handling  
- **TL14** — RBAC registry: `@cmc/auth` single source  
- **TL16** — ADR A–D decisions: all encoded in procedures + schema  
- **TL24** — P1 workflow spec: 9 workflows implemented  
- **TL25** — Traceability matrix: P1 fully mapped (see `docs/25-ma-tran-truy-vet-p1.md`)

**Design remains authoritative.** Code is derived artifact.

---

## Next Steps (P2+)

1. **Student lookup** — Frontend needs "which child is this enrollment?" query (deferred)  
2. **Class operations** — P2 workflow: attendance, shifts, payroll (not started)  
3. **Email/comms** — Wire Brevo/Graph transport for provisioning emails  
4. **Admin dashboard** — Facility creation, user seed, batch operations  
5. **LMS frontend** — Parent/student web portal (React app)  

---

**Repository:** CMC EDU v2 @ `D:\project\vip\CMC`  
**Docs Root:** `docs/` (Vietnamese design corpus + English implementation notes)  
**Reports:** `plans/reports/` (session audits, remediations, deep reviews)  
**Last Updated:** 2026-07-26 — xem banner đầu file. *(Dòng cũ "2026-07-10 (Astryx migration Phase 1 GO…)" mô tả riêng đợt Astryx, không phải ngày cập nhật của cả tài liệu.)*
