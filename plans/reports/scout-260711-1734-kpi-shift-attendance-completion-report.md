# Scout Report — KPI · Shift/Đăng ký ca · Check-in/Check-out

**Date:** 2026-07-11 17:34 ICT · **Branch:** main · **Scope:** backend + UI/e2e + docs (parallel scouts × 3)

## Verdict tổng

| Module | Backend | UI (admin) | E2E | Docs/traceability |
|---|---|---|---|---|
| **Check-in / Check-out (staff time-punch)** | ✅ MVP-ready | ✅ MVP-ready (unlinked in nav) | ❌ **none** | ✅ WF-P3-01/02 done (ADR0039, QĐ0034) |
| **Đăng ký công ca (shift registration)** | ⚠️ MVP-with-caveats | ⚠️ Skeleton (paste-UUID UX) | ❌ **none** | ✅ WF-P3-03/04 done (ADR0040, QĐ0035/0027) |
| **KPI** | ✅ MVP-ready | ✅ MVP-ready (unlinked in nav) | ❌ **none** | ✅ WF-P3-06 done (QĐ0011/0010) |
| **Payroll (adj.)** | ✅ MVP-ready | ✅ MVP-ready (unlinked in nav) | — | ✅ WF-P3-05 done (QĐ0025/0012) |
| **Shift-config (admin)** | — | ❌ **empty placeholder** | — | Chưa có scope rõ |

Tất cả **6 luồng WF-P3-01…06** đã đóng đủ 6 cột traceability (docs/25-ma-tran-truy-vet-p1.md:36-41) và 4 test files tương ứng đều xanh. Nhưng cả HR module **không có nav entry** và **không có e2e** — user hiện chỉ vào được qua URL trực tiếp.

---

## 1. Data models (schema.prisma)

Nhóm nhân sự – lương – ca (packages/db/prisma/schema.prisma):

| Model | Line | Vai trò | Trạng thái |
|---|---|---|---|
| `AppUser` | :1024 | staff; `position` drives shift group; `managerId` → approver chain | ✅ |
| `EmployeeCodeCounter` | :1078 | seq `CMC####` | ✅ |
| `FacilityNetwork` | :1062 | CIDR/IP whitelist per facility | ✅ |
| `TimePunch` | :1085 | append-only, `method`, `ipAddress` | ✅ |
| `ManualAttendanceTicket` | :1104 | `status: string` (pending/approved/rejected/resubmitted) — **không có CHECK constraint** | ⚠️ |
| `ShiftGroup` | :1131 | `type: KINH_DOANH\|GIAO_VIEN`, `selectionMode: SINGLE\|MULTIPLE` | ✅ |
| `ShiftTemplate` | :1149 | `startTime`/`endTime` (HH:mm ICT) | ✅ |
| `ShiftRegistration` | :1175 | status CHECK `draft\|submitted\|approved\|cancelled`, ticket-lock idx | ✅ |
| `ShiftRegistrationEntry` | :1204 | SINGLE-mode dedup **chỉ app-layer, không DB constraint** | ⚠️ |
| `SalaryRate` | :1223 | `baseSalary`, `variablePayRate`, `kpiMax` | ✅ |
| `Payslip` | :1246 | status CHECK `draft\|finalized`; `@@unique([appUserId, period])` | ✅ |
| `KpiScore` | :1279 | status CHECK `draft\|submitted\|confirmed\|approved`, `override` flag | ✅ |
| `Attendance` (HS) | :838 | student-side, **khác** staff time-punch | ✅ |

**Models docs kỳ vọng nhưng KHÔNG có trong schema:** `CompensationPolicy`, `PayrollPeriod` (canonical = `Payslip`), `HrAttendance` (canonical = `TimePunch`), `ShiftEntryType` enum `work|leave` (chưa impl — entries hiện chỉ tham chiếu template).

---

## 2. API surface — tRPC procedures

Mount tại `apps/api/src/router.ts:66-87`.

**`attendance` (HS marking)** — `apps/api/src/attendance/router.ts`
- `mark`, `markAll`, `listBySession`, `listForChild` — đủ CRUD read/write, tested (`gate.test.ts`, `list-for-child.test.ts`).

**`checkInOut` + `manualPunch`** — `apps/api/src/checkin/router.ts`
- `checkInOut.punch` — IP-gate + 5-min cooldown + FOR UPDATE row lock (tested `ip-match.test.ts`).
- `manualPunch.create/approve/reject` — direct-manager gate, `pending→approved/rejected/resubmitted`.
- **Gap:** không có `list/history` procedure — reader phải query DB trực tiếp.
- **Gap nghiệp vụ:** approve `ManualAttendanceTicket` **không tạo synthetic `TimePunch`** → payslip vẫn thấy `unpunchedDays++`. Cần confirm intent.

