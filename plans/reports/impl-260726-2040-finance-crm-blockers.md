# Vá 4 lỗi CHẶN/CAO trên money chain P1 — CRM + Tài chính

**Ngày:** 2026-07-26 · **Nhánh:** main · **Dựa trên:** `plans/reports/audit-260726-2040-crm-finance.md`

---

## 1. Sale bị chặn đọc phiếu vừa tạo (finding #1, CHẶN)

**File:** `apps/admin/src/pages/finance/receipt-create.tsx`

**Vấn đề:** `createMutation.onSuccess` luôn `navigate('/finance/${id}')`, nhưng `finance.receiptGet` không cấp cho role `sale` (`packages/auth/src/index.ts:75`) — sale (persona chính tạo phiếu, cùng GĐKD) tạo phiếu xong lập tức thấy "Không tìm thấy phiếu thu".

**Cách chọn giải pháp:** Đề bài cho 2 lựa chọn (điều hướng nơi khác HOẶC hiển thị kết quả tại chỗ) và cấm nới RBAC. Tôi ghép cả hai theo hướng rủi ro thấp nhất:
- Đọc `canDo('finance','receiptGet')` (hook `useSession` có sẵn, dùng đúng `@cmc/auth.can()` — không đụng `packages/auth`).
- Có quyền (GĐKD) → giữ nguyên hành vi cũ, `navigate('/finance/{id}')`.
- Không có quyền (sale) → **không điều hướng**, hiển thị banner thành công tại chỗ (`Đã tạo phiếu thu {code}`) + 2 nút: "Tạo phiếu khác" (reset form, giữ prefill từ cơ hội nếu có) và "Xem cơ hội" / "Về bảng kinh doanh" (điều hướng `/crm/opportunities/{id}` nếu có `opportunityId`, ngược lại `/crm` — cả hai route sale đều đọc được vì `opportunityGet`/`opportunityList` dùng chung quyền `crm.opportunityList`, sale có quyền này).
- Nút "Tạo phiếu thu" bị khoá khi đang hiện màn kết quả, tránh double-submit với dữ liệu cũ.

Lý do không chọn "chỉ điều hướng nơi khác" đơn thuần: sale cũng không có `finance.receiptList`, nên điều hướng `/finance` cũng chết y hệt; hiển thị tại chỗ là lựa chọn an toàn nhất không phụ thuộc route nào khác ngoài CRM (mà sale chắc chắn đọc được).

**Không đổi:** `packages/auth/**` — không nới quyền `finance.receiptGet` cho sale.

## 2. Duyệt phiếu thất bại im lặng (finding #2, CHẶN)

**File:** `apps/admin/src/pages/finance/receipt-detail.tsx:140-160` (mới), `176-184` (banner)

`approveMutation.onError` trước đây chỉ `setApproveOpen(false)`. Thêm render `approveMutation.error` bằng `Banner status="error" title="Duyệt phiếu thất bại"` ngay đầu `overviewContent`, cùng cấu trúc với `receipt-create.tsx`'s `createMutation.error` banner (đúng pattern đang có trong repo, theo yêu cầu đề bài).

## 3. Bộ lọc + tìm kiếm danh sách phiếu thu chết (finding #3, CHẶN)

**File:** `apps/admin/src/pages/finance/receipt-list.tsx:1,109-117,146`

Grep toàn bộ caller của `FilterBar` trước khi sửa: chỉ 3 nơi dùng (`receipt-list.tsx`, `apps/admin/src/pages/teaching/schedule.tsx`, `apps/admin/src/pages/engagement/rewards.tsx`) — 2 nơi kia gọi `<FilterBar filters={FILTERS} />` không có `onChange`/`value`, tức đã ở chế độ URL-uncontrolled đúng thiết kế của component.

Áp đúng đề xuất trong audit: **không sửa `packages/ui/src/components/filter-bar.tsx`** (không cần thiết → giữ rủi ro = 0 cho 2 màn kia). Chỉ sửa `receipt-list.tsx`:
- Bỏ prop `onChange={handleFiltersChange}` khỏi `<FilterBar>` — để component tự đọc/ghi `useSearchParams` (đúng hợp đồng "uncontrolled" của nó).
- Thay `handleFiltersChange` bằng `useEffect(() => setPage(1), [status, q])` — reset trang khi filter đổi, không cần callback nữa.

Nguyên nhân gốc (đã xác nhận qua đọc `filter-bar.tsx:27-48`): truyền `onChange` mà không truyền `value` khiến `FilterBar` gọi `externalOnChange(next)` thay vì `setSearchParams`, trong khi giá trị hiển thị (`currentValues`) vẫn luôn đọc từ URL (vì `externalValue` là `undefined`) — 2 nguồn dữ liệu lệch nhau nên gõ/chọn không có tác dụng.

## 4. 4 mutation CRM + duyệt phiếu không hiện lỗi (finding #14 + #2, CAO/CHẶN)

**File:** `apps/admin/src/pages/crm/opportunity-detail.tsx:157-169,247-250`

`advanceMutation`, `markLostMutation` (dùng cho "Mở lại cơ hội"), `completeMutation`, `noShowMutation` đều bấm thẳng trên action bar, không dialog riêng để hiện lỗi. Gom lỗi 4 mutation vào 1 biến `actionError` (first-error-wins) và 1 `Banner` chung ngay dưới `PageHeader` (đầu `Stack` nội dung).

