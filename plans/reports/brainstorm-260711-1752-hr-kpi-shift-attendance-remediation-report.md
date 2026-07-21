# Brainstorm Report — Khắc phục & hoàn thiện HR module: KPI · Đăng ký ca · Chấm công · Lương

**Date:** 2026-07-11 17:52 ICT · **Branch:** main · **Status:** APPROVED by user (9 quyết định + design 7 khối)
**Input:** `plans/reports/scout-260711-1734-kpi-shift-attendance-completion-report.md`
**Roles (5 active, KHÔNG nhầm lẫn):** `giao_vien`, `sale`, `giam_doc_dao_tao` (GĐĐT), `giam_doc_kinh_doanh` (GĐKD), `super_admin` (IT). "Quản lý" = attribute `managerId`, không phải role. 4 role gác (`hr`, `ke_toan`, `cskh`, `ctv_mkt`) = 0 quyền (ADR-D).

---

## 1. Problem statement

Backend 6 luồng WF-P3-01…06 đã đóng (routers + models + tests xanh) nhưng:
- **Correctness**: phạt kép manual-punch (approve ticket không miễn `unpunchedDays`); penalty rates hardcoded 500/1000 (`payroll/router.ts:223-224`); shift entries không validate range/overlap.
- **Usability**: HR module ẩn hoàn toàn khỏi nav; không có list/pending procedures → UI paste-UUID; không có `shift.reject`.
- **Nghiệp vụ KPI sai mô hình**: code cho nhân viên tự nhập điểm (`kpi.submit`) — yêu cầu thực tế là **hệ thống tự tính, nhân sự xác nhận trách nhiệm, GĐ thẩm định/override**.

## 2. Quyết định đã chốt (9)

| # | Quyết định | Chốt |
|---|---|---|
| 1 | Ưu tiên | Cả correctness + usability trong 1 đợt; **correctness chặn release** (không mở nav trước khi fix lương) |
| 2 | Phạt kép manual-punch | **Miễn phạt ngày có phiếu duyệt** — assemble đọc approved tickets, ngày đó không đếm unpunchedDays, không phạt muộn/sớm. KHÔNG tạo TimePunch giả |
| 3 | Nav HR | Mở đủ 5 role theo chức năng (ma trận §4) |
| 4 | KPI nguồn dữ liệu | **Auto từ data sẵn có**: sale = doanh thu thực thu (Receipt duyệt); GV = số buổi dạy hoàn tất có điểm danh. Bỏ nhập tay của nhân viên |
| 5 | Penalty rates | **`CompensationPolicy` model per-facility**, default 500/1000, super_admin chỉnh qua UI |
| 6 | Shift gaps | Thêm **`shift.reject`** (lý do bắt buộc) + **build shift-config UI thật** |
| 7 | Công thức KPI | **Tuyến tính có trần**: `kpiBonus = kpiMax × min(1, thực đạt / monthlyQuota)`. Thêm cột `SalaryRate.monthlyQuota` |
| 8 | Lifecycle KPI | **Giữ 4 bước, đổi ngữ nghĩa** (user tự thiết kế — xem §3) |
| 9 | Trigger tính | **On-demand + nút "Tính lại"** — sinh lazy khi truy cập, không cron |

## 3. KPI lifecycle mới (quyết định của user + fix mâu thuẫn)

```
draft      — hệ thống SINH + TỰ TÍNH (lazy khi mở trang; "Tính lại" refresh từ data live;
             không đè phiếu đã submitted+)
submitted  — nhân sự mở phiếu, xem, bấm NỘP (xác nhận trách nhiệm) → phiếu tới GĐ theo managerId.
             Nút Nộp CHỈ MỞ từ ngày 1 tháng kế tiếp (ICT) — chặn nộp số chưa đầy đủ
confirmed  — GĐ thẩm định từng phiếu (override + lý do nếu sửa số).
             ★ payslip.assemble lấy kpiBonus từ trạng thái CONFIRMED trở lên
             (fix vòng lặp chết: code cũ chỉ đọc approved, mà approved chỉ có sau trả lương)
approved   — TẤT TOÁN: GĐ bấm nút "Đã trả lương kỳ X" → hệ thống bulk-transition
             mọi phiếu confirmed của kỳ → approved, khoá vĩnh viễn
```

