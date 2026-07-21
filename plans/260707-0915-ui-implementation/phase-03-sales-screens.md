# Phase 03 — Màn Kinh doanh (Sales)

## Context links
- `docs/06` §3B/C (route CRM + finance), `docs/12` §5 (pattern ResultPanel, hành động có hệ quả), `docs/16` (ADR-B second-eye), `docs/19` (nghiệp vụ tiền).
- Router: `crm`, `finance`, `enrollment` (`apps/api/src/{crm,finance,enrollment}/router.ts`). Permission: `finance.receiptApprove` (SoD: KHÔNG có `sale`), `finance.receiptList/Get`, `enrollment.enroll`.

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: completed · Review gate: **adversarial (tiền)**.
- 4 màn: Ghi danh overlay + ResultPanel · Duyệt học phí (SoD master-detail) · CRM pipeline kanban · Phiếu thu list.

## Key insights
- **SoD trên UI** (H2): nút "Duyệt & Kích hoạt" ẩn với người lập + role không đủ quyền. UI đọc cờ **`canApprove`** trong ReceiptDto (thêm ở phase-01a) — KHÔNG thử-rồi-bắt-403 (đúng thứ cần tránh). Server vẫn là gate thật.
- **Over-threshold = ROLE-ELEVATION, KHÔNG phải 2 chữ ký** (H1): phiếu >20tr chỉ `giam_doc_dao_tao`/`super_admin` được duyệt — **một người như vậy duyệt một mình** (`finance/router.ts:184-193`). KHÔNG có đồng-duyệt/co-approval/2-chữ-ký. UI: khi phiếu vượt ngưỡng, **ẩn/disable nút duyệt cho role không phải second-eye** (cờ `canApprove` đã phản ánh), hiện banner giải thích "phiếu >20tr cần cấp GĐĐT/super_admin duyệt". Ngưỡng đọc từ `session.me.config.approvalSecondEyeThreshold` (phase-01a) — KHÔNG hardcode.
- **ResultPanel nguồn = receipt create→approve→provisioning** (H3): auto-actions ("tạo TK LMS + gửi email") phát sinh ở `finance.receiptApprove`→`provisionFromReceipt`, trả field `provisioning` (`finance/router.ts:741`) — KHÔNG phải từ `enrollment.enroll`. ResultPanel đọc `provisioning` từ response approve. Chống tự-động-hoá-vô-hình (TL2). Không bịa.
- **Ghi danh HS mới ≠ `enrollment.enroll`** (H3): `enrollment.enroll` yêu cầu `studentId` CÓ SẴN + `classBatchId`, chỉ trả enrollment (`enrollment/router.ts:41-66`) → dùng cho **xếp lớp HS đã tồn tại**. Onboard HS MỚI (tạo student/parent/LMS acct) đi qua **luồng phiếu thu create→approve**.
- Mã phiếu = **SO00183** (phase-01a). Wireframe chỉ là style.
- Ghi danh từ cơ hội: route `/finance/receipts/new?opportunityId=` điền sẵn tên HS/SĐT/lớp (QĐ 0037). Form phiếu thu mới thu **email phụ huynh** (phase-01b C1, cho login LMS).

## Requirements
1. **Ghi danh / phiếu thu mới** (H3): luồng onboard HS mới = **tạo phiếu thu** `/finance/receipts/new` (form thu tên HS fullName+SĐT phụ huynh — KHÔNG mã HS — + **email phụ huynh** cho login LMS) → sau khi **duyệt** (req2) mới sinh provisioning. ResultPanel liệt kê auto-actions từ field `provisioning` của response **approve**. `enrollment.enroll` chỉ dùng cho **xếp lớp HS đã tồn tại** (form riêng, chọn student sẵn + classBatch). Deep-link `?modal=create` hoặc route `/…/new`.
2. **Duyệt học phí** `/finance/receipts?status=pending` → `/finance/receipts/{code}`: master-detail, pipeline stage (brand blue = stage hiện tại, KHÔNG đỏ), tab order-lines, banner SoD (đọc `canApprove`), banner over-threshold (**role-elevation**: "phiếu >20tr cần GĐĐT/super_admin duyệt" — KHÔNG phải 2 chữ ký), nút "Duyệt & Kích hoạt" ẩn/disable khi `canApprove=false` (ConfirmDialog nêu hệ quả) → ResultPanel từ `provisioning`.
3. **CRM pipeline** `/crm/opportunities?view=kanban&stage=`: 5 cột kanban, kéo-thả gọi `crm.opportunityAdvance`, stage hiện tại = brand blue. Detail `/crm/opportunities/{id}/timeline|activities`.
4. **Phiếu thu list** `/finance/receipts`: DataTable + FilterBar (status/q/sort → URL query), StatusBadge semantics đúng, mã SO hiển thị, deep-link agent `?flag=` (từ đối soát, phase 05).

