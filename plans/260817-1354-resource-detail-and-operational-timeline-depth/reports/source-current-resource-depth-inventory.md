# Source-current resource depth inventory

**Snapshot:** `feat/back-before-design@bd2bae4`, 2026-08-17 (Phase 1 re-baseline)  
**Authority:** current routes, pages, API routers, `@cmc/links`; not the 2026-08-11 rollout matrix.

## Execution baseline (Phase 1, 2026-08-17)

- Branch: `feat/back-before-design` (plan branch) → sync target for `main`/`develop`; PR branch
  `feat/resource-depth-phase-1-2` is cut from the synced base.
- Base commit `bd2bae4`: the 2026-08-17 design commit (DetailPage statusbar → first row of the
  sheet, CMC blue accent revert) is the ONLY delta vs the original `96b1b80` snapshot. It touches
  `packages/ui` presentation files only — no route, nav, `@cmc/links`, or API surface changed
  (`git diff 96b1b80 bd2bae4 -- apps/admin/src/routes apps/admin/src/shell/nav-registry.ts
  packages/links apps/api/src` is empty). Ledger rows below therefore remain source-current.
- Worktree baseline recorded: `AGENTS.md`/`CLAUDE.md` carry GitNexus index-count bumps and are left
  untouched (unrelated); the plan directory itself is untracked until this PR adds it.
- D1–D10 verified against source:
  - D1/D7 canonical staff URL grammar — no `/hr/staff` surface exists yet; Phase 3 adds it.
  - D2 staff matrix — matches `user.manage` roster (`giam_doc_kinh_doanh`, `giam_doc_dao_tao`,
    `super_admin` bypass) and the existing update/updateRoles/resetPassword super-admin guards.
  - D3/D4 dual ledger — `RecordEvent` (facility-scoped, RLS) + `AuditLog` (global) verified below;
    no director roster on `audit.list`.
  - D8 parent-meeting paths — `/crm/post-sale-meeting` is the only current surface; D8 is a Phase 6
    delta, not a source contradiction.
  - D9 `parentAccount.read` — NOT yet in the permission registry (only `updateEmail`/`setActive`);
    this is the planned Phase 6 delta, consistent with the decision text ("Add explicit …").
  - D10 audit link manifest — Phase 4B delta; no contradiction with current derivation.
- Overlapping plans: predecessor `260811-1408-record-centric-url-form-depth` (phases 0–4 done) is a
  dependency; this plan supersedes only its Phase 05 matrix. No other active plan touches the Staff
  surface.

Legend:

- `record`: stable identity should have a detail work surface.
- `workspace`: task surface addressed by query/context, not one durable record.
- `config`: compact catalog/settings editor.
- `queue`: list plus record detail when a row has lifecycle/HITL.
- `dashboard`: aggregate read surface.

## Route-complete ledger

This table covers every declared Admin SPA route in `routes/index.tsx` and
`routes/*.routes.tsx` at the snapshot commit. The implementation phase must regenerate it from
source and fail if a new declared route is absent.

