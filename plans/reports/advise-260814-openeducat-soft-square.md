# Advise — OpenEduCat soft-square (bo vuông góc)

**Date:** 2026-08-14  
**Route:** design-visual | epic | elevated | domains: OpenEduCat pack + console tokens  
**Skills:** `ak:agentkit` → `impeccable` (Operate / layout refine) + pack authority  
**Authority:** `/home/manhquy/Downloads/openeducat-ui-pack` + `OPENEDUCAT-VISUAL-CONTRACT.md`

## Verdict

CMC lệch pack không chỉ vì màu: còn **bubble geometry** (avatar tròn, chip/dash pill, session card 12–14px, sheet pad 14/16). OpenEduCat dùng **soft-square 4px** cho nút / sheet / card / avatar; **chỉ** search + status list capsule mới pill.

## Geometry contract (đã khóa)

| Surface | Radius | Note |
|---------|--------|------|
| Button / input / sheet / kanban card / facet | **4px** | “Bo vuông góc” = soft-square, không 0 cứng |
| Search bar | **999px** | Pack 02/03/15 — giữ pill |
| List status (Draft/Done) | **999px** | Solid capsule |
| Avatar / systray avatar | **4px** | Vuông bo nhẹ, không circle |
| Form sheet padding | **24×32** | Pack form density |

## Shipped this session

- `packages/ui/src/console.css` — remap `--console-radius-lg` / card lg → 4px; sheet pad 24/32; avatars + session cards + dash chips + callouts + conversion strip soft-square; nested sheet panels flatten.
- `apps/admin/src/shell/shell.tsx` — role systray: plain `.console-systray-db` text (pack DB name), bỏ Badge pill.
- Contract + `console-tokens.test.ts` pin soft-square.

## Still open (không giả CSS)

- Search pill đo 0/4 trên vài list (BulkActionBar stack / measure) — grammar CP footer.
- Form summary HighlightStrip còn trên canvas (pack 14: ribbon trong sheet).
- Product gaps: SIS photo kanban, Discuss badge giả, … (INDEX live audit).

## Non-goals

- Port OWL / website 31–33.
- Đổi `--console-search-radius` về 4 (trái pack).
- LMS `tokens.css` bubble radius (ngoài `.o_web_client`).
