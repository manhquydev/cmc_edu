---
title: "Phase 3: Session detail shell + panels"
status: todo
---

# Phase 3: UI hub

## Overview

DetailPage shell + extract/session-fixed panels for three ops.

## Related Code Files

- Create: `apps/admin/src/pages/teaching/session-detail.tsx`
- Create: `apps/admin/src/pages/teaching/panels/*` or co-locate panels
- Modify: attendance / session-assessment / session-evidence to use panels
- Modify: `teaching.routes.tsx`

## Implementation Steps

1. session-detail.tsx: get + doneProgress + EntityHeader + CmcTabs
2. AttendancePanel(sessionId, classBatchId)
3. AssessmentPanel / EvidencePanel same pattern
4. Legacy pages keep pickers; render panels when session selected

## Success Criteria

- [x] Hub renders with fixed session; no class/session pickers on hub tabs
