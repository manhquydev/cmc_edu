# Cook report — Phase D Lane A: DataTable keyboard row-open (2026-08-13)

**Worktree:** `/home/manhquy/.herdr/worktrees/cmc_edu/fix-datatable-keyboard`  
**Branch:** `fix/datatable-keyboard-open` (base develop `bc3f473`)  
**Commit:** `0e71ce0` `fix(ui): mở dòng DataTable bằng một điểm vào bàn phím`  
**Pushed:** no  
**Quy trình:** `/ak-engineer:ak-cook` → `/ak-engineer:ak-test` → `/ak-engineer:ak-code-review`

## Bước 1 — Astryx Table có row-prop không?

**Không.** `@astryxdesign/core` 0.2.0 (`packages/ui/node_modules/@astryxdesign/core/src/Table`).

Đã đọc `Table.tsx` (`TableProps`) và `types.ts` (`BaseTableProps`, `TableColumn`, `BodyRowRenderProps`):

- Không có `onRowClick`
- Không có `rowProps` / `getRowProps`
- Không có `onRowKeyDown`

Có plugin `transformBodyRow` (gắn `htmlProps` lên `<tr>`), nhưng đó không phải prop consumer-facing đúng tên đã chốt. `Table` scroll-wrapper đã có `tabIndex={0}` `role="group"` (cuộn ngang) — không phải điểm mở dòng.

Vì vậy đi **Bước 2**: một điểm-vào-bàn-phím trên cell đầu non-checkbox.

## Cách hiện thực

Chỉ hai file: `packages/ui/src/components/data-table.tsx` + `data-table.test.tsx`. Call-site (users / classes / pipeline / aftersale / rewards / facilities / …) giữ nguyên. Không đụng `console.css`. Không roving-tabindex.

Khi `onRowClick` có:

- Mọi cell vẫn bọc `<div onClick style={{ cursor: 'pointer' }}>` — UX chuột không đổi.
- **Chỉ** `columns[0]` (cột dữ liệu đầu, sau cột checkbox `__select` nếu có) thêm `role="button"` `tabIndex={0}` `onKeyDown` Enter/Space → `e.preventDefault()` + `onRowClick(row)`.
- `aria-label`: ưu tiên `string|number` từ `col.render(...)`; không thì `string|number` raw `row[col.key]`; không thì `"Mở dòng"`. **Không** `String(object)` (tránh `"Mở dòng [object Object]"` trên cột `appUser` / `contact`).
- Guard descendant tương tác giữ selector cũ (`button, a, input, select, textarea, label, [role="button"], [role="checkbox"]`) nhưng loại chính wrapper — nếu không, `role="button"` trên điểm vào sẽ tự chặn click chuột.

Không `onRowClick` → không wrapper, không `tabIndex`, không `role=button` "Mở dòng".

**GitNexus:** `impact(DataTable, upstream)` LOW (d=1: `data-table.test.tsx`; barrel consumers admin không nằm trong call graph). `detect_changes` trước commit: 2 file, 0 process, risk LOW. Public `DataTableProps` không đổi.

## Bằng chứng test đỏ / xanh

Tạm **bỏ `onKeyDown`**, chạy `pnpm --filter @cmc/ui test -- src/components/data-table.test.tsx`, rồi hoàn tác.

**Lần đỏ** (đúng test 2 + 3):

```
 FAIL  src/components/data-table.test.tsx > DataTable row keyboard > calls onRowClick with the row on Enter
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times

 FAIL  src/components/data-table.test.tsx > DataTable row keyboard > calls onRowClick with the row on Space
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times

 Test Files  1 failed | 41 passed (42)
      Tests  2 failed | 157 passed (159)
```

**Lần xanh** sau hoàn tác, rồi cả suite (sau cả fix aria-label object):

```
pnpm --filter @cmc/ui test
 Test Files  42 passed (42)
      Tests  160 passed (160)
```

RTL trong `data-table.test.tsx` (9 tests, gồm 2 selection cũ):

1. `onRowClick` → mỗi hàng một `role=button` `tabIndex=0` (`Mở dòng Alpha` / `Mở dòng Beta`)
2. Enter → `onRowClick` đúng row
3. Space → `onRowClick` đúng row
4. click/Enter trên button con `"Hành động"` → không gọi `onRowClick`
5. không `onRowClick` → không có điểm-vào (`queryByRole('button', { name: /Mở dòng/ })` null)
6. (bổ sung review) render `appUser.fullName` → `"Mở dòng Nguyễn Văn A"`, không `[object Object]`; cột 2 không phải button
7. (bổ sung) click chuột trên entry và cell khác vẫn mở dòng

**Typecheck:** `pnpm typecheck` — `Tasks: 34 successful, 34 total` (48s; `@cmc/db` cache hit, không cần `db:generate`). `@cmc/ui typecheck` sau fix label: xanh.

**ui-e2e không chạy local** — CI canh (`typecheck-and-test` + `ui-e2e` trên PR).

**Review:** `ak-engineer:tester` DONE — 42/42 file, 159 rồi 160 tests, 34/34 typecheck. `ak-engineer:code-reviewer` vòng 1 REQUEST_CHANGES (aria-label `String(object)`); vòng 2 APPROVE sau khi sửa + test `appUser`.

## `git diff --stat` (commit `0e71ce0`)

```
 packages/ui/src/components/data-table.test.tsx | 118 +++++++++++++++++++++++++
 packages/ui/src/components/data-table.tsx      |  58 +++++++++---
 2 files changed, 165 insertions(+), 11 deletions(-)
```

## Rủi ro e2e (CI)

- `findInList` dùng `table tbody tr` + text hàng — thêm wrapper trong cell **không** đổi selector hàng.
- Mỗi hàng list có thêm **một** `role="button"` tên `"Mở dòng …"`. Journey hiện gọi `getByRole('button', { name: 'Mở phiếu' | 'Duyệt' | 'Tiếp nhận' | … })` — không trùng tên.
- Rủi ro thật: assertion **đếm** `getByRole('button')` không lọc tên; hoặc `getByRole('button', { name: <text cột đầu> })` nếu text cột đầu trùng accessible name cũ. Cột đầu là object + render ra chuỗi thì name là `"Mở dòng <chuỗi>"`, không phải raw object.
- Focus ring do Lane khác (`console.css` / primitive) — Lane A không đụng CSS. Theme đã có `[role='button']:focus-visible` trong `astryx-theme-cmc.css` (reviewer ghi nhận).
- Nested interactive nếu cell đầu *chỉ* chứa button: thêm một tab-stop wrapper. Guard chặn double-fire. Không đổi call-site.

Rollback = revert `0e71ce0` (render-only, không state/migration).

LANE A DONE
