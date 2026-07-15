# Tài liệu 22 — ADR hoá rule "chỉ-trong-code" (0038–0042)

> G1: nâng các quy tắc tinh vi hiện chỉ sống trong code thành **ADR chính thức** để bản viết lại v2
> tái mã hoá chắc chắn (nguyên tắc "port quyết định, không port code"). Định dạng ADR chuẩn; đánh số
> tiếp repo (`docs/decisions/0038…0042`). Đều **Status: Accepted** (mô tả hành vi hiện hữu, chốt cho v2).

---

## ADR 0038 — Thời điểm mở bài tập theo tiến độ dạy (Tier A/B)

**Status:** Accepted (formalize `lib/exercise-open.ts`).
**Context.** Bài tập gắn `curriculumUnit`. Cần định rõ *khi nào* một bài mở cho học viên — không thể
mở ngay khi tạo, phải theo tiến độ học thực tế; và buổi học bù chỉ dạy cho HS vắng, không thể mở cho
cả lớp.

**Decision.**
- Điều kiện nền: Exercise `status = published` **và** HS không ở `BLOCKED_LMS_LIFECYCLE`.
- **Tier A (mở cả lớp):** một `curriculumUnitId` mở cho **toàn batch** khi buổi học **không phải bù**
  dạy unit đó **đã kết thúc** — mốc kết thúc tính theo **giờ ICT** (`sessionEndUtc`, UTC+7), không theo
  cột `sessionDate` UTC-midnight.
- **Tier B (mở riêng HS):** buổi **bù** (`isMakeup`) mà HS **có mặt/đi muộn** (`present`/`late`) mở
  unit đó **chỉ cho HS ấy** (keyed trên `Attendance`), **không** mở cả lớp.
- Buổi `cancelled` không mở gì.

**Consequences.** "Học tới đâu mở bài tới đó"; công bằng buổi bù; phụ thuộc `SessionStatus` +
`isMakeup` + giờ ICT. Nếu đổi cách tính giờ kết thúc, phải giữ nguyên ngữ nghĩa Tier A/B.

**Alternatives bỏ.** Mở ngay khi published (không theo tiến độ) — bị loại vì học viên thấy bài chưa học.

---

## ADR 0039 — Chấm công qua khớp IP dải mạng cơ sở (không GPS)

**Status:** Accepted (formalize `routers/check-in-out.ts`).
**Context.** Chấm công tại cơ sở; cần xác thực "đang ở công ty" mà không dùng GPS (riêng tư, thiếu
chính xác trong nhà).

**Decision.**
- `FacilityNetwork` khai báo các dải hợp lệ: `ipAddress` dạng **CIDR** (`192.168.1.0/24`) hoặc IP đơn,
  `label`, `isActive`.
- Khi chấm: lấy `ctx.ip` (IP client qua proxy header) → `ipMatchesCidr` so với các dải active của cơ sở.
  - Khớp → `method: 'ip'` (hợp lệ tự động).
  - Không khớp → `method: 'manual'` → bắt buộc **phiếu chấm công thủ công theo ngày** (QĐ 0034).
- **Cooldown** chống double-punch (lỗi `CONFLICT`). Bản ghi lưu `ipAddress` + `method` (audit).
- Duyệt phiếu thủ công: **không tự duyệt của mình**; **chỉ manager trực tiếp** (FORBIDDEN nếu khác).

**Consequences.** Phụ thuộc **độ tin cậy của IP client** — hạ tầng phải cấu hình `x-forwarded-for`
đúng (chống giả IP). Cơ sở phải khai báo dải mạng. Không cần quyền định vị.

**Alternatives bỏ.** GPS/geofence (riêng tư, kém chính xác trong nhà); QR tại chỗ (dễ chụp lại).

---

## ADR 0040 — Nhóm ca theo vai trò + `selectionMode` (sale ≠ giáo viên)

**Status:** Accepted (formalize `resolveShiftGroup()` + `ShiftGroup`).
**Context.** Sale và giáo viên có **hình thức công ca khác nhau**: khối kinh doanh làm giờ cố định;
giáo viên làm theo buổi, có thể nhiều ca.