Xử lý trùng lặp: `markLostMutation` dùng chung giữa page này và `MarkLostDialog` (dialog "Đánh dấu mất" đã tự hiện lỗi inline khi mở). Đã thử chặn theo `!markLostOpen` để tránh hiện 2 lần khi dialog đang mở — verify bằng test cho thấy `MarkLostDialog` vẫn giữ span lỗi trong DOM ngay cả khi đóng (Astryx `Dialog` dựng trên `<dialog>` gốc, ẩn bằng CSS đóng chứ không unmount) nên với người dùng thật, khi dialog đóng chỉ banner của page hiện (đúng ý đồ), khi dialog mở chỉ span trong dialog hiện (banner của page bị `!markLostOpen` chặn) — không có lỗi hiện 2 lần cùng lúc trên màn hình thật.

`receiptApprove` (mục 2) coi như phần "duyệt phiếu" của finding này — đã sửa ở `receipt-detail.tsx` (mục 2).

**Không làm:** finding #12 (`EnrollPicker` nuốt lỗi) và #13 (pipeline "Chuyển lên" im lặng) — nằm trong audit nhưng **không có trong danh sách 4 lỗi được giao**; để nguyên theo đúng phạm vi.

---

## Verify (output thật)

### `pnpm --filter @cmc/admin exec tsc -p tsconfig.json --noEmit`
Lần chạy đầu tiên báo lỗi TS2322 tại `apps/admin/src/pages/classes/index.tsx:445` — file này thuộc agent khác (`apps/admin/src/pages/classes/**`, đang có thay đổi song song, `git status` xác nhận `M`), tôi không đụng file này. Chạy lại 2 lần liên tiếp:
```
EXIT: 0
EXIT: 0
```
→ sạch, lỗi kia là do agent khác đang ghi file cùng lúc lần đầu, đã ổn định ở các lần sau.

### `pnpm --filter @cmc/admin exec vitest run src/pages/finance src/pages/crm`
```
 Test Files  13 passed (13)
      Tests  146 passed (146)
```
Bao gồm 2 file test mới (`receipt-detail.test.tsx` 8 test, `receipt-list.test.tsx` 6 test) + cập nhật `receipt-create.test.tsx` (17 test, +5 test cho routing theo quyền) + `opportunity-detail.test.tsx` (31 test, +5 test cho banner lỗi chung).

### `packages/ui` — không sửa
Theo điều kiện của đề bài ("Nếu sửa packages/ui: chạy toàn bộ `@cmc/admin test`") — không áp dụng vì `filter-bar.tsx` không bị đụng (`git status packages/ui/` rỗng). Bỏ qua run toàn bộ theo đúng điều kiện.

### `pnpm lint`
```
> eslint apps/admin apps/lms scripts
EXIT: 0
```

### GitNexus `detect_changes()`
Không có công cụ MCP GitNexus (`impact`/`detect_changes`/`query`/`context`) trong bộ tool của subagent này — chỉ có CLI `node .gitnexus/run.cjs analyze` (dùng cho re-index, không phải blast-radius). Lần đầu `analyze` lỗi `FTS index inconsistent` (index dùng chung, agent khác đang ghi đồng thời) — chạy lại tự phục hồi (`Repository indexed successfully`). Đã bù đắp impact analysis thủ công trước khi sửa: đọc `packages/auth/src/index.ts` để xác nhận quyền `sale` trước finding #1, grep toàn bộ caller `FilterBar` trước finding #3, đọc `MarkLostDialog`/`useOpportunityActions` trước finding #4 và xác minh bằng test thật (không suy đoán) hành vi Dialog đóng vẫn giữ DOM.

---

## Files Modified
- `apps/admin/src/pages/finance/receipt-create.tsx` (+51/-3) — mục 1
- `apps/admin/src/pages/finance/receipt-detail.tsx` (+12) — mục 2
- `apps/admin/src/pages/finance/receipt-list.tsx` (+15/-7) — mục 3
- `apps/admin/src/pages/crm/opportunity-detail.tsx` (+17) — mục 4
- `apps/admin/src/pages/finance/receipt-create.test.tsx` — cập nhật mock `session.me` thành function theo role động + 5 test mới cho routing
- `apps/admin/src/pages/crm/opportunity-detail.test.tsx` — 5 test mới cho banner lỗi chung
- `apps/admin/src/pages/finance/receipt-detail.test.tsx` (mới, 8 test)
- `apps/admin/src/pages/finance/receipt-list.test.tsx` (mới, 6 test)

**Không đụng:** `packages/auth/**`, `apps/api/**`, `packages/ui/**`, và mọi file ngoài `finance/**`/`crm/**` — xác nhận bằng `git status` trước khi nộp báo cáo.

---

Status: DONE
Summary: Sửa xong cả 4 lỗi CHẶN/CAO đúng phạm vi giao — sale không còn bị điều hướng vào phiếu mình không đọc được, duyệt phiếu lỗi hiện banner, bộ lọc/tìm kiếm phiếu thu hoạt động lại, 4 mutation CRM + duyệt phiếu hiện lỗi cho người dùng. tsc/vitest(finance+crm)/lint đều xanh; không đụng file ngoài phạm vi.
Concerns/Blockers: Không có. 1 điểm cần lưu ý cho reviewer: gate `!markLostOpen` không thực sự ngăn `MarkLostDialog` giữ DOM node lỗi khi đóng (chỉ ẩn bằng CSS của `<dialog>` gốc) — với người dùng thật không thấy trùng lặp, nhưng test phải dùng `getAllByText` thay vì `getByText` ở 1 chỗ vì testing-library không lọc theo visibility.
