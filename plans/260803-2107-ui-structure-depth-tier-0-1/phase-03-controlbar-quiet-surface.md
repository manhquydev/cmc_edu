---
phase: 3
title: "ControlBar quiet surface"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 3: ControlBar quiet surface

## Overview

Sticky ControlBar gets quiet raised surface so scrolled content does not bleed through.

## Requirements

- CSS: background canvas/raised, hairline bottom, optional blur, z-index
- Keep density ops compatible
- Visual: no double chrome with PageHeader soft-card

## Related Code Files

- Modify: `packages/ui/src/premium.css` `.tpl-control-bar*`
- Optional: control-bar.test snapshot class presence

## Implementation Steps

1. Style `.tpl-control-bar` with bg `--cmc-canvas` or quiet raised, `border-bottom`, `backdrop-filter` if nav already uses blur.
2. Padding bottom small gap so filters breathe.
3. Manual note in Design Lab (phase 6) 

## Success Criteria

- [x] CSS ships sticky quiet surface
- [x] ListPage tests still pass
