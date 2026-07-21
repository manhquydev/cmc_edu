# Phase 1 — Verification & Promotion Gate — Kết quả

**Ngày:** 2026-07-15

## V1 — password-expired coverage
Grep `requireLmsStudent` toàn `apps/api/src` → 7 call site trong 4 file:
- `exercise/open-tier.ts:173,181` — `openForStudent`/`listForStudent` — **query (đọc)**, không cần gate.
- `rewards/gift-router.ts:85` — `listForStudent` — **query (đọc)**, không cần gate.
- `rewards/reward-router.ts:54,271` — `redeem` (mutation, CÓ gọi `assertPasswordNotExpired:55`) + `listForStudent` (đọc, không cần).
- `submission/router.ts:209,255` — `saveDraft` + `submit` (mutation, CÓ gọi `assertPasswordNotExpired:210,256`).

**Kết luận: KHÔNG có lỗ hổng.** Mọi mutation thật (saveDraft, submit, redeem) đều gọi gate; các query đọc đúng đắn không cần. Câu hỏi mở "Chưa xác định" trong báo cáo scenario-audit gốc (NS #9) → **đóng, an toàn**. Không promote việc vào Phase 3.

## V2 — frontend role-array hardcode
3 điểm audit cũ (`docs/03-audit-diem-dut-gay-chuan-hoa.md`) nêu tên:
- `opportunity-detail.tsx` — còn tồn tại nhưng **0 role-literal**, đã dọn sạch.
- `checkin-panel.tsx`, `attendance-roster.tsx` — **không còn tồn tại** (đổi tên/viết lại trong đợt Astryx UI migration).

→ 3 điểm gốc đã fix. Quét lại toàn bộ `apps/admin/src` + `apps/lms/src`, loại `*.test.tsx`, còn **4 file non-test**:
| File | Dùng để làm gì |
|---|---|
| `shell/role-switcher.tsx:12` | Dev-only impersonation switcher (không phải gate) |
| `pages/cockpit.tsx:211-213` | Chọn hiển thị dashboard theo vai trò (nút bấm thật đã qua `canDo()` đúng chuẩn — xác nhận đọc code dòng 206-209) |
| `pages/classes/class-detail.tsx:26` | Lọc danh sách giáo viên cho dropdown gán lớp |
| `pages/hr/my-hr.tsx:49` | Xác định "nhân sự vận hành" cho hiển thị HR |
| `pages/hr/salary-tiers.tsx:313,318,331` | Phân loại kiểu bậc lương (GIAO_VIEN/KINH_DOANH) — business logic, không phải security gate |

**Kết luận:** không phải cổng quyền thay `can()` (mutation thật vẫn qua `canDo()`/`requirePermission` server-side) — chỉ là UI display/business-classification, rủi ro thấp (đúng loại hygiene). 4 file ≤ ngưỡng 5 → **nhập Phase 8**, không tách sub-plan.

## Cập nhật scope
- Phase 3: KHÔNG có việc promote thêm từ V1.
- Phase 8: thêm ghi chú tham khảo 4 file trên (không bắt buộc sửa, có thể cân nhắc dùng `canDo()` thay literal nếu muốn nhất quán tuyệt đối — độ ưu tiên thấp).

## Unresolved questions
Không còn — cả 2 nhánh V1/V2 đã có kết luận rõ.
