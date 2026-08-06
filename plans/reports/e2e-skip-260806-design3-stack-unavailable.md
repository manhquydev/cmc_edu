# ui-e2e skip — design3 validation (2026-08-06)

## Decision

**Did not run** full `ui-e2e` in this cook session.

## Evidence stack unavailable

| Probe | Result |
|-------|--------|
| `http://localhost:4173` (admin preview) | HTTP 000 — down |
| API health (local) | not listening |
| Docker containers | no CMC e2e stack (only unrelated sentinel/dd services) |

## What still must run before merge claim

On CI (or local stack via project e2e compose/runbook):

1. Required check **`ui-e2e`** green on the design3 PR branch
2. Confirm `apps/e2e/tests/admin-shell.ui.spec.ts` + `menu-nav` journeys (app-switcher contract)
3. Canary: `gift-config-nav.journey.ui.spec.ts` / `assertEntryAbsent`
4. Optional after green CI: `pnpm acceptance:report` vs Phase 1 baseline flow ids

## Code readiness (not runtime proof)

- `apps/e2e/src/journey/menu-nav.ts` rewritten for Odoo app-switcher
- Journey binders retarget `main.o-main`
- CRM journey includes list↔kanban smoke

Until CI is green, plan status remains **`validation`**, not completed.
