---
title: "Phase 2: G1 Search application playbook"
status: done
---

# Phase 2: G1 — Search OS application playbook

## Overview

Turn Search OS research into a **how-to apply on CMC** playbook: when to use FilterBar as-is, when presets/chips, URL contract, page recipes, anti-patterns. No SearchChrome implementation.

## Requirements

- [x] Playbook at `reports/g1-search-application-playbook.md`
- [x] Archetypes: 1-field, 2-field (select+text), multi-preset future
- [x] Explicit map: Odoo Filters/GroupBy/Favorites → CMC now / later
- [x] Pilot page recommendations (finance + CRM) without code changes

## Inputs (read-only)

- `plans/260806-odoo-ui-component-dissection/reports/odoo-search-system-filters-groupby-favorites.md`
- `packages/ui/src/components/filter-bar.tsx`, `list-page.tsx`, `control-bar.tsx`
- `apps/admin` FilterBar usages

## Success Criteria

An agent can open a new ListPage and apply the correct filter grammar without inventing page-local cards.
