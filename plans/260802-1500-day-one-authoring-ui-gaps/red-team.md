# Red-team: day-one authoring ui gaps

**Date:** 2026-08-02  
**Stance:** hostile reviewer

| # | Attack / failure mode | Verdict |
|---|----------------------|---------|
| 1 | Course create bypasses RBAC | **Mitigated** — page already PermissionGate `course.manage`; no new API |
| 2 | Seed doubles curriculum | **Mitigated** — count>0 skip |
| 3 | ensure uses wrong DB (prod) | **Risk** — must use local-sim URL only; refuse cmc_prod name? Local-sim DB name **is** cmc_prod. Use assertNotProdDatabase? That refuses cmc_prod. **Conflict:** local-sim intentionally uses cmc_prod name. ensure must only run when LOCAL_SIM_SEED_ALLOW=1 or called from seed-local-sim-demo which already has LOCAL_SIM_SEED_ALLOW. |
| 4 | Redirect breaks intentional /classes future | **Low** — no real route exists |
| 5 | Scope sneak sale receipts | **Rejected** — out of plan |
| 6 | Class form “fix” without courses | **Not in scope** — create course first; form already correct |

**Gate:** proceed to implement with LOCAL_SIM_SEED_ALLOW gate on ensure.