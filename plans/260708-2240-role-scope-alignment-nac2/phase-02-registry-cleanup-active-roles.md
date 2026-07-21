---
phase: 2
title: "Registry-Cleanup-Active-Roles"
status: done
effort: "0.5d"
priority: P1
dependencies: [1]
---

# Phase 2: Registry-Cleanup-Active-Roles

## Overview

Làm xanh nhóm test đỏ của Phase 1: thêm `ACTIVE_ROLES` + type `ActiveRole` vào `@cmc/auth`,
xóa 4 role gác khỏi mọi mảng `PERMISSIONS`, siết kiểu để TS chặn tái nhập role gác. Sửa các
test fixture hiện hữu dùng role gác làm case dương.

## Requirements

- Functional: registry chỉ chứa role active; `ROLES` (9) giữ nguyên — drift-test enum↔TS không đổi.
- Non-functional: compile-time enforcement — `PERMISSIONS` typed bằng `ActiveRole`, thêm role gác
  vào mảng là lỗi typecheck, không chỉ lỗi test.

## Architecture

```ts
// packages/auth/src/index.ts
/** 9 giá trị enum DB (drift-test) — KHÔNG phải danh sách role vận hành. */
export const ROLES = [...] as const;                    // giữ nguyên 9

/** ADR-D (amendment 2026-07-08): 5 role thật đang vận hành. Role ngoài danh
 *  sách này là giá trị enum trơ — không quyền, không gán được. Bật lại =
 *  thêm vào đây + quyền + UI + ADR mới. */
export const ACTIVE_ROLES = [
  'super_admin', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien',
] as const;
export type ActiveRole = (typeof ACTIVE_ROLES)[number];

export const PERMISSIONS: Record<string, readonly ActiveRole[]> = { ... };
```

> [RED-TEAM 2026-07-08 — CRITICAL fix] Narrowing kiểu `PERMISSIONS` làm CHÍNH `can()` fail
> typecheck: `index.ts:191` `allowedRoles.includes(role)` nhận `role: Role` (union 9) vào mảng
> `ActiveRole` → TS2345. `can()` PHẢI sửa kèm (1 dòng, widening cast — an toàn vì chỉ nới kiểu
> đọc, không nới quyền): `(allowedRoles as readonly Role[]).includes(role)`. Liệt kê `can()`
> là site sửa; bỏ khẳng định cũ "can() giữ nguyên". Signature public không đổi.

`AuthSubject.roles: readonly Role[]` giữ nguyên — user có thể *mang* giá trị enum bất kỳ trong
DB cũ, nhưng role gác không match roster nào → tự động denied.

> [RED-TEAM] Định vị lớp chặn đúng: **invariant test `PERMISSIONS ⊆ ACTIVE_ROLES` + registry là
> boundary thật** (deny-safe với mọi đường ghi roles). Zod ở Phase 3 chỉ là defense-in-depth cho
> endpoint `updateRoles` — các writer khác bypass zod (vd `scripts/seed-super-admin.ts:54,63` ghi
> Prisma thô; DB enum vẫn nhận 9 giá trị by design).

## Related Code Files

- Modify: `packages/auth/src/index.ts` (ACTIVE_ROLES + xóa role gác khỏi ~15 mảng theo bảng Phase 1;
  **kèm `can()` dòng 191 — widening cast, xem RED-TEAM note trên**)
- Modify: `packages/auth/src/index.test.ts` (fixture `['cskh','sale']` dòng 44 → `['sale']` cho sạch
  ngữ nghĩa — assertion vốn pass qua sale; invariant test đổi hardcode → import ACTIVE_ROLES)
- Modify: `apps/e2e/tests/finance-approval.spec.ts:135-153` [RED-TEAM] — test "over-threshold blocked
  for ke_toan" hiện đi qua nhánh SECOND_EYE vì ke_toan có receiptApprove; sau cleanup sẽ pass VÌ LÝ
  DO SAI (chặn sớm ở permission gate) → mất coverage second-eye. Đổi fixture sang
  `giam_doc_kinh_doanh` (active, có receiptApprove, KHÔNG thuộc SECOND_EYE_ROLES) + đổi tên test.
