# Independent advise/review — student & class densify (domain no-drift)

**Date:** 2026-08-11  
**Scope:** post-densify check only  

## Checks

| Check | Result |
|-------|--------|
| `student.setLifecycle.mutate` still used with confirm dialog | PASS |
| No new `/hr/duyet-*` or “Duyệt …” nav leaves | PASS (`nav-registry`) |
| `classBatch.assignTeacher` + `user.pickList({role:'giao_vien'})` | PASS (existing tests) |
| `classSession.cancel` still ConfirmDialog-gated | PASS (tests) |
| No `manualPunch.create` UI | PASS (comment + no route) |
| No TEKY kanban product route | PASS |
| Permission keys unchanged | PASS (canDo student setLifecycle only) |

## Verdict

**PASS** — presentation densify only; domain rules **Khớp**.  

## Residual (not blockers)

- Class status statusbar labels are UI mapping over existing `cls.status` strings; if new status enums appear, extend `CLASS_STATUS_LABELS` only.  
- Student statusbar is not a forced linear workflow in domain (lifecycle is free transition among three states) — strip is **display** of current state position only, not clickable transitions.
