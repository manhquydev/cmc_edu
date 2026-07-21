---
phase: 7
title: Metric & Data Integrity
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 7: Metric & Data Integrity (Đợt 3 — sai báo cáo âm thầm)

## Overview
Nhóm lỗi "nhãn Medium nhưng nguy hiểm theo nghiệp vụ": xảy ra trong vận hành BÌNH THƯỜNG và âm thầm sai số tiền/báo cáo — duplicate student + renewal-mislabel, FinalGrade stale sau sửa điểm danh, closedAt bị ghi đè, submit sau khi bài đóng, Tier B mở sớm. Ưu tiên cao dù nhãn Medium (đúng tinh thần Hybrid B+C — xếp theo rủi ro thực).

## Requirements
- Functional:
  - **Trùng SĐT chưa chỉ rõ bé → CHẶN + bắt sale xác nhận (PO chốt vòng 3 — kích hoạt MỌI lúc trùng SĐT, không chỉ khác tên):** khi tạo phiếu mà phone trùng 1 phụ huynh **đã có ≥1 học sinh** VÀ không set `studentId` → KHÔNG tạo thẳng (bất kể tên giống hay khác); trả lỗi/tín hiệu buộc sale chọn: (a) bé đã có → chọn `studentId` hiện có (renewal), hoặc (b) bé MỚI → gửi lại kèm cờ `confirmNewStudent: true`. Chỉ khi có 1 trong 2 mới cho qua.
  - Lý do mở rộng (PO): trùng-SĐT-tên-GIỐNG cũng có thể là 2 bé thật trùng tên (tên VN hay trùng) hoặc sale quên chọn bé → chặn cả trường hợp này an toàn hơn. Đánh đổi: thêm 1 bước xác nhận cả khi gia hạn bình thường nếu sale quên chọn `studentId`.
  - Phone HOÀN TOÀN MỚI (chưa có học sinh nào) → KHÔNG chặn (luồng khách mới bình thường).
  - Renewal/new phân loại đúng theo **student-scope** (không chỉ theo phone).
  - Sửa điểm danh (vắng→có mặt) sau khi FinalGrade đã tính → FinalGrade tự refresh (không lệch với attendanceRate live).
  - Không ghi đè `closedAt` khi opportunity đã `O5_ENROLLED`.
  - `submit()` kiểm lại `exercise.status` (chặn nộp sau khi bài đóng).
  - Tier B (makeup open-tier) yêu cầu buổi đã kết thúc (mirror Tier A).
- Non-functional: tái dùng `recomputeFinalGrade` sẵn có; không đổi công thức tính, chỉ đúng điều kiện/thời điểm trigger.

## Related Code Files
- Modify: `apps/api/src/finance/router.ts:613-676` (receiptCreate — thêm cổng chặn trùng-SĐT-khác-tên + cờ `confirmNewStudent`) + `packages/domain-finance/src/duplicate-phone.ts` (nâng từ soft-warn → điều kiện chặn) + `packages/domain-finance/src/receipt-kind.ts:13-15` (`computeReceiptKind` student-scoped)
- Modify: `apps/api/src/finance/router.ts:640-653` (không ghi đè `closedAt` khi đã O5)
- Modify: `apps/api/src/attendance/router.ts` (`mark`/`markAll` trigger `recomputeFinalGrade` cho period bị ảnh hưởng) ↔ `apps/api/src/submission/router.ts:150-203` (`recomputeFinalGrade`)
- Modify: `apps/api/src/submission/router.ts:254-276` (`submit` — gọi `assertExerciseOpenForStudent` như `saveDraft`)
- Modify: `apps/api/src/exercise/open-tier.ts:110-124` (Tier B thêm time-gate `endTime < now`)
- Modify (test): siblings tương ứng

