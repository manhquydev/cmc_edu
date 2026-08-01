# Audit trải nghiệm thật — CRM + Tài chính (P1 money chain)

**Ngày:** 2026-07-26 · **Nhánh:** main (`f354e20`) · **Phạm vi:** chỉ đọc
**Đọc:** `apps/admin/src/pages/crm/**`, `apps/admin/src/pages/finance/**`, `apps/admin/src/routes/{crm,finance}.routes.tsx`, `apps/api/src/{crm,finance}/**`, `apps/api/src/{reconciliation,worker,provisioning,class}/`, `packages/{domain-finance,auth,ui}/src/**`, `docs/system-architecture.md`

Đã loại trừ theo yêu cầu: `receipt-create.tsx:311` (`step={100000}`) và P1-08 huỷ/hoàn tiền chưa có UI.

---

## Findings

| # | Mức | Vấn đề | file:line | Đề xuất sửa |
|---|-----|--------|-----------|-------------|
| 1 | Chặn | Sale tạo phiếu xong bị điều hướng sang `/finance/{id}` → `receiptGet` chặn role `sale` → hiện "Không tìm thấy phiếu thu" + "Missing permission finance.receiptGet." ngay sau khi vừa tạo thành công | `apps/admin/src/pages/finance/receipt-create.tsx:117` (roles: `packages/auth/src/index.ts:74`) | Cho `sale` đọc phiếu do chính mình tạo (`receiptGet` lọc `createdById`), hoặc điều hướng sale về `/crm/opportunities/{oppId}` kèm banner "đã tạo phiếu SO000xx" |
| 2 | Chặn | Duyệt phiếu thất bại hoàn toàn im lặng: `onError` chỉ đóng dialog, `approveMutation.error` không được render ở bất kỳ đâu → SoD/vượt ngưỡng/opp lost/conflict đều "bấm xong không có gì xảy ra" | `apps/admin/src/pages/finance/receipt-detail.tsx:146-149` | Render `approveMutation.error.message` bằng `Banner status="error"` cạnh `approveResult` |
| 3 | Chặn | Bộ lọc trạng thái + ô tìm kiếm của danh sách phiếu thu chết hoàn toàn: truyền `onChange` khiến `FilterBar` bỏ nhánh ghi URL, trong khi trang đọc state từ `searchParams` → gõ không lên chữ, chọn trạng thái không đổi gì | `apps/admin/src/pages/finance/receipt-list.tsx:139` (+ `packages/ui/src/components/filter-bar.tsx:37-47`, `receipt-list.tsx:81-88`) | Bỏ prop `onChange`, để FilterBar tự sync URL; reset page bằng `useEffect` theo `[status, q]` |
| 4 | Chặn | Phiếu **Nháp** không thể huỷ và không thể sửa: `receiptCancel` bắt buộc `status='approved'`, không có procedure sửa phiếu → gõ sai số tiền/lớp/SĐT là phiếu rác kẹt vĩnh viễn trong hàng đợi duyệt | `apps/api/src/finance/router.ts:480-482` | Cho phép `receiptCancel` với `draft` (bỏ qua nhánh rollback provisioning), hoặc thêm `receiptUpdate` chỉ áp dụng khi `draft` |
| 5 | Cao | SĐT sai định dạng lọt tới lúc duyệt rồi hỏng vĩnh viễn: client chỉ check rỗng, server `z.string().min(1)`; `provisionFromReceipt` ném `InvalidPhoneError` → `provisioning:'pending'` và UI hứa "sẽ tự động hoàn tất sau vài phút" trong khi mọi lần retry đều hỏng, không màn nào sửa được SĐT | `apps/admin/src/pages/finance/receipt-create.tsx:38` · `apps/api/src/finance/router.ts:99` · `receipt-detail.tsx:187` | Validate `normalizeLoginPhone` ngay ở form + ở `receiptCreateInput`; hoặc phân biệt `pending` (retry được) với `failed` (cần sửa dữ liệu) trong thông báo |
| 6 | Cao | Danh sách phiếu thu không có phân trang (`page` chỉ bị reset), `pageSize:50` → quá 50 phiếu là không tới được phiếu cũ; cộng với #3 thì người duyệt mất hẳn khả năng tìm bản nháp | `apps/admin/src/pages/finance/receipt-list.tsx:91,110` | Thêm điều khiển phân trang như `pipeline.tsx:396-418`, và chuyển `q` sang lọc server-side |
| 7 | Cao | `runReconcileFinanceFlags` không được nối vào `drainOnce` (chỉ có test và `apps/e2e/src/db.ts` gọi) → 4 loại cảnh báo mà màn Đối soát hiển thị/lọc không bao giờ được sinh ra ở prod | `apps/api/src/worker/index.ts:115-130` (scanner: `worker/reconcile-finance-flags.ts:237`) | Thêm `await runReconcileFinanceFlags(db)` vào `drainOnce`, kèm test như `drain-once.test.ts` đã làm cho `reconcileCancelledButProvisioned` |
| 8 | Cao | Hệ quả của #7: tự duyệt dưới ngưỡng được API cho phép (chỉ ghi audit `selfApproved`) — biện pháp bù trừ duy nhất là cờ `self_approved`, mà cờ đó không bao giờ được sinh. UI thì hứa "Cổng tiền (SoD): người tạo ≠ người duyệt" | `apps/api/src/finance/router.ts:257` · `receipt-detail.tsx:286` | Sửa #7 trước; nếu SoD là quy tắc cứng thì chặn thẳng ở `runMoneyTransaction`, không thì sửa lại câu chữ ở UI cho đúng bản chất "kiểm soát bù trừ" |
| 9 | Cao | Cảnh báo duy nhất thực sự được sinh ở prod (`cancelled_receipt_partial_provisioning`, `cancelled_receipt_active_enrollment`) hiển thị dạng chuỗi thô tiếng Anh, không mô tả, và không lọc được vì enum `kind` không có chúng | `apps/api/src/reconciliation/router.ts:15-17` · `apps/admin/src/pages/finance/reconciliation.tsx:37-60` | Bổ sung 2 kind vào enum input + `KIND_LABELS`/`KIND_DESCRIPTIONS`/`KIND_COLORS` |
| 10 | Cao | Deep-link cảnh báo trỏ sai route: mọi nơi ghi `/finance/receipts/{id}?flag=` nhưng route thật là `/finance/:id` → rơi vào catch-all `ComingSoon` | `apps/api/src/finance/router.ts:1008` · `worker/reconcile-orphaned-receipts.ts:274,346` · `worker/reconcile-finance-flags.ts:110,134,177,217` (route: `finance.routes.tsx:71`, catch-all `routes/index.tsx:63`) | Đổi thành `/finance/{id}?flag=…` (giống anchor đang đúng ở `reconciliation.tsx:133`) |
| 11 | Cao | Nút "+ Tạo phiếu thu" và "+ Ghi danh" hiện cho GĐĐT — role duy nhất duyệt được phiếu >20M — nhưng GĐĐT không có `finance.receiptCreate` lẫn `crm.opportunityList` → điền hết form rồi mới nhận lỗi tiếng Anh | `apps/admin/src/pages/finance/receipt-list.tsx:122-135` (roles: `packages/auth/src/index.ts:55,64`) | Bọc 2 nút bằng `canDo('finance','receiptCreate')` / `canDo('crm','opportunityList')` |
| 12 | Cao | `EnrollPicker` nuốt lỗi (không lấy `error` từ query) → lỗi quyền/mạng đều hiển thị "Không có cơ hội O4 nào sẵn sàng ghi danh": trạng thái rỗng giả | `apps/admin/src/lib/enroll-picker.tsx:15` (thông báo: `:32`) | Lấy `error` và hiển thị `Banner status="error"` thay vì empty state |
| 13 | Cao | "Chuyển lên" ở pipeline thất bại im lặng: `onError` chỉ rollback optimistic, không thông báo → thẻ nhảy về chỗ cũ, người dùng tưởng lag và bấm lại | `apps/admin/src/pages/crm/pipeline.tsx:240-245` | Lưu message vào state và hiển thị banner/toast trên thẻ hoặc đầu trang |
| 14 | Cao | Ở chi tiết cơ hội, `advanceMutation`, `markLostMutation` (nút "Mở lại cơ hội"), `completeMutation`/`noShowMutation` đều không render lỗi — chỉ `assignMutation.error` có | `apps/admin/src/pages/crm/opportunity-detail.tsx:94-96,175,185,546,553` | Gom lỗi 4 mutation vào một `Banner` chung dưới `PageHeader` |
| 15 | TB | Đối soát: `afterMutateError` chỉ đóng dialog xác nhận, không báo lỗi → "Bỏ qua"/"Đã xử lý" thất bại (vd cờ đã bị người khác xử lý) trông y hệt thành công cho tới khi list refresh | `apps/admin/src/pages/finance/reconciliation.tsx:197-199` | Hiển thị `dismissMut.error`/`actionMut.error` trong banner ở đầu list |
| 16 | TB | Báo cáo doanh thu hiển thị `Lớp …{8 ký tự uuid}` dù `receiptList` đã trả sẵn `classBatchCode` → không ai đọc được biểu đồ | `apps/admin/src/pages/finance/revenue-report.tsx:45` (DTO: `apps/api/src/finance/router.ts:189`) | Dùng `classBatchCode` làm label, fallback về uuid |
| 17 | TB | Báo cáo doanh thu không có bộ lọc kỳ/tháng (comment đầu file khẳng định có `?range=` nhưng code không có), lại chỉ lấy 100 phiếu trang đầu và tự thú "chưa triển khai" bằng banner → không dùng được để chốt doanh thu tháng | `apps/admin/src/pages/finance/revenue-report.tsx:9,164-169,193-199` | Thêm `dateFrom/dateTo` vào `receiptListInput` + tổng hợp server-side; sửa comment sai |
| 18 | TB | Trạng thái `sent` không có writer nào trong toàn bộ API → pipeline 3 bước ở chi tiết phiếu luôn dừng ở 2/3 ("Đã gửi" mãi xám) và bộ lọc "Đã gửi" luôn rỗng | `apps/api/src/finance/router.ts:197` · `receipt-detail.tsx:24-28` · `receipt-list.tsx:8` | Bỏ `sent` khỏi pipeline + bộ lọc cho tới khi có luồng gửi phiếu thật |
| 19 | TB | Pipeline CRM phân trang chung 20 bản ghi cho cả 5 cột trong khi số đếm ở tiêu đề cột lấy từ server, và không có bộ lọc theo giai đoạn dù API hỗ trợ `stage` → cột ghi "Đã liên hệ · 47" nhưng chỉ có 3 thẻ, muốn tìm 1 cơ hội phải lật trang mù | `apps/admin/src/pages/crm/pipeline.tsx:14,266-272,372` (API: `apps/api/src/crm/router.ts:78`) | Thêm Selector lọc theo giai đoạn (truyền `stage` xuống API), hoặc phân trang từng cột |
| 20 | TB | Chọn lớp khi tạo phiếu chỉ nạp 100 lớp trang đầu và không lọc `status` → lớp đã đóng vẫn chọn được, lớp thứ 101 biến mất, và ô search của Selector chỉ tìm trong 100 đã tải | `apps/admin/src/pages/finance/receipt-create.tsx:109` (API: `apps/api/src/class/class-batch-router.ts:257`) | Thêm filter `status:'active'` vào `classBatch.list` và chuyển Selector sang tìm kiếm server-side |

