---
title: "Phase 4: Wire calendar / class-detail / redirects"
status: todo
---

# Phase 4: Wiring

## Overview

All entry points open the hub.

## Related Code Files

- Modify: `schedule-fc-events.ts` href
- Modify: `class-detail.tsx` SessionsTab link
- Modify: attendance deep-link → navigate hub
- Optional: cockpit shortcuts

## Success Criteria

- [x] classSessionToEvents href → `/teaching/sessions/:id?tab=attendance`
- [x] Deep-link `?session=` on attendance redirects to hub
