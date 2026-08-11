---
title: "LMS ERP money bridge import cutover"
description: "Plan 3/3: gói bán→unit, provision grant ranges, break-glass, refund revoke, import live cmc-lms, quality gate, đóng LMS cũ."
status: pending
priority: P1
effort: "3–5 tuần"
tags: [lms, erp, provision, cutover]
created: 2026-08-11
blockedBy:
  - project:260811-1117-lms-foundation-adr-va-spike-unit-range
  - project:260811-1118-lms-teaching-spine-api-ui-family
---

# Plan 3/3 — Money bridge + import + close old LMS

## Depends on

Plan 1 ship contracts (grant surface + range invariants + renewal stub) + Plan 2 teaching day quality.  
Range writer must be same grant service used by admin grantUnits (single-writer).

## Owner rules

- Khóa học > Unit; grant by unit  
- Scenario B import  
- Build quality first → cutover → **đóng cmc-lms**  
- Break-glass A; refund cut unlearned units  

## Outcome

- Product mapping: package / receipt fields → unit count or continuous range in course  
- `provisionFromReceipt` grants ranges idempotently (0041 preserved)  
- Break-glass + refund revokeFromNext  
- Dry-run then real import from live LMS  
- Quality gate → cutover → close old LMS  

## Phases

| # | Phase |
|---|-------|
| 1 | Start / freeze cutover runbook draft |
| 2 | Receipt unit package product mapping (**owner examples of packages**) |
| 3 | grantUnitsFromReceipt in provision |
| 4 | Break-glass + refund revoke |
| 5 | Import dry-run + integrity |
| 6 | Quality gate cutover close old LMS |

## Success criteria

- [ ] Paid receipt → correct units  
- [ ] 1 week ops without rollback  
- [ ] Old LMS closed as SoT  
- [ ] 0 dual-write  

## Note on package examples

Before phase 2 implementation: collect 3–5 real sale packages (“gói X = N unit khóa Y”) from owner — form phiếu thu later; **model already locked**.

<!-- slug: lms-erp-money-bridge-import-cutover -->
