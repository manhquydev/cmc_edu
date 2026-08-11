---
title: "Phase 6: Exercise delivery"
status: done
dependencies: [2, 3]
---
# Phase 6: Exercise library + delivery + grading
## Overview
Library folders, freeze class sequence, cron 1/session end, grade publish → stars; flag off open-tier.
## Requirements
- [x] SessionExercise model live
- [x] Delivery uses roster D1 (open-tier OFF path + dual-gate)
- [x] realign units never moves sequence pointer (sequence independent of unit restamp)
- [x] Server kill-switch for ADR 0038 open-tier
## Success Criteria
- [x] Homework path only via delivery when flag on (`LMS_OPEN_TIER_ENABLED=0`)

## Notes
Ship: `plans/reports/ship-lms-session-exercise-delivery.md`.  
Folder library UX deferred; API sequence assign + unit-stamp fallback live. Grading still on Exercise Submission (shared exerciseId).
