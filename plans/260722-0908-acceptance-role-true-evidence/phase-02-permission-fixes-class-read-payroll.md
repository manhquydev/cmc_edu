---
phase: 2
title: "Permission fixes (class.read + payroll)"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Permission fixes (class.read + payroll)

## Overview

Gỡ ba lỗi phân quyền đang chặn luồng thật — trong đó **F1 chặn luồng tiền cốt lõi** và đã tồn tại từ 2026-07-06 (chưa từng chạy được, không phải hồi quy).

## Requirements

**Functional**
- `sale` và `giam_doc_kinh_doanh` tạo được phiếu thu qua `/finance/new` từ đầu đến cuối.
- `giao_vien` chọn được lớp/buổi ở `/teaching/session-assessment`.
- `giam_doc_kinh_doanh`/`giam_doc_dao_tao` thấy danh sách nhân viên ở `/hr/payroll`.

**Non-functional (ràng buộc cứng)**
- `class.create` **vẫn chỉ** `giam_doc_dao_tao` — quyền tạo lớp không được nới (D2).
- ADR-B giữ nguyên: `finance.receiptCreate` **không** cấp cho `giam_doc_dao_tao` (D3).
- Không hạ bất kỳ money-gate nào (`receiptApprove`, `refundCreate`, `payslip.finalize`).

## Architecture

**Nguyên nhân gốc chung của F1 và F2** — `class-batch-router.ts:112-114` tự khai:

> *"Registry has only 4 P2-Foundation entries (course.manage, room.manage, class.create, schedule.generate) — list/get reuse `class.create` rather than inventing a 5th read-only permission the spec does not name."*

Quyết định đó là cố ý và có lý do (bám spec), nhưng hệ quả là **quyền đọc bị buộc vào quyền ghi**. Sáu procedure đang chịu ảnh hưởng:

| Procedure | File:line | Sau khi sửa |
|---|---|---|
| `classBatch.create` | `class-batch-router.ts:115` | **giữ** `class.create` |
| `classBatch.list` | `class-batch-router.ts:229` | → `class.read` |
| `classBatch.listStudents` | `class-batch-router.ts:254` | → `class.read` |
| `classBatch.get` | `class-batch-router.ts:283` | → `class.read` |
| `classBatch.assignTeacher` | `class-batch-router.ts:300` | **giữ** `class.create` (ghi) |
| `classSession.list` | `class-session-router.ts:84` | → `class.read` |

`'class.read': ['giam_doc_kinh_doanh','giam_doc_dao_tao','sale','giao_vien']`

**F4 độc lập**: `/hr/payroll` (`payroll.tsx:414`) gọi `trpc.user.list` **vô điều kiện** trong component chính; `user.list` đòi `user.manage: []` (rỗng = super_admin only, `user/router.ts:129`). Nav mở màn này cho `payslip.assemble` (GĐKD/GĐĐT) → mâu thuẫn.

Hai hướng cho F4, **chọn khi thực thi sau khi đọc `user/router.ts`**:
- **(a)** Thêm `user.list` một permission đọc riêng (`user.read`) cấp cho GĐKD/GĐĐT — nhất quán với cách xử lý `class.read`, nhưng `user.list` trả PII nhân sự nên phạm vi phải cân nhắc.
- **(b)** Màn payroll dùng một procedure hẹp hơn, chỉ trả `{id, fullName, employeeCode, position}` cho mục đích chốt lương (đúng 4 field `payroll.tsx:416-420` dùng).

**Khuyến nghị (b)** — least-privilege thật sự: màn chốt lương không cần toàn bộ hồ sơ nhân sự. Nhưng (b) tốn công hơn; nếu chọn (a) phải ghi rõ lý do chấp nhận lộ PII cho 2 vai giám đốc.

## Related Code Files

- Modify: `packages/auth/src/index.ts` — thêm `class.read` (+ `user.read` nếu chọn hướng (a))
- Modify: `apps/api/src/class/class-batch-router.ts` — 3 procedure đọc
- Modify: `apps/api/src/class/class-session-router.ts:84`
- Modify: `apps/api/src/user/router.ts` hoặc `apps/api/src/payroll/router.ts` — tuỳ hướng F4
- Modify: `apps/admin/src/pages/hr/payroll.tsx` — nếu chọn (b)
- Modify: `docs/14-danh-muc-vai-tro-phan-quyen.md` — bổ sung entry mới vào bảng registry
- Modify: ADR/spec P2-Foundation — cập nhật câu "registry chỉ có 4 entry"

