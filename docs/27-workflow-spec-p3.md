# Tài liệu 27 — Workflow Spec cụm P3 (HR / Ca / Lương: WF-P3-01…06)

> Cụm P3 — nhân sự, ca làm, lương, KPI. Kéo **ADR 0039** (chấm công IP) · **ADR 0040** (ca sale-vs-GV,
> HR remediation: gate ROLE thay managerId) · **ADR 0042** (KPI auto-score + salary-tier + session-done,
> WF-P3-05/06 REWRITE). Khuôn 12 mục (TL23), viết gọn vì pattern đã lập. Hàng Traceability append TL25.

---

## WF-P3-01 — Chấm công check-in/out (ADR 0039)

**Meta:** P3 · P0 · người (nhân viên). **Actors:** nhân viên. **Trigger:** bấm chấm công. **Precondition:**
cơ sở có `FacilityNetwork` khai báo.

**Swimlane**
```mermaid
flowchart LR
    A["Nhân viên bấm chấm công"] --> B["Lấy ctx.ip → ipMatchesCidr<br/>với dải active cơ sở"]
    B -->|Khớp| C["method: 'ip' (hợp lệ)"]
    B -->|Không khớp| D["method: 'manual'<br/>→ phiếu thủ công (WF-P3-02)"]
    C & D --> E["Lưu TimePunch (ip, method)"]
```

**Happy path:** bấm → khớp IP dải cơ sở → `method: ip` → lưu punch.
**Exceptions & edge:** IP không khớp → `manual` (cần phiếu). **Cooldown** double-punch → `CONFLICT`. IP
giả: phụ thuộc `x-forwarded-for` cấu hình đúng (ADR 0039 caveat).
**Rules/ADR:** **ADR 0039** · TL20 §1. **API:** `checkInOut.punch` (`checkInOut.punch`). **UI/URL:**
`/attendance/check-in-out`.
**Traceability:** `nhân viên → WF-P3-01 → "Chấm công qua WiFi công ty" → checkInOut.punch →
/attendance/check-in-out → test/checkin/ip-match.spec → ADR0039`.
**Acceptance:** IP khớp → `ip`; ngoài dải → `manual`; cooldown chặn double-punch; punch lưu ip+method.

---

## WF-P3-02 — Phiếu chấm công thủ công → manager duyệt (ADR 0039)

**Meta:** P3 · P0 · **HITL** (manager). **Actors:** nhân viên (tạo), manager trực tiếp (duyệt).
**Trigger:** chấm ngoài WiFi → tạo phiếu thủ công theo ngày. **Precondition:** `method: manual`.

**State machine**
```mermaid
stateDiagram-v2
    [*] --> pending: nhân viên gửi (theo ngày, 1 lý do)
    pending --> approved: manager trực tiếp duyệt
    pending --> rejected: từ chối
    rejected --> resubmitted: gửi lại
    resubmitted --> approved
```

**Happy path:** tạo phiếu ngày + lý do → manager trực tiếp duyệt.
**Exceptions & edge:** **không tự duyệt của mình** (`FORBIDDEN`); **chỉ manager trực tiếp** (khác →
`FORBIDDEN`). Notif `manual_punch_pending/resubmitted/rejected` (TL20 §8b).
**Rules/ADR:** **ADR 0039** · QĐ 0034 · TL20 §1. **API:** `manualPunch.create/approve/reject`
(manager). **UI/URL:** `/attendance/check-in-out` (phiếu) · notif.
**Traceability:** `nhân viên/manager → WF-P3-02 → "Duyệt chấm công thủ công" → manualPunch.approve →
/attendance/check-in-out → test/checkin/manual-ticket.spec → ADR0039, QĐ0034`.
**Acceptance:** không tự duyệt; chỉ manager trực tiếp; phiếu theo ngày; resubmit được.

---

## WF-P3-03 — Đăng ký ca (sale vs giáo viên — ADR 0040)

**Meta:** P3 · P0 · **HITL** (duyệt ở WF-P3-04). **Actors:** nhân viên (sale/giáo viên). **Trigger:** đăng
ký ca kỳ tới. **Precondition:** thuộc một `ShiftGroup`.

**Swimlane**
```mermaid
flowchart LR
    A["Nhân viên"] --> G{"resolveShiftGroup(position)"}
    G -->|sale/cskh/ctv_mkt| KD["KINH_DOANH<br/>selectionMode (vd SINGLE)"]
    G -->|giao_vien| GV["GIAO_VIEN<br/>selectionMode (vd MULTIPLE)"]
    KD & GV --> P["Phiếu ca: chọn CA_SANG/CHIEU/TOI<br/>type work/leave · fromDate tương lai"]
    P --> S["submitted (ticket-lock 1 phiếu)"]
```

