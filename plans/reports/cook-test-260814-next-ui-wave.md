# Cook + test report — next UI wave (2026-08-14)

**Plan:** `plans/260814-2154-next-ui-wave-affordances-brand-students-crm-sort/`  
**Branch:** `feat/next-ui-wave-affordances-brand-students-crm-sort`  
**Mode:** One PR with four logical concerns (solo CI cost vs plan’s four sequential PRs — intentional override).

## Phases cooked

| Phase | Concern | Status |
|-------|---------|--------|
| 1 | Kickoff from develop (#143) | done |
| 2 | PR1 affordances + EmptyState icons + idempotent draft seed + honest receipt bulk | done |
| 3 | PR2 brand tones (receipts draft, KPI submitted) + CRM table stage badges | done |
| 4 | PR3 Students empty honesty (no widen) | done |
| 5 | PR4 CRM orderBy whitelist + table sort + rotting journey locator | done |

## Local validation

- `@cmc/ui` focused: 13 passed (empty-state, bulk-action-bar, status-badge)
- `@cmc/admin` focused: 88+ then receipt-list 10 passed; broader admin suite 696 earlier in cook
- Code review (--pending): **SHIP** — no Critical/High; residuals Medium only
- API integration tests: need DB URL (deferred to CI `typecheck-and-test`)

## Residual risks (Medium)

1. One PR vs four — coarser rollback
2. `nextActionAt` DESC nulls-first (Postgres)
3. Seed mid-fail can leave orphan opp before draft appears

## Next

Push + PR to `develop`; wait for `typecheck-and-test` + `ui-e2e`.
