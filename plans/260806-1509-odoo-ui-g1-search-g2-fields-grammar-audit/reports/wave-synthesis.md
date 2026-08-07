# Wave synthesis — G1 Search · G2 Fields · Grammar audit

**Date:** 2026-08-06  
**Plan:** `plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/`  
**Mode:** Research only (3 parallel agents + controller integration)

---

## Deliverables

| Lane | Report | Lines | Status |
|------|--------|------:|--------|
| G1 | [g1-search-application-playbook.md](./g1-search-application-playbook.md) | ~589 | **Done** |
| G2 | [g2-form-fields-inventory-map.md](./g2-form-fields-inventory-map.md) | ~393 | **Done** |
| Audit | [admin-grammar-coverage-audit.md](./admin-grammar-coverage-audit.md) | ~384 | **Done** |

---

## What we learned (honest)

### 1. Grammar frames are largely adopted — Search is not

| Metric | Value |
|--------|------:|
| Pages with any standard frame | **40 / 55 = 72.7%** |
| Routed pages with frame (ex dialogs/panels) | **40 / 44 = 90.9%** |
| Shell OdooNavbar + `.o_web_client` | **100%** |
| List surfaces with FilterBar | **7 / 23 = 30.4%** (audit snapshot); **post-cook 12/23 ≈ 52%** — see debt list 260806-1538 |

**Implication:** Migrating more pages onto ListPage/DetailPage is **no longer** the main Odoo-parity lever. The hole is **list search chrome** (G1) and **form field primitives** (G2), not missing frames.

Prior design3 claim “~40/55” **validated**. Prior “~45/55” after Settings/Dashboard was **overstated** (double-count).

### 2. G1 Search — research → **playbook**, still no cook

Playbook freezes:

- Always host filters in `ListPage` → ControlBar.
- Today: archetypes A/B/C (1–2 FilterBar fields); copy-paste from real pages.
- Chips / preset menu / GroupBy / Favorites **parked** until re-open triggers.
- Pilots: `finance/receipt-list` (golden C); CRM `aftersale` for select status.

### 3. G2 Form fields — inventory complete; CMC is Astryx not a field registry

- Odoo: **68 widget folders** + shared registry/formatters (not a fake “92 folders”).
- CMC: form **structure** (sheet, statusbar, SectionBlock, KeyValueList) is real; **edit fields** are Astryx primitives without Odoo-style registry.
- Top gaps for “feels like Odoo form”: **date/datetime**, **async many2one**, **inline x2many lines**, **monetary**, **boolean**, **binary/file**.

---

## Ranked next actions (product)

| Rank | Action | Why | Effort |
|------|--------|-----|--------|
| **1** | Use G1 playbook on every **new** ListPage; optionally add FilterBar to high-traffic lists missing it (16/23) | Measurable hole 30% FilterBar; no platform risk | Small per page |
| **2** | Cook **smallest G2 slice**: shared Date field (+ optional Monetary VND) in `@cmc/ui` or thin wrapper | Highest form-feel gap, multi-page | 1–3d |
| **3** | Do **not** cook SearchChrome mega-menu | Lists still 1–2 fields; playbook says so | — |
| **4** | Leave 15 “bespoke” files alone unless product asks | 7 dialogs + 3 panels + auth/coming-soon — correct as non-frames | — |
| **5** | Later: RelationSelect (async m2o), line-editor pattern, boolean toggle | After Date | multi-week |

---

## Updated coverage model (how complete is Odoo UI learning now?)

| Layer | Before this wave | After this wave |
|-------|------------------|-----------------|
| Shell / frames / density | ~75–80% | ~75–80% (unchanged code; audit **measured**) |
| Search OS apply guidance | Research only | **Playbook** (apply-ready) |
| Form field catalog | ~5–10% | **~70%+ catalogued**; code still ~20–30% |
| Project-wide “learn Odoo to apply” | ~30–35% | **~45–50%** (docs), apply still gated by cook |

Still missing for “full Odoo UI bible”: mobile grammar, dialog/dropdown patterns deep dive, calendar/graph layout, optional list interactions (optional columns, cog).

---

## Evergreen links

- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` — Search playbook + form fields inventory pointers  
- `design-system/cmc-edu/VIEW-GRAMMAR.md` — G1 playbook as authority for list filters  

---

## Status

```text
Status: DONE
Summary: Parallel G1 playbook + G2 field map + admin grammar audit complete; frames ~91% of routes, FilterBar ~30% of lists, form field gaps ranked for optional cook.
```
