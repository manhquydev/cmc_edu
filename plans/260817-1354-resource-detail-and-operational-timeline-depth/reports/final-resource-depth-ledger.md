# Final resource-depth ledger — Phase 7 close

**Plan:** `plans/260817-1354-resource-detail-and-operational-timeline-depth/`
**Date:** 2026-08-20
**Program state at close:** `main` = `42d05c7` (both required checks terminal-green — see CI section).

This is the measured close-out for the Resource Detail and Operational Timeline
Depth program. Numbers are measured, not copied. Local measurements are marked as
reference-only where the source of truth is CI (per `AGENTS.md`).

## Required CI — final program state

| Check | HEAD | Conclusion | Evidence |
|---|---|---|---|
| `typecheck-and-test` | `42d05c7` | **success** | CI run [32268703865](https://github.com/manhquydev/cmc_edu/actions/runs/32268703865) (merge PR #166) |
| `ui-e2e` | `42d05c7` | **success** | run [32268703941](https://github.com/manhquydev/cmc_edu/actions/runs/32268703941), re-run 2026-08-20, ~7.5 min |

**ui-e2e flake note.** The first `ui-e2e` run for merge commit `42d05c7` hung ~6h and
was auto-cancelled; the immediately preceding branch-tip run (`a42e06c`) passed the
same code in 8m2s. Re-running the workflow on the unchanged HEAD produced a clean
**success in ~7.5 min**, confirming the 6h event was an infrastructure/hang flake,
not a code defect. Normal `ui-e2e` runtime is ~8–12 min.

## Static resource-depth audit (`pnpm resource-depth:audit`)

Measured 2026-08-20, exit **0**:

- Unknown routes: **0**
- Duplicate canonical paths: **0**
- Unclassified detail routes: **0**
- Declared exceptions (category + reason): **13**

Audit is wired into the required `typecheck-and-test` job (`.github/workflows/ci.yml`),
so a future popup-only regression that leaves a route unclassified fails CI.

### Exception registry (13)

| Path | Category |
|---|---|
| `/go/:entity/:id` | resolver |
| `/teaching/sessions/:sessionId` | workspace-detail |
| `/teaching/classes/:classBatchId/exercise-sequence` | subresource-workspace |
| `/hr/staff/:staffId` | compatibility |
| `/admin/students/:id` | compatibility |
| `/admin/classes/:id` | compatibility |
| `/admin/users/:staffId` | compatibility |
| `/crm/aftersale/:caseId` | timeline-gap |
| `/teaching/exercises/:exerciseId` | timeline-gap |
| `/hr/checkin/:ticketId` | timeline-gap |
| `/hr/shifts/:registrationId` | timeline-gap |
| `/hr/kpi/:scoreId` | timeline-gap |
| `/admin/engagement/rewards/:rewardId` | timeline-gap |

## Other gates (measured locally, 2026-08-20)

| Gate | Result | Notes |
|---|---|---|
| `pnpm typecheck` | **pass** | turbo 34/34 |
| `pnpm lint` | **pass** | `eslint apps/admin apps/lms scripts` |
| `pnpm test` | reference-only | `@cmc/api` needs `DATABASE_URL`; no local Postgres. All other packages pass. CI (`typecheck-and-test`) is the authority and is green. |
| `pnpm acceptance:report` | reference-only | 0/43 "proven" locally (results at a different commit + dirty worktree). Journey coverage 37/43. Authority = CI artifact only. |

## E2E archetype coverage (Staff)

Phase 7 required browser proof for the staff surface beyond the existing ADM-02
super-admin journey. Coverage before this close:

| Archetype | Before | After (this close) |
|---|---|---|
| director staff management (positive) | missing | `staff-director-management.journey.ui.spec.ts` (actor `giam_doc_kinh_doanh`) |
| ordinary-role staff denial (negative) | missing | same file — `sale` sees `user.manage` EmptyState |
| staff row → detail | missing | same file |
| staff cold deep-link `/hr/staff/:id/profile` | missing | same file |
| F5 on staff detail | missing | same file |
| Back to staff list | missing | same file |
| legacy `/admin/users` redirect | covered | `user-admin-roles.journey.ui.spec.ts` |
| create → detail (staff) | covered | `user-admin-roles.journey.ui.spec.ts` |
| cold-link / row→detail / cross-role (other entities) | covered | `deeplink-detail-gates.ui.spec.ts`, journeys |

New spec `tsc` compile: exit **0**. Runtime proof executes under the `ui-e2e`
Playwright project (`PLAYWRIGHT_UI=1`) on CI.

## Documentation (dual-ledger + canonical staff URL)

| Doc | Dual-ledger | `/hr/staff` | Depth taxonomy/exception rule |
|---|---|---|---|
| `docs/system-architecture.md` | present | present | pointer |
| `docs/06-kien-truc-url-routing.md` | **added (this close)** | present | n/a |
| `docs/ux-resource-centric-structure.md` | via §8 exception rule | **added (this close)** | present (§8) |

## Residual explicit exceptions

The 13 audit exceptions above are intentional and registered (resolver, workspace,
compatibility redirects, and documented timeline-gap detail routes). No unclassified
production routed surface remains.

## Verdict

Phase 7 gates are closed: static resource-depth audit is green and CI-enforced,
Staff E2E archetypes are covered, docs carry dual-ledger + canonical staff URL, and
both required checks are terminal-green on the final program state.
