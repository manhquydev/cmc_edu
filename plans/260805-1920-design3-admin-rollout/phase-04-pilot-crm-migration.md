---
title: "Phase 4: Pilot CRM Migration"
status: todo
priority: P1
effort: "3w"
dependencies: [3]
---

# Phase 4: Pilot CRM Migration

## Overview

**Hiện trạng thật (red-team verified):** `crm/pipeline.tsx` ĐÃ là stage board
(grid Panel theo `STAGES` O1→O5, `byStage` grouping `:270-282`, optimistic
stage-advance `:235-243`, control panel tự chế `:293-343`);
`opportunity-detail.tsx` ĐÃ có `WorkflowStatusbar` (`:358`). CRM KHÔNG có list
view.

**Scope (user quyết 2026-08-05, đảo non-goal "no KanbanBoard" của plan
260803-2043 có phê duyệt):** làm CRM thành module Odoo hoàn chỉnh —
(a) port board hiện có sang `KanbanBoard`; (b) **XÂY MỚI list view DataTable
cho opportunities** (feature work có acceptance criteria riêng); (c)
view-switcher list↔kanban với lựa chọn view trong URL query (TL6); (d)
statusbar detail đã chevron-hoá từ Phase 3 — chỉ wire click-to-advance nếu
hành vi hiện có cho phép.

## Requirements

- Functional: kanban giữ nguyên hành vi board cũ (advance stage, counts,
  funnel, lost-visibility selector); list view mới đọc CÙNG query, không API
  mới; switcher phản ánh vào URL query, deep-link được.
- Feature-work acceptance (list view): cột mirror data trên card (tên, phụ
  huynh/contact, stage, owner, giá trị nếu có — chốt cột lúc cook theo open
  question #3 của plan.md); sort/filter tối thiểu = những gì query hiện có hỗ
  trợ, KHÔNG thêm param backend; empty state + loading dùng chuẩn DataTable.
- Non-functional: stage hiện tại = brand blue "bạn ở đây" (TL12 §3); kanban
  accent map `--odoo-kanban-color-1..6`.
- Gate: `check-ui-frames.test.mjs` assert `opportunity-detail` full-tier (chứa
  `WorkflowStatusbar`) — nếu đổi cách render statusbar thì re-point assertion
  TRONG CÙNG PR.

## Architecture

- **Cache (round-2 corrected, bỏ framing "shared hook bắt buộc"):**
  `onSettled` đã `invalidate()` toàn bộ key `opportunityList` không filter
  (`pipeline.tsx:255-257`) ⇒ hai view TỰ hội tụ sau round-trip; hazard chỉ là
  cửa sổ optimistic. **Quyết định v1 (KISS):** list view dùng CHUNG `listInput`
  nguyên trạng — không sort/page độc lập (ràng buộc ghi rõ, khớp "sort/filter
  tối thiểu"); optimistic `setData` vì thế áp cả hai view tự nhiên. Nếu sau
  này cần sort/page riêng → mỗi view own input + `setData` cả hai key (ghi
  nhận là follow-up, không làm ở pilot).
- Kanban: `KanbanBoard` từ `@cmc/ui` (Phase 1); drag-drop KHÔNG làm — advance
  bằng nút như hiện tại.
- Switcher: nút trên ControlBar (slot Phase 3); param đặt theo convention TL6
  (đọc TL6 trước khi đặt tên).
- Mọi fix component phát sinh → `packages/ui` cùng PR + ghi **gap ledger** vào
  PR description (đầu vào Phase 5).

## Related Code Files

- Modify: `apps/admin/src/pages/crm/pipeline.tsx` (+`pipeline.test.tsx` — có
  4 assertion class, cập nhật cấu trúc, giữ hành vi),
  `apps/admin/src/pages/crm/opportunity-detail.tsx` (nếu statusbar wire),
  `packages/ui/src/odoo/*` + `odoo.css` (gap fix),
  `scripts/check-ui-frames.mjs`/`.test.mjs` nếu marker đổi.
- Create: list-view component trong `apps/admin/src/pages/crm/` (tách file nếu
  pipeline.tsx phình — theo module boundary hiện có).
- E2E: journeys CRM hiện có (`grep -rl crm apps/e2e/tests`) — thêm bước smoke
  "mở list view + switch về kanban" vào journey CRM hiện có, không tạo suite mới.

## Implementation Steps

1. Scout `crm/` (21 file) + journeys CRM; chốt danh sách cột list view (hỏi
   nếu data card không đủ rõ).
2. Port board → KanbanBoard; list view share `listInput` nguyên trạng; verify
   optimistic advance hiển thị ở cả 2 view.
3. Xây list view + switcher + URL param.
4. Wire statusbar detail (nếu hành vi cho phép); re-point check-ui-frames nếu cần.
5. ui-e2e + duyệt mắt toàn bộ CRM; ghi gap ledger.
6. PR: `feat(crm): migrate crm to design3 patterns with list-kanban switcher`.

## Success Criteria

- [ ] Kanban giữ đủ hành vi board cũ (advance, counts, funnel, lost filter)
- [ ] List view mới + switcher, view choice deep-link được qua URL
- [ ] Optimistic advance hiển thị đúng ở CẢ hai view (test)
- [ ] Không API/backend change; `check-ui-frames` xanh không nới ngưỡng
- [ ] ui-e2e không tụt so main (kèm smoke switcher); gap ledger ghi trong PR

## Risk Assessment

- **List view phình thành feature lớn:** khoanh bằng acceptance ở Requirements
  (không param backend mới, cột mirror card). Vượt khung → dừng, cập nhật plan.
- **Cache hai view lệch nhau:** xử lý bằng shared input hook + test riêng
  (bước 2 làm TRƯỚC khi xây list view).
- Rollback: forward-fix (odoo.css dùng chung); revert sạch chỉ trước khi
  Phase 5 bắt đầu merge.