**`shift`** — `apps/api/src/shift/router.ts`
- `createGroup`, `createTemplate`, `submit`, `approve`, `cancel` — tested `register-approve.test.ts`.
- **Gap MVP:** không có `list`, `myRegistrations`, `pendingForApproval`, không có `reject` state (chỉ `cancel`), không check overlap/conflict với approved shifts, entries có thể nằm ngoài `[fromDate, toDate]` (không validate range).

**`compensation` + `payslip`** — `apps/api/src/payroll/router.ts`
- `compensation.upsertRate`, `payslip.assemble`, `finalize`, `reopen`, `getForUser` — tested `penalty-posttax.test.ts`.
- **Gap:** không có `list`, không có `myPayslips`; **penalty rates hardcoded 500/1000 VND** tại `payroll/router.ts:223-224` (docs quote "caller supplies from CompensationPolicy" nhưng `CompensationPolicy` model chưa tồn tại).

**`kpi`** — `apps/api/src/kpi/router.ts`
- `submit`, `confirm`, `approve`, `override`, `getForUser` — lifecycle 4 state + override auto-jump to `approved` (tested `override-tree.test.ts`).
- **Gap:** không có `list`, `pendingForConfirm`, `pendingForApprove`.

---

## 3. Domain packages

**`@cmc/domain-time`** (`packages/domain-time/src/index.ts`, 117 dòng) — pure ICT↔UTC helpers + `resolveShiftGroup(position)` classifier. Không test colocated; coverage qua consumers.

**`@cmc/domain-payroll`** (`packages/domain-payroll/src/assemble-slip.ts`) — pure `assembleSlip()`:
- `variablePay = baseSalary × variablePayRate`
- `penaltyAmount = lateMin × rateLate + earlyMin × rateEarly` (post-tax, independent line — QĐ0025)
- `totalNet = max(0, baseSalary + variablePay + kpiBonus − penaltyAmount)`
- 18 tests coverage ≥90%.

---

## 4. UI (admin app) & E2E

Routes: `apps/admin/src/routes/hr.routes.tsx` mount 4 HR pages + `admin.routes.tsx:74` mount shift-config.

| Page | Path | Trạng thái | tRPC dùng |
|---|---|---|---|
| `hr/checkin` (`check-in-out.tsx`) | `/hr/checkin` | Full impl: live ICT clock, punch button, manual-punch fallback | `checkInOut.punch`, `manualPunch.create` |
| `hr/shifts` (`attendance/shifts.tsx`) | `/hr/shifts` | Submit + Approve tabs, **UUID paste-only** (không dropdown, không list) | `shift.submit/approve/cancel` |
| `hr/kpi` | `/hr/kpi` | Master/detail per-user + URL-synced period | `user.list`, `kpi.getForUser/confirm/approve` |
| `hr/payroll` | `/hr/payroll` | assemble/finalize/reopen + penalty row | `payslip.*` |
| `admin/shift-config` | `/admin/shift-config` | **`<EmptyState title="Tính năng chưa áp dụng">`** (18 dòng) | none |

**Nav registry (`apps/admin/src/shell/nav-registry.ts:6-59`) không có `hr` group.** Test `nav-registry.test.ts:34-42` khẳng định `expect(ids).not.toContain('hr')` cho MỌI role — có vẻ có chủ ý.

**LMS**: parent xem attendance qua `session-evidence.tsx`, `report-card.tsx` (`attendance.listForChild`). Không có shift/KPI LMS UI.

**E2E**: `apps/e2e/tests/attendance.spec.ts` và `attendance-grading.spec.ts` cover HS `attendance.mark` — **không cover** `shift.*`, `checkInOut.punch`, `manualPunch.*`, `kpi.*`, `payslip.*`. Global setup không seed shift template/group/IP allowlist.

**UI code smell:** `check-in-out.tsx:157,160` dùng string-match `err.message` để phân biệt IP-mismatch vs cooldown → brittle. Nên chuyển sang tRPC error code + `cause`.

---

## 5. Docs / traceability

Docs layer khép kín — cluster docs (`10-data-model-v2.md`, `11-api-contract.md`, `19/20/24/25`) + stories US-UI-05/06 mô tả đầy đủ. Ma trận TL25 xác nhận **28/28 luồng P1–P4 đóng** sau reconcile `a998d5c` (2026-07-11), 532 tests passing.

**Role matrix** (14/17):
- 5 active roles: `super_admin`, `giam_doc_kinh_doanh` (GĐKD), `giam_doc_dao_tao` (GĐĐT), `sale`, `giao_vien`.
- 4 gác (0 quyền sau ADR-D 2026-07-08): `ke_toan`, `cskh`, `ctv_mkt`, `hr`. Trước amendment `hr` giữ KPI+shift management, `ke_toan` giữ payroll — sau amendment chuyển hết sang GĐKD+GĐĐT.
- "Quản lý" là **attribute** `managerId`, không phải role.

