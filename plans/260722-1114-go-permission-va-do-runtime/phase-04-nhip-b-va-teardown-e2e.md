---
phase: 4
title: "Nhip B - va teardown e2e"
status: completed
priority: P1
dependencies: []
---

# Phase 4: Vá teardown e2e

## Overview

☢️ **Tiền đề bắt buộc trước mọi e2e mới.** `cleanupFacility` trên `main` không xoá `QualitativeAssessment`, `SessionEvidence` và một loạt bảng khác. FK `studentId` là required với `onDelete: Restrict` ⇒ `student.deleteMany` ném lỗi ⇒ teardown re-throw ⇒ **rò nguyên một facility trên `cmc_edu` mỗi lần chạy**, vĩnh viễn. DB này dùng chung giữa các phiên và agent.

Không phase nào sau đây được chạy e2e trước khi phase này xong.

## Requirements

**Functional**
- `cleanupFacility` xoá hết mọi bảng con của một facility.
- Có **residue guard**: teardown còn sót row thì **ném lỗi to**, không im lặng.
- ⚠️ **Thứ tự bắt buộc: xoá facility TRƯỚC, đếm residue SAU, rồi mới ném.** Đặt guard trước `facility.deleteMany` (`db.ts:190`) thì guard ném ⇒ facility **không bao giờ bị xoá** ⇒ mọi lần chạy sau vừa đỏ vừa rò — biến rò mềm thành rò vĩnh viễn.

**Non-functional**
- 🔴 **BẮT BUỘC TRƯỚC MỌI VIỆC KHÁC — guard `DATABASE_URL`.**
  `assertNotProdDatabase` hiện **chỉ** được gọi trên `APP_DATABASE_URL` (`global-setup.ts:81`). Nhưng toàn bộ khối xoá destructive chạy trên `getPrivilegedDb()`, đọc **thẳng** `process.env.DATABASE_URL` **không guard gì cả** (`apps/e2e/src/db.ts:36-40`). Phase này thêm ~12 `deleteMany` nữa vào đúng đường đó.
  **Kịch bản mất dữ liệu thật:** dev trỏ `APP_DATABASE_URL` sang `cmc_edu` (guard pass) trong khi `DATABASE_URL` còn sót URL migration-owner của `cmc_prod` từ phiên migrate ⇒ teardown xoá `attendance`, `payslip`, `timePunch`, `appUser`, `refundRecord` **thật** — dữ liệu trẻ em.
  **Việc phải làm:** gọi `assertNotProdDatabase(process.env.DATABASE_URL)` **bên trong `getPrivilegedDb()`** (không chỉ ở `global-setup`), để mọi đường vào connection đặc quyền đều bị canh. Đây là tiền đề của tiền đề — làm trước cả việc cherry-pick `cleanupFacility`.
- Không đụng `cmc_prod`.
- Thứ tự xoá theo FK graph (con trước cha) — mẫu đã có trong file.

## Architecture

Bản vá **đã tồn tại** trên branch `test/independent-runtime-verification-38-flows` (đã xác minh bằng `git diff main...branch -- apps/e2e/src/db.ts`): thêm `deleteMany` cho `reconciliationFlag`, `afterSaleCase`, `parentMeeting`, `testAppointment`, `reward`, `gift`, `kpiScore`, `payslip`, `qualitativeAssessment`, `sessionEvidence`, `sessionEvidencePhoto`, `refundRecord`, kèm residue-count guard.

Phía API **đã có** bản đúng (`apps/api/src/test/db.ts:160`) — chính vì thế không ai để ý phía e2e thiếu.

**Cherry-pick, không merge cả branch.** Merge cả branch kéo theo 5 commit đụng `verify.ts`/`types.ts` — ngoài scope đợt này.

## Related Code Files

