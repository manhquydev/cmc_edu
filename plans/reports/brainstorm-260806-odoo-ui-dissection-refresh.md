# Brainstorm: Odoo UI dissection refresh → Xia compare brief

**Date:** 2026-08-06  
**Modes:** none (`--html`/`--wiki` not requested)  
**Status:** approved design; docs/process refresh in same session  
**Branch context:** `feat/design3-admin-rollout`

---

## Problem statement

Staff admin needs **professional Odoo-like layout grammar**. Team already has pin + first dissection; pain now is **docs/matrix drift vs shipped code** and need a clean authority package for **`/ak:xia --compare`** (understand Odoo UI before any further port/cook).

### Problem-first (compressed)

| Item | Content |
|------|---------|
| Solution jump | “Build Odoo dissection business / clone layouts” |
| Underlying problem | Unstable ERP feel + AI ports surfaces without layout authority |
| Evidence | Medium–Strong (pin, plan, unit tests, frontend audit, live form-sheet ship) |
| Chosen frame | **A** — keep process; refresh authority; then xia compare |

---

## Requirements (locked)

| # | Requirement |
|---|-------------|
| Output | Brainstorm report + refreshed dissection + evergreen map + process checklist + **xia brief** |
| Acceptance | Form sheet status = SHIPPED; matrix matches code; checklist runnable; xia command scoped to grammar |
| Out of scope | OWL/XML/Bootstrap port; purple interactive; LMS/TL12; chatter/pivot/bottom-sheet; cook UI this round |
| Constraints | Pin `odoo/odoo@19.0` local `/home/manhquy/Downloads/odoo-src`; accent `#0071E3`; Inter stays |
| Touchpoints | `plans/260806-odoo-ui-component-dissection/**`, `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`, (read-only) `packages/ui` |

### Product decision

- **Navbar brand:** show **current module/app name** (Odoo behaviour). Today still fixed “CMC EDU” → cook later; decision recorded.

---

## Approaches evaluated

1. Doc-only status fix — fast, thin process  
2. **Doc refresh + process harden** ✅ chosen  
3. Refresh + cook P1 immediately — deferred after xia/plan  

---

## Recommended solution

**Approach 2 + xia handoff:**

1. Re-verify Odoo pin `7de220c941c77d4fffdc270a7862c69475fa4577` (unchanged).  
2. Refresh wireframe/matrix: form dual sheet **SHIPPED**; mark stale PARTIAL rows.  
3. Harden Step 0–5 checklist + dated delta under plan `reports/`.  
4. Hand off compare brief for `/ak:xia` (no implementation in xia `--compare`).

---

## Research summary (2026-08-06 refresh)

Source-read: webclient, navbar, control_panel, list, form, kanban (XML/SCSS). CMC verified: `.o-form-sheet-bg` / `.o-form-sheet` in `DetailPage`/`FormPage`; navbar `z-index: 1000`; ControlBar still column not Odoo L/C/R.

| Gap | Pri | Note |
|-----|-----|------|
| Live re-audit navbar cover after deploy | P0 | `design3-frontend-audit.mjs` |
| Brand → module name | P1 | product decision; not yet code |
| ControlBar densify / optional L/C/R | P1–P2 | densify first |
| Sticky statusbar md+ gate | P1 | match form_controller.scss |
| ViewSwitcher extract | P2 | when 2nd list↔kanban |
| Sticky thead live proof | P2 | CSS present |
| Mobile scroll-owner flip | P2 | product arch |
| ck→o rename | P3 | debt |

---

## Xia brief (next session)

**Full anti-sprawl playbook:** `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md`

Never xia whole Odoo. Run **one surface per command**:

```text
/ak:xia /home/manhquy/Downloads/odoo-src \
  "webclient shell navbar scroll-owner stacking z-index" --compare
```

Then form → control_panel → list → kanban (see map §3).

**Include paths (repomix):** per-surface globs in AGENT-COMMAND-MAP §3.  
**Local compare targets:**  
`packages/ui/src/odoo.css`, `odoo/odoo-navbar.tsx`, `components/{list,detail,form}-page.tsx`, `control-bar.tsx`,  
`docs/design-system-odoo.md`, dissection report.

**Rules for xia:** grammar/slots/sticky/tokens only — do **not** recommend OWL/XML/Bootstrap transplant.

**Prior xia (superseded shell notes):**  
`plans/260804-ui-smart-cohesion-upgrade/reports/xia-odoo-layout-grammar-2026-08-04.md`

---

## Success metrics

- [x] Design approved (Approach 2)  
- [x] Dissection + map statuses match shipping code  
- [x] Plan checklist + delta note written  
- [ ] Xia compare run produces fresh layout/IA brief (follow-up)  
- [ ] Optional: `/ck:plan` for brand-module + P1 densify after xia  

---

## Next steps

1. Apply doc refresh (same session as this report).  
2. Run `/ak:xia … --compare` with brief above.  
3. `/ck:plan` for cook packages: brand-as-module, CP densify, sticky md+, ViewSwitcher if warranted.
