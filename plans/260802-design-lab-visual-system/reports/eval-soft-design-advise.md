# Eval · Research · Advise — Soften CMC design (from Design Lab)

**Date:** 2026-08-02  
**Surface:** http://127.0.0.1:5173/design  
**Skills:** ak-brainstorm · ak-research · ak-advise  

---

## 1. Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Admin feels **thân thiện / mềm** more while staying ops-dense ERP; brand Inter + #0071E3 kept. |
| **Constraints** | No second stack; change tokens + premium + Astryx theme map; no BI charts; attendance touch ≥44px. |
| **Non-goals** | Font family swap; dark mode; LMS frame; pastel metrics; orange CTAs. |
| **Acceptance** | Tokens/Astryx radius map/premium cards/PageHeader soft; Design Lab + cockpit/list feel softer; typecheck + ui tests green. |

---

## 2. Evaluation of Design Lab (as-shown)

### Strengths (keep)
- One brand blue, Inter, warm canvas intent  
- Composite cockpit (Metric/Panel/Inbox/Funnel) already better than bare forms  
- Clear token inventory on `/design`  

### Hardness sources (ranked)

| # | Finding | Impact | Fix lever |
|---|---------|--------|-----------|
| **P0** | `astryx-theme-cmc.css` maps **all** Astryx radii → `--cmc-radius-xs` (4px) | Inputs, cards, dialogs all sharp | Map element/inner→xs, **container→md**, **page→lg** |
| **P0** | Cards flat (no rest border/shadow) | “Paper stickers”, cold | Whisper border + shadow-sm rest |
| **P1** | PageHeader full-bleed bar + hard border | Cuts page like a toolbar | Soft card header |
| **P1** | radius-xs 4 / md 12 | Form vs card generational gap | xs 8, md 16, lg 20 |
| **P2** | Border `#d2d2d7` cool gray | Technical spreadsheet | Warmer softer hairlines |
| **P2** | Row hover → canvas | Slightly harsh | Hover → sunken |

### Research notes (enterprise soft, 2024–26 patterns)
- Soft B2B (Linear-adjacent / modern SaaS ops): **8–16px controls**, card **1px hairline + soft shadow**, warm neutrals.  
- Apple HIG-ish ERP: surface contrast **plus** subtle elevation for primary cards (not pure Notion flat).  
- Avoid: glass, gradients, multi-accent, huge consumer whitespace.

---

## 3. Advise — chosen approach

**Promote Softer Lab → production tokens** (not a parallel theme).

| Lever | From | To |
|-------|------|-----|
| `--cmc-radius-xs` | 4px | **8px** |
| `--cmc-radius-md` | 12px | **16px** |
| `--cmc-radius-lg` | 16px | **20px** |
| Canvas / borders | cool flat | warmer hairlines |
| Shadow-sm | black 0.06 | warm-tint whisper |
| Cards `.ck-mc` `.ck-pnl` | flat | border-subtle + shadow-sm |
| PageHeader | sticky slab | soft card |
| Astryx radius map | all xs | scale to tokens |

**Rollback:** revert tokens.css + astryx-theme + premium page-header block.

---

## 4. Implementation this session

See code changes in `packages/ui` (tokens, astryx-theme, premium, page-header) + Design Lab note update.