- Modify: `apps/e2e/src/db.ts` — **`getPrivilegedDb()` thêm guard `DATABASE_URL`** (ưu tiên 1) + `cleanupFacility` + residue guard
- Read-only tham chiếu: `apps/api/src/test/db.ts:160`, `packages/db/prisma/schema.prisma` (FK graph)

## Implementation Steps

1. Trích bản vá: `git show test/independent-runtime-verification-38-flows:apps/e2e/src/db.ts` — đọc, đối chiếu với bản `main`, lấy phần `cleanupFacility` + residue guard. Không lấy phần khác của branch.
2. Áp vào `apps/e2e/src/db.ts`. Kiểm thứ tự xoá khớp FK graph hiện tại của `schema.prisma` (branch tạo lúc schema có thể khác — **đừng chép mù**).
3. Chạy một spec e2e sẵn có (không phải spec mới) → teardown xanh, residue guard không kêu.
4. **Dọn rác đã rò từ trước** (nếu có): lọc theo **prefix tên `E2E Run `** (`global-setup.ts:116` đặt tên facility là `E2E Run ${new Date().toISOString()}`), **không** lọc theo "còn row con hay không" — một facility bị lột nửa vời do lỗi giữa chuỗi trông y hệt facility lành. **Prefix một mình KHÔNG đủ** — nó không phân biệt facility rò với facility của **run đang chạy** trên cùng `cmc_edu` (agent khác có thể đang test). Phải kèm điều kiện **`createdAt` cũ hơn vài giờ**. Ngược lại, rác từ API integration test **vô hình** với filter này vì `apps/api/src/test/db.ts:90` đặt `name` tuỳ ý — ghi nhận là giới hạn đã biết, không cố xoá mù. Liệt kê ra trước, xác nhận, rồi mới xoá. Ghi số lượng vào báo cáo phase.

## Test / Validation

- Chạy `pnpm --filter @cmc/e2e test` (project `api`) → xanh, không sót facility.
- **Falsification:** tạm bỏ một `deleteMany` khỏi `cleanupFacility` → residue guard phải **ném lỗi**; hoàn nguyên. Không có bước này thì không biết guard có thật sự hoạt động.
- Đếm facility trong `cmc_edu` trước/sau một lần chạy → bằng nhau.

## Success Criteria

- [ ] 🔴 `assertNotProdDatabase` được gọi **bên trong `getPrivilegedDb()`** trên `DATABASE_URL`; falsification: trỏ `DATABASE_URL` sang tên chứa `cmc_prod` → phải ném **trước** khi bất kỳ `deleteMany` nào chạy
- [ ] `cleanupFacility` xoá hết bảng con; thứ tự khớp FK graph **hiện tại**, không chép mù từ branch
- [ ] Residue guard hoạt động (đã chứng minh bằng falsification test)
- [ ] Chạy e2e không làm tăng số facility trong `cmc_edu`
- [ ] Rác cũ (nếu có) đã dọn, số lượng ghi lại
- [ ] Không kéo theo thay đổi nào khác từ branch

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Chép mù thứ tự xoá từ branch trong khi schema đã đổi | **Cao** | Bước 2 bắt buộc đối chiếu `schema.prisma` hiện tại |
| Dọn rác cũ xoá nhầm facility đang dùng | **Cao** | Chỉ xoá facility có tên/prefix e2e; liệt kê ra trước, xác nhận rồi mới xoá; **tuyệt đối không chạy trên `cmc_prod`** |
| Cherry-pick kéo theo phần khác của branch | Trung bình | Chỉ lấy `cleanupFacility` + guard; diff lại trước khi commit |
| **Teardown không atomic**: chuỗi `deleteMany` privileged chạy **ngoài** transaction (`db.ts:128-143`), lỗi giữa chừng để lại facility bị lột nửa vời | **Cao** | Ghi rõ trong phase: lỗi giữa chuỗi là trạng thái đã biết; bước 4 lọc theo prefix tên chứ không theo row con. Cân nhắc bọc toàn chuỗi trong một tx privileged nếu quyền cho phép |