Rationale thời điểm sinh phiếu: repo chưa có cron; KPI đo trọn tháng nên số chỉ đủ khi hết tháng → sinh lazy on-access (nhân sự thấy số tạm trong tháng) + guard nộp sau ngày 1. Cron notification = đợt sau nếu cần.

## 4. Ma trận nav/quyền (5 role)

| Tính năng | giao_vien | sale | GĐĐT | GĐKD | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Chấm công (punch + phiếu thủ công) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đăng ký ca (submit/cancel) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Duyệt/từ chối ca | | | ✓ (GIAO_VIEN grp) | ✓ (KINH_DOANH grp) | ✓ |
| Duyệt phiếu chấm thủ công | | | ✓ | ✓ | ✓ |
| KPI của tôi (xem + nộp) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Duyệt KPI (confirm/override/bulk-approve) | | | ✓ | ✓ | ✓ |
| Lương của tôi (self-view) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chốt lương (assemble/finalize/reopen) | | | ✓ | ✓ | ✓ |
| Shift-config + CompensationPolicy | | | | | ✓ |

## 5. Design 7 khối (APPROVED)

**K1. DB/migrations**
- `SalaryRate.monthlyQuota Decimal` (sale: VND doanh thu; GV: số buổi).
- Model `CompensationPolicy` per-facility: `penaltyRatePerLateMinute`, `penaltyRatePerEarlyMinute` (default 500/1000), unique facilityId, RLS.
- `ShiftRegistration`: status thêm `rejected` (CHECK update) + cột `rejectReason`.
- `ManualAttendanceTicket.status`: thêm CHECK constraint (hardening, đồng bộ 3 model kia).
- Shift entries: validate range `[fromDate,toDate]` + overlap check (app-layer; SINGLE dedup giữ app-layer).

**K2. Payroll correctness** (`payslip.assemble`)
- Ngày có `ManualAttendanceTicket` approved → miễn unpunchedDays + miễn phạt muộn/sớm.
- Đọc penalty rates từ CompensationPolicy (fallback default nếu chưa cấu hình).
- `kpiBonus` lấy từ KpiScore `confirmed | approved` (thay vì chỉ approved).

**K3. KPI auto-score**
- Compute service (module riêng, pure phần công thức): sale = revenue từ Receipt duyệt trong kỳ ICT; GV = ClassSession hoàn tất có attendance do GV đó dạy.
- Procedures: `kpi.refresh` (upsert draft, on-demand — THAY `kpi.submit` nhập tay), `kpi.submitSlip` (nhân sự nộp phiếu của mình, khoá số, guard sau ngày 1), `kpi.confirm` (GĐ, giữ), `kpi.override` (giữ), `kpi.bulkApprove` (period → confirmed→approved toàn kỳ), `kpi.list(period)`, `kpi.myScore(period)`.

**K4. Shift**
- `shift.reject` (reason bắt buộc, nhân viên thấy lý do; rejected → được nộp phiếu mới, ticket-lock giải phóng).
- `shift.list`, `shift.myRegistrations`, `shift.pendingForApproval`.
- Range + overlap validation trong `submit`.

**K5. List procedures còn thiếu**
- `payslip.list(period)`, `payslip.my(period)`; `manualPunch.list` (pending inbox cho GĐ + của tôi); `checkInOut.history` (self, theo tháng).

**K6. UI (admin app)**
- Nav: thêm nhóm HR theo ma trận §4 (sửa `nav-registry.ts` + test).
- `shifts.tsx`: bỏ paste-UUID → dropdown groups/templates, danh sách của tôi, inbox duyệt cho GĐ, nút reject + lý do.
- KPI: tách "KPI của tôi" (mọi role — xem, Tính lại, Nộp) vs "Duyệt KPI" (GĐ — inbox, confirm, override, nút "Đã trả lương kỳ X").
- Payroll: thêm self-view "Lương của tôi"; giữ màn GĐ.
- `shift-config.tsx`: build thật — CRUD ShiftGroup/ShiftTemplate + edit CompensationPolicy (super_admin).
- `check-in-out.tsx`: chuyển phân loại lỗi string-match → tRPC error code/cause.

