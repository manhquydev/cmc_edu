# Phase C — Kanban CRM thôi nói dối số (nhịp-1-only)

**Trạng thái:** thi hành local 2026-08-13, chờ PR · **Công:** ~0.5 ngày
**Branch:** `fix/crm-kanban-count-truth` @ `87f6b30` (worktree; user cấm push)
**Thay cho:** phase 03 cũ (đã superseded — nhịp 2 bị cắt vì scope creep)
**Căn cứ:** `plans/reports/decisions-ba-260813-0800-outstanding-issues.md` (Q2)

## Quyết định nền — đọc trước

`stageCounts` **giữ nguyên** facility-wide (thiết kế có chủ đích, F7, `router.ts:483-495`). FunnelBar tiêu
thụ nó là đúng — funnel là bức tranh tổng. **KHÔNG đổi contract server. KHÔNG làm per-stage query.** Work-queue
vét cạn đã có: `pipeline.tsx:528-533` table view + `?stage=`.

Lỗi khu trú: `pipeline.tsx:504,506` truyền `count={stageCounts[stage.key]}` (tổng facility) vào KanbanColumn,
nhưng thân cột chỉ hiện items trang phẳng 20 (`:503,507-521`). Cột trống mà header "8" + "Chưa có" = nói dối.

## Bất biến phải đạt (BA contract)

1. **Không con số nào trên board mâu thuẫn với thẻ ngay dưới nó.**
2. Empty state phân biệt: `stageCounts[stage]===0` ("giai đoạn này chưa có") vs
   `stageCounts[stage]>0 && stageItems.length===0` ("không có trên trang này · N ở giai đoạn").
3. Funnel giữ facility-wide (không đụng).

## Cách sửa (tối thiểu, giữ public contract)

**File 1 — `apps/admin/src/pages/crm/pipeline.tsx:500-525`:**
- `count={stageCounts[stage.key]}` (`:504,506`) → `count={stageItems.length}` — badge cột = số thẻ đang hiện,
  khớp thân cột. (KanbanColumn không đổi — `console-kanban.tsx:26-40` nhận `count?: number` sẵn.)
- Nhánh empty (`:507-509`): tách hai copy theo bất biến (2). Khi `count>0 && stageItems.length===0` dùng copy
  riêng có số `stageCounts[stage.key]`, **không** dùng `.console-kanban-empty` "Chưa có" trần.

**Không đụng** `console-kanban.tsx` (giữ contract — red-team đã bác việc nới prop). Không đụng router. Không
đụng funnel (`:483-490`).

## Test — `apps/admin/src/pages/crm/pipeline.test.tsx`

Test cũ khóa `count === stageCounts` (badge = tổng facility). Đây là hành vi CŨ CỐ Ý ĐỔI — cập nhật test, và
đây KHÔNG phải vi phạm "đừng revert test" của red-team (đó là cảnh báo chống revert vô ý; đây là đổi có chủ
đích, có tài liệu). Ba case:
1. `stageCounts.O1=5`, 1 item O1 hiện → badge cột O1 = `1` (số thẻ), **không** `5`; funnel O1 vẫn `5`.
2. `stageCounts.O3=2`, 0 item O3 trang này → empty state là copy "không có trên trang này · 2", **không** "Chưa có".
3. `stageCounts.O4=0`, 0 item → "Chưa có".

## Nghiệm thu

- [x] Không màn hình nào hiện số mâu thuẫn thẻ dưới nó — badge = `stageItems.length`; funnel vẫn `stageCounts`; empty tách true-empty vs off-page
- [x] `pnpm --filter @cmc/admin test` (hoặc filter pipeline) xanh, 3 case trên pass — pipeline 32/32 (3 case mới); admin 625/625; `pnpm typecheck` 34/34
- [x] `git diff` chỉ chạm `pipeline.tsx` + `pipeline.test.tsx` (không router, không console-kanban.tsx) — `develop...HEAD` 2 files
- [ ] `typecheck-and-test` + `ui-e2e` xanh trên PR — chưa có PR (user cấm push). Review local Approved 9/10.

## Ngoài scope (đã quyết cắt)

Per-stage query, pager per cột, đổi `stageCounts` theo search, nới prop KanbanColumn. Bảng + `?stage=` là
work-queue vét cạn.