### Ghi chú không tính thành finding

- **Không có bảng giá.** `Course`/`ClassBatch` không có trường học phí (`packages/db/prisma/schema.prisma:575-586,608-629`), nên "Học phí (VND)" là ô nhập tự do không đối chiếu được với chương trình; cũng không cảnh báo trước ngưỡng 20M lúc tạo (chỉ báo ở màn chi tiết, `receipt-detail.tsx:195`). Đây là khoảng trống thiết kế sản phẩm, cần quyết định của PO chứ không phải lỗi code.
- **Tự duyệt dưới ngưỡng được phép ở API** là quyết định đã kiểm chứng (ADR-B, test khẳng định ở `apps/api/src/finance/approve.test.ts:361`) — finding #8 không đề nghị đảo quyết định đó, chỉ chỉ ra biện pháp bù trừ đi kèm chưa chạy.
- **`receiptCancel` và `refundCreate` không có UI caller nào** (đã biết, no-ui-path) — nhắc lại vì nó là nguyên nhân trực tiếp của #4.
- **Vì sao CI xanh:** toàn bộ e2e money chain gọi tRPC trực tiếp bằng client (`apps/e2e/tests/finance-approval.spec.ts:50-61`), không đi qua màn hình, nên #1/#2/#3/#11/#12 không thể bị bắt.

