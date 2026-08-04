## Phase Implementation Report

### Executed Phase
- Phase: phase-07-parents-stubs-grading
- Plan: `/home/manhquy/Downloads/cmc_edu/plans/260803-2043-odoo-ux-grammar-full-adoption`
- Status: completed

### Files Modified
| File | Lines | Change |
|------|------:|--------|
| `apps/admin/src/pages/parents/index.tsx` | 617 | ListPage shell; CmcTabs + tables body preserved |
| `apps/admin/src/pages/engagement/leaderboard.tsx` | 33 | ListPage + EmptyState stub (`isEmpty`) |
| `apps/admin/src/pages/teaching/grading.tsx` | 393 | ListPage shell; MasterDetail body; drop `calc(100vh-N)` |
| `plans/.../phase-07-parents-stubs-grading.md` | — | status → completed; success criteria checked |

No test file edits — existing contracts held. Did not touch `pdf-annotator` or `packages/ui/**`.

### Tasks Completed
- [x] parents → ListPage frame (tabs under header; dialogs outside)
- [x] leaderboard stub → ListPage + EmptyState
- [x] grading → ListPage + MasterDetail body (logic preserved)
- [x] Run grading.test.tsx (+ parents + leaderboard)

### Tests Status
- Type check: phase-7 files clean; package `typecheck` fails pre-existing on `design-lab.tsx` unused `ControlBar` (out of ownership)
- Unit tests: **pass** — 15/15
  - `grading.test.tsx` — 8 pass
  - `leaderboard.test.tsx` — 2 pass
  - `parents/index.test.tsx` — 5 pass
- Integration tests: n/a

### Design Notes
- **parents**: multi-tab hub (link queue + directory) → ListPage header + CmcTabs body. Filters stay tab-local (status/search). Email Dialog kept outside ListPage (same as gifts create dialog).
- **leaderboard**: `isEmpty` + custom `empty` EmptyState; no backend (still deferred).
- **grading**: MasterDetail queue/detail + tRPC grade flow unchanged. Height wrapper: `flex:1; minHeight:520; height:100%` — no `calc(100vh - 120px)`. No VIEW-GRAMMAR exemption (frame adopted).

### Impact (GitNexus)
- `ParentListPage` / `LeaderboardPage` / `GradingPage` page symbols: **LOW** risk (route lazy imports only).

### Issues Encountered
None blocking. Admin package typecheck red from unrelated design-lab import (phase 3 ownership).

### Next Steps
- Phase 7 complete; unblocks phase 8 adoption audit.
- Phase 8 may note grading as ListPage+MasterDetail (not exemption).
