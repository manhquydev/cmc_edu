---
title: "Clone visual OpenEduCat (pack 36 PNG) vào admin CMC"
description: "SUPERSEDED as full clone execution. Residual chrome debt only — see Residual section. Bridge grammar cook: plans/260814-1656-ui-bridge-crm-e2e-after-d0-d5/"
status: cancelled
priority: P2
effort: residual-only
tags: [ui, openeducat, console, design-system, control-panel, superseded]
created: 2026-08-13
blockedBy: []
blocks: []
supersededBy: 260814-1656-ui-bridge-crm-e2e-after-d0-d5
---

# Clone visual OpenEduCat → CMC admin

> **2026-08-14:** Full clone *execution* plan **superseded** by  
> [`plans/260814-1656-ui-bridge-crm-e2e-after-d0-d5/`](../260814-1656-ui-bridge-crm-e2e-after-d0-d5/).  
> Visual **contract** remains SoT: [`OPENEDUCAT-VISUAL-CONTRACT.md`](../../design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md).  
> Do not resurrect mass clone work here.

## Residual chrome debt (track before closing)

| Gap | Notes |
|-----|-------|
| Control panel / StatActions placement fidelity | Screenshot acceptance vs pack |
| Course-card / kanban person-grid chrome | Non-CRM kanban cards |
| Form sheet / smart-button visual parity | Pack form PNGs |
| Search facet + view-switcher edge cases | If still drifting from contract |

File GitHub issues or a tiny residual plan for rows still open; do not reopen this as P0 mega-clone.

**Hợp đồng visual:** [`design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md`](../../design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md)  
**Phân tích pack:** [`plans/reports/research-260813-openeducat-ui-pack-visual.md`](../reports/research-260813-openeducat-ui-pack-visual.md)  
**Pack:** `/home/manhquy/Downloads/openeducat-ui-pack`

Admin only. LMS không import `console.css`.

## Overview (historical)

CMC đã có shell Odoo-like. Pack 36 PNG chứng minh bốn lệch làm admin **không y hệt**: ControlBar xếp chồng, CTA xanh Apple, kanban SIS không phải lưới thẻ, chatter chưa có. Plan này sửa visual/layout; không đổi nghiệp vụ.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Trong `.o_web_client`, primary = `#71639e`; không còn `#0071E3` trên nút/link/tab/focus | P0 |
| 2 | Control panel = một hàng LEFT / CENTER / RIGHT, cao ~58px, khớp 02/03/14 | P0 |
| 3 | List 40px, không kẻ dọc, status pill, column configurator | P0 |
| 4 | Kanban người = lưới 3 cột ảnh+meta; CRM pipeline giữ cột | P1 |
| 5 | Form: New outline, sheet inset, tabs underline, smart buttons, statusbar 33px lavender | P1 |
| 6 | Search facet chip + view switcher dùng chung | P1 |
| 7 | Chatter dưới form + systray badge — sau data model CRM | P2 |

## Phases

| Phase | File | Status |
|-------|------|--------|
| 01 Token + ControlPanel 3 vùng | [phase-01](./phase-01-tokens-control-panel.md) | implemented (screenshot tay còn) |
| 02 List + view switcher + search facet | [phase-02](./phase-02-list-search-views.md) | implemented |
| 03 Kanban SIS + form sheet | [phase-03](./phase-03-kanban-form.md) | implemented (screenshot tay còn; StatActions CP chưa dời) |
| 04 Chatter + systray (phụ thuộc CRM) | [phase-04](./phase-04-chatter-systray.md) | chrome done; không fake Send/Discuss |

## Success

So sánh tay 1280px với pack: `02` kanban, `03` list, `14` form+ribbon+chatter, `15` status pills. CP không còn 2–3 hàng. Nút New tím, không xanh.

## Out of scope

Website 31–33 · login · CRM pipeline visual (đã có board) · OWL/XML · bịa form student từ file 04 (file đó là Settings).
