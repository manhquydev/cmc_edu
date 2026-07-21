# Phase 02 — CRUD Cơ sở (tạo + sửa tên)

## Context links
- Parent: [plan.md](plan.md)
- Design: brainstorm report (hạng mục A)
- Không phụ thuộc phase khác.

## Overview
- Date: 2026-07-16
- Mô tả: Backend thêm `facility.update` (đổi name). Frontend `facilities.tsx` thêm form Tạo mới + Sửa tên. Không làm deactivate (PO chốt).
- Priority: P2
- Implementation status: done
- Review status: done (1 Critical + 1 Medium finding fixed, re-verified)

## Key Insights
- Backend đã có `facility.create` (auto-derive code, ghi AuditLog) + `facility.list`. Thiếu `update`.
- Model `Facility` (schema.prisma:230): `id/name/code/createdAt`, KHÔNG có `isActive`/`updatedAt`. → Sửa name không cần đổi schema.
- `code` nằm trong class-code đã phát hành (`{facility.code}-...`) → **KHÔNG cho sửa code**, chỉ `name`.
- Frontend hiện chỉ list read-only (`facilities.tsx`), đã có gate `canDo('facility','list')`.
- Permission `facility.*` = mảng role rỗng → chỉ super_admin. `facility.update` phải dùng cùng khuôn gate `requirePermission('facility','manage')` (thêm key `facility.manage` vào registry nếu chưa có; hiện có `facility.create`/`facility.list`).

## Requirements (đã chốt qua red-team)
- **Tạo (`facility.create` qua UI)**: form BẮT BUỘC nhập cả `name` + `code` (mã ngắn admin tự gõ, vd "HN"). Không dùng auto-derive cho luồng UI (auto-derive chỉ là fallback cho test/caller cũ). Trùng `code` (unique) → bắt lỗi Prisma P2002 → trả lỗi thân thiện "Mã cơ sở đã tồn tại" (không để lộ lỗi DB thô).
- **Sửa (`facility.update({ id, name })`)**: CHỈ đổi `name`, ghi AuditLog (`facility.update`), super_admin-only. Từ chối name rỗng. `code` bất biến — không nhận field code (bỏ qua nếu gửi).
- UI: nút "Thêm cơ sở" (form name+code → `facility.create`), nút/inline "Sửa tên" mỗi dòng (→ `facility.update`, KHÔNG hiển thị ô sửa code). Invalidate `facility.list` sau mutation.

## Edge cases (từ red-team)
- Trùng mã khi tạo → thông báo thân thiện, giữ nguyên form cho admin sửa (không mất dữ liệu đã nhập).
- Tên trùng nhau giữa 2 cơ sở: CHO PHÉP (chỉ `code` unique, `name` không) — không chặn.
- `facility.create` hiện đã ghi audit tay; khi phase 04 có middleware, xử lý trùng theo quy tắc dọn ở phase 04 (không ghi đôi).

## Architecture
- Backend: thêm procedure `update` vào `facility/router.ts`. Quyết định permission key: tái dùng pattern create. Kiểm tra registry `packages/auth/src/index.ts` — thêm `facility.manage: []` nếu cần key riêng, hoặc gate `update` bằng `facility.create` (đơn giản hơn, cùng nghĩa "super_admin-only"). Chốt: dùng key mới `facility.manage` cho rõ ngữ nghĩa.
- Frontend: mở rộng `facilities.tsx` (form + mutation), theo khuôn `users.tsx` (modal create + invalidate).

## Related code files
- Sửa: `apps/api/src/facility/router.ts` (+ `facility.test.ts`)
- Sửa (nếu thêm key): `packages/auth/src/index.ts` (+ `index.test.ts`)
- Sửa: `apps/admin/src/pages/admin/facilities.tsx` (+ `facilities.test.tsx`)
- Tham chiếu: `apps/admin/src/pages/admin/users.tsx` (khuôn modal create/edit)

## Implementation Steps (TDD)
1. **Test backend trước** (`facility.test.ts`): super_admin `facility.update` đổi name persist + ghi AuditLog; non-super_admin → FORBIDDEN; name rỗng → BAD_REQUEST; gửi `code` → bị bỏ qua (code không đổi). Thêm test `facility.create` với code trùng → lỗi thân thiện (không lộ P2002 thô). Chạy → đỏ.
2. Implement `facility.update` + bắt lỗi trùng code ở `create` → xanh.
3. (Nếu thêm `facility.manage`) test registry: super_admin pass, role khác fail → implement → xanh.
4. **Test frontend** (`facilities.test.tsx`): render form tạo, submit gọi `facility.create`; sửa tên dòng gọi `facility.update`; invalidate list. Chạy → đỏ.
5. Implement UI → xanh. Regression: test list cũ + gate cũ vẫn xanh.

## Todo list
- [ ] Test `facility.update` backend (đỏ)
- [ ] Implement `facility.update` + audit
- [ ] (tùy) Thêm `facility.manage` registry + test
- [ ] Test UI tạo/sửa (đỏ) → implement → xanh
- [ ] Regression list + gate cũ xanh

## Success Criteria
- super_admin tạo + sửa tên cơ sở qua UI, không cần chạy script.
- `code` bất biến sau update.
- AuditLog ghi cả create (đã có) + update (mới).
- Không role khác thao tác được.

## Risk Assessment
- Sửa code cơ sở phá class-code → mitigations: khoá field code ở cả API (bỏ qua) lẫn UI (không hiển thị input code khi sửa).
- Đổi name không ảnh hưởng class-code (chỉ code tham gia). An toàn.

## Security Considerations
- Gate super_admin-only qua registry rỗng + `requirePermission`. Ghi audit mọi thay đổi.

## Next steps
→ Phase 03.
