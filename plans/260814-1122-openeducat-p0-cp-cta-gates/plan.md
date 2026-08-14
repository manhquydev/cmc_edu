---
title: "OpenEduCat P0 — CP 58px + primary tím (gates)"
description: "Chứng minh live sau rebuild #139 và khóa regression: ControlBar một hàng 58px + accent #71639e dưới .o_web_client."
status: completed
priority: P0
effort: hours
tags: [ui, openeducat, control-panel, tokens, regression]
created: 2026-08-14
blockedBy: []
blocks: []
---

# OpenEduCat P0 — CP 58px + primary tím

**Parent:** [`260813-2038-openeducat-visual-clone`](../260813-2038-openeducat-visual-clone/plan.md)  
**Contract:** `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` §2–3  
**Audit:** `plans/reports/live-ui-audit-260814-0945/` (baseline 09:45 predates #139; re-run 11:21 after rebuild)

## Brainstorm contract

| Field | Value |
|-------|--------|
| Outcome | List CP ∈ 54–62px; solid primary under `.o_web_client` = `#71639e`; 0 `#0071E3` fill on smoke walk |
| Constraints | Không đổi `tokens.css` LMS blue; không port OWL; branch + PR vào `develop` |
| Non-goals | Search pill P1; list row density P1; form summary card; design-gallery statusbar |
| Acceptance | Live audit ≥8 list `h_cp` 54–62 + `blue=0`; unit pins CP row + accent purple; `packages/ui` tests xanh |

## Scout verdict

CSS densify + accent remap **đã land** ở #139 (`develop@52602de`). Audit 09:45 đo image cũ. Sau `rebuild-cmcv2-admin.sh` (11:21): 13 list/kanban `h_cp=58`, `blue=0`, primary `rgb(113,99,158)`.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Verify live + pin unit gates](./phase-01-verify-and-pin.md) | completed |

## Risks

MEDIUM — test-only change; blast radius = false fail if someone reverts densify/accent remaps intentionally.
