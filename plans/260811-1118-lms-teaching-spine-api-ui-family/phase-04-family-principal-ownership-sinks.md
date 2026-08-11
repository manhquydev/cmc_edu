---
title: "Phase 4: Family principal"
status: done
dependencies: [1]
---
# Phase 4: Family principal
## Overview
Family phone+password; multi-child session; every sink requires studentId + ownership.
## Requirements
- [x] ParentAccount isActive + tokenVersion on monorepo
- [x] No studentIds[0] defaults (parent home only auto-picks when 1 child)
- [x] Rate limit + dummy-hash timing (pre-existing lms-auth)
## Success Criteria
- [x] Multi-child ownership int tests; sibling negative test (open-tier F1 + setActive)

## Notes
Parent login remains OTP-primary; student password path exists. setActive bumps tokenVersion on deactivate.
