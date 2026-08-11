---
title: "Phase 3: grantUnitsFromReceipt"
status: todo
dependencies: [2]
---
# Phase 3: Provision grants unit ranges
## Overview
Extend provisionFromReceipt after activateEnrollment; money TX unchanged (0041).
## Requirements
- [ ] grantUnitsFromReceipt idempotent
- [ ] Renewal extends ranges
- [ ] Reconciler repairs missing ranges
- [ ] No money rollback on grant fail
## Related
- apps/api/src/provisioning/provision-from-receipt.ts
## Success Criteria
- [ ] Provision int tests first/renewal/replay
