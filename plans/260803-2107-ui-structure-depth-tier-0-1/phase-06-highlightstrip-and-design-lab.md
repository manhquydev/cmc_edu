---
phase: 6
title: "HighlightStrip and Design Lab"
status: pending
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 6: HighlightStrip + Design Lab

## Overview

Lightning-style highlight band: 3–4 compact key fields under EntityHeader. Export + Design Lab record composite.

## Requirements

- Component `HighlightStrip` items: { key, label, value }
- CSS in premium.css `.ck-highlight*`
- Design Lab detail section shows full record recipe
- Wire on receipt-detail and opportunity-detail as pilot (or phase 7)

## Related Code Files

- Create: `highlight-strip.tsx`, `highlight-strip.test.tsx`
- Modify: `index.ts`, `premium.css`, `design-lab.tsx`

## Success Criteria

- [x] HighlightStrip exported + tested
- [x] Design Lab demo
- [x] Used on ≥1 product detail page
