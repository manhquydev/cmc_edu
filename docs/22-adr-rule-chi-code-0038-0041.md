# Tài liệu 22 — ADR hoá 4 rule "chỉ-trong-code" (0038–0041)

> G1: nâng 4 quy tắc tinh vi hiện chỉ sống trong code thành **ADR chính thức** để bản viết lại v2
> tái mã hoá chắc chắn (nguyên tắc "port quyết định, không port code"). Định dạng ADR chuẩn; đánh số
> tiếp repo (`docs/decisions/0038…0041`). Đều **Status: Accepted** (mô tả hành vi hiện hữu, chốt cho v2).

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

## Ghi chú triển khai

4 ADR này **bỏ thẳng vào `docs/decisions/0038…0041`** của repo v2. Chúng là "carry-forward spec"
(TL05 §3) — khi build lại, đọc trước khi code cụm tương ứng. Ma trận Truy vết (TL00) sẽ trỏ cột ADR
tới đúng số này.

> Liên kết: TL19 §4 (0038) · TL20 §1 (0039) · TL20 §2 (0040) · TL01/17 (0041) · TL16 (ADR A–D).
