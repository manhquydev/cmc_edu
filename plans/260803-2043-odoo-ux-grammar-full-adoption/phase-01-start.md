---
phase: 1
title: "VIEW-GRAMMAR law"
status: pending
priority: P1
effort: "2–4h"
dependencies: []
---

# Phase 1: VIEW-GRAMMAR law

## Overview

Publish the closed interaction grammar that maps Odoo concepts onto CMC frames so humans and agents stop inventing layouts.

## Requirements

- Functional: `VIEW-GRAMMAR.md` documents list/detail/form/dashboard recipes, ControlBar slots, special cases, anti-patterns.
- Non-functional: Link from PAGE-FRAMES, STRUCTURE, packages/ui/llms.txt; no code behavior change required.

## Architecture

Docs-only authority layer under `design-system/cmc-edu/`.

## Related Code Files

- Create: `design-system/cmc-edu/VIEW-GRAMMAR.md`
- Modify: `design-system/cmc-edu/PAGE-FRAMES.md`, `STRUCTURE.md`, `README.md`, `packages/ui/llms.txt`
- Delete: none

## Implementation Steps

1. Draft VIEW-GRAMMAR from advise/xia compare (view map table, ControlBar band, detail recipe, exemptions).
2. Cross-link PAGE-FRAMES §Detail/List → VIEW-GRAMMAR.
3. Update STRUCTURE detail recipe pointer + llms.txt “Page frames / grammar” line.
4. Self-check: no claim of ControlBar code existence until phase 2.

## Success Criteria

- [x] VIEW-GRAMMAR.md present and complete (map + anti-patterns + exemptions)
- [x] At least 3 inbound links from design-system + llms.txt
- [x] No product runtime regressions (docs only)

## Risk Assessment

Stale “already exists” claims — phrase ControlBar as planned-then-landed; update after phase 2 if needed.