**Decision.**
- **ShiftGroup** phân theo vai trò qua `resolveShiftGroup(position)`:
  - `KINH_DOANH` ← `sale`/`cskh`/`ctv_mkt`
  - `GIAO_VIEN` ← `giao_vien`
- Mỗi nhóm có **`selectionMode` = `SINGLE` | `MULTIPLE`**: một nhóm cho chọn **một** ca/ngày (khối văn
  phòng cố định), nhóm kia **nhiều** ca (giáo viên theo buổi). (Gán selectionMode cụ thể theo cấu hình.)
- `ShiftTemplate` (`CA_SANG/CA_CHIEU/CA_TOI`, start/end) thuộc nhóm. `ShiftEntryType` = `work` | `leave`.
- Vòng đời phiếu `draft→submitted→approved|cancelled`; **ticket-lock** 1 phiếu chờ; `fromDate` tương
  lai (ICT) — QĐ 0035.
- **Duyệt (fallback theo nhóm):** managerId trực tiếp; hết chuỗi → nhóm `GIAO_VIEN` → **GĐĐT**, nhóm
  `KINH_DOANH` → **GĐKD**. Chống tự-duyệt (QĐ 0027). Role `bgd` cũ đã bỏ.

**Consequences.** Hai hình thức công ca cùng tồn tại, phân bằng dữ liệu (`ShiftGroup`), không hardcode
theo role rải rác. Đổi mapping role→group chỉ sửa `resolveShiftGroup`.

**Alternatives bỏ.** Một mẫu ca chung cho mọi vai trò — không phản ánh thực tế sale vs giáo viên.

---

## ADR 0041 — Provisioning atomic tại duyệt phiếu (+ tinh chỉnh v2)

**Status:** Accepted (formalize QĐ 0024/0033/0037) — **v2 tinh chỉnh** phần idempotent.
**Context.** Tài khoản HS/PH phải tồn tại đúng khi tiền được xác nhận; tuyệt đối **không student mồ côi**
tạo ngoài mạch tài chính.

**Decision (hành vi hiện hữu).**
- Tại `finance.receiptApprove` (cổng tiền): trong mạch tiền → auto-advance opp **O5_ENROLLED** +
  `closedAt`; tạo **Student** (`createdByReceiptId` provenance) + **ParentAccount** (find-or-create theo
  `phone` 84xxx) + **Enrollment** (`reserved`→`active`) + **StudentAccount** LMS; email PH qua **outbox**.
- Không có UI tạo student thủ công (break-glass tách trang quản trị — quyết định 2026-07-05).
- Race `unique_violation` trên `parent_account.phone` (2 con SĐT-mới đồng thời) xử bằng
  **SAVEPOINT / `ON CONFLICT DO NOTHING` + refetch** để giữ transaction tiền sống.

**Decision (tinh chỉnh v2 — TL03 §A, ADR-B).**
- Giữ **đăng tiền + O5 atomic**; **tách provisioning ra bước idempotent** (khoá theo `phone`) để lỗi
  provisioning **không rollback tiền**.
- `Enrollment` `reserved→active` **lái bởi Receipt** (`active ⇔ Receipt approved` — ADR-A/TL16).

**Consequences.** Không student mồ côi; toàn vẹn tiền; provisioning idempotent chịu retry (khớp outbox).
Mang nguyên QĐ 0024 (cổng tiền/auto-O5), 0033 (định danh phone), 0037 (CRM↔finance lookup).

**Alternatives bỏ.** Tạo student ở UI riêng ngoài mạch tiền — sinh student mồ côi, sai "won" metrics.

---

## ADR 0042 — KPI auto-score + session-done engine (HR remediation)