**Naming drift trong stories cần chú ý:**
- US-UI-05 dùng `attendance.checkIn` — code chuẩn `attendance.mark` (HS) hoặc `checkInOut.punch` (NV).
- US-UI-06 dùng `hrAttendance.checkIn/checkOut`, `shift.register/withdraw`, table `HrAttendance`/`PayrollPeriod` — code chuẩn `checkInOut.punch`, `shift.submit`, `TimePunch`/`Payslip`.
- Stories là thin sketch, không phải contract; TL11 + TL10 là canonical.

**Journal gaps chưa đóng:**
- HIGH-2 (`260709-golive-sprint-session-summary.md:77`): `ctv_mkt` từng giữ `shift.create/cancel` + `manualPunch.create` — ADR-D gác role đóng issue, nhưng nếu unfreeze cần ADR product decision.
- HIGH-3: HR staff role 0 UAT scenarios cho KPI/shift → đã redirect qua KB4/KB5 (`uat-checklist-go-live.md:213-216`).

---

## 6. Completion assessment tổng hợp

**Check-in / Check-out:** Backend + UI đủ MVP. Blocker để user thực dùng: (a) nav entry, (b) e2e coverage, (c) hard-coded penalty rates, (d) manual-approve không sinh synthetic TimePunch → punchless days vẫn bị phạt, (e) error handling string-match.

**Đăng ký công ca:** Backend đủ MVP nhưng có 4 gap thật (không list, không reject state, không overlap check, không range validate); UI hiện tại yêu cầu paste UUID → **thực tế chưa dùng được** cho end user. Blocker để user thực dùng: build `shift.list` + `shift.myRegistrations` + dropdown/lookup + nav entry + e2e.

**KPI:** Backend + UI đủ MVP với lifecycle 4 state + override. Blocker: (a) nav entry, (b) `kpi.list`/`pendingForConfirm`/`pendingForApprove` để manager thấy inbox thay vì phải chọn từng user, (c) e2e coverage.

**Shift-config (admin):** Placeholder empty-state. Không rõ scope owner + phase.

---

## 7. Unresolved questions

1. **HR module ẩn nav có chủ ý hay quên?** Route mount đủ, page implement đủ, nhưng nav-registry test khẳng định "không có hr module cho MỌI role". Nếu cố ý — feature chỉ dùng nội bộ / URL bookmark; nếu quên — cần thêm nav entry theo TL25 URL scheme (`/attendance/check-in-out`, `/attendance/shifts`, `/hr/payroll/:id`, `/hr/kpi`).
2. **Hardcoded penalty rates 500/1000 VND** ở `payroll/router.ts:223-224` có ship production được không, hay phải land `CompensationPolicy` model trước? Docs kỳ vọng model này nhưng chưa impl.
3. **Manual-punch approve có nên tạo synthetic `TimePunch`?** Hiện tại approve ticket không tạo punch → payslip vẫn count `unpunchedDays++` cho ngày đó → phạt sai.
4. **`ShiftRegistration` có cần state `rejected`?** Hiện chỉ có `cancel` — manager không thể reject với lý do.
5. **`ShiftRegistrationEntry` SINGLE-mode dedup + range validation** nên đưa xuống DB constraint hay giữ app-layer?
6. **Overlap/conflict check** giữa các approved shift registrations của cùng appUser — có cần?
7. **`shift-config` admin page** thuộc phase nào, owner ai? Đang là empty-state 18 dòng.
8. **`selectionMode` default per group** — `KINH_DOANH=SINGLE`, `GIAO_VIEN=MULTIPLE`? TL20 §2 chưa chốt, docs khuyến nghị nâng lên ADR.
9. **`ManualAttendanceTicket.status`** là `string` không có CHECK constraint (khác 3 model kia). Intentional?
10. **E2E gap 5 module (shift/kpi/checkin/manualPunch/payslip)** — có nằm trong scope phase khác đã plan chưa?

---

## 8. Đề xuất kế tiếp (không hành động, chờ user quyết)

Nếu mục tiêu là đưa 3 module vào tay end-user trước UAT:
- **P0 UX**: build `shift.list` + `shift.myRegistrations` + `kpi.list`/`pending*` → replace paste-UUID + master/detail-per-user flows.
- **P0 discoverability**: mở nav entry cho HR group theo role (GĐKD/GĐĐT thấy full, sale/giao_vien thấy `checkin`+`shifts`+`kpi`+`payroll` self-view).
- **P0 correctness**: fix manual-punch → synthetic TimePunch (hoặc document rõ đây là "phạt kép" cố ý).
- **P1 hardening**: land `CompensationPolicy` model + move penalty rates ra; add overlap-check + range-validate cho shift; chuyển error routing `checkInOut` sang tRPC error code.
- **P1 coverage**: 5 e2e specs (shift submit/approve, manual-punch pending→approved, kpi lifecycle, payslip assemble→finalize, checkin ip-block).