**State machine (`ShiftRegistration.status`):** `draft` → `submitted` → `approved` | `rejected` |
`cancelled` (`rejected` — HR remediation, xem WF-P3-04/07 — giải phóng ticket-lock, nộp lại được).
**Happy path:** hệ thống xác nhóm theo vai trò → chọn ca theo `selectionMode` nhóm → gửi (`submitted`).
**Exceptions & edge:** **ticket-lock** — 1 phiếu `submitted` tại một thời điểm. **Overlap guard**: 1
khoảng `[fromDate,toDate]` active bất kể ShiftGroup. `fromDate` phải tương lai (ICT). sale (SINGLE)
chọn 1 ca/ngày; giáo viên (MULTIPLE) chọn nhiều — **đúng điểm khác biệt**.
**Rules/ADR:** **ADR 0040** · QĐ 0035 · TL20 §2. **API:** `shift.submit` (`shift.submit`).
**UI/URL:** `/hr/shifts`.
**Traceability:** `nhân viên → WF-P3-03 → "Đăng ký ca làm" → shift.submit →
/hr/shifts → apps/api/src/shift/register-approve.test.ts → ADR0040, QĐ0035`.
**Acceptance:** nhóm đúng theo vai trò; sale SINGLE vs GV MULTIPLE; ticket-lock 1 phiếu; overlap guard;
fromDate tương lai.

---

## WF-P3-04 — Duyệt ca (gate theo ROLE + group-type — ADR 0040, HR remediation)

**Meta:** P3 · P0 · **HITL**. **Actors:** GĐKD (nhóm KINH_DOANH) / GĐĐT (nhóm GIAO_VIEN) /
super_admin (cả hai). **Trigger:** phiếu ca `submitted`. **Precondition:** phiếu chờ duyệt.

> **HR remediation sửa lại:** gate KHÔNG còn dựa `managerId` chain/fallback — chuyển sang ROLE khớp
> `ShiftGroup.type` của phiếu (docs/20 §2, docs/22 ADR 0042).

**Swimlane**
```mermaid
flowchart LR
    A["Phiếu submitted"] --> B{"ShiftGroup.type"}
    B -->|KINH_DOANH| F["role giam_doc_kinh_doanh"]
    B -->|GIAO_VIEN| E["role giam_doc_dao_tao"]
    B -.->|bypass| S["super_admin"]
    E & F & S --> G{"chống tự-duyệt"}
    G -->|approve| H["approved"]
    G -->|reject + reason| I["rejected (rejectReason,<br/>giải phóng ticket-lock)"]
```

**Happy path:** caller có role khớp `ShiftGroup.type` của phiếu → duyệt → `approved`.
**Exceptions & edge:** chống tự-duyệt (caller ≠ chủ phiếu, dù cùng role); role sai nhóm → `FORBIDDEN`;
`reject` bắt buộc `reason` (≥3 ký tự) → `rejectReason`, giải phóng ticket-lock + overlap, chủ phiếu
nộp lại ngay. Notif `shift_reg_submitted/approved/rejected`.
**Rules/ADR:** **ADR 0040** · docs/22 ADR 0042 · docs/20 §2. **API:** `shift.approve`/`shift.reject`
(`shift.approve`) · `shift.pendingForApproval` (inbox) · `shift.myRegistrations` (self, thấy `rejectReason`).
**UI/URL:** `/hr/shifts/:id`.
**Traceability:** `GĐKD/GĐĐT → WF-P3-04 → "Duyệt ca" → shift.approve/reject → /hr/shifts/:id →
apps/api/src/shift/register-approve.test.ts, reject-validate.test.ts, apps/e2e/tests/shift-lifecycle.spec.ts → ADR0040`.
**Acceptance:** không tự duyệt; role phải khớp group-type (trừ super_admin); reject bắt buộc reason;
rejected giải phóng ticket-lock/overlap.

---

## WF-P3-05 — Chốt lương tháng theo bậc lương (SalaryTier, HR remediation — ADR 0042)

**Meta:** P3 · P0 · **HITL** (GĐKD/GĐĐT). **Actors:** GĐKD/GĐĐT (assemble/finalize/reopen, gán tier),
hệ thống (tính live). **Trigger:** chốt lương tháng. **Precondition:** nhân sự đã có `SalaryRate.tierId`
(gán qua `compensation.assignTier`) — thiếu tier → `payslip.assemble` FORBIDDEN, không fallback legacy.

> **HR remediation thay hoàn toàn WF-P3-05 cũ:** `SalaryRate` nhập tay từng người + `/hr/salary-structure`
> + `compensation.upsertRate` đã **BỎ**. Công thức đầy đủ + rationale: docs/20 §3, docs/22 ADR 0042.

**State machine (`PayslipStatus`)**
```mermaid
stateDiagram-v2
    [*] --> draft: payslip.assemble (live TỪ TimePunch+ShiftRegistration+KpiScore+SalaryTier)
    draft --> finalized: finalize (khoá)
    finalized --> draft: reopen
```