**Status:** Accepted (formalize `kpi/auto-score.ts`, `kpi/router.ts`, `payroll/router.ts`,
`class/session-done.ts`, `worker/session-done-sweep.ts`).
**Context.** Trước HR remediation, KPI là nhập tay (`kpi.submit`/`kpi.approve` đơn lẻ, không công
thức chuẩn) và lương dùng `SalaryRate` per-employee tự do (`baseSalary`/`variablePayRate`/`kpiMax`
gõ tay từng người, không catalog, không audit trail cho công thức). "Buổi học xong" cũng không có
khái niệm hệ thống — chỉ dựa điểm danh thô, không phản ánh buổi đã hoàn thành đủ 3 khâu (điểm danh +
đánh giá + bằng chứng), khiến giờ dạy GV tính KPI thiếu chính xác khi GV chốt buổi trễ.

**Decision — mô hình lương bậc + công thức "PHẦN NHÂN".**
- `SalaryTier` catalog per-facility (`type` KINH_DOANH\|GIAO_VIEN, `baseSalary`, `unitRate`,
  `requiredShifts`, `requiredMetric`) thay thế nhập tay từng người. `compensation.assignTier` gán 1
  `AppUser` (chỉ `sale`/`giao_vien`) vào 1 tier — `SalaryRate.tierId`. 3 cột cũ (`baseSalary`,
  `variablePayRate`, `kpiMax` trên `SalaryRate`) nullable-deprecated, không writer mới ghi.
- Công thức: `value = min(1, shiftActual/tier.requiredShifts) × min(1, metricValue/tier.requiredMetric)
  × tier.unitRate` (`computeKpiValue`, làm tròn `roundVnd`) — cap 100% trên CẢ HAI tỉ lệ (không vượt
  100% dù vượt chỉ tiêu), 0 nếu quota bằng 0 (không chia 0, không mặc định 100%).
