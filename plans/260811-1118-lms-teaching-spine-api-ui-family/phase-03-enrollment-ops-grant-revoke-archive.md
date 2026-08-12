---
title: "Phase 3: Enrollment ops"
status: done
dependencies: [2]
---
# Phase 3: Enrollment ops
## Overview
Full unit-range ops: grantPast, revokeFromNext, archive/unarchive, expiring list.
## Requirements
- [x] Past ADD ok; past SUBTRACT forbidden
- [x] Admin roster unfiltered; write paths filtered (dual-gate on rosterForSession)
## Success Criteria
- [x] Ported enrollment int tests green

## Notes
expiring list UI/query deferred. grantPast/revoke/archive int tests green.
