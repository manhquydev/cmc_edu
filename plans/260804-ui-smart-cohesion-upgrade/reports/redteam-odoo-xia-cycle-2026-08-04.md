# Red team + Odoo xia cycle — 2026-08-04

## Subagents

| Agent | Scope | Status |
|-------|--------|--------|
| code-reviewer | Full CMC admin UI cohesion | DONE → findings C1–H6 |
| researcher (ak-xia layout) | odoo/odoo 19.0 webclient grammar | DONE → `xia-odoo-layout-grammar-2026-08-04.md` |
| explore | Wireframes vs product vs Odoo gaps | DONE → ADD/REVISE IDs |

## Primary Odoo sources (verified via raw github)

- `addons/web/static/src/webclient/webclient.xml` — NavBar + ActionContainer
- `addons/web/static/src/webclient/webclient_layout.scss` — flex column OS
- `addons/web/static/src/search/control_panel/control_panel.xml` — CP left/center/right
- `addons/web/static/src/views/list/list_controller.xml` — selection replaces search
- `addons/web/static/src/views/form/form_controller.xml` — form CP + renderer

## Port decisions

| Port | Skip |
|------|------|
| CP sticky + scroll body | OWL, XML arch |
| Selection strip / bulk | Purple brand, top-nav transplant |
| Form sheet band order | Side chatter product |
| Settings left rail | Bootstrap theme |

## Cook this cycle

1. Wireframes: +`odoo-control-panel` · `odoo-form-sheet` · `chatter-tab` · `list-bulk` · `master-detail`; revise list/detail/form/settings/pipeline  
2. Student detail: `student.get` deep-link (C1)  
3. Cockpit CTA → `/hr/checkin` (H4)  
4. `check-ui-frames --strict` fails dual-title (C2 partial)  
5. Design Lab red-team panel rebased  

## Scores (this cycle)

Overall cohesion ~**3.5–3.8/5** (depth honest). Grammar+wireframes Odoo map **4/5**.

## Next open (H1/H2/H3)

- FilterBar pass · pager remaining lists · bulk honesty label / one domain bulk