## Implementation Steps (TDD)
1. **duplicate-student chặn+xác nhận + renewal-label:**
   a. Test đỏ — phone đã có học sinh, KHÔNG set studentId, KHÔNG cờ (tên KHÁC) → BỊ CHẶN, không tạo student. Chạy → đỏ.
   b. Test đỏ — phone đã có học sinh, KHÔNG set studentId, KHÔNG cờ (tên GIỐNG bé cũ) → **cũng BỊ CHẶN** (mở rộng vòng 3). Chạy → đỏ.
   c. Test đỏ — gửi lại kèm `confirmNewStudent: true` → tạo Student MỚI + `kind='new'`. Chạy → đỏ.
   d. Test đỏ — gửi lại kèm `studentId` bé hiện có → reuse student cũ, `kind='renewal'`. Chạy → đỏ.
   e. Test — phone HOÀN TOÀN MỚI (chưa có học sinh) → KHÔNG chặn, tạo bình thường. (giữ xanh)
   f. Impl: cổng chặn khi (phone có ≥1 student) && !studentId && !confirmNewStudent; `computeReceiptKind` scope theo student. Chạy → xanh.
2. **closedAt không ghi đè:** test đỏ — approve phiếu cho opp đã O5 (đã closedAt cũ) → assert `closedAt` KHÔNG đổi. Impl guard. Xanh.
3. **FinalGrade refresh sau sửa điểm danh:** test đỏ — tính FinalGrade tháng → sửa attendance (vắng→có mặt) → assert FinalGrade.score refresh khớp attendanceRate mới. Impl:
   - **Verify trước:** chữ ký `recomputeFinalGrade` (`submission/router.ts:150-203`) — nó nhận (studentId, period) hay recompute rộng? Nếu chưa scope theo period, mở rộng để chỉ tính period ICT của session bị sửa.
   - `attendance.mark` gọi recompute cho (session.studentId, ICT-period của session).
   - **`markAll`:** gom UNIQUE (studentId, period) rồi recompute MỘT lần mỗi cặp — KHÔNG recompute per-enrollment (tránh N lần).
   - recompute KHÔNG được gọi lại `mark` (chống vòng lặp) — chỉ đọc attendance + ghi FinalGrade. Xanh.
4. **submit sau khi bài đóng:** test đỏ — bài `closed`, student còn draft → `submit()` → assert lỗi (như `saveDraft`). Impl gọi `assertExerciseOpenForStudent`. Xanh.
5. **Tier B time-gate:** test đỏ — makeup session tương lai đánh present → assert curriculum unit CHƯA mở (Tier B). Impl thêm `endTime < now`. Xanh. Giữ Tier B past-session xanh.
6. **Regression:** `pnpm --filter @cmc/api test finance submission attendance exercise` + `pnpm --filter @cmc/domain-finance test` xanh.

## Success Criteria
- [ ] Trùng SĐT chưa chỉ rõ bé (tên giống HAY khác) không cờ → CHẶN; có `confirmNewStudent` → bé mới `kind='new'`; có `studentId` → renewal. Phone hoàn toàn mới không bị chặn.
- [ ] `closedAt` không bị ghi đè khi opp đã O5.
- [ ] FinalGrade tự refresh sau sửa điểm danh; report không còn "rate mới + score cũ".
- [ ] `submit` bị chặn khi bài đóng.
- [ ] Tier B chỉ mở khi buổi bù đã kết thúc.

## Risk Assessment
- Rủi ro: trigger recompute từ attendance có thể gây quét rộng/hiệu năng nếu không giới hạn period. Mitigation: chỉ recompute period ICT của session bị sửa, tái dùng hàm sẵn có; test không tạo vòng lặp (recompute không gọi lại mark).
- Rủi ro: đổi `computeReceiptKind` scope là hàm thuần dùng nhiều nơi → sweep call site, giữ test unit hàm xanh.
- Rủi ro WORKFLOW (mới, do PO chọn chặn): receiptCreate giờ có thể CHẶN + đòi `confirmNewStudent` → UI tạo phiếu (`apps/admin`) phải xử bước xác nhận "bé mới hay bé cũ?"; e2e tạo phiếu trùng-SĐT phải cập nhật. Sweep UI + e2e trong cùng phase, đừng để sale kẹt ở lỗi khó hiểu. Đây là đổi hợp đồng có kiểm soát (thêm cờ optional, không phá luồng phone-mới).
- Rủi ro: chặn `submit` sau đóng có thể khoá student đang nộp dở hợp lệ ngay lúc bài vừa đóng. Chấp nhận (như `saveDraft` đã làm) — nhất quán hơn là để lọt.
