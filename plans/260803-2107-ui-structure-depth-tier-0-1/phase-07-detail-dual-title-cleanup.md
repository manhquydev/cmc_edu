---
phase: 7
title: "Detail dual-title cleanup"
status: pending
priority: P1
effort: "3h"
dependencies: [2, 6]
---

# Phase 7: Detail dual-title cleanup

## Overview

All DetailPage entity screens: PageHeader without entity title when EntityHeader present; breadcrumbs only.

## Target pages

- student-detail, class-detail, receipt-detail, opportunity-detail
- Any other DetailPage + EntityHeader combo

## Related Code Files

- Modify detail pages only
- Tests: update heading queries if needed (EntityHeader h1 remains)

## Success Criteria

- [x] No dual entity title on cleaned pages
- [x] Detail tests pass
