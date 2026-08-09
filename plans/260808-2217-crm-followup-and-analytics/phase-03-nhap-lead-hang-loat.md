---
phase: 3
title: "P3 — Nhập lead hàng loạt"
status: pending
priority: P2
effort: "3-4d"
dependencies: []
---

# Phase 03 — P3: Nhập lead hàng loạt

## Overview
Cho phép tư vấn viên nhập một danh sách lead cùng lúc (dán text/CSV) thay vì gõ tay từng người, có bước xem trước và chống trùng ở mức cơ hội.

## Giá trị nghiệp vụ (cho người nghiệm thu)
- Lead vào theo lô (hội thảo/fanpage) được nhập nhanh, không nghẽn.
- Chống trùng tự động khi nhập lô nhiều bản ghi.

## Nghiệm thu tính năng (điều kiện chấp nhận — demo được ngay)
- [ ] Dán danh sách N người → hệ thống hiện **xem trước**: sẽ tạo bao nhiêu, bỏ trùng bao nhiêu, lỗi bao nhiêu (dòng nào, vì sao).
- [ ] Xác nhận → tạo đúng số cơ hội mới ở bước "Mới", gắn đúng nguồn.
- [ ] Số điện thoại **đã có cơ hội đang mở** trong cơ sở → bị bỏ (không tạo cơ hội thứ 2); trùng **trong chính file** → gộp/bỏ.
- [ ] Dòng lỗi được báo cáo rõ và **không chặn** các dòng hợp lệ.
- [ ] Dữ liệu chỉ vào đúng cơ sở của người nhập.

## Requirements
- Functional:
  - Kênh nhập v1: **dán text/CSV** (một kênh duy nhất — không làm upload file Excel ở v1). Cột tối thiểu: tên, số điện thoại; tùy chọn: email, nguồn. Gắn 1 nguồn chung cho cả lô (hoặc theo cột nguồn nếu có).
  - **Bước xem trước bắt buộc** trước khi ghi: phân loại từng dòng thành *tạo mới / trùng-đã-có (bỏ) / trùng-trong-file (bỏ) / lỗi (nêu lý do)*.
  - **Chống trùng mức cơ hội (logic MỚI — không có sẵn):** với mỗi SĐT, kiểm tra đã tồn tại **cơ hội đang mở** (`closedAt IS NULL`) trong cơ sở chưa; nếu có → bỏ. (Xem cảnh báo dưới: dùng lại `find-or-create-contact`/`opportunityCreate` KHÔNG tự làm việc này.)
  - Giới hạn ≤ 500 dòng/lần (ràng buộc thật về khóa/round-trip, không chỉ UX); nêu rõ cho người dùng.
  - Người dùng có thể **tải lại/copy các dòng lỗi** để sửa và nhập lại.
- Non-functional:
  - Chính sách ghi: **bỏ qua dòng lỗi + báo cáo** (KHÔNG all-or-nothing). Ghi theo từng dòng có xử lý lỗi riêng, không dùng một transaction lớn abort-toàn-bộ.
  - Chuẩn hoá số điện thoại dùng lại `normalize-contact-phone.ts` (điểm DRY hợp lệ duy nhất).
  - Quyền: quyền tạo lead hiện có (`sale` + GĐKD). RLS `facilityId`.

## ⚠️ Cảnh báo kiến trúc (red-team HIGH)
Dùng lại `find-or-create-contact` chỉ chống trùng **Contact**, không chống trùng **cơ hội**: `opportunityCreate` sau đó **luôn tạo Opportunity mới**, kể cả khi SĐT đã có cơ hội (dedup mức-lead vốn là việc của frontend `opportunityLookup`, QD-0037). ⇒ Nếu bulk chỉ "dùng lại" 2 helper này, nó sẽ **tạo lead ma thứ 2** — vi phạm chính tiêu chí nghiệm thu. **Bulk phải tự làm dedup mức-cơ-hội (logic mới)**, và **kiểm lại lúc commit** để **giảm** TOCTOU (giữa xem-trước và ghi có thể có request khác chèn cùng SĐT). Không đóng hoàn toàn (không có unique index trên Opportunity) — chấp nhận residual, xem Risk.