## Architecture notes
- Dùng `MasterDetail`, `DataTable`, `FilterBar`, `StatusBadge`, `ConfirmDialog`, `ResultPanel` từ phase 02. Không tạo primitive mới; nếu thiếu → bổ sung vào `@cmc/ui` (không nhồi vào page).
- Kanban: cân nhắc `@hello-pangea/dnd` hoặc Mantine — chọn 1, ghi note. Trạng thái optimistic + rollback nếu `opportunityAdvance` lỗi.
- Ngưỡng over-threshold + `canApprove` đến từ phase-01a (`session.me.config.approvalSecondEyeThreshold` + `ReceiptDto.canApprove`). UI KHÔNG hardcode 20tr, KHÔNG tự tính self-approval từ raw id. Semantic role-elevation: nút duyệt ẩn cho role không second-eye khi vượt ngưỡng.

## Related code files
- Đọc (hợp đồng): `apps/api/src/finance/router.ts` (ReceiptDto.canApprove + receiptApprove.provisioning), `apps/api/src/crm/router.ts`, `apps/api/src/enrollment/router.ts`.
- Thêm: `apps/admin/src/pages/finance/{receipt-list,receipt-detail,receipt-approve,receipt-create}.tsx`, `pages/crm/{pipeline,opportunity-detail}.tsx`, `pages/enrollment/class-placement.tsx` (xếp lớp HS đã tồn tại).
- File ownership: **chỉ** thư mục `apps/admin/src/pages/{finance,crm,enrollment}` + route nhánh tương ứng. KHÔNG chạm pages phase 04/05/06.

## Implementation steps
1. Phiếu thu list + FilterBar URL-binding.
2. Receipt create form (email PH) + detail master-detail + tab order-lines + pipeline stage.
3. Duyệt: banner SoD/over-threshold (canApprove), nút ẩn khi canApprove=false, ConfirmDialog + ResultPanel từ `provisioning`.
4. CRM kanban + advance + detail tabs.
5. Xếp lớp HS đã tồn tại (`enrollment.enroll`) — form riêng.
6. Verify: người lập/role thường không thấy nút duyệt (canApprove), over-threshold = role-elevation, ResultPanel khớp `provisioning` thật.

## Todo list
- [x] Phiếu thu list (URL query)
- [x] Receipt create (email PH) + detail + order-lines + pipeline
- [x] Duyệt: canApprove gate + over-threshold role-elevation + ConfirmDialog + ResultPanel từ provisioning
- [x] CRM kanban + advance + detail
- [x] Xếp lớp HS đã tồn tại (enrollment.enroll)
- [x] Verify gate + adversarial

## Success criteria
- Người lập (`sale`) + role không đủ quyền: `canApprove=false` → nút "Duyệt" ẩn/disable. GĐKD/ke_toan thấy. Server 403 nếu ép gọi.
- Phiếu >20tr: UI hiện banner **role-elevation** ("cần GĐĐT/super_admin duyệt"); role thường ẩn nút. KHÔNG có ngôn từ "2 chữ ký"/co-approval.
- ResultPanel liệt kê đúng auto-actions từ field `provisioning` của response **approve** (không bịa, không lấy từ enroll).
- CRM stage hiện tại = brand blue (không đỏ) — khớp `docs/12` §3.
- Mã SO00183 hiển thị; không xuất hiện mã HS.
- Ngưỡng 20tr đọc từ `session.me` — grep xác nhận không hardcode ở FE.
- **Verify**: build/typecheck admin xanh; test UI critical (duyệt happy + canApprove-block + over-threshold role-elevation) — e2e UI-driven ở phase 08.
- **Review**: adversarial — soi SoD bypass, ngưỡng hardcode, semantic over-threshold, ResultPanel bịa/sai-nguồn.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| UI mời hành động server cấm (SoD) | TB×Cao | ẩn nút theo `canApprove` (ReceiptDto); server vẫn chặn |
| Ngưỡng 20tr hardcode UI → drift | TB×Cao | đọc từ `session.me.config`, không hằng số UI |
| Trình bày sai kiểm soát over-threshold (2 chữ ký) | TB×Cao | semantic role-elevation; review chặn ngôn từ co-approval |
| ResultPanel rỗng/sai nguồn (dùng enroll thay approve) | TB×Cao | đọc field `provisioning` từ response approve |
| Optimistic kanban sai stage khi lỗi | TB×TB | rollback + refetch on error |

## Security considerations
- Màn tiền: mọi hành động qua `can()` server; UI-gate chỉ là UX.
- Không lộ danh sách HS ngoài phạm vi facility (RLS backend đã lo; UI không cache chéo facility).
- ConfirmDialog cho hành động tiền phải nêu hệ quả (không nghịch được dễ).

## Next steps
→ Phase 08 e2e UI cho luồng duyệt tiền (critical path).
