# Delta — Odoo dissection refresh 2026-08-06

**Pin:** unchanged `7de220c941c77d4fffdc270a7862c69475fa4577` @ `19.0`  
**Brainstorm:** `plans/reports/brainstorm-260806-odoo-ui-dissection-refresh.md`

## Code vs prior report

| Item | Was | Now |
|------|-----|-----|
| Form `.o-form-sheet-bg` + `.o-form-sheet` | PARTIAL in matrix | **SHIPPED** (DetailPage/FormPage + CSS + unit tests) |
| Navbar z-index 1000 | Source fix noted | Confirmed in `odoo.css`; **live deploy audit still open** |
| ControlBar L/C/R | PARTIAL | Still PARTIAL (column densify preferred over full 3-col) |
| Brand label | Unresolved | **Decision:** module/app name like Odoo (cook later; still “CMC EDU” in code) |

## Process

- Re-run checklist in parent `plan.md` § Process when pin or shell drifts.  
- Next analytical pass: `/ak:xia` local odoo-src `--compare` (see brainstorm xia brief).

## No code cooked this delta
