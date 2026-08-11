---
title: "Phase 2: Class engine full"
status: todo
dependencies: [1]
---
# Phase 2: Class engine full cancel restamp
## Overview
Port session materialize, cancel with reasons, restamp future units, slot edit, close/discard from cmc-lms.
## Related
- Source: cmc-lms session-generator, batch-unit, class-batch router
- Modify: apps/api class / lms-ops
## Requirements
- [ ] Cancel rewinds unit stamps for future non-attended
- [ ] No makeup session create path in new ops
- [ ] realignHistory optional late / repair only
## Success Criteria
- [ ] Integration tests cancel + restamp
