---
title: "UI List Ops Bulk Selection"
description: "DataTable row selection + BulkActionBar pilot on production list. AgentKit store cmc_edu/260803-1436."
status: completed
priority: P1
effort: "4–8h"
tags: [ui, list-ops, bulk]
created: 2026-08-03
---

# UI List Ops Bulk Selection

## Overview

Enable multi-select on DataTable and wire BulkActionBar through ListPage controlFooter on one pilot list (gifts). Completes Tier 2 list-ops gap from structure-depth research.

## Goals

1. DataTable controlled selection API (`selectedIds` + `onSelectionChange`)
2. Checkbox column when selection enabled
3. Pilot page shows BulkActionBar when selection > 0
4. Design Lab + VIEW-GRAMMAR note
5. Unit tests green

## Non-goals

- Server-side bulk mutations (can no-op / toast on pilot)
- Select-all-across-pages
- Every list migrated

## Phases

| # | Phase |
|---|-------|
| 1 | Kickoff |
| 2 | DataTable selection API |
| 3 | ListPage bulk slot docs |
| 4 | Gifts pilot |
| 5 | Design Lab + docs |

## Success criteria

- [ ] DataTable selection tests pass
- [ ] Gifts page: select rows → BulkActionBar
- [ ] Design Lab demo
- [ ] No regression on existing DataTable call sites
