---
phase: 8
title: "WorkflowStatusbar and StatActions"
status: pending
priority: P2
effort: "4h"
dependencies: [6, 7]
---

# Phase 8: WorkflowStatusbar + StatActions pilot

## Overview

Pilot Lightning Path / Odoo statusbar + smart buttons on one money and one CRM entity.

## Requirements

- Reuse ProgressSteps as WorkflowStatusbar wrapper **or** thin `WorkflowStatusbar` composite
- StatActions: row of CountBadge/buttons linking related (e.g. receipt → student, opportunity → create receipt)
- Pilot: receipt-detail (pipeline stages already) + opportunity-detail

## Related Code Files

- Create optional: `workflow-statusbar.tsx`, `stat-actions.tsx`
- Modify: receipt-detail, opportunity-detail
- Export + tests

## Success Criteria

- [x] At least one pilot shows workflow strip
- [x] At least one StatAction navigates related
- [x] Tests pass
- [x] VIEW-GRAMMAR documents pattern