**K7. E2E (5 specs)**
1. Shift: submit → reject (lý do) → resubmit → approve.
2. Manual-punch: create → approve → assemble payslip → KHÔNG phạt ngày đó.
3. KPI: refresh → submitSlip → confirm → bulkApprove; assemble lấy đúng kpiBonus từ confirmed.
4. Payslip: assemble → finalize với CompensationPolicy rates.
5. Check-in: IP-block → manual ticket path.

## 6. Approaches đã cân nhắc & loại

| Vấn đề | Loại bỏ | Lý do |
|---|---|---|
| Phạt kép | Tạo TimePunch giả khi approve | Bịa dữ liệu giờ chấm; assemble-aware đúng bản chất phiếu giải trình |
| Phạt kép | Giữ nguyên (phạt cố ý) | Duyệt phiếu mà vẫn phạt → duyệt vô nghĩa |
| KPI | Giữ self-submit | Ngược yêu cầu nghiệp vụ user chốt |
| KPI | Chỉ GĐ nhập tay | User muốn auto + trách nhiệm nhân sự |
| Công thức | Bậc thang % | Cần chốt ngưỡng bậc = QĐ kinh doanh chưa có |
| Lifecycle | Rút gọn 2 bước | User muốn nhân sự có trách nhiệm ký nộp; giữ 4 bước ngữ nghĩa mới |
| Trigger | Cron đầu tháng | Repo chưa có scheduler — YAGNI |
| Rates | Env constant / hardcode | Đổi rate phải redeploy; lệch docs |

## 7. Risks & mitigations

- **Sửa logic lương/KPI có test đang xanh** (`override-tree.test.ts`, `penalty-posttax.test.ts`) → đi TDD: viết test hành vi mới trước, sửa code sau; test cũ sửa có chủ đích, không weaken.
- **Đổi nguồn kpiBonus (approved → confirmed+)**: payslip đã finalized kỳ trước không recompute (giữ nguyên số cũ) — chỉ áp dụng kỳ mới.
- **`kpi.submit` bị thay bằng `kpi.refresh`/`submitSlip`**: breaking change permission key `kpi:submit` → cập nhật `packages/auth` + PERMISSIONS + docs TL11/TL14/TL25 đồng bộ.
- **Nav test hiện khẳng định không có HR** (`nav-registry.test.ts:34-42`) → sửa test theo ma trận mới, đây là thay đổi contract có chủ đích.
- **Doanh thu sale attribution**: Receipt cần map về sale phụ trách — verify field tồn tại (Receipt.createdBy vs ownerId) khi plan chi tiết; nếu thiếu attribution → flag NGAY trong plan phase 1.
- **Quota chưa nhập** → KPI = 0 hoặc null? Quyết trong plan: `monthlyQuota null` → phiếu draft hiển thị "chưa cấu hình quota", không tính, GĐ phải upsertRate trước.

## 8. Success metrics

- 6 luồng WF-P3 + 3 luồng mới (reject, bulkApprove, refresh) đủ 6 cột traceability TL25.
- 5 role vào được đúng chức năng qua nav, không cần paste UUID/URL tay.
- Kỳ lương test: ngày có phiếu thủ công approved → penalty = 0 cho ngày đó.
- KPI slip đi trọn draft→submitted→confirmed→approved; assemble lấy đúng số confirmed.
- Toàn bộ test suite xanh (532+ hiện có + mới), e2e 5 specs pass, typecheck/build pass.

## 9. Next steps

1. `/ck:plan --tdd` với report này làm input (khuyến nghị — sửa business logic có test).
2. Plan cần verify sớm: Receipt→sale attribution field; notification hooks (events `kpi_pending_review`, `shift_reg_rejected`) có infra chưa hay chỉ ghi docs.
3. Sau implement: sync docs TL10/TL11/TL14/TL20/TL25 + ADR cho lifecycle KPI mới & CompensationPolicy.

## Unresolved questions

1. Receipt model có field attribution về sale phụ trách không? (verify khi plan — nếu thiếu, cần thêm hoặc đổi nguồn metric).
2. Notification (in-app/email) cho các event `kpi_pending_review`, `shift_reg_rejected`, `manual_punch_pending` — đợt này chỉ đổi trạng thái hay cần notify? (docs TL20 liệt kê events nhưng chưa xác nhận infra).
3. GV `monthlyQuota` = số buổi — buổi dạy bù/thay có tính không? (mặc định plan: mọi session hoàn tất có attendance do GV đó dạy đều tính).
