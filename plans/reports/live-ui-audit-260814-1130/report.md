# Live crop vs pack 03 / 14 — soft-square + summary-in-sheet

**Date:** 2026-08-14 11:30–11:40 (+07)  
**Target:** `https://erp.localhost` after `scripts/rebuild-cmcv2-admin.sh` (×2)  
**Artifacts:** `plans/reports/live-ui-audit-260814-1130/` (`compare-03-14.json`, `crops/`)

## Pack 03 — Students list

| Check | Pack 03 | Live CMC | Result |
|-------|---------|----------|--------|
| CP height | ~58 | **58** | MATCH |
| Search height | ~35 | **35** | MATCH |
| Search radius | pill | **999px** | MATCH (đúng pack; không soft-square) |
| Avatar systray | ~4px vuông | **4px** | MATCH |
| Role text | plain | `.console-systray-db` “Quản trị hệ thống” | MATCH |
| New + table 25 rows | có | empty search-gate (≥2 ký tự) | **PRODUCT-GAP** |

Shots: `crops/cmc-students-list-after.png` · `crops/pack-03-students-list.png`

## Pack 14 — Form sheet grammar

Measured opportunity / class / receipt (known IDs from morning follow-up).

| Check | Before rebuild #2 | After (DetailPage + flatten) |
|-------|-------------------|------------------------------|
| Sheet pad | 24×32 | 24×32 |
| Sheet radius | 4px | 4px |
| Statusbar in sheet / first child | yes / yes | yes / yes |
| Summary **before** sheet (canvas card) | **yes** | **no** |
| Summary **inside** sheet | no | **yes** (after statusbar) |
| HighlightStrip border / bg | 1px solid / white card | **0 / transparent** |

Sheet child order after fix: `statusbar → summary → entity → tabs|body`  
Shots: `crops/cmc-form-*-before-summary-fix.png` · `crops/cmc-form-*-after.png` · `crops/pack-14-admissions-register-form.png`

## Code shipped for summary

- `DetailPage`: `summary` moved **into** `.console-form-sheet` (after statusbar).
- `console.css`: flatten `.console-highlight` inside sheet/summary.
- Tests: `detail-page.test.tsx`, `console-cp-sheet.test.ts`.

## Still unlike pack 14 at arm’s length

- StatActions still in summary band (pack: smart button on CP right).
- EntityHeader + tabs density / blue leftovers on some CTAs (re-check after next walk).
- Students list is not a SIS table (product).
