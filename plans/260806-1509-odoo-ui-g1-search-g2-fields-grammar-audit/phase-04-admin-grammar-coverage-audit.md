---
title: "Phase 4: Admin grammar coverage audit"
status: done
---

# Phase 4: Admin grammar coverage audit

## Overview

Measure what % of real admin pages use design3 Odoo grammar frames and chrome. Produce denominators, per-archetype rates, and outlier list.

## Requirements

- [x] Census of page components under `apps/admin/src/pages/**/*.tsx` (exclude tests)
- [x] Detect: ListPage, DetailPage, FormPage, DashboardPage, SettingsShell, OdooNavbar shell, ControlBar/FilterBar, form sheet classes, bespoke layouts
- [x] % using standard frames vs bespoke
- [x] Module breakdown (crm, finance, teaching, …)
- [x] Report: `reports/admin-grammar-coverage-audit.md` with tables + methodology

## Method hints

```bash
# count render sites
rg -l "ListPage|DetailPage|FormPage|DashboardPage|SettingsShell" apps/admin/src/pages --glob "*.tsx"
rg -l "from '@cmc/ui'" apps/admin/src/pages --glob "*.tsx"
```

Exclude `*.test.tsx`, stories, dead design3 lab if any.

## Success Criteria

Single number headline % + honest caveats; actionable outlier top 15 for migration.
