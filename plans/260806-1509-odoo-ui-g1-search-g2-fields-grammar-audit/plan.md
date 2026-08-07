---
title: "Odoo UI G1 Search · G2 Fields · Grammar Audit"
description: "Parallel research wave: Search OS application playbook, form-field inventory map, and admin page grammar coverage audit. Research-only unless cook triggers fire."
status: completed
priority: P1
effort: "1 session research + optional cook later"
tags: [design-system, odoo, design3, search, form-fields, audit]
created: 2026-08-06
---

# Odoo UI — G1 Search playbook · G2 Form fields · Grammar audit

## Outcome

Staff and agents have **three durable research products** so Odoo UI learning covers more than shell layout:

1. **G1** — How to apply Search OS (Filters · facets lite · presets) on CMC ListPages without OWL/SearchModel.
2. **G2** — Inventory of Odoo form field/widget grammar → CMC/Astryx analogues + gaps.
3. **Audit** — Measured % of `apps/admin` pages already on design3 grammar (frames + chrome).

## Constraints

- Research + docs only in this wave (no SearchChrome/field widget cook unless product re-opens).
- Odoo pin: `/home/manhquy/Downloads/odoo-src` @ `7de220c9` (19.0).
- Allowlist still applies for source reads; G2 may **catalog** `views/fields/*` names + patterns without porting OWL.
- LMS / premium out of scope for audit counts (admin only).
- Parent context: `plans/260806-odoo-ui-component-dissection/` + design3 rollout.

## Non-goals

- Port SearchModel, DomainSelector, ir.filters server.
- Port 92 OWL field widgets.
- Rebuild CP L/C/R or Settings search.
- Change LMS TL12.

## Acceptance

- [x] G1 playbook written under `reports/` + phase-02 checkboxes done
- [x] G2 field map written under `reports/` + phase-03 checkboxes done
- [x] Audit report with denominators, % frames, list of outliers under `reports/` + phase-04 done
- [x] `plan.md` phases marked complete; evergreen map links updated (G1/G2 sections)
- [x] Synthesis in phase-01 with ranked next cook (if any)

## Phases (parallel then synthesize)

| # | Phase | Lane | Status |
|---|-------|------|--------|
| 1 | [Coordination / synthesis](./phase-01-start.md) | Integrate 3 reports | **Done** |
| 2 | [G1 Search application playbook](./phase-02-g1-search-application-playbook.md) | Search OS → CMC apply rules | **Done** |
| 3 | [G2 Form fields inventory map](./phase-03-g2-form-fields-inventory-map.md) | fields/* → CMC map | **Done** |
| 4 | [Admin grammar coverage audit](./phase-04-admin-grammar-coverage-audit.md) | apps/admin census | **Done** |

## Reports

| Report | Path |
|--------|------|
| G1 playbook | [reports/g1-search-application-playbook.md](./reports/g1-search-application-playbook.md) |
| G2 field map | [reports/g2-form-fields-inventory-map.md](./reports/g2-form-fields-inventory-map.md) |
| Grammar audit | [reports/admin-grammar-coverage-audit.md](./reports/admin-grammar-coverage-audit.md) |
| Synthesis | [reports/wave-synthesis.md](./reports/wave-synthesis.md) |

## Dependencies

- Prior Search OS dissection: `plans/260806-odoo-ui-component-dissection/reports/odoo-search-system-filters-groupby-favorites.md`
- Layout matrix: `…/reports/odoo-19-source-dissection.md`
- Evergreen: `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`, `VIEW-GRAMMAR.md`