**Happy path:** GĐKD/GĐĐT tạo `SalaryTier` catalog → `assignTier` cho sale/GV → `payslip.assemble` =
`base(tier) + %côngca × %chỉ-số × đơnGiá(tier) − phạt` (phạt per-ca, ManualAttendanceTicket-approved
ngày miễn hoàn toàn) → `finalize` khoá.
**Exceptions & edge:** phạt là dòng độc lập, không âm `totalNet`; `%chỉ-số` = `KpiScore.value` khi
`confirmed`\|`approved` (0 nếu chưa có); đổi tier giữa kỳ cho phép (audit qua snapshot trên
`KpiScore`, không trên `Payslip`); GĐ/`super_admin` không có phiếu lương. `reopen` mở lại để assemble
tiếp — không tự tính lại.
**Rules/ADR:** **docs/22 ADR 0042** · docs/20 §3. **API:** `payslip.assemble/finalize/reopen/my/
getForUser` · `salaryTier.list/create/update` (`salaryTier.manage`) · `compensation.assignTier`.
**UI/URL:** `/hr/payroll/:id` · `/hr/salary-tiers` · `/hr/my`.
**Traceability:** `GĐKD/GĐĐT → WF-P3-05 → "Chốt lương tháng theo bậc" → payslip.assemble → /hr/payroll/:id
→ apps/api/src/payroll/{policy-model,policy-rates,penalty-posttax,payslip-my}.test.ts,
apps/e2e/tests/kpi-lifecycle.spec.ts → ADR0042`.
**Acceptance:** không tier → FORBIDDEN; phạt per-ca độc lập, không âm; đổi tier giữa kỳ có audit trail
qua snapshot; GĐ ngoài hệ thống lương.

---

## WF-P3-06 — Nộp & duyệt phiếu KPI (auto-score lifecycle, HR remediation — ADR 0042)

**Meta:** P3 · P1 · **HITL**. **Actors:** sale/giao_vien (submit), direct manager (confirm), 2 GĐ
(bulkApprove, branch-scope theo ROLE). **Trigger:** kỳ KPI (ngày 3 tháng kế tiếp ICT trở đi).
**Precondition:** đã gán `SalaryTier`.

> **HR remediation thay hoàn toàn WF-P3-06 cũ:** `kpi.submit`/`kpi.approve`(đơn lẻ)/`kpi.getForUser`
> đã **BỎ** — `approved` chỉ đạt qua `bulkApprove`. Công thức + rationale: docs/20 §4, docs/22 ADR 0042.

**State machine (`KpiScore.status`):** `draft` → `submitted` → `confirmed` → `approved`.
**Happy path:** `kpi.refresh` tính "PHẦN NHÂN" (`%côngca × %chỉ-số × đơnGiá`) → chủ phiếu `submitSlip`
(tự refresh trước, mở từ ngày 3 tháng kế tiếp) → direct manager `confirm` → 2 GĐ `bulkApprove` hàng
loạt (chỉ slip có Payslip `finalized`, loại trừ phiếu chính mình, branch-scope theo `AppUser.roles`).
**Exceptions & edge:** anti-self trên mọi bước; `override` (director set trực tiếp) — sửa `approved`
chỉ `super_admin` khi Payslip đã reopen; immutable khi Payslip `finalized` (phải reopen trước); GĐ/
`super_admin` không có phiếu KPI. Metric sale = doanh thu **gross** đã duyệt (chưa trừ refund).
**Rules/ADR:** **docs/22 ADR 0042** · docs/20 §4. **API:** `kpi.refresh/submitSlip/confirm/override/
bulkApprove/list/myScore` (`kpi.submitSlip`, `kpi.confirm`, `kpi.approve`). **UI/URL:** `/hr/kpi` ·
`/hr/my`.
**Traceability:** `sale/GV/GĐ → WF-P3-06 → "Nộp & duyệt KPI" → kpi.bulkApprove → /hr/kpi →
apps/api/src/kpi/{lifecycle,auto-score}.test.ts, apps/e2e/tests/kpi-lifecycle.spec.ts → ADR0042`.
**Acceptance:** anti-self mọi bước; branch-scope theo ROLE không theo `position`; bulkApprove chỉ
Payslip finalized; approved chỉ qua bulkApprove (hoặc super_admin override khi reopen).

---

## Trạng thái P3

6/6 workflow P3 (đã cập nhật WF-P3-04/05/06 theo HR remediation). **ADR 0039 (P3-01,02) + ADR 0040
(P3-03,04) + ADR 0042 (P3-05,06)** được phủ. 5 luồng bổ sung (reject/bulkApprove/refresh/session-done/
reschedule) tại docs/25 §2 (P3-07…11), không lặp lại narrative đầy đủ ở đây (khuôn 6 WF chính giữ nguyên).

> Liên kết: TL22 (ADR 0039/0040/0042) · TL20 §1–4b (rule) · TL11 (API) · TL06 (URL) · TL25 (traceability).
