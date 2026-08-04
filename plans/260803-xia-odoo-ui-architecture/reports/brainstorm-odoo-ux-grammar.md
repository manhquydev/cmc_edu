# Brainstorm contract: Odoo-like UX grammar for CMC EDU

**Date:** 2026-08-03  
**Skills:** ak-brainstorm  
**Evidence:** xia compare + scout explore (same plan folder)

---

## Outcome

Admin ERP feels like **one product OS** (Odoo-grade muscle memory): every list, detail, form, and dashboard reuses the same chrome grammar and visual system. Modules only swap data, permissions, and tabs—not full-page layouts.

User-visible end state:

- Opening any list: same sticky ops band (title · filters · pager · primary CTA).
- Opening any entity: same DetailPage recipe (header → entity → summary? → tabs? → sections).
- Agents and humans never invent a fifth full-page layout.
- Brand stays CMC (warm canvas, Inter, `#0071E3`) — not Odoo purple/Bootstrap.

## Constraints

| Constraint | Detail |
|------------|--------|
| Stack | React + Astryx + `@cmc/ui` only — no OWL, Bootstrap second system, shadcn/Tailwind |
| Solo + AI ops | Prefer composition over DI registries / declarative XML views |
| Facility tenancy | Real facility session — no fake multi-company switcher |
| Existing frames | Extend List/Detail/Form/Dashboard — do not replace |
| Quality gates | typecheck + focused vitest; CI green before "done" |
| Brand | MASTER.md tokens locked |
| Prior decision | Port **interaction grammar** only (xia compare 2026-08-03) |

## Non-goals

- Port Odoo web client / OWL / QWeb / SCSS Bootstrap stack
- Full SearchModel + domain favorites DSL
- Generic Kanban engine before 2+ boards need it
- Full mail chatter (ActivityTimeline is enough)
- LMS student/parent app redesign in this plan
- Backend/schema changes for UI grammar
- Visual rebrand away from warm premium system

## Acceptance criteria (observable)

1. **Law:** `design-system/cmc-edu/VIEW-GRAMMAR.md` exists and is linked from PAGE-FRAMES + `packages/ui/llms.txt`.
2. **ControlBar (or equivalent ListPage slots):** every *migrated* list shows one sticky ops chrome pattern; unit tests cover the composite.
3. **Adoption delta:** Priority list pages that currently skip ListPage (students, classes, courses, payroll list at minimum) use ListPage; entity details already on DetailPage stay compliant.
4. **List ops pack:** `ListPagination` used on ≥1 production list (receipt or users); Design Lab shows ControlBar/recipe live.
5. **No second system:** grep / review confirms no new full-page layout CSS outside `.tpl-*`.
6. **Tests:** `@cmc/ui` frame tests + touched admin page tests pass.

## Approaches compared

| # | Approach | Pros | Cons | Verdict |
|---|----------|------|------|---------|
| A | **Law only** (VIEW-GRAMMAR + doc) | Cheap, unblocks agents | Zero user-visible sync | Insufficient alone |
| B | **Law + ControlBar + finish high-traffic adoption** (lists + detail law) | High sync ROI; reuses atoms | Multi-page migration work | **Recommended** |
| C | **Full Odoo parity** (view switcher, action stack, widget kit, all pages) | Max cohesion | Multi-sprint; YAGNI risk | Defer phases |

**Chosen direction (pending advise confirm):** Approach **B** with phased optional C.

## Risks

- Scope creep into “rebuild every page”
- BulkActionBar needs DataTable selection — large; defer if not P1
- Stale docs claim “21/21 on templates” — measure from scout, not docs

## Handoff

→ ak-research synthesis + ak-advise confirm scope → ak-plan (phases) → red-team → validate → ak-cook → ak-test
