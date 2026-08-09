---
phase: 3
title: "S6 async entity combobox"
status: pending
priority: P1
effort: "1-2d"
dependencies: [1]
---

# Phase 3: S6 async entity combobox — sửa bug cắt dữ liệu (TDD)

## Overview

**Bug thật, không phải thẩm mỹ.** 5 dropdown FK nuôi bằng `list` + `pageSize: 100` hardcode ⇒
**bản ghi thứ 101 biến mất âm thầm**. Lớp bug này đã từng cắn một lần và được sửa ở
`crm/pipeline.tsx:29-33` (F7 fix). Ưu tiên trên mọi việc thẩm mỹ.

## Requirements

- Functional: mọi picker FK chọn được bản ghi thứ 101+; giữ nguyên giá trị đang chọn khi search
  thu hẹp kết quả.
- Non-functional: **thuần frontend** — cả 5 procedure backing đã hỗ trợ `search` server-side.
- **TDD:** viết test cho `AsyncEntityCombobox` trước khi viết component; viết lại 3 test canh
  gác trước khi đổi call site.

## Architecture

Trích component dùng chung từ pattern **đã đúng** ở `teaching/attendance.tsx:178-273`:
1. Input search có debounce → truyền `search` vào tRPC query
2. **Ghim item đang chọn** vào options để search không làm rớt giá trị hiện tại
3. Trạng thái loading/empty

`Selector` (Astryx) **không có async built-in** → component mới tự quản debounce + loading.

**5 call site phải đổi:**
| File | Entity | Procedure |
|---|---|---|
| `finance/receipt-create.tsx:124` | classBatch | `classBatch.list` |
| `enrollment/class-placement.tsx:57` | classBatch | `classBatch.list` |
| `classes/index.tsx:222` | course | `course.list` |
| `teaching/session-evidence.tsx:32` | classBatch | `classBatch.list` |
| `teaching/session-assessment.tsx:47` | classBatch | `classBatch.list` |

`teaching/attendance.tsx:188` = bản tham chiếu, migrate sang component mới để không còn 2 bản.

## Related Code Files

- Create: `packages/ui/src/components/async-entity-combobox.tsx` + `.test.tsx`
- Modify: `packages/ui/src/index.ts` (export)
- Modify: 5 call site trên + `teaching/attendance.tsx` (dùng component mới)
- **Modify (BẮT BUỘC — test canh gác sẽ đỏ nếu bỏ sót):** 3 test **khoá cứng** `pageSize: 100`
  bằng tên test:
  - `apps/admin/src/pages/finance/receipt-create.test.tsx:155` — `it('queries classBatch.list with the unchanged {pageSize: 100} input')`
  - `apps/admin/src/pages/teaching/session-evidence.test.tsx:90` — `it('queries classBatch.list with the unchanged {page:1, pageSize:100} input')`
  - `apps/admin/src/pages/classes/index.test.tsx:138` — tương đương cho `course.list`

  Các test này **cố ý** khoá input hiện tại. Viết lại thành assert hành vi mới (có `search`,
  không cắt ở 100), **không phải xoá**. Đổi tên test — chữ "unchanged" trở thành sai nghĩa.

## Implementation Steps

1. **TDD bước 1:** viết `async-entity-combobox.test.tsx` — pin-selected không bị search làm
   rớt; debounce không bắn query mỗi ký tự; loading/empty state — **trước khi có implementation**.
2. Viết `AsyncEntityCombobox` cho test xanh — props: `label`, `value`, `onChange`, `useOptions`
   (hook trả `{options, isLoading}` theo `search`), `placeholder`.
3. Migrate `attendance.tsx` trước (có e2e phủ) → verify không hồi quy.
4. Viết lại 3 test canh gác **trước** khi đổi từng call site tương ứng.
5. Migrate 4 site còn lại, `receipt-create` cuối (rủi ro tiền cao nhất).
6. E2E smoke: seed >100 classBatch, chứng minh chọn được bản ghi thứ 101 trên `receipt-create`.

## Success Criteria

- [ ] `grep -rn "pageSize: 100" apps/admin/src/pages` → không còn dòng nào **nuôi dropdown**.
- [ ] E2E chứng minh chọn được bản ghi thứ 101 trên `receipt-create`.
- [ ] Không có thay đổi nào trong `apps/api`.
- [ ] 3 test canh gác đã viết lại (không xoá), phản ánh hành vi mới.
- [ ] `pnpm --filter @cmc/ui test` + `--filter @cmc/admin test` xanh.
- [ ] CI `typecheck-and-test` + `ui-e2e` xanh.

## Risk Assessment

- **Seed >100 record cho e2e** có thể làm chậm suite. Mitigation: seed cục bộ trong chính test đó.
- **`receipt-create` là màn hình tiền** — hồi quy ở đây tốn kém. Mitigation: migrate cuối cùng.
- Rollback: revert; API không đổi nên không có migration.
