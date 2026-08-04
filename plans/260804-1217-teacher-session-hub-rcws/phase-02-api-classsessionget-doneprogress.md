---
title: "Phase 2: API classSession.get + doneProgress"
status: todo
---

# Phase 2: API

## Overview

Add read APIs for session hub identity and session-done progress flags.

## Related Code Files

- Modify: `apps/api/src/class/class-session-router.ts`
- Modify: `apps/api/src/class/session-done.ts` (progress helper)
- Create/Modify: tests under `apps/api/src/class/`

## Implementation Steps

1. `evaluateSessionDoneProgress` pure helper (3 flags + timeGate).
2. `classSession.get({ sessionId })` — identity + batch denorm.
3. `classSession.doneProgress({ sessionId })` — load rows + evaluate progress.
4. Unit tests.

## Success Criteria

- [x] get returns NOT_FOUND for missing session
- [x] doneProgress matches evaluateSessionDone eligibility flags
