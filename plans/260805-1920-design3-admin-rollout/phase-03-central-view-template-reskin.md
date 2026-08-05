---
title: "Phase 3: Central View Template Reskin"
status: completed
priority: P1
effort: "2.5w"
dependencies: [2]
---

# Phase 3: Central View Template Reskin

## Overview

Re-skin các template + archetype dùng chung trong `@cmc/ui` sang ngôn ngữ Odoo.
Cơ chế là **PORT class**: mỗi component restyle chuyển từ emit `tpl-*`/`ck-*`
(premium.css) sang emit `o-*` (odoo.css) — đây chính là bước trả nợ dần cho
Phase 6 (user chốt: port đủ rồi mới gỡ premium). Phủ thật: ~40/55 trang qua 5
template + phần lớn 15 trang bespoke qua 4 archetype bổ sung. An toàn LMS:
LMS không import bất kỳ component nào trong danh sách (đã verify 0 hit).

## Requirements

- Functional: API/props công khai KHÔNG đổi (prop optional mới được phép);
  ~40 trang compile không sửa import.
- Non-functional: style mới trong `odoo.css` scope `.o_web_client`; semantics
  màu TL12 §3 giữ; component đã port không còn emit class `tpl-/ck-` nào.
- Gate: `check-ui-frames` **text-match TÊN component trong source trang**
  (không phải class/marker — round-2 corrected). Phase 3 không sửa source
  trang ⇒ gate không đổi bởi construction; chỉ đụng khi đổi TÊN component
  export (cấm trừ khi cập nhật gate cùng PR, không nới ngưỡng).

## Architecture

| Component | Treatment |
|---|---|
| `DataTable` | **Có markup change (nói thẳng):** thêm wrapper `<div className="o-list">` — Astryx `<Table>` (`data-table.tsx:144-151`) không nhận className, root là `div role="group"` StyleX, KHÔNG có hook. Tận dụng props Astryx sẵn (`density="compact"` đã set, `isStriped`, `verticalAlign`); phần Odoo không reach được qua props (sticky-header inset shadow…) áp lên wrapper. **CẤM** descendant-selector vào class atomic StyleX nội bộ Astryx (vỡ khi Dependabot bump). Ghi nhận affordance không đạt được vào gap ledger. |
| `ControlBar` (restyle tại chỗ) | Thành Odoo control panel: breadcrumb + search + create + view-switcher slot. `ListPage` compose sẵn ControlBar (`list-page.tsx:44`) → mọi list page tự hưởng, KHÔNG thêm band thứ hai. |
| `ListPage` | Wire lại header qua ControlBar mới; giữ FilterBar mapping vào search slot. |
| `DetailPage` | Sheet Odoo (`--odoo-radius-lg`), breadcrumb 2 cấp qua ControlBar, statusbar slot. |
| `FormPage` | Sheet + typography token; giữ layout field (settings-row pattern = YAGNI). |
| `PageHeader` | Breadcrumb-as-title; **accessible name/text hiển thị GIỮ NGUYÊN** (e2e role/text). |
| `ProgressSteps`/`WorkflowStatusbar` (restyle tại chỗ) | Chevron clip-path `.o-steps`; prop shape `activeIndex` GIỮ — 2 call site production không sửa. |
| `EntityHeader` (4 trang detail), `SettingsShell` (3 trang), `DashboardPage` (2 trang: cockpit, revenue-report), `MetricCard` | Port sang `o-*` cùng đợt. Số là render-site thật (round 2 sửa). `MetricCard` kéo vào đợt này vì premium.css có rule cross-component `.tpl-dash-metrics > .ck-mc` (`premium.css:1015`) — port DashboardPage mà bỏ MetricCard là để lại coupling ck- trong odoo.css. |

