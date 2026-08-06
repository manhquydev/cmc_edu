---
title: "Phase 3: G2 Form fields inventory map"
status: done
---

# Phase 3: G2 — Form fields inventory map

## Overview

Catalog Odoo `views/fields/*` widget families and map to CMC/Astryx form patterns used in admin DetailPage/FormPage. Identify high-traffic gaps (many2one, one2many/x2many list, monetary, date, selection, boolean, statusbar field, html, etc.).

## Requirements

- [x] Full directory inventory of Odoo field widget folders (names + role 1-liner)
- [x] Group into families (scalar, relational, layout, decorative)
- [x] CMC/Astryx analogue table with SHIPPED/PARTIAL/MISSING/SKIP
- [x] Top 10 gaps ranked by admin ERP feel
- [x] Report: `reports/g2-form-fields-inventory-map.md`

## Inputs (read-only)

- `/home/manhquy/Downloads/odoo-src/addons/web/static/src/views/fields/`
- `packages/ui` form/detail components; Astryx usage in `apps/admin` forms
- Form sheet section of odoo-19-source-dissection

## Constraints

- Catalog only — do not port OWL field components
- Prefer existing Astryx/CMC primitives over new abstractions

## Success Criteria

Matrix covers ≥90% of Odoo field folder names; top gaps actionable for a future cook plan.