- `metricValue`: GV = giờ dạy quy đổi qua `creditFactor` (xem phần session-done bên dưới); Sale =
  `SUM(Receipt.netAmount)` `approved` trong kỳ, gắn `createdByAppUserId` (namespace AppUser thật, R2
  #2 — không dùng `createdById` legacy userId scalar).
- `shiftActual` (ADR 0043, thay thế đoạn ghép ±2h/ca cũ): mỗi ngày có cặp vào/ra hợp lệ (punch trong
  mạng, hoặc phiếu offsite `approved` mang `checkInAt`/`checkOutAt` đóng băng) qua `resolveDayCredit`
  (`apps/api/src/attendance/`, dùng chung `computeDayAttendance` @cmc/domain-payroll với phase lương —
  một nguồn sự thật duy nhất cho "công ca thực") — mọi ca đăng ký ngày đó có khung **giao** với cặp
  vào/ra được tính công. Xem `docs/decisions/0043-attendance-daily-inout-pairing.md`.
- Mọi giá trị snapshot tại thời điểm `kpi.refresh` (`quotaSnapshot`, `shiftRequired`,
  `unitRateSnapshot`, `tierIdSnapshot`) — đổi tier sau đó KHÔNG làm trôi số đã tính cho slip đã nộp.
- `Payslip.kpiBonus` tái dụng chứa "Phần KPI" (= `KpiScore.value` khi `confirmed`\|`approved`);
  `Payslip.variablePay` deprecated, luôn 0 (`assembleSlip`, @cmc/domain-payroll).

**Decision — vòng đời KPI (`draft→submitted→confirmed→approved`).**
- `kpi.refresh`: idempotent upsert `draft`, không bao giờ ghi đè `submitted`+ (race-safe qua P2002/
  P2025 catch — 2 request đồng thời hội tụ về cùng 1 row, không 500, không duplicate).
- `kpi.submitSlip`: chủ phiếu tự nộp, mở từ **00:00 ICT ngày 3 tháng kế tiếp** (đủ thời gian
  `creditFactor` 48h đóng băng trước khi số liệu "chốt"); tự `refresh` trong cùng transaction, kèm
  inline done-evaluate các session GV quá hạn (bù lỗ nếu sweep worker chạy chậm — R3-14).
- `kpi.confirm`: direct manager (qua `managerId`) hoặc `super_admin`, chống tự-xác-nhận.
- `kpi.override`: director set `value` trực tiếp có lý do audit; sửa `approved` chỉ `super_admin` VÀ
  chỉ khi `Payslip` kỳ đó đã reopen về `draft` — van duy nhất chạm số đã tất toán.
- `kpi.bulkApprove`: branch-scope theo **`AppUser.roles`** (RBAC truth), KHÔNG theo `position`
  free-text (`resolveShiftGroup` là công cụ SAI cho quyết định tiền — dùng cho phân loại ca, không
  phải phân loại tiền); chỉ đụng `confirmed` có `Payslip` `finalized`; loại trừ phiếu của chính người
  duyệt; idempotent.
- GĐ/`super_admin` không có `KpiScore`/`Payslip` — "lương giám đốc ngoài hệ thống", `kpi.refresh`/
  `payslip.assemble` target họ trả `BAD_REQUEST`.

**Decision — session-done engine (chỉ sweep, không event hook).**
- 3 điều kiện `done`: ≥1 điểm danh `present`; mọi HS `present` có `QualitativeAssessment` `confirmed`;
  `SessionEvidence` `published` ≥1 ảnh. Chỉ đánh giá khi `now >= endTime` (chặn chốt sớm để gian
  credit).
- **Không hook trực tiếp trên router điểm danh/đánh giá/bằng chứng** — 3 điều kiện nằm ở 3 router
  khác nhau, hook sẽ đua nhau qua các transaction riêng biệt không có consumer real-time nào biện
  minh cho rủi ro (R2 #1). Worker sweep định kỳ (`session-done-sweep.ts`) đánh giá lại mọi session
  `planned`/`confirmed` đã qua `endTime`.
- `doneAt` = mốc muộn nhất trong 3 điều kiện, **đóng băng tại thời điểm `done`** — sửa điểm danh/huỷ
  đánh giá sau đó không hồi tố.
- `creditFactor(doneAt, endTime)`: trễ ≤24h → 1.0; ≤48h → 0.5; >48h → 0 — nhân vào giờ dạy GV tính KPI
  (`collectTeacherHours`). Session trước mốc kích hoạt engine (`SESSION_DONE_ACTIVATED_AT`) là lịch
  sử, backfill 1 lần, credit luôn 1.0 (không phạt hồi tố dữ liệu cũ chưa từng được thiết kế theo
  cơ chế này — R2 Scope F3).
- Sweep thứ hai: session quá `endTime + 24h` với 0 điểm danh `present` → tự `cancelled`; nếu có
  `scheduleSlotId` (không phải buổi thêm tay), tự tạo buổi bù nối vào **cuối** chuỗi slot lặp lại
  (có thể kéo dài lịch học qua `ClassBatch.endDate` khi lớp nợ buổi); phòng bận → bỏ qua tạo tự động,
  báo `roomConflict: true`, người xử lý thủ công.

**Consequences.** Lương/KPI có công thức tường minh, kiểm chứng được, audit trail đầy đủ (snapshot
mọi input); loại bỏ hoàn toàn nhập tay dễ sai/khó audit. Session-done engine phụ thuộc worker sweep
chạy đều đặn (không real-time) — độ trễ giữa lúc 3 điều kiện đủ và lúc `done` thực sự set phụ thuộc
chu kỳ sweep, chấp nhận được vì `creditFactor` đã có biên 24h/48h đủ rộng để hấp thụ độ trễ vận hành
bình thường.

**Alternatives bỏ.** Event hook trực tiếp trên 3 router (điểm danh/đánh giá/bằng chứng) để `done` set
ngay lập tức — bị loại vì đua transaction xuyên router, không có nhu cầu real-time nào biện minh cho
rủi ro. Giữ `SalaryRate` nhập tay từng người — bị loại vì không audit được công thức, dễ lệch giữa
các nhân viên cùng vị trí.

---

## Ghi chú triển khai

5 ADR này **bỏ thẳng vào `docs/decisions/0038…0042`** của repo v2. Chúng là "carry-forward spec"
(TL05 §3) — khi build lại, đọc trước khi code cụm tương ứng. Ma trận Truy vết (TL00) sẽ trỏ cột ADR
tới đúng số này.

> Liên kết: TL19 §4 (0038) · TL20 §1 (0039) · TL20 §2 (0040) · TL01/17 (0041) · docs/20 §2-4b, docs/25
> P3 (0042).
