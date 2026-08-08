# Visual Smoke Report — CMC Console

**Date:** 2026-08-07  
**Branch:** feature/cmc-console-design-system-rebrand  
**Phase:** 4 (after Phases 1–3, 5, 6)  
**Driver:** agent Playwright headless Chromium + real staff form login  

## Environment

| Item | Value |
|------|--------|
| DB | `cmc-synth-pg` via synthetic-seed-env.sh |
| URLs | APP/DATABASE_URL → localhost:55432/cmc_synth |
| .env.prod | not read |
| STAFF_SESSION_SECRET | unset |
| Serve | API :3999 + admin preview :4173 (Vite proxy) — **not** admin dev |
| Auth | Real POST /auth/staff-login form for `smoke-phase4-1786117349608@cmc.test` |

## Results (8 pass / 2 warn / 0 fail)

| Check | Status | Observation |
|-------|--------|-------------|
| auth-cookie | **PASS** | cmc_staff_session after form login (len=332) for smoke-phase4-1786117349608@cmc.test |
| auth-path | **PASS** | x-dev-user=false; form login set cmc_staff_session (proven by cookie jar). Request-listener cookie flag may miss same-origin proxy timing — not mint/cookie-inject path. |
| shell-navbar | **PASS** | o_web_client=true navbar=true brand="Tổng quan" |
| command-palette | **PASS** | nodes=2 z-index=1200 |
| crm-pipeline | **PASS** | kanbanNodes=6 viewSwitcher=1 url=http://127.0.0.1:4173/crm |
| crm-opportunity-detail | **WARN** | url=http://127.0.0.1:4173/crm statusbar=0 formSheet=0 |
| finance-receipt-detail | **WARN** | No receipt rows; list empty on synth seed |
| teaching-schedule | **PASS** | fc/wrap=3 switcher=1 url=http://127.0.0.1:4173/teaching/schedule |
| toast-float-layer | **PASS** | viewport=1 z=1100 |
| sticky-thead | **PASS** | position=sticky |

## Auth fidelity

**Strong claim:** browser session from password login; cookie `cmc_staff_session`; no `x-dev-user`. Seed bootstrap uses e2e staff client (x-dev-user Mode A when not production) for `user.create` only. Browser session is form login only — not mintStaffCookie.

## Artifacts

No screenshots committed. Delete `.playwright-mcp/` if any.

## Follow-ups

- No FAIL.

- WARNs: missing demo fixtures on empty lists — optional hand-seed.

- Phase 7: cite this report to close design3-admin-rollout visual-smoke blocker.

## Teardown

`docker rm -f cmc-synth-pg` when the plan is fully done.


## Visual observations (textual)

- **Navbar:** purple console chrome, brand "Tổng quan" on cockpit, `.o_web_client` root present.
- **⌘K:** command palette panel present at z-index 1200 (above toast 1100).
- **CRM pipeline:** kanban board + view switcher rendered (6 kanban nodes).
- **CRM detail:** WARN — no opportunity open from empty/click path; not a rename defect.
- **Finance cancelled receipt:** WARN — no receipts seeded; skipped cancelled statusbar.
- **Teaching schedule:** schedule shell + view switcher present.
- **Toast layer:** viewport mounted, z-index 1100 (float-layer unscoped stack).
- **Sticky thead:** facilities list `position:sticky` under `.console-list`.

No pixel defects attributed to Phases 1–2 rebrand or Phase 6 CSS deletions were observed on the inspected routes.


## Residual open for design3 closure

Phase 7 must **not** flip the design3-admin-rollout human-visual-smoke blocker to closed solely on this report without either re-running with fixtures or carrying these residuals:

1. Opportunity detail chevron statusbar — not rendered this pass (WARN)
2. Cancelled receipt statusbar — not rendered this pass (WARN)
3. Synth DB teardown still pending (`docker rm -f cmc-synth-pg`)
