---
phase: 3
title: "Placeholder detection"
status: pending
priority: P2
dependencies: [1]
---

# Phase 3: Placeholder detection

## Overview

`P1-08` (Huỷ phiếu / hoàn tiền — luồng đụng tiền) đang mang trạng thái **"built"** trong khi `/finance/refund` là một `EmptyState` **tự viết chữ "Tính năng chưa áp dụng"**. Đây là bằng chứng không thể tranh cãi rằng "đếm tên" ≠ "nghiệm thu". Phase này làm cho một màn tự khai chưa làm không thể được đếm là đã xây.

## Requirements

**Functional**
- Verifier phân giải được `uiRoute` → file page component.
- Nhận diện màn placeholder và hạ trạng thái luồng chứa nó (không còn `built`).
- Trạng thái mới phải **nói đúng sự thật**, không phải `missing` (procedure có thật, chỉ thiếu UI).

**Non-functional**
- Dùng ts-morph theo import graph (D5). Regex-first bị cấm.

## Architecture

Repo đã có `scanners/route-scanner.ts` đi đúng import graph để compose full path từ `createBrowserRouter`. Nó **dừng ở đường dẫn** — chưa giữ lại component đích. Phase này mở rộng nó để trả thêm file page, rồi kiểm tra file đó.

```
routes/index.tsx ──(ts-morph, import graph)──→ route tree
   path segments ──compose──→ "/finance/refund"
   element <RefundPage/> ──resolve──→ pages/finance/refund.tsx
                                            ↓
                            placeholder? (EmptyState "Tính năng chưa áp dụng")
```

**Cạm bẫy đã kiểm chứng thực nghiệm** (prototype regex trong phiên brainstorm chỉ resolve 13/40 màn):
- `lazy(() => import('../pages/hr/payroll.js'))` — đuôi `.js` trong specifier trỏ tới file `.tsx`.
- `<Suspense fallback={<Fallback />}>` bọc component thật → lấy nhầm `Fallback`.
- Cả hai biến mất nếu đi qua AST thay vì regex.

**Nhận diện placeholder** — không hardcode một chuỗi tiếng Việt rồi coi là xong. Ưu tiên theo thứ tự:
1. Component render `EmptyState` với `title` là hằng "Tính năng chưa áp dụng", **và** không có `trpc.*.useMutation` nào → placeholder.
2. Cân nhắc cách bền hơn: một dấu hiệu tường minh trong page (ví dụ export `export const PLACEHOLDER = true` hoặc comment chuẩn hoá) để không phụ thuộc chuỗi hiển thị — chuỗi hiển thị có thể đổi khi làm i18n.

Chọn cách nào cần quyết khi thực thi; ghi lý do vào code.

**Trạng thái mới:** thêm mức phân biệt "API có, UI chưa" — ví dụ `ui-missing` — thay vì ép về `partial`/`missing`. `/finance/refund` đúng là trường hợp này: `finance.refundCreate` tồn tại và có test, chỉ thiếu màn.

## Related Code Files

- Modify: `scripts/acceptance-report/scanners/route-scanner.ts` — trả thêm `{ route, pageFile }`
- Modify: `scripts/acceptance-report/verify.ts` — luật hạ cấp khi có placeholder
- Modify: `scripts/acceptance-report/types.ts` — mở rộng `FlowStatus`
- Modify: `scripts/acceptance-report/render.ts` + templates — hiển thị trạng thái mới
- Read-only: `apps/admin/src/pages/finance/refund.tsx`, `apps/admin/src/pages/engagement/leaderboard.tsx`

## Implementation Steps

1. Mở rộng `route-scanner.ts` giữ lại element component và phân giải sang file thật (xử lý `.js` specifier + `Suspense`/`Fallback` bằng AST, không regex).
2. Thêm hàm nhận diện placeholder theo cách đã chọn ở Architecture.
3. Thêm `FlowStatus` mới (`ui-missing` hoặc tên tương đương) + luật: luồng có ≥1 `uiRoute` trỏ tới placeholder thì không được `built`.
4. Cập nhật renderer cả 2 tab (Nghiệm thu / Builder) để trạng thái mới hiện đúng, tiếng Việt, không kỹ thuật ở tab Nghiệm thu.
5. Chạy report → `P1-08` đổi trạng thái. Rà các luồng khác có placeholder tương tự (`leaderboard.tsx` cũng là EmptyState nhưng hiện không thuộc luồng nào — xác nhận lại).

## Test / Validation

- Unit cho scanner: `/finance/refund` → `pages/finance/refund.tsx`; `/hr/payroll` → `pages/hr/payroll.tsx` (case đuôi `.js` + `Suspense`).
- **Falsification test:** tạm biến một màn thật (ví dụ `/finance`) thành EmptyState → report phải hạ cấp luồng tương ứng; hoàn nguyên.
- Đếm số route phân giải được: phải xấp xỉ tổng số `path:` entry (46) — **không** chấp nhận tỷ lệ như prototype regex (13/40). Nếu thấp, scanner còn sót nhánh.
- `pnpm acceptance:report` chạy sạch; `pnpm typecheck` xanh.

## Success Criteria

- [ ] Scanner phân giải route → page file cho ~toàn bộ route (không phải một phần)
- [ ] `P1-08` không còn `built`; trạng thái mới mô tả đúng "API có, UI chưa"
- [ ] Falsification test chứng minh luật thật sự hoạt động
- [ ] Cả 2 tab HTML hiển thị trạng thái mới đúng ngữ nghĩa
- [ ] Không luồng nào bị hạ cấp oan (rà tay danh sách thay đổi trạng thái)

## Risk Assessment

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Nhận diện placeholder dựa vào chuỗi hiển thị → vỡ khi đổi copy/i18n | Trung bình | Cân nhắc dấu hiệu tường minh trong code thay vì chuỗi; ghi lý do lựa chọn |
| Scanner sót nhánh route → âm tính giả (placeholder lọt lưới) | **Cao** | Tiêu chí đếm tỷ lệ phân giải trong Test; ts-morph theo import graph |
| Hạ cấp oan màn thật có EmptyState hợp lệ (trạng thái rỗng bình thường) | Trung bình | Điều kiện kép: EmptyState **và** không có mutation; rà tay danh sách đổi trạng thái |
| Trạng thái mới làm rối tab Nghiệm thu của giám đốc | Thấp | Dùng nhãn tiếng Việt phi kỹ thuật, giữ đúng tinh thần "◐ đã xây, chưa chứng minh" của plan gốc |
