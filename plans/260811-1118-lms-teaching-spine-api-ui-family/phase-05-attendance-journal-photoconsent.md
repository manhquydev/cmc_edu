---
title: "Phase 5: Attendance journal"
status: done
dependencies: [2, 4]
---
# Phase 5: Attendance + journal + photoConsent
## Overview
Teacher window attendance; session evidence publish; monorepo photoConsent gate.
## Requirements
- [x] Attendance window for teachers; admin override
- [x] Cancelled session hides journal from family
- [x] photoConsent enforced (not ops-only published)
## Success Criteria
- [x] Parent cannot see photos without consent

## Notes
Window via ATTENDANCE_WINDOW_ENFORCED (prod ON). Directors override.