## Implementation Steps

1. **Chạy impact analysis trước khi sửa** (bắt buộc theo `CLAUDE.md`): `gitnexus_impact({target: "classBatchRouter", direction: "upstream"})` và tương tự cho `classSessionRouter`, `userRouter`. Báo blast radius; dừng lại hỏi nếu HIGH/CRITICAL.
2. Thêm `'class.read'` vào `PERMISSIONS` với 4 vai. **Không** đụng `'class.create'`.
3. Đổi 4 procedure đọc (`classBatch.list/get/listStudents`, `classSession.list`) sang `class.read`. Giữ `create`/`assignTeacher` ở `class.create`.
4. Cập nhật comment `class-batch-router.ts:112-114` — nó đang khai một quyết định vừa bị đảo; để nguyên là để lại lời nói dối trong code.
5. Xử lý F4 theo hướng đã chọn; nếu (b) thì thêm procedure hẹp + đổi `payroll.tsx`.
6. Cập nhật `docs/14` và spec/ADR P2-Foundation. Nếu cần ADR mới cho việc tách quyền đọc/ghi → tạo theo mẫu `docs/decisions/`.
7. Chạy lại audit Phase 1 → các luồng vướng `class.create` phải hết vi phạm.

## Test / Validation

**Negative-authz (bắt buộc — chống nới quyền quá tay):**
- `sale` gọi `classBatch.create` → **FORBIDDEN** (chứng minh không nới nhầm quyền ghi)
- `giao_vien` gọi `classBatch.assignTeacher` → **FORBIDDEN**
- `giam_doc_dao_tao` gọi `finance.receiptCreate` → **FORBIDDEN** (ADR-B còn nguyên)

**Positive:**
- `sale` gọi `classBatch.list` → OK
- `giao_vien` gọi `classSession.list` → OK
- GĐKD lấy được danh sách nhân viên cho màn payroll

**Chạy:**
- `pnpm --filter @cmc/api test` (có `rls-negative.test.ts`, `can-approve.test.ts` — phải còn xanh)
- `pnpm test` toàn bộ
- UAT trình duyệt 3 màn: `/finance/new` (sale), `/teaching/session-assessment` (GV), `/hr/payroll` (GĐKD)

## Success Criteria

- [ ] `class.read` tồn tại, cấp cho 4 vai; `class.create` vẫn chỉ GĐĐT (kiểm chứng bằng negative test)
- [ ] `sale` tạo được phiếu thu qua UI `/finance/new` trọn vẹn (chọn được lớp, submit thành công)
- [ ] `giao_vien` chọn được lớp ở `/teaching/session-assessment`, dropdown có option
- [ ] GĐKD thấy danh sách nhân viên ở `/hr/payroll`
- [ ] Ba negative-authz test ở trên đều FORBIDDEN
- [ ] `docs/14` + spec P2-Foundation phản ánh đúng registry mới; comment `class-batch-router.ts:112-114` đã cập nhật
- [ ] `pnpm test` xanh, không test nào bị nới lỏng để pass

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Nới quyền quá tay — sale/GV vô tình tạo/sửa được lớp | **Cao** | Chỉ đổi 4 procedure đọc; 3 negative-authz test bắt buộc; review diff `packages/auth` kỹ |
| `user.read` (hướng a) lộ PII nhân sự cho 2 vai giám đốc | Trung bình | Ưu tiên hướng (b) — procedure hẹp 4 field. Nếu chọn (a) phải ghi lý do chấp nhận |
| RLS/facility-scope bị ảnh hưởng khi đổi permission | Trung bình | `class.read` chỉ đổi tầng permission, không đụng `scoped()`/`withFacility`; chạy `rls-negative.test.ts` để xác nhận |
| Sửa comment/doc không khớp code sau này | Thấp | Bước 4 và 6 nằm trong success criteria, không phải việc phụ |
