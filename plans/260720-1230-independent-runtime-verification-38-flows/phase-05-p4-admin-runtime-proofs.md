---
phase: 5
title: "P4-ADMIN Runtime Proofs"
status: pending
priority: P2
dependencies: [1]
effort: "1.5d"
---

# Phase 5: P4-ADMIN Runtime Proofs

## Overview

Runtime proof cho 10 flows còn lại: P4 (đổi sao, quà, họp PH, test đầu vào, chăm sóc sau bán — 5) + ADMIN (cơ sở, user, mạng IP, audit log, cấu hình ca — 5). <!-- Updated: Red Team R2 - R2-1 --> Signed-auth mode.

## Requirements

- Functional: 10/10 flows có verdict.
- Non-functional: negative-authz theo nguyên tắc rt#10 — KHÔNG blanket mọi ADM flow; chỉ flows có privileged mutation (`rewards.approve`, `user.create/updateRoles`, `compensationPolicy.upsert`, `gift.upsert`) + đại diện 1 CRUD ADM (facility) làm spot-check. Đây là proof "flow chạy", không phải security audit đầy đủ (authz audit toàn diện = plan riêng nếu findings lộ gap).

## Architecture

2 spec cụm + tái dùng `kind-isolation.spec.ts` (đã phủ isolation cross-cutting — cite trong report thay vì viết lại). Mỗi flow 1 `test()` (rt#6). Assert theo ID in-test — AuditLog/StarTransaction là bảng tích tụ (rt#5).

## Related Code Files

- Reuse + annotate (theo matrix): `apps/e2e/tests/kind-isolation.spec.ts`, `admin-shell.ui.spec.ts` (nếu thực phủ ADM nào)
- Create: `apps/e2e/tests/p4-engagement-aftersale.spec.ts` (P4-01…P4-05), `apps/e2e/tests/adm-admin-surface.spec.ts` (ADM-01…ADM-05)
- UI screenshots trong functional UI specs (rt#15)

## Implementation Steps

1. `p4-engagement-aftersale.spec.ts` (serial: P4-02 gift trước P4-01 redeem):
   - P4-02: gift.upsert/list (GĐ). Negative: role thường gọi gift.upsert → chặn.
   - P4-01: rewards.redeem (hoc_vien, đủ/thiếu sao 2 nhánh) → approve → deliver; nhánh reject. Assert số dư sao trước/sau theo StarTransaction ID của test (không đếm global). Negative: hoc_vien gọi rewards.approve → chặn.
   - P4-03: parentMeeting.schedule/complete/cancel.
   - P4-04: testAppointment.schedule/complete/noShow gắn opportunity.
   - P4-05: afterSale.create/advance/resolve/close + student.setLifecycle. (AfterSaleCase teardown — Phase 1 đã phủ, cần privileged DELETE.)
2. `adm-admin-surface.spec.ts` (super_admin; mỗi ADM flow 1 test):
   - ADM-01 facility CRUD (+1 negative spot-check: role thường tạo facility → chặn); ADM-02 user.create/updateRoles trong đúng 5 real roles (role-reality principle) + negative: role thường updateRoles → chặn; ADM-03 facilityNetwork CRUD + detectMyIp; ADM-04 audit.list — assert bản ghi audit sinh ra bởi CHÍNH action của test này (lookup theo entity ID test tạo), không đếm tổng; ADM-05 shift.createGroup/createTemplate + compensationPolicy.upsert + negative: role thường upsert policy → chặn.
3. UI proof + screenshot trong functional UI specs cho uiRoutes claimed P4+ADM.
4. Chạy 1 lần chuẩn; re-run targeted khi flaky.

## Success Criteria

- [ ] 10/10 flows có verdict.
- [ ] Negative-authz pass cho: rewards.approve, gift.upsert, user.updateRoles, compensationPolicy.upsert, facility.create (spot-check).
- [ ] P4-01 số dư sao assert theo transaction ID in-test; ADM-04 assert audit record của chính test run theo entity ID.
- [ ] kind-isolation coverage được cite vào report (không viết lại).

## Risk Assessment

- Negative test lộ lỗ hổng phân quyền thật → verdict `failed` + finding Critical trong report; authz audit toàn diện tách plan riêng — không sa đà tại đây (rt#10).
- P4 bảng bare-facilityId (Gift/ParentMeeting/TestAppointment) — teardown Phase 1 phải phủ trước khi phase này chạy.
