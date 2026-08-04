---
phase: 2
title: "ControlBar + ListPage"
status: pending
priority: P1
effort: "4–8h"
dependencies: [1]
---

# Phase 2: ControlBar and ListPage

## Overview

Ship named `ControlBar` composite and embed it in `ListPage` so every list shares sticky ops chrome (title · filters · pager · actions).

## Requirements

- Functional: ControlBar props for leading (title/breadcrumb via PageHeader or slots), filters, pager, actions; ListPage uses it by default when header/filters provided.
- Non-functional: unit tests; premium.css; export from index; density ops compatible.

## Architecture

```text
ListPage
  ControlBar
    [ header slot — usually PageHeader ]
    [ filters slot — FilterBar ]
    [ trailing — pager? · actions? ]
  body / empty
```

Keep PageHeader as identity/breadcrumb component; ControlBar is the **band** that stacks sticky chrome.

## Related Code Files

- Create: `packages/ui/src/components/control-bar.tsx`, `control-bar.test.tsx`
- Modify: `list-page.tsx`, `list-page.test.tsx`, `premium.css`, `index.ts`
- Delete: none

## Implementation Steps

1. TDD: ControlBar renders slots and sticky class `.tpl-control-bar`.
2. Integrate into ListPage without breaking existing callers (header/filters still work).
3. CSS: sticky, raised/surface-2 harmony, keyline-x, ops density gap.
4. Export + update VIEW-GRAMMAR if API names differ from draft.

## Success Criteria

- [x] ControlBar tests pass
- [x] ListPage tests pass (existing + control band presence)
- [x] Exported from `@cmc/ui`
- [x] No admin page required to change in this phase (backward compatible)

## Risk Assessment

Breaking ListPage layout on ops density pages — visual check Design Lab next phase; keep class names stable.
