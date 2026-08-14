---
phase: 1
title: "Kickoff gates"
status: pending
priority: P1
effort: "0.5h"
dependencies: []
---

# Phase 1: Kickoff gates

## Overview

Confirm D0–D5 baseline is on `develop` and lock cook preconditions before any new UI code.

## Requirements

- Functional: PR #142 merged; working tree based on current `develop`.
- Non-functional: No cook until phases 2–6 survive red-team + validate.

## Related Code Files

- Read: `plans/reports/impl-260814-d0-d5-design-path.md`
- Read: `design-lab/system/BRIDGE.md`
- Read: `design-lab/system/CONFLICT-LEDGER.md`
- Read: `plans/reports/brainstorm-260814-ui-bridge-implement-direction.md`

## Implementation Steps

1. Verify `origin/develop` contains D3–D5 surfaces (`console.css` alias block, `TableEmptySpec`, `approvalBlock`).
2. Note CI evidence from #142 (`typecheck-and-test`, `ui-e2e` green).
3. Branch from latest `develop` for subsequent phase PRs (`feat/ui-bridge-wave4-atoms`, then CRM).

## Todo

- [x] Confirm #142 merged on develop
- [x] Confirm brainstorm contract still matches owner confirmation (#2 CRM E2E)

## Success Criteria

- [x] Develop tip includes D0–D5 bridge commits
- [x] This plan is active (`ak plan use` this directory)

## Risk Assessment

Stale local branch → rebase before cook. Low risk.
