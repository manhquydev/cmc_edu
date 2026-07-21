---
phase: 1
title: "Baseline-Tests-Lock-Active-Matrix"
status: done
effort: "0.5d"
priority: P1
dependencies: []
---

# Phase 1: Baseline-Tests-Lock-Active-Matrix (TDD — tests first)

## Overview

Viết test khoá **ma trận quyền đích** trong `packages/auth/src/index.test.ts` TRƯỚC khi sửa
registry. Test gồm 2 nhóm: (A) hành vi 5 role active — phải xanh NGAY (baseline, chống rơi quyền);
(B) role gác bị từ chối mọi quyền — **đỏ lúc này**, Phase 2 làm xanh. Đây là hợp đồng regression
cho toàn plan.

## Requirements

- Functional: mọi permission key trong `PERMISSIONS` có test roster active; mọi role gác có test
  denial đại diện trên các gate nhạy cảm.
- Non-functional: test thuần unit (`can()`), không cần DB — chạy nhanh, không đụng testDb.

## Architecture

Ma trận đích (registry sau cleanup — chỉ liệt kê key ĐỔI roster; key không đổi vẫn cần test active):

| Permission key | Roster đích (bỏ role gác) | Bị bỏ |
|---|---|---|
| `crm.opportunityList` | gdkd, sale | cskh, ctv_mkt |
| `crm.opportunityLookup` | gdkd, sale | ke_toan |
| `finance.receiptCreate` | gdkd, sale | ke_toan |
| `finance.receiptApprove` | gdkd, gddt | ke_toan |
| `finance.refundCreate` | gdkd | ke_toan |
| `finance.receiptList` / `receiptGet` | gdkd, gddt | ke_toan |
| `guardian.approveLink` / `listPendingLinks` | gdkd, gddt, sale, giao_vien | cskh |
| `student.lookup` | gdkd, gddt, sale, giao_vien | ke_toan |
| `parentAccount.updateEmail` | gdkd, sale | cskh, ke_toan |
| `checkIn.punch` / `manualPunch.create` | gdkd, gddt, sale, giao_vien | ke_toan, cskh, ctv_mkt, hr |
| `shift.submit` | gddt, gdkd, giao_vien, sale | hr |
| `kpi.submit` | giao_vien, sale, gddt, gdkd | hr |
| `gift.list` / `rewards.manage` / `parentMeeting.manage` / `testAppointment.manage` | gdkd, gddt, sale | hr |

(gdkd = giam_doc_kinh_doanh, gddt = giam_doc_dao_tao. Các key còn lại: roster không đổi.)

Bất biến SoD giữ nguyên: `sale` KHÔNG có `finance.receiptApprove`/`receiptList`/`receiptGet`;
sale tạo nháp ≠ GĐKD/GĐĐT duyệt (ADR-B).

> [RED-TEAM 2026-07-08] Giới hạn phạm vi ma trận: `SECOND_EYE_ROLES` (`apps/api/src/finance/router.ts:41`
> — gate duyệt vượt ngưỡng, chỉ gddt+super_admin) là gate NGOÀI registry, ma trận `can()` này không
> phủ; đã có test riêng (`finance/approve.test.ts:191,206`, `can-approve.test.ts:83-96`). Không chứa
> role gác — cleanup không ảnh hưởng, nhưng đừng suy diễn "ma trận Phase 1 = toàn bộ hành vi finance".

## Related Code Files

- Modify: `packages/auth/src/index.test.ts` (thêm describe block ma trận)

## Implementation Steps

1. Thêm describe `active-role matrix (ADR-D amendment)` vào `packages/auth/src/index.test.ts`:
   - Data-driven: bảng `{key, allowed: ActiveRole[]}` cho TOÀN BỘ key trong `PERMISSIONS`
     (chép roster hiện tại trừ role gác — theo bảng Architecture trên).
   - Với mỗi key: assert `can()` true cho từng role trong `allowed`, false cho các role active
     còn lại. [RED-TEAM] LOẠI `super_admin` khỏi vòng assert-false trên MỌI key — bypass trả true
     kể cả key roster rỗng (`facility.create`/`user.manage`... = `[]`, `index.ts:79,125-126,186`);
     thêm 1 case tường minh: super_admin true trên cả key roster rỗng.
2. Thêm describe `deferred roles are denied everywhere` (RED lúc này):
   - Với mỗi role gác × mỗi key trong `PERMISSIONS`: `can({roles:[gác]}) === false`.
   - Viết dạng vòng lặp qua `Object.keys(PERMISSIONS)` — tự phủ key thêm sau này.
3. Thêm invariant test (RED lúc này): mọi mảng trong `PERMISSIONS` ⊆ 5 role active
   (hardcode danh sách 5 role trong test — Phase 2 mới export `ACTIVE_ROLES`, test này đổi
   sang import khi constant tồn tại).
4. Chạy `pnpm --filter @cmc/auth test`: nhóm A xanh 100% (nếu đỏ → roster đích sai, sửa bảng
   Architecture + báo lại, KHÔNG sửa registry ở phase này); nhóm B + invariant đỏ đúng kỳ vọng.
5. Commit riêng phase này (test-first, đỏ có chủ đích — ghi rõ trong message `test(auth):`).

## Success Criteria

- [ ] Nhóm A (active matrix) pass trên registry HIỆN TẠI — chứng minh không đổi hành vi active
- [ ] Nhóm B (deferred denial) + invariant fail đúng các key dự kiến (đối chiếu bảng Architecture)
- [ ] Test thuần `can()`, không phụ thuộc DB
- [ ] `sale` denial trên money-gate keys có test tường minh (SoD)

## Risk Assessment

- **Roster đích chép sai** → nhóm A đỏ ngay, phát hiện sớm (đó là mục đích TDD ở đây).
- **Bảng thiếu key mới thêm sau** → vòng lặp `Object.keys(PERMISSIONS)` + invariant test phủ.
- Rollback: revert 1 file test.