| Surface | Type | Current depth | Main gap / verdict |
|---|---|---|---|
| `/login` | auth workflow | standalone page | Keep workflow |
| `/` | compatibility | redirects to `/cockpit` | Keep replace redirect |
| `/cockpit` | dashboard | aggregate | No detail conversion |
| `/change-password` | auth workflow | forced form | Keep workflow; never return credentials in route state |
| `/classes` | compatibility | redirects to `/admin/classes` | Keep replace redirect |
| `/go/:entity/:id` | resolver | allowlisted links + UUID | Extend only for approved first-class records |
| `/design` | non-production lab | showcase page | Exclude from product-depth quota; retain explicit registry row |
| `*` | fallback | ComingSoon | Not a product surface; audit must not count it as classified work |
| `/finance` | record index | receipt list | Keep |
| `/finance/new` | create workflow | full receipt create page | Create-success replaces compose with receipt detail |
| `/finance/:id` | record detail | link; local-state tabs | Add timeline; route `overview/order-lines` |
| `/finance/class-placement` | workspace | student/class task | No detail conversion |
| `/finance/refund` | workspace/action index | rows open receipt detail | Refund detail needs separate product decision |
| `/crm` | record index | opportunity pipeline | Reference implementation |
| `/crm/opportunities/:id` | record detail | link + timeline | Reference implementation |
| `/crm/bulk-import` | import workflow | batch create | Keep workflow |
| `/crm/report` | dashboard/report | aggregate | No detail conversion |
| `/crm/post-sale-meeting` | compatibility + queue gap | schedule/complete dialogs | Rename to `/crm/parent-meetings`; add record detail |
| `/crm/aftersale` | queue + record index | list + modal create | Create-success pushes created detail |
| `/crm/aftersale/:caseId` | record detail | link | Keep; timeline gap-only sweep |
| `/teaching` | dashboard | cockpit | No detail conversion |
| `/teaching/schedule` | workspace | calendar | No detail conversion |
| `/teaching/sessions/:sessionId` | record workspace | detail with `?tab=` | Keep existing addressable query-tab contract |
| `/teaching/attendance` | workspace | class/session query | No detail conversion |
| `/teaching/grading` | workspace | submission query | No detail conversion |
| `/teaching/session-evidence` | workspace | class/session query | No detail conversion |
| `/teaching/session-assessment` | workspace | selected session context | No detail conversion |
| `/teaching/classes/:classBatchId/exercise-sequence` | subresource workspace | class-owned sequence | No independent detail conversion |
| `/teaching/exercises` | catalog + record index | list; folder config dialog | Keep |
| `/teaching/exercises/:exerciseId` | record detail | link | Keep; timeline gap-only sweep |
| `/hr` | compatibility | role-aware child redirect | Keep replace redirect |
| `/hr/checkin` | workspace | punch + ticket queue | Punch stays workspace |
| `/hr/checkin/:ticketId` | record detail exception | approval ticket + link | Keep; timeline gap-only sweep |
| `/hr/shifts` | queue + record index | list | Keep |
| `/hr/shifts/new` | create workflow | full page | Keep |
| `/hr/shifts/:registrationId` | record detail | link | Keep; timeline gap-only sweep |
| `/hr/payroll` | workspace | period × user query | No payslip detail without separate UUID workflow decision |
| `/hr/kpi` | queue + record index | board | Keep |
| `/hr/kpi/:scoreId` | record detail | link | Keep; timeline gap-only sweep |
| `/hr/my` | self-service workspace | current actor | No arbitrary staff ID route |
| `/hr/salary-tiers` | config | grid/editor | Legitimate exception |
| `/ops` | placeholder | ComingSoon | Explicit incomplete landing; not a record |
| `/ops/revenue` | dashboard/report | aggregate | No detail conversion |
| `/ops/recon` | queue | action surface | Keep unless ReconciliationFlag becomes a shared record |
| `/admin` | placeholder | ComingSoon | Explicit incomplete landing; not a record |
| `/admin/students` | record index | list | Keep |
| `/admin/students/:id` | record detail | link; local-state tabs | Route only real `profile/enrollments` sections |
| `/admin/parents` | queue + record index | list | Add explicit read roster |
| `/admin/parents/:parentId` | record detail | link; action-key gate | Move shell/get/timeline to `parentAccount.read` |
| `/admin/classes` | record index | list | Keep |
| `/admin/classes/:id` | record detail | link; local tabs | Route tabs; fix section gates; roster links to student |
| `/admin/courses` | config catalog | minimal two-field create/list | Keep config until curriculum edit semantics are approved |
| `/admin/engagement/gifts` | config catalog | bounded upsert/archive dialog | Keep config; Reward owns redemption lifecycle |
| `/admin/engagement/rewards` | queue + record index | list | Keep |
| `/admin/engagement/rewards/:rewardId` | record detail | link | Keep; timeline gap-only sweep |
| `/admin/engagement/leaderboard` | dashboard | aggregate | No detail conversion |
| `/admin/facilities` | platform config | edit dialog | Keep config |
| `/admin/users` | **record index gap** | list + create/role/reset dialogs | **P0: move canonical surface to `/hr/staff`** |
| `/admin/network-ip` | config | inline/dialog | Legitimate exception |
| `/admin/shift-config` | config | tabbed settings | Legitimate exception |
| `/admin/audit-log` | compliance ledger | global super-admin list | Filter/link correction only; never director timeline |
| `/admin/report-cards` | workspace/queue | class/student assessment flow | Keep; separate route-ownership TODO is outside this plan |

## Current audit split

| Concern | Current source | Verdict |
|---|---|---|
| Global mutation trail | `AuditLog` + base tRPC middleware | Security/compliance only |
| Tenant field/RLS | `AuditLog` has none | Unsafe for director detail timeline |
| Per-record operational events | `RecordEvent` | Correct substrate |
| Shared timeline UI | `RecordTimeline` | Reuse |
| Existing operational integration | Opportunity detail | Reference |

## Matrix superseded

This inventory supersedes only
`plans/260811-1408-record-centric-url-form-depth/phase-05-system-rollout-matrix.md`.
The predecessor plan remains authority for path-based form-depth invariants and the shift pilot.
