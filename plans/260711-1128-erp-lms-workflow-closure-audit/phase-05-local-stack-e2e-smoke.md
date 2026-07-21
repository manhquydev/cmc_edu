# Phase 05 — Local-stack E2E Smoke of 4 Named Workflows (OPTIONAL STRETCH)

## Context
- Plan: [plan.md](plan.md)
- Depends on Phase 02 + 03 (green unit/integration suite + documented invariants first).
- **Genuinely optional / potentially large.** Skip if time-boxed. This is the strongest "real data proving systematic completeness" the user asked for, but not required for plan closure.

## Overview
Unit/integration tests already prove the invariants in isolation. This phase exercises the 4 user-named workflows end-to-end against the actually-running local self-hosted Docker stack (`docker compose -p cmcv2-prod`: admin/api/lms/worker/postgres/minio/nginx, confirmed healthy), simulating the real cross-role handoff ERP→LMS. Scope down aggressively if it balloons.

## Key Insights
- The stack is the "real" production for this phase (user decision — no VPS).
- Each workflow crosses the ERP↔LMS boundary and involves ≥2 roles, which unit tests mock but E2E does not.
- Prefer a scripted/checklist pass over building heavyweight E2E infra (KISS/YAGNI). Reuse any existing e2e harness before writing new tooling.

## Requirements
- Verify the stack is healthy first; do not provision anything new.
- Use seeded/test data in the local DB; never touch real personal data.
- Each scenario asserts the LMS-visible OUTCOME, not just an ERP 200 — that is the point of E2E.
- If a scenario needs infra that does not exist, STOP and report rather than building a framework.

## Scenarios (the 4 named workflows, cross-role)
1. **P2-08 session evidence:** giao_vien publishes session photo + summary (internalNote set) → phu_huynh (guardian-linked, consent active) sees published summary + own child's photo in LMS; internalNote absent; a non-linked parent gets FORBIDDEN.
2. **P2-06 grade + star:** giao_vien grades a submitted exercise → hoc_sinh sees Grade + star in LMS child profile; gradedById / teacher annotation not leaked.
3. **P4-01/P4-02 gift loop:** giam_doc configures an active gift (director-only) → hoc_sinh redeems with sufficient stars (balance debited, stock decremented) → director approves; insufficient-stars redeem rejected immediately.
4. **P2-07 assessment:** AI draft generated → giao_vien confirms → phu_huynh sees only the confirmed comment; draft never visible pre-confirm.

## Architecture / Data flow
Seed staff+student+guardian+facility in local Postgres → drive ERP mutations via API (authenticated per role) → read back through the LMS surface as hoc_sinh/phu_huynh → assert the boundary-filtered outcome. MinIO backs photo objects; nginx fronts routing.

## Related files (own exclusively)
- NEW under `plans/260711-1128-erp-lms-workflow-closure-audit/` or an existing e2e dir: a smoke checklist/script (e.g. `apps/api/e2e/*` if that harness exists — reuse, don't reinvent).
- Read-only: `docker-compose*.yml`, existing e2e setup, `test/db.ts`.

## Implementation Steps
1. Confirm stack health: `docker compose -p cmcv2-prod ps` (all services up). Abort with a report if not.
2. Inventory existing E2E harness (the reports mention "API e2e 17 passed") — reuse its auth + seeding utilities.
3. Encode the 4 scenarios as the smallest viable scripted checks (or a documented manual checklist if scripting cost is high).
4. Run each; capture the LMS-visible outcome (photo visible / star shown / gift redeemed / confirmed-only comment) as evidence.
5. Record pass/fail + evidence in a phase report under `reports/`.

## Todo list
- [ ] Verify cmcv2-prod stack healthy
- [ ] Reuse existing e2e auth/seed harness
- [ ] Scenario 1: session photo → parent visibility + internalNote omitted
- [ ] Scenario 2: grade → student star visible, no leak
- [ ] Scenario 3: gift config → redeem → approve; insufficient rejected
- [ ] Scenario 4: assessment draft → confirm → parent sees confirmed only
- [ ] Evidence report in reports/

## Success Criteria
- All 4 scenarios produce the expected LMS-visible outcome against the running stack, with captured evidence.
- Zero real personal data used; only seeded test rows.
- Any failure is a real finding (regression or gap), reported — not worked around.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| E2E infra balloons into a framework build | High | Med | Time-box; fall back to documented manual checklist; STOP-and-report rule |
| Local stack drifts from code under test | Med | Med | Confirm the stack was rebuilt from current main before running |
| Seed data collides with existing local rows | Med | Med | Use throwaway facility per scenario (test/db.ts pattern); clean up after |
| MinIO/photo path misconfigured locally | Med | Low | Scenario 1 asserts object retrieval; report config gap rather than patch infra |

## Security Considerations
This phase validates the highest-risk compliance boundaries live: child-photo access control and draft-comment non-exposure. Treat any leak observed here as P0. Never seed real student PII.

## Rollback
Ephemeral test data cleaned per scenario; no production code or schema changes. Delete the smoke script/checklist to fully revert.

## Next steps
On success, this is the closing evidence that the docs-vs-reality gap is shut. Feed the evidence report back into Phase 01's TL25 update (mark the 4 workflows E2E-verified against local prod).