## Architecture
- Backend: procedure `opportunityBulkImport`. Bước xem trước phân loại toàn bộ (parse + normalize + dedup file + dedup DB). Bước ghi: lặp từng dòng hợp lệ, **re-check cơ hội đang mở theo SĐT ngay trước khi tạo**, dùng lại `find-or-create-contact` cho Contact + tạo Opportunity O1 (set `stageChangedAt=now()` như P2). Trả báo cáo created/skipped(lý do)/errors(dòng).
- Frontend: trang/hộp thoại với vùng dán text/CSV, bảng xem trước, nút xác nhận, khu báo cáo kết quả + xuất dòng lỗi.

## Related Code Files
- Create: `apps/api/src/crm/bulk-import-opportunities.ts`, `apps/admin/src/pages/crm/bulk-import.tsx`, journey `apps/e2e/.../crm-bulk-import.journey.ui.spec.ts`.
- Modify: `apps/api/src/crm/router.ts`, `apps/admin/src/routes/crm.routes.tsx`.
- Reuse: `apps/api/src/crm/normalize-contact-phone.ts` (đã ép prefix quốc gia cố định `84xxxxxxxxx` — xác nhận qua vòng đối chiếu Odoo lần 2: đúng thứ cần cho dedup SĐT theo nhiều định dạng nhập, không cần viết thêm), `find-or-create-contact.ts` (chỉ cho phần Contact).

## Implementation Steps
1. `impact({target:"findOrCreateContact"})` + `impact` trên `opportunityCreate` để biết có tách được logic tạo-opp dùng chung không.
2. Viết dedup mức-cơ-hội (query cơ hội đang mở theo `(facilityId, phone)`); unit test: trùng trong file, trùng DB (đang mở), SĐT đã mất/đã đóng (được phép tạo lại?), dòng lỗi, vượt 500.
3. Procedure: preview (phân loại) + confirm (ghi từng dòng, re-check commit-time). 
4. UI dán/CSV + xem trước + xác nhận + báo cáo + xuất dòng lỗi.
5. Journey ui-e2e; `pnpm acceptance:report`; `detect_changes`; PR.

## Success Criteria
- [ ] N dòng hợp lệ không trùng → tạo đúng N cơ hội "Mới" gắn đúng nguồn.
- [ ] SĐT đã có cơ hội đang mở → KHÔNG tạo cơ hội thứ 2 (test chống lead ma).
- [ ] Trùng trong file bị gộp/bỏ; dòng lỗi báo cáo rõ, không chặn dòng hợp lệ.
- [ ] RLS: không tạo được lead cho cơ sở khác. CI xanh; journey proven; không hồi quy CRM cũ.

## Risk Assessment
- **Chống trùng mức-cơ-hội là logic mới** (không dùng lại được) → effort tăng lên 3-4d.
- TOCTOU giữa preview và commit → **giảm** bằng re-check lúc ghi; KHÔNG đóng hoàn toàn (không unique index trên Opportunity). Với 1 operator, ≤500 dòng, rủi ro thực rất thấp → **chấp nhận residual, KHÔNG thêm index ở v1** (giữ cam kết không đổi schema, KISS). Nâng lên partial unique index `WHERE closedAt IS NULL` chỉ khi thực tế xảy ra trùng.
- Tải lớn: ≤500 dòng = N round-trip giữ khóa trong giới hạn timeout → cap là ràng buộc thật.
- Rollback: gỡ procedure + trang. Không đổi schema.

## Phụ lục kỹ thuật
- `find-or-create-contact.ts:39-46` dedup Contact (INSERT..ON CONFLICT, race-safe). `opportunityCreate` (`crm/router.ts:113-142`) tạo Opportunity vô điều kiện; unique index chỉ ở `Contact(facilityId,phone)`, KHÔNG ở Opportunity → trùng cơ hội không phát lỗi DB, im lặng nhân đôi. **Đã chốt:** SĐT có cơ hội **đã đóng/đã mất** → bulk ĐƯỢC tạo cơ hội mới (lead quay lại); dedup chỉ chặn khi có cơ hội **đang mở** (`closedAt IS NULL`).
