---
phase: 6
title: "HR settings frames"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 6: HR / settings frames

## Overview

Normalize HR and admin config screens onto frames: lists → ListPage; tabbed settings → FormPage or ListPage+tabs consistently.

## Requirements

- Functional:
  - payroll **list** mode → ListPage (detail mode already DetailPage — keep).
  - kpi → ListPage or DashboardPage if metrics-first.
  - my-hr → DetailPage or FormPage with tabs (not free Stack).
  - salary-tiers, shift-config → FormPage or SettingsSection inside FormPage/ListPage.
- Tests for payroll/kpi/my-hr updated green.

## Related Code Files

- Modify: `hr/payroll.tsx`, `hr/kpi.tsx`, `hr/my-hr.tsx`, `hr/salary-tiers.tsx`, `admin/shift-config.tsx` (+ tests)
- Optional: attendance/shifts and check-in-out hybrids — if still PageHeader-primary, wrap FormPage consistently.

## Implementation Steps

1. Map each file to one archetype; document choice in PR notes.
2. Migrate payroll list branch to ListPage.
3. **Hooks rule:** all hooks run unconditionally at top of component; only the returned tree branches ListPage vs DetailPage (no conditional hooks).
4. Migrate remaining HR/admin config.
5. Run HR-related vitest files.

## Success Criteria

- [x] No HR product page is bare PageHeader+div without frame (except intentional punch modal chrome inside FormPage)
- [x] payroll + kpi tests pass

## Implementation notes (2026-08-03)

| File | Archetype |
|------|-----------|
| `hr/payroll.tsx` list | `ListPage` (ops) |
| `hr/payroll.tsx` detail | `DetailPage` (kept) — hooks unconditional at top |
| `hr/kpi.tsx` | `ListPage` (ops) |
| `hr/my-hr.tsx` | `DetailPage` + `CmcTabs` |
| `hr/salary-tiers.tsx` | `DetailPage` + `CmcTabs` |
| `admin/shift-config.tsx` | `DetailPage` + `CmcTabs`; policy tab uses `SettingsSection` |

Optional attendance hybrids (check-in-out / shifts) left untouched — outside ownership.

## Risk Assessment

payroll dual mode (list vs detail) — carefully branch frames without hook-order bugs.
