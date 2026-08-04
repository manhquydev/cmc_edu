# Plan: UI/UX Sprint A — Toast, shell hierarchy, role labels, cockpit empty

**Status:** completed  
**Date:** 2026-08-02  
**Source:** `design-system/cmc-edu/MASTER.md` + interaction upgrade report  

## Outcome

Admin ERP feels operational: every commit can toast; topbar has one primary CTA; roles read as Vietnamese; teacher/sale cockpit empty states have next-step CTAs; single metric cards do not stretch full-bleed.

## Acceptance criteria

1. `toast.success` / `toast.error` work app-wide via `ToastProvider` (aria-live, auto-dismiss).  
2. Đăng xuất uses ghost style; Ghi danh remains primary.  
3. Badge shows e.g. `Giáo viên` not `giao_vien`.  
4. Cockpit empty queue uses helpful copy + navigation CTA.  
5. Metric strip: single card constrained (max-width), not empty full-width bar.  
6. Unit tests for toast + formatRole; typecheck packages/ui + admin.

## Out of scope

- Leave-guard attendance, confirm matrix full coverage, compact density tables, LMS toast.

## Phases

| Phase | Owner files | Summary |
|-------|-------------|---------|
| 01 | `packages/ui` | Toast + premium CTA variants + metric max-width |
| 02 | `packages/auth`, `apps/admin/shell` | formatRole + shell wire |
| 03 | `apps/admin/pages/cockpit` | Empty CTA + greeting |
| 04 | verify | typecheck/test/review |

## Dependencies

- Design system: `design-system/cmc-edu/*`  
- No new npm deps if possible (pure React toast).
