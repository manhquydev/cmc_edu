---
phase: 1
title: "Kickoff gate"
status: pending
priority: P1
effort: "30m"
dependencies: []
---

# Phase 1: Kickoff gate

## Overview

Confirm PR #143 is on `develop`, branch for this wave, and freeze the owner contract before any code edits.

## Requirements

- Functional: worktree on a feature branch from up-to-date `origin/develop`.
- Non-functional: no commits on `main`; do not reopen completed plan `260814-1656`.

## Related Code Files

- Read only: `plans/reports/brainstorm-260814-next-ui-wave-after-browser-audit.md`
- Read only: `design-lab/system/BRIDGE.md` (ListPage recipe §102)

## Implementation Steps

1. `git fetch origin develop` and confirm merge commit for PR #143 is present.
2. Create branch `feat/next-ui-wave-affordances-brand-students-crm-sort` from `origin/develop` (or continue on current feature branch if already based on that tip).
3. Confirm owner decisions in brainstorm §5 are treated as locked.
4. Mark this phase complete; start Phase 2.

## Success Criteria

- [ ] Branch base includes merged UI bridge CRM E2E (#143)
- [ ] Active plan pointer set to this directory
- [ ] No code changes in this phase

## Risk Assessment

Low. Wrong base branch would force rebase — mitigate by fetching before branch create.
