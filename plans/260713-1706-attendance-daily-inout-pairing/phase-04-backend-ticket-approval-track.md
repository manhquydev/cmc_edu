---
phase: 4
title: "Backend ticket approval track"
status: pending
priority: P1
dependencies: [1]
---

# Phase 4: Backend ticket approval track

## Overview
Đổi duyệt phiếu chấm công từ "quản lý trực tiếp" (`managerId`) sang **GĐ theo
track** (sale→GĐKD, giáo viên→GĐĐT), giữ anti-self + resubmit; bỏ
`manualPunch.create` nhập ngày tùy ý.

## Requirements
- Functional:
  - `manualPunch.approve`/`reject`: người duyệt phải là GĐ đúng track của chủ phiếu.
    Sale→`giam_doc_kinh_doanh`, giáo viên→`giam_doc_dao_tao`. `super_admin` bypass.
    Anti-self: không duyệt phiếu của chính mình.
  - `manualPunch.list` inbox: GĐ thấy phiếu nhân sự đúng track mình (theo role của
    chủ phiếu), không theo `managerId`. `super_admin` thấy tất cả. `mine` giữ nguyên.
  - Bỏ `manualPunch.create` (nhập ngày tùy ý). Phiếu chỉ sinh từ luồng punch (phase 3).
  - Resubmit: phiếu `rejected` → chủ phiếu chỉnh lý do gửi lại → `resubmitted`
    (giữ cơ chế hiện có, nhưng entry point KHÔNG còn `create` ngày tùy ý — resubmit
    xảy ra qua punch lại ngày đó? → xem Quyết định dưới).

## Quyết định resubmit (khóa)
Vì đã bỏ `manualPunch.create`, phiếu bị `rejected` được gửi lại bằng thủ tục MỚI
`manualPunch.resubmit({ ticketId, reason })` (chủ phiếu, chỉ khi phiếu `rejected`)
→ set `status='resubmitted'`, `note=reason`. Không tạo phiếu ngày tùy ý; chỉ thao
tác trên phiếu đã tồn tại (sinh từ punch offsite). Giữ giờ checkInAt/checkOutAt cũ.

## Architecture
- Xác định track của chủ phiếu: đọc `owner.roles` → `resolvePayrollTargetRole`
  (tái dùng từ payroll: sale|giao_vien|null). Map: sale→GĐKD, giao_vien→GĐĐT.
- **Red-team R3 — chủ phiếu role null** (GĐ/super_admin có phiếu offsite): không có
  track → **chỉ `super_admin` duyệt được**. Cùng tinh thần bypass hiện có; ghi rõ
  test riêng. `resolvePayrollTargetRole` chưa export (nợ kỹ thuật đã ghi ở scout)
  → tách ra module dùng chung `apps/api/src/attendance/` thay vì import chéo router.
- `assertCanReviewTicket(reviewerRoles, ownerRole)` tái dùng pattern
  `compensation.assignTier` branch-scope + `shift/router.ts::assertCanReview`
  anti-self. Anti-self so bằng `AppUser.id` (reviewer vs owner).
- **TOCTOU (rà vòng 2):** approve/reject/resubmit phải update có điều kiện
  `WHERE id AND status IN (pending|resubmitted)` (approve/reject) hoặc
  `status='rejected'` (resubmit); Prisma P2025 khi 2 GĐ đua duyệt → BAD_REQUEST
  ("phiếu đã được xử lý"). Không đọc-rồi-ghi không guard.
- Bỏ `managerId` khỏi logic duyệt phiếu (giữ cột schema — dùng chỗ khác/không xóa vội).
- `manualPunch.list` inbox: filter theo role chủ phiếu khớp track GĐ. Query: lấy
  phiếu facility, join `appUser.roles`, lọc ở app-layer (roles là mảng — Prisma
  `has`), hoặc lọc theo danh sách appUserId có role tương ứng.

## Related Code Files
- Modify: `apps/api/src/checkin/router.ts` (`manualPunchRouter`: approve/reject/list;
  xóa `create`; thêm `resubmit`)
- Modify: `packages/auth/src/index.ts` — `manualPunch.approve` giữ [GĐKD, GĐĐT];
  cân nhắc thêm `manualPunch.resubmit` key ([sale, giao_vien]) hoặc dùng protected+owner.
- Modify: `apps/api/src/checkin/ip-match.test.ts` (hoặc file test riêng cho approval)

## TDD Test Plan (test-first)
1. Sale tạo phiếu (qua seed/punch offsite) → GĐKD approve OK; GĐĐT approve → FORBIDDEN.
2. Giáo viên phiếu → GĐĐT approve OK; GĐKD → FORBIDDEN.
3. Anti-self: người vừa là sale vừa GĐKD, phiếu của chính mình → approve/reject FORBIDDEN.
4. `super_admin` approve mọi phiếu OK.
5. Approve phiếu không `pending`/`resubmitted` → BAD_REQUEST.
6. Reject → `rejected`; resubmit(reason) bởi chủ phiếu → `resubmitted`, note đổi;
   resubmit bởi người khác → FORBIDDEN; resubmit phiếu không `rejected` → BAD_REQUEST.
7. `manualPunch.create` không còn tồn tại (procedure removed) — test cũ xóa/di trú.
8. inbox: GĐKD chỉ thấy phiếu chủ là sale; GĐĐT chỉ thấy phiếu chủ là giáo viên;
   super_admin thấy tất cả; `mine` trả phiếu của caller.
9. Approve sau khi payslip kỳ đó finalized → vẫn approved + `warning: PAYSLIP_FINALIZED`
   (giữ hành vi red-team #13 hiện có).
10. **TOCTOU**: 2 GĐ approve cùng phiếu đồng thời → 1 thành công, 1 nhận BAD_REQUEST
    (P2025), không double-apply.

## Implementation Steps
1. RED: viết 9 case.
2. GREEN: đổi gate approve/reject sang track; thêm `resubmit`; xóa `create`; sửa
   inbox filter.
3. Cập nhật `packages/auth` nếu thêm key.
4. `pnpm --filter @cmc/api test -- checkin` xanh.

## Success Criteria
- [ ] Duyệt/từ chối theo GĐ track, anti-self, super_admin bypass.
- [ ] `manualPunch.create` (ngày tùy ý) đã xóa; `resubmit` thay thế đường gửi lại.
- [ ] inbox lọc theo track; `mine` giữ nguyên.
- [ ] Giữ warning PAYSLIP_FINALIZED.
- [ ] 9 case TDD xanh.

## Risk Assessment
- **Rủi ro:** đổi authorization (managerId→track) — nhân sự đang gán managerId sẽ
  không còn ý nghĩa cho phiếu. Mitigation: track suy từ role chủ phiếu, không cần
  data migration; ghi rõ trong docs. `managerId` vẫn dùng ở KPI confirm (không đụng).
- **Rủi ro:** phiếu của chủ có CẢ 2 role (kiêm nhiệm) → track nào? Mitigation:
  `resolvePayrollTargetRole` ưu tiên sale trước giao_vien (đã có quy ước); ghi rõ.
- **Rủi ro:** xóa `manualPunch.create` phá caller frontend cũ. Mitigation: phase 7
  gỡ form ngày tùy ý cùng nhánh.