---

## 3 việc nên làm trước nhất

1. **Vá đường đi của sale trong money chain** (#1 + #4): mở `receiptGet` cho phiếu do chính sale tạo và cho huỷ phiếu `draft`. Hiện tại persona chính của P1 vừa tạo phiếu xong là bị chặn, còn phiếu gõ sai thì không ai dọn được.
2. **Bật hiển thị lỗi cho mọi mutation tiền + CRM** (#2, #13, #14, #15, #12): 5 chỗ, mỗi chỗ vài dòng. Cổng tiền hiện thất bại hoàn toàn im lặng — đây là loại lỗi UAT người thật sẽ vấp ngay.
3. **Khôi phục hàng đợi duyệt** (#3 + #6): bỏ prop `onChange` của FilterBar và thêm phân trang. Không có 2 thứ này, quá 50 phiếu là người duyệt không tìm được bản nháp nào.

---

Status: DONE_WITH_CONCERNS
Summary: 20 finding có file:line đã kiểm chứng; 4 mức Chặn nằm trên đúng đường đi chính của money chain (sale tạo phiếu → bị chặn đọc, duyệt lỗi im lặng, bộ lọc hàng đợi chết, phiếu nháp không huỷ được). Toàn bộ đều nằm ngoài vùng e2e vì e2e gọi tRPC trực tiếp, không qua UI.
