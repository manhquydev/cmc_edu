---
phase: 1
title: "Nhip A - quyen doc lop (TDD)"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Quyền đọc lớp (TDD)

## Overview

Tách quyền **đọc** danh sách lớp khỏi quyền **tạo** lớp. Một thay đổi này gỡ cả F1 (luồng tiền) lẫn F2 (màn nhận xét của GV).

## Requirements

**Functional**
- `class.read` cấp cho `sale`, `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `giao_vien` — dùng cho `classBatch.list/get` + `classSession.list`.
- **`classRoster.read` cấp cho `giao_vien`, `giam_doc_dao_tao`** — chỉ cho `classBatch.listStudents` (trả `fullName` trẻ em). Sale/GĐKD **không** có (Q3′).
- 2 procedure **ghi** giữ `class.create`.

**Non-functional (ràng buộc cứng)**
- `class.create` **vẫn chỉ** `giam_doc_dao_tao` (Q5).
- ADR-B nguyên vẹn: `finance.receiptCreate` không cấp cho GĐĐT (Q4).
- Không hạ bất kỳ money-gate nào (`receiptApprove`, `refundCreate`, `payslip.finalize`).
- **Tách `classRoster.read`** (Q3′) — `listStudents` trả `fullName` trẻ em nên không đi chung với quyền đọc danh sách lớp. Đo thực tế: chỉ 2 màn dùng nó, sale không dùng màn nào ⇒ tách không mất chức năng.

## Architecture

Nguyên nhân gốc, `class-batch-router.ts:112-114` tự khai:

> *"Registry has only 4 P2-Foundation entries (course.manage, room.manage, class.create, schedule.generate) — list/get reuse `class.create` rather than inventing a 5th read-only permission the spec does not name."*

Cố ý và có lý do (bám spec), nhưng hệ quả là **quyền đọc bị buộc vào quyền ghi**.

| Procedure | Vị trí | Sau khi sửa |
|---|---|---|
| `classBatch.create` | `class-batch-router.ts:115` | **giữ** `class.create` |
| `classBatch.list` | `:229` | → `class.read` |
| `classBatch.listStudents` | `:254` | → **`classRoster.read`** (chỉ GV + GĐĐT — Q3′) |
| `classBatch.get` | `:283` | → `class.read` |
| `classBatch.assignTeacher` | `:300` | **giữ** `class.create` |
| `classSession.list` | `class-session-router.ts:84` | → `class.read` |

## Related Code Files

- Modify: `packages/auth/src/index.ts` — thêm `'class.read': [...]`
- Modify: `apps/api/src/class/class-batch-router.ts` (3 procedure đọc)
- Modify: `apps/api/src/class/class-session-router.ts:84`
- Modify: `packages/auth/src/index.test.ts` — `ACTIVE_ROLE_MATRIX`
- Modify: `docs/14-danh-muc-vai-tro-phan-quyen.md`
- Modify: comment `class-batch-router.ts:112-114` (đang khai quyết định vừa bị đảo)
- **Rà (có thể Modify):** `apps/admin/src/pages/cockpit.tsx:210` — gate **phía client** `canDo('class','create')` bọc `TodaySchedulePanel` (panel gọi `classBatch.list`). Sau Phase 1, quyền đọc đã mở nhưng gate client vẫn đòi `class.create` nên 4 vai mới vẫn không thấy panel. Quyết định: đổi sang quyền đọc, hay giữ có chủ đích — ghi lý do.
- **Rà:** 28 call site `canDo()` khác trong `apps/admin/src/pages/**` — tìm chỗ cũng gate bằng `class.create` cho hành vi chỉ-đọc

## Blast radius — consumer của 4 procedure đổi quyền

Đo trực tiếp (grep `trpc.<proc>.` trong `apps/` + `packages/`, loại node_modules). **10 màn** bị ảnh hưởng, không phải 3:

| Procedure | Màn tiêu thụ |
|---|---|
| `classBatch.list` (7) | `finance/receipt-create.tsx` **(F1)**, `teaching/session-assessment.tsx` **(F2)**, `teaching/session-evidence.tsx`, `teaching/schedule.tsx`, `enrollment/class-placement.tsx`, `cockpit.tsx`, `classes/index.tsx` |
| `classBatch.get` (1) | `classes/class-detail.tsx` |
| `classBatch.listStudents` (2) | `teaching/session-assessment.tsx`, `classes/class-detail.tsx` |
| `classSession.list` (3) | `teaching/session-evidence.tsx`, `teaching/session-assessment.tsx`, `classes/class-detail.tsx` |

**Hệ quả cần lưu ý khi thực thi:**
- `teaching/session-evidence.tsx` và `teaching/schedule.tsx` **hỏng cùng kiểu F2** nhưng chưa từng được nêu tên trong bảng phát hiện — Phase 1 sẽ gỡ chúng luôn, cần UAT cả hai để xác nhận (chúng cũng nằm trong 8 nav entry không gate ở Phase 2).
- `enrollment/class-placement.tsx` và `classes/class-detail.tsx` **không có nav entry** — chỉ ma trận route-tree của Phase 5 mới chạm tới, nav-based thì không.
- `cockpit.tsx` còn gate `canDo` phía client (xem mục trên) nên gỡ quyền API là **chưa đủ** cho màn đó.

## Implementation Steps

**TDD — viết test TRƯỚC khi đụng registry.**

1. **Viết test đỏ trước** (đây là bước chống nới quyền quá tay, không phải thủ tục):
   - Negative: `sale` → `classBatch.create` FORBIDDEN; `giao_vien` → `classBatch.assignTeacher` FORBIDDEN; `giam_doc_dao_tao` → `finance.receiptCreate` FORBIDDEN; **`sale` → `classBatch.listStudents` FORBIDDEN** (Q3′ — đóng đường rò tên trẻ em)
   - Positive (đỏ ở bước này): `sale` → `classBatch.list` OK; `giao_vien` → `classSession.list` OK
   - Chạy → negative phải **xanh sẵn**, positive phải **đỏ**. Nếu negative đỏ ngay từ đầu thì giả định về registry sai, dừng lại xét lại.
2. Chạy `gitnexus_impact({target: "classBatchRouter", direction: "upstream"})` và tương tự cho `classSessionRouter` — báo blast radius, dừng hỏi nếu HIGH/CRITICAL (bắt buộc theo `CLAUDE.md`).
3. Thêm vào `PERMISSIONS`: `'class.read': ['giam_doc_kinh_doanh','giam_doc_dao_tao','sale','giao_vien']` **và** `'classRoster.read': ['giao_vien','giam_doc_dao_tao']`. **Không** đụng `'class.create'`.
4. Đổi `classBatch.list`/`get` + `classSession.list` sang `class.read`; `classBatch.listStudents` sang **`classRoster.read`**. Giữ `create`/`assignTeacher` ở `class.create`.
5. Chạy lại test → cả negative lẫn positive phải xanh.
5b. ⚠️ **`pnpm --filter @cmc/auth build` — bắt buộc trước khi probe live.** Vitest alias `@cmc/auth` thẳng vào **source** (`apps/api/vitest.config.ts:5-7` nói rõ: *"Runtime/build resolution still uses the packages' compiled `dist` output via their `exports` map"*), còn server chạy bằng `tsx` đọc `dist/index.js` — mà `dist/` bị gitignore (`.gitignore:24`) và task `dev` trong `turbo.json` **không** có `dependsOn: ["^build"]`.
   Bỏ bước này ⇒ **test xanh nhưng probe vẫn FORBIDDEN**, hai tín hiệu mâu thuẫn không lời giải, và phản xạ tự nhiên là nới `class.create` — đúng thứ Q5 cấm.
6. Bổ sung `class.read` vào `ACTIVE_ROLE_MATRIX` (`packages/auth/src/index.test.ts`) — hiện **không có assertion exhaustiveness**, nên quyền mới sẽ land với zero coverage mà CI vẫn xanh (red-team #25).
7. Cập nhật `docs/14` + comment `:112-114`. Để nguyên comment cũ = để lại lời nói dối trong code.

## Test / Validation

- `pnpm --filter @cmc/api test` — phải xanh, đặc biệt `rls-negative.test.ts`, `can-approve.test.ts`.
- `pnpm --filter @cmc/auth test` — `ACTIVE_ROLE_MATRIX` phủ `class.read`.
- `pnpm test` toàn bộ.
- Probe API live 4 vai cho `classBatch.list` (dùng `x-dev-user`, server dev) — đối chiếu kỳ vọng.
- **KHÔNG chạy e2e ở phase này** (xem Phase 4).

## Success Criteria

- [ ] Test negative-authz viết **trước** và xanh: `sale` không tạo được lớp, `giao_vien` không gán được GV, `GĐĐT` không tạo được phiếu thu
- [ ] `sale` gọi `classBatch.list` → OK; `giao_vien` gọi `classSession.list` → OK
- [ ] `class.create` vẫn chỉ `giam_doc_dao_tao` (kiểm bằng test, không bằng đọc code)
- [ ] **`sale` gọi `classBatch.listStudents` → FORBIDDEN** (Q3′ — bằng test, không bằng đọc code)
- [ ] `ACTIVE_ROLE_MATRIX` phủ `class.read`
- [ ] `docs/14` + comment `:112-114` phản ánh registry mới
- [ ] `pnpm test` xanh, không test nào bị nới lỏng để pass

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Nới quyền quá tay — sale/GV vô tình tạo/sửa được lớp | **Cao** | Test negative viết trước (bước 1); chỉ đổi 4 procedure đọc; review diff `packages/auth` kỹ |
| ~~PII trẻ em: sale đọc được roster mọi lớp~~ | **ĐÃ ĐÓNG (Q3′)** | `listStudents` chuyển sang `classRoster.read`, sale/GĐKD không có. Đóng ở **tầng API**, không phụ thuộc lớp client |
| GV đọc roster ngoài lớp mình dạy (rộng hơn `assert-teacher-owns-class.ts`) | Trung bình — **còn lại** | GV vốn cần roster để dạy; phạm vi hẹp hơn nhiều so với trước. Siết theo lớp được phân công là việc riêng nếu có yêu cầu tuân thủ |
| RLS/facility-scope bị ảnh hưởng | Trung bình | Chỉ đổi tầng permission, không đụng `scoped()`/`withFacility`; `rls-negative.test.ts` xác nhận |
