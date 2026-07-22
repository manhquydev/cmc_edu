---
phase: 5
title: "Cam super_admin trong spec luong"
status: pending
priority: P1
dependencies: [4]
---

# Phase 5: Cấm super_admin trong spec luồng nghiệp vụ

## Overview

Biến bài học đắt nhất của phiên brainstorm thành rào chắn tự động. 35 nhãn `proven` mất giá trị chỉ vì một dòng `roles: ['super_admin']` trong `beforeEach`. Con người và agent đều sẽ lặp lại lựa chọn tiện tay đó nếu không có gate.

Đã có tiền lệ trong repo: plan `260720-1230` cấm `x-dev-user` trong spec bằng guard grep = 0. Phase này áp đúng mẫu ấy cho `super_admin`.

## Requirements

**Functional**
- Guard phát hiện `super_admin` trong spec thuộc luồng nghiệp vụ và fail.
- Cho phép có kiểm soát ở nơi `super_admin` **là** actor thật: các luồng `ADM-*` (`facility.*`, `user.*`, `facilityNetwork.*`, `audit.list`) và bootstrap facility trong `global-setup.ts`.

**Non-functional**
- Chạy được cả local lẫn CI, không phụ thuộc DB.
- Thông báo lỗi phải nói rõ **vì sao** cấm, không chỉ "vi phạm quy tắc" — người gặp lỗi lần đầu cần hiểu ngay.

## Architecture

Ranh giới cho phép/không cho phép:

| Nơi dùng `super_admin` | Phán quyết | Lý do |
|---|---|---|
| `global-setup.ts` bootstrap facility | **Cho phép** | Facility đầu tiên chỉ super_admin tạo được (`trpc.ts` bỏ qua `requireValidFacility`) — không có đường khác |
| Spec luồng `ADM-*` | **Cho phép** | Manifest khai actor là `super_admin`; đó là sự thật nghiệp vụ |
| Spec luồng P1–P4 | **Cấm** | Đây chính là chỗ 35 `proven` mất giá trị |
| `flow-ui-routes.ui.spec.ts` `beforeEach` dùng chung cho mọi flow | **Cấm** | Phải tách auth theo từng flow (việc của Phase 6) |

Cơ chế: script kiểm tra chạy trong `pnpm test`/CI, quét `apps/e2e/tests/**`, đối chiếu flow id mà spec khai (`proveFlow('P1-02')`) với danh sách actor trong manifest. Nếu spec khai flow non-ADMIN mà mint cookie `super_admin` → fail.

**Cách mạnh hơn đáng cân nhắc khi thực thi:** thay vì grep, cho `mintStaffCookie` nhận flow context và tự từ chối `super_admin` cho flow non-ADMIN. Grep dễ bị lách (biến trung gian, mảng động); guard tại điểm cấp cookie thì không. Grep là mức tối thiểu, guard runtime là mức nên nhắm tới.

## Related Code Files

- Create: `scripts/check-e2e-role-discipline.mjs` (hoặc test trong `apps/e2e`)
- Modify: `package.json` — nối guard vào `test` hoặc CI script
- Có thể Modify: `apps/e2e/src/session-injection.ts` — guard runtime tại `mintStaffCookie`
- Read-only: `scripts/acceptance-report/flow-manifest.ts` — nguồn actor hợp lệ per flow

## Implementation Steps

1. Viết guard: quét spec, trích flow id được khai, đối chiếu `actorRoles` trong manifest (Phase 1 đã làm trường này đáng tin).
2. Danh sách ngoại lệ **tường minh**, mỗi mục 1 dòng lý do — dùng đúng văn hoá `INFRA_PROCEDURE_WHITELIST` đã có trong `verify.ts`, kèm liveness guard để ngoại lệ chết không nằm lại.
3. Thông báo lỗi nêu rõ: `super_admin` bypass registry (`packages/auth/src/index.ts:147`) nên bằng chứng thu bằng nó không chứng minh được gì về phân quyền.
4. Cân nhắc nâng lên guard runtime tại `mintStaffCookie` (xem Architecture); nếu chọn, giữ cả hai lớp.
5. Nối vào CI. Quyết định chặn merge hay chỉ cảnh báo — **câu hỏi #3 trong `plan.md`, cần PO**.

## Test / Validation

- **Falsification test:** thêm tạm `roles: ['super_admin']` vào một spec P1 → guard phải fail; hoàn nguyên.
- Guard **không** được fail trên `global-setup.ts` và spec `ADM-*` (kiểm chứng bằng cách chạy trên cây hiện tại sau Phase 4).
- Chạy trên branch `test/independent-runtime-verification-38-flows` → **phải fail** ở `flow-ui-routes.ui.spec.ts`. Đây vừa là test cho guard, vừa là bằng chứng cho Phase 6 rằng branch đó cần sửa.

## Success Criteria

- [ ] Guard fail khi spec luồng P1–P4 dùng `super_admin` (đã kiểm chứng bằng falsification test)
- [ ] Guard không fail oan trên bootstrap và spec `ADM-*`
- [ ] Chạy guard trên branch runtime-verification → fail đúng chỗ đã biết
- [ ] Thông báo lỗi giải thích được lý do, không chỉ báo vi phạm
- [ ] Ngoại lệ có lý do từng dòng + liveness guard
- [ ] Đã nối vào CI (chặn hay cảnh báo — theo quyết định PO)

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Grep bị lách bằng biến trung gian → gate thành hình thức | **Cao** | Cân nhắc guard runtime tại `mintStaffCookie`; grep chỉ là lớp tối thiểu |
| Ngoại lệ phình dần thành cửa sau | Cao | Mỗi ngoại lệ 1 dòng lý do + liveness guard; rà lại ở Phase 6 |
| Fail oan làm team tắt gate | Trung bình | Test không-fail-oan là success criteria; thông báo lỗi rõ ràng |
| Gate chỉ cảnh báo → bị phớt lờ | Trung bình | Đưa quyết định lên PO thay vì tự chọn mức nhẹ |
