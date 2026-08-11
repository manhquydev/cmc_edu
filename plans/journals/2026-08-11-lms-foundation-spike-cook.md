---
title: "LMS foundation spike cook (Plan 1)"
date: 2026-08-11
summary: "Cooked plan 260811-1117: domain-lms, unit-range schema+RLS, lmsOps create/grant/roster; tests green; review C1/H1/H2 fixed"
---

# LMS foundation spike cook

## Outcome

Implemented Plan 1 on `feat/lms-foundation-unit-range-spike` from main (isolated from breadcrumb WIP stash).

## Delivered

- ADRs 0045, 0046
- `@cmc/domain-lms` (ported unit-progression)
- Migration unit-range + FORCE RLS
- `lmsOps.createClassWithUnits` / `addWithUnits` / `rosterForSession`
- RBAC `enrollment.grantUnits` GĐĐT-only
- Tests: domain 19+, auth matrix, lms-ops 10, provision/finance 30 green
- Review fixes: e2e/ensure orderGlobal, FOR UPDATE, ICT archive day

## Next

Plan 2 teaching spine when ready; do not close live cmc-lms until quality + Plan 3 cutover.
