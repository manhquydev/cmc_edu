# Cook — OpenEduCat P0 CP + primary tím (2026-08-14)

**Branch:** `fix/openeducat-p0-cp-cta-gates`  
**Plan:** `plans/260814-1122-openeducat-p0-cp-cta-gates/`  
**Skill:** `ak:cook` (verify + regression gates; runtime CSS already in #139)

## Outcome

| P0 | Runtime | Evidence |
|----|---------|----------|
| Control panel ~58px one row | Already in #139 densify | Live 11:21: **13/13 list `h_cp=58`** |
| Primary `#71639e`, no `#0071E3` | Already in #139 `--color-accent` remap | Live 11:21: **blue=0**; New/Tạo = `rgb(113,99,158)` |

Audit 09:45 FAIL was pre-merge image (column CP, blue accent). Rebuild admin closed both gates without further CSS.

## This PR slice

1. Unit pins: `console-cp-sheet` one-row 58px; `console-precedence` shell purple vs outside blue  
2. Refresh `live-ui-audit-260814-0945/INDEX.md` success metrics  
3. Plan + this report

## Non-goals left open

P1 search pill · list row density · form summary card · design-gallery statusbar
