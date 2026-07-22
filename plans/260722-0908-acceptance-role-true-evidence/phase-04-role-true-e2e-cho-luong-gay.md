---
phase: 4
title: "Role-true e2e cho luong gay"
status: pending
priority: P1
dependencies: [2]
---

# Phase 4: Role-true e2e cho luồng gãy

## Overview

Phase 2 gỡ lỗi. Phase này dựng lưới để lỗi cùng loại không quay lại: e2e đi trọn luồng bằng **một vai duy nhất**, không bắc cầu dữ liệu giữa các vai.

Đây là phase trực tiếp trả lời câu hỏi mà không tầng nào của dự án từng hỏi: *"vai X, chỉ với quyền của X, có làm nổi việc Y không?"*

## Requirements

**Functional**
- Spec cho P1-02: một phiên `sale` đi từ cơ hội → chọn lớp → tạo phiếu thu, **không** nhận id từ vai khác.
- Spec cho P2-07: một phiên `giao_vien` chọn lớp → chọn buổi → nhận xét.
- Spec cho P3-05: một phiên `giam_doc_kinh_doanh` mở màn chốt lương, thấy danh sách nhân viên.

**Non-functional**
- Auth qua signed cookie (Mode-B), không `x-dev-user` — theo tiền lệ plan `260720-1230`.
- Không dùng `super_admin` ở bất kỳ bước nào của 3 spec này.

## Architecture

**Phản-mẫu cần loại bỏ** (`apps/e2e/tests/enrollment.spec.ts:45,66`):

```js
const classBatch = await gddt.classBatch.create.mutate({...});   // vai A tạo
...
const receiptResult = await sale.finance.receiptCreate.mutate({  // vai B dùng
  classBatchId: classBatch.id,                                    // ← bắc cầu qua biến JS
```

Test pass vì `classBatch.id` đi qua bộ nhớ của test. Người dùng thật không có đường đó — đúng chỗ F1 ẩn nấp suốt 2 tuần.

**Mẫu đúng:** dữ liệu nền (lớp học) do vai có quyền tạo dựng trong `beforeAll` là chấp nhận được — đó là tiền đề nghiệp vụ có thật (GĐĐT mở lớp trước, sale bán sau). Điều **cấm** là vai đang được kiểm tra nhận id qua biến; nó phải **tự tìm ra** id đó qua chính API/UI mà quyền của nó cho phép:

```js
// beforeAll: GĐĐT mở lớp (tiền đề nghiệp vụ thật)
// test: phiên sale — phải tự gọi classBatch.list để thấy lớp,
//        rồi mới tạo phiếu. Không đọc biến classBatch.id từ scope ngoài.
```

Ranh giới này là **hạt nhân của cả plan** — viết sai thì spec lại xanh giả.

## Related Code Files

- Create: `apps/e2e/tests/p1-02-role-true-receipt.spec.ts`
- Create: `apps/e2e/tests/p2-07-role-true-assessment.spec.ts`
- Create/Modify: spec cho P3-05 (có thể gộp vào file HR sẵn có)
- Read-only tham chiếu: `apps/e2e/src/session-injection.ts` (`mintStaffCookie`), `apps/e2e/src/trpc-client.ts` (`createSignedStaffClient`), `apps/e2e/tests/enrollment.spec.ts` (phản-mẫu)
- Có thể Modify: `apps/e2e/tests/enrollment.spec.ts` — bổ sung ghi chú vì sao nó **không** phải bằng chứng đúng vai (không xoá, nó vẫn có giá trị kiểm tra tích hợp)

## Implementation Steps

1. Viết spec P1-02: `beforeAll` GĐĐT tạo course + classBatch. Trong `test`, client `sale`:
   - gọi `crm.opportunityCreate` → `opportunityAdvance` tới O4
   - gọi `classBatch.list` **bằng chính quyền sale** → lấy id từ kết quả trả về (đây là bước sẽ đỏ nếu Phase 2 chưa xong hoặc bị hoàn tác)
   - gọi `finance.receiptCreate` với id vừa tìm được
   - khẳng định phiếu tồn tại trong DB, đúng facility
2. Viết spec P2-07: `beforeAll` GĐĐT tạo lớp + buổi. Trong `test`, client `giao_vien`:
   - `classBatch.list` → `classSession.list` → `attendance.listBySession` → `assessment.draftComment`/`confirm`
   - Mỗi bước phải chạy được bằng quyền GV, không mượn vai khác
3. Viết spec P3-05: client GĐKD mở được dữ liệu nhân sự cần cho chốt lương.
4. **Negative-authz đi kèm** (bắt buộc cho luồng có mutation đặc quyền): `sale` gọi `finance.receiptApprove` → FORBIDDEN; `giao_vien` gọi `classBatch.create` → FORBIDDEN.
5. Chạy đủ 2 chế độ: `pnpm --filter @cmc/e2e test` (API) và `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`.

## Test / Validation

- **Falsification test (quan trọng nhất):** tạm hoàn tác `class.read` của Phase 2 → 2 spec mới phải **đỏ**. Nếu chúng vẫn xanh thì spec đang bắc cầu ở đâu đó và **toàn bộ phase này vô giá trị**; phải sửa lại spec trước khi đi tiếp.
- Grep tự kiểm: trong 3 spec mới, không có id nào được gán từ kết quả của client vai khác rồi truyền thẳng vào mutation của vai đang kiểm tra.
- Chạy `--project=ui-chromium` **riêng** (không chạy chung) để tránh đỏ giả do dùng chung DB.

## Success Criteria

- [ ] 3 spec mới xanh sau Phase 2
- [ ] **Falsification test đạt**: hoàn tác `class.read` làm 2 spec đỏ đúng như dự đoán
- [ ] Không spec nào trong 3 file dùng `super_admin`
- [ ] Negative-authz: `sale` không duyệt được phiếu, `giao_vien` không tạo được lớp
- [ ] Không có id bắc cầu giữa vai đang kiểm tra và vai khác
- [ ] Cả 2 chế độ chạy (api, ui-chromium) đều xanh khi chạy riêng

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Spec mới vô tình vẫn bắc cầu → xanh giả, phase mất hết giá trị | **Cao** | Falsification test là tiêu chí bắt buộc, không phải tuỳ chọn; grep tự kiểm |
| Ranh giới "tiền đề nghiệp vụ" bị nới dần thành bắc cầu | Cao | Viết rõ quy tắc trong comment đầu mỗi spec; Phase 5 biến nó thành gate tự động |
| Chạy chung 2 project gây đỏ giả, tốn thời gian truy lỗi sai chỗ | Trung bình | Ghi rõ lệnh đúng trong spec header và trong `plan.md` |
| Dữ liệu tồn dư giữa các lần chạy trên DB dùng chung | Trung bình | Mỗi run một facility riêng (mẫu `global-setup.ts` đã có), teardown đúng |