**Census bắt buộc trước khi port (round-2):** với mỗi component, tách 3 nhóm
rule trong premium.css: (a) tự thân, (b) coupled sang class component khác
(vd `.tpl-wrap--ops .tpl-control-bar` `:813`), (c) **13 khối `@media`** (vd
`.tpl-detail-split:951`, `.tpl-dash-metrics:1017`, `.ck-settings-shell:1235`)
— nhóm (c) PHẢI port kèm, không thì mất responsive collapse. Tiêu chí port
đúng: không còn `tpl-/ck-` trong JSX của component VÀ không có selector
`.ck-*/.tpl-*` trong khối odoo.css thay thế.

Không đổi đợt này: `EmptyState`, `StatCard`, `StatusBadge`, `ConfirmDialog`,
`Panel`, `CommandPalette`, `BulkActionBar`… — typography đã ăn qua Astryx
remap (proof Phase 1); port class của chúng thuộc Phase 6 census.

**FilterBar (quyết định chốt round-2):** GIỮ LẠI làm implementation search/
filter của control panel (restyle) — gate `check-ui-frames` text-match tên
component trong source trang (`filterBarCount>=5`, hiện 6, margin 1); giữ tên
là giữ gate xanh suốt Phase 4-5.

## Related Code Files

- Modify: `packages/ui/src/components/data-table.tsx`, `control-bar.tsx`,
  `list-page.tsx`, `detail-page.tsx`, `form-page.tsx`, `page-header.tsx`,
  `progress-steps.tsx`, `entity-header.tsx`, `settings-shell.tsx`,
  `dashboard-page.tsx`, `packages/ui/src/odoo.css`,
  `scripts/check-ui-frames.mjs` (+`.test.mjs`) nếu marker đổi.
- **Keep green (danh sách thật, theo số assertion class):** `list-page.test.tsx`
  (2 class assertions), `detail-page.test.tsx` (5), `form-page.test.tsx` (1),
  `page-header.test.tsx` (1), `control-bar.test.tsx` (5) — assertion CẤU TRÚC
  đổi theo class mới `o-*`; assertion HÀNH VI (callback, render props, a11y
  name) phải sống nguyên. `data-table.test.tsx` không có class assertion —
  không phải chốt chặn, đừng dựa vào nó.

## Implementation Steps

1. Đọc 10 component + tests, đánh dấu assertion hành vi vs cấu trúc.
2. DataTable wrapper `.o-list` + Astryx props → ui-e2e local ngay (sớm nhất).
3. ControlBar restyle → ListPage/DetailPage hưởng; PageHeader breadcrumb hoá.
4. ProgressSteps chevron; EntityHeader/SettingsShell/DashboardPage port.
5. Cập nhật `check-ui-frames` markers trong cùng PR.
6. Duyệt mắt ≥1 trang/module (~12 trang, bắt buộc gồm cockpit) — ghi gap ledger.
7. PR: `feat(ui): reskin shared templates and archetypes to odoo language`.

## Success Criteria

- [x] 0 trang admin sửa import/props bắt buộc để compile (chỉ rename class
      utility `tpl-detail-*` → `o-detail-*` trên một số detail pages)
- [x] 10+ component port xong không còn emit `tpl-/ck-` (grep className = 0)
- [ ] ui-e2e không tụt so main  **← still open**
- [x] `check-ui-frames` xanh; FilterBar tên giữ (count ≥5)
- [x] LMS không import templates (0 hit) — render path unchanged
- [x] Gap ledger: `reports/phase-03-gap-ledger.md`

## Risk Assessment

- **Đây là điểm hiệu chỉnh (checkpoint) của plan:** sau merge, duyệt tổng thể
  rồi mới chốt lại scope Phase 4-6.
- **Rollback = forward-fix:** từ phase này `odoo.css` được nhiều phase cùng
  sửa; revert sạch chỉ khả thi trước khi phase sau merge. Sự cố sau đó xử lý
  bằng PR sửa tiến, không revert chéo.
- **Cám dỗ nới assertion/gate khi đỏ:** cấm theo Requirements; nếu một
  assertion hành vi buộc phải đổi → dừng, ghi vào plan, hỏi lại.