- Modify: `apps/api/src/finance/router.ts:561` (comment nhắc ke_toan trong roster — cập nhật)
- Verify không đổi: `apps/api/src/user/role-drift.test.ts` (ROLES vẫn 9 = enum DB)
- Verify vẫn pass: `apps/api/src/crm/list.test.ts`, `guardian/link.test.ts`,
  `guardian/pending-links.test.ts`, `after-sale/after-sale.test.ts`, `student/lookup.test.ts`
  (các fixture `roles:['hr']`/`['cskh']` là case ÂM — sau cleanup vẫn denied, kỳ vọng không đổi;
  nếu file nào assert role gác được PHÉP → sửa assertion theo roster mới, ghi vào report)

## Implementation Steps

1. Thêm `ACTIVE_ROLES`/`ActiveRole` export; đổi kiểu `PERMISSIONS` sang `readonly ActiveRole[]`.
2. Xóa `ke_toan`/`cskh`/`ctv_mkt`/`hr` khỏi mọi mảng — đúng theo bảng Architecture Phase 1
   (typecheck sẽ tự chỉ điểm mọi chỗ sót).
3. Cập nhật comment trong index.ts còn nhắc role gác trong roster (receiptApprove, receiptList,
   parentAccount.updateEmail, checkIn.punch, kpi/gift/shift blocks...) — mô tả roster mới, giữ
   rationale SoD/ADR-B.
4. [RED-TEAM sửa — instruction cũ trỏ test không tồn tại] `index.test.ts` KHÔNG có case cskh-positive
   trên `crm.opportunityList`. Case thật cần đụng: dòng 44 `['cskh','sale']` trên `finance.receiptCreate`
   (pass qua sale — refixture `['sale']`); các case hr/cskh negative (:59-61, :67-70) giữ nguyên.
   Expected-RED của Phase 1 tính lại theo hiện trạng này (≈0 case active phải sửa).
5. Chạy `pnpm --filter @cmc/auth test` → toàn bộ Phase 1 matrix + denial + invariant XANH.
6. Chạy full `pnpm typecheck && pnpm test` — sửa test app nào đỏ vì fixture role gác
   (chỉ đổi fixture/assertion, KHÔNG đổi hành vi code app; liệt kê file đổi vào report).

## Success Criteria

- [ ] `grep -n "ke_toan\|cskh\|ctv_mkt\|'hr'" packages/auth/src/index.ts` chỉ còn trong `ROLES` (9)
- [ ] Toàn bộ test Phase 1 xanh (matrix + deferred-denial + invariant)
- [ ] `role-drift.test.ts` pass không sửa
- [ ] Typecheck toàn repo xanh (PERMISSIONS kiểu ActiveRole)
- [ ] Full test suite xanh; mọi fixture sửa được liệt kê trong report phase

## Risk Assessment

- **Rơi quyền active do xóa nhầm** → ma trận Phase 1 chặn (viết trước trên registry cũ).
- **Test app dùng role gác làm positive ở chỗ chưa quét ra** → full suite bước 6 bắt; chỉ sửa
  fixture, hành vi app giữ nguyên.
- **User DB đang mang role gác** → [RED-TEAM nâng cấp] đây là **HARD PRECONDITION của phase này**,
  không phải checkbox Phase 4: verify `SELECT id, roles FROM "AppUser"` = 0 user mang role gác
  TRƯỚC khi bắt đầu; nếu có → dừng, hỏi PO (stop-condition). Lưu ý TOCTOU: `updateRoles` vẫn nhận
  9 role tới khi Phase 3 land → **land cả 4 phase trong MỘT PR** để đóng cửa sổ gán; re-run query
  lần cuối ngay trước merge (Phase 4 step 5).
- Rollback: revert 2 file chính (`index.ts`, `index.test.ts`) + fixture; không có migration.
