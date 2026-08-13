> **SUPERSEDED 2026-08-13.** Không thi hành file này nguyên trạng.
> Red-team: `plans/reports/redteam-adjudication-260813-0139-design-system.md`.
> BA Q2 đảo về nhịp-1-only + cắt nhịp 2: `plans/reports/decisions-ba-260813-0800-outstanding-issues.md`.
> Phần còn hiệu lực: `phase-C-crm-kanban-truth.md`.

# Phase 03 — Kanban CRM thôi nói dối số

**Trạng thái:** superseded bởi C · **Công:** 2–3.5 ngày (nhịp 1: 0.5–1d, nhịp 2: 1.5–2.5d — cắt)
**Branch:** `fix/crm-kanban-count-truth` từ `develop` (nhịp 1), `feat/crm-kanban-per-stage` (nhịp 2)
**Bằng chứng:** `plans/reports/brainstorm-260813-0120-q2-kanban-crm.md`,
`plans/reports/audit-260813-0052-ds-l2-components.md` (P0-1)

## Vấn đề

`pipeline.tsx` chạy **một query phẳng `pageSize:20`** (`:34,287-293`), `groupBy` items (`:342-351`), rồi lấy
count và empty-state từ `stageCounts` (`:504-508`). API đã tách đúng "items trang này" và "tổng giai đoạn";
UI gộp hai thứ thành **một chữ số**. Sale nhìn thấy cột ghi "Đã kiểm tra 8" bên trên chữ "Chưa có".

**Hai nhịp nằm cùng phase này, không tách sang backlog.** Nhịp 1 gắn nhãn cho con số; nhịp 2 mới làm nó
với tới được. Dừng ở nhịp 1 = để sale quyết trên con số họ không mở được.

## Nhịp 1 — nói thật phần thiếu

Badge **giữ** `stageCounts` (contract này đang bị khóa bởi `pipeline.test.tsx:13-14,58-60` — đừng đảo).

| Chỗ | Sửa |
|---|---|
| `pipeline.tsx:504-508` | Empty state **chỉ** khi `count === 0`. Khi `count > 0 && stageItems.length === 0` → copy riêng "0 trên trang này · N ở giai đoạn". **Cấm** `.console-kanban-empty` "Chưa có" ở nhánh này |
| `pipeline.tsx:353-354` + header cột | Badge hiện `visible/total` (vd. `1/5`) khi lệch; chỉ `count` khi khớp |
| `pipeline.tsx:481-488` funnel | **Giữ nguyên** tổng — đây là con số để ra quyết định |
| `packages/ui/src/console/console-kanban.tsx:20-29,35` | `count` nhận `ReactNode`, hoặc thêm prop `visible?`. Hiện chỉ nhận số trần |

### Test nhịp 1 — `pipeline.test.tsx`

Sửa `:153-166` và thêm:
1. `stageCounts.O1 = 5`, 1 item O1 → badge chứa cả `1` và `5`, không chỉ `5`
2. `stageCounts.O3 = 2`, 0 items → **không** hiện "Chưa có"
3. `stageCounts.O4 = 0`, 0 items → vẫn hiện "Chưa có"

## Nhịp 2 — query per-stage

**Không cần endpoint mới.** Đã có sẵn:
- Lọc theo stage: `opportunityListInput.stage` (`apps/api/src/.../router.ts:102,450`), test `list.test.ts:58-66`
- Đếm: `stageCounts` + `lostCount` (`router.ts:474-495,519`), test `list.test.ts:129-146`
- Paging/search/lost: `router.ts:101-112,453-480`

Làm tối thiểu (YAGNI): **5 `useQuery`** `opportunityList({ stage, lost, search, page: colPage[stage], pageSize: 20 })`,
pager **per cột**. Chỉ mở endpoint `opportunityBoard` nếu đo được 5 round-trip là chậm thật — đừng mở trước.

**Sửa kèm:** `stageCounts` hiện cố ý bỏ qua `search` (`router.ts:483-491`). Board có lọc thì count phải đếm
theo cùng `where` với items, nếu không lọc "Nguyễn" vẫn ra số toàn facility.

### Test nhịp 2

RTL: gọi đủ 5 lần với `{stage:'O1_LEAD'|...}`; pager cột O1 không làm đổi page cột O2.
API `list.test.ts`: thêm case `stage` + `search` → `items.length === total` trên fixture nhỏ; nếu sửa
`groupBy` theo search thì assert `stageCounts` co lại đúng.

## Cấm

Nâng `PAGE_SIZE` lên 100 (`router.ts:112` cho phép max 100) rồi gọi là xong. Vỡ ở bản ghi thứ 101 và CI
không bắt được.

## Nghiệm thu

- [ ] Không màn hình nào hiện con số mâu thuẫn với thẻ bên dưới
- [ ] Sale mở được mọi thẻ trong một giai đoạn (pager per cột)
- [ ] Lọc theo tên thì số trên cột co lại theo
- [ ] Unit/RTL là cổng chính (`typecheck-and-test`); `ui-e2e` chỉ smoke, không assert count
- [ ] Cả hai nhịp merged — không đóng phase khi mới xong nhịp 1

## Rủi ro

| | Rủi ro |
|---|---|
| Nhịp 1 | Sale thấy `1/5` vẫn tưởng cột có 5 thẻ; agent sau revert test `:153-166` về assert cũ |
| Nhịp 2 | Cache/optimistic của `handleAdvance` (`:297-318`) lệch giữa 5 query key; payload gấp 5; `ui-e2e` dễ flaky nếu chạm journey CRM |