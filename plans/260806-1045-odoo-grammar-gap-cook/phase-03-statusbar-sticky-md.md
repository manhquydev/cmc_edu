---
phase: 3
title: Thin statusbar sticky md+
status: completed
priority: P1
effort: done unit
dependencies: []
---

# Phase 3: Thin statusbar sticky md+

<!-- Updated: Validation Session 1 defer → revived cook 2026-08-06 -->

## Overview

Split HighlightStrip (`summary`) from thin WorkflowStatusbar (`statusbar`). Sticky **only** `.o-detail-statusbar` at md+.

## Related Code Files

- `packages/ui/src/components/detail-page.tsx` — `statusbar` prop
- `packages/ui/src/odoo.css` — sticky md+
- Pilots: `receipt-detail.tsx`, `opportunity-detail.tsx`

## Success Criteria

- [x] No sticky on tall `.o-detail-summary`
- [x] Thin sticky md+ on `.o-detail-statusbar`
- [x] CRM + finance pilots migrated
- [x] Unit + CSS contract tests
