# Plan: KPI shared workspace (resource-centric)

**ID:** `260811-1524-kpi-shared-workspace`  
**Status:** ACTIVE — phases 0–5 implemented (unit green) — cook with TDD / parallel-ready phases / auto  
**Flags:** `--tdd` · `--parallel` (phases 1a∥1b after 0) · `--auto`  
**Authority:** `docs/ux-resource-centric-structure.md` · TL06 · docs/20 KPI lifecycle  

## Outcome

Staff and directors share **one KPI product**: board at `/hr/kpi` + form at `/hr/kpi/:scoreId`.  
Nav label **KPI** (not “Duyệt KPI”). Role only changes **which rows** and **which form actions**.  
Share: `links.kpiScore` + `/go/kpiScore/:id`. Domain math / bulkApprove / managerId **unchanged**.

## Non-goals

- Kanban pixel-copy Odoo  
- New permission keys  
- Change `bulkApprove` / confirm managerId / override branch rules  
- Dual nav “KPI của tôi” + “Duyệt KPI”  
- Payroll path form  

## Acceptance (program)

- [ ] Nav leaf label “KPI”; staff who can `submitSlip`/`refresh` can open board (own rows) OR board stays GĐ-gated but form UUID cold-start works for entitled callers  
- [ ] `kpi.get` owner | manager (confirm path) | branch director | super_admin  
- [ ] Form cold-start `/hr/kpi/:scoreId` shows statusbar + period + value + actions  
- [ ] Board row → form URL; back preserves period filter when possible  
- [ ] Unit tests TDD for get + links; admin form/board tests; existing lifecycle tests green  
- [ ] No standalone “approve one score” API (approved only via bulkApprove)  

## Architecture

```
/hr/kpi?period=&status=     board (ListPage)
/hr/kpi/:scoreId            form (DetailPage)
kpi.get { scoreId }         cold-start
links.kpiScore(id)
Nav: "KPI"  visibility: can(kpi.confirm) OR can(kpi.submitSlip)  — prefer open board to both
```

**Scope (server, unchanged semantics):**

| Caller | Rows on board | Form actions |
|--------|---------------|--------------|
| sale/GV | own (`list` self or keep myScore on board filter mine) | refresh, submitSlip when draft |
| GĐ | branch roles via existing `list` | confirm if managerId; override if track; bulk on board |
| super_admin | all in facility | all |

**Decision D-KPI-1:** Prefer **one list procedure** for board: extend `kpi.list` so non-directors with `submitSlip` get **self-only** results (no new key). Directors keep branch scope.  
**Decision D-KPI-2:** `/hr/my` keeps payroll/self hub; KPI card **links** to form/board — do not delete myScore path until board self-scope proven.  
**Decision D-KPI-3:** `approved` still **only** via `bulkApprove` on board toolbar.

## Phases

| # | File | Goal | Parallel | TDD |
|---|------|------|----------|-----|
| 0 | phase-00-nav-authority.md | Nav rename + authority cite | — | nav test |
| 1a | phase-01a-links-go.md | links.kpiScore + tests | ∥ 1b | first |
| 1b | phase-01b-kpi-get.md | kpi.get + tests | ∥ 1a | first |
| 2 | phase-02-routes-form.md | routes + form page shell | after 1 | form tests |
| 3 | phase-03-board-unify.md | board resource-centric + list self-scope | after 2 | board tests |
| 4 | phase-04-wire-actions-myhr.md | form actions + my-hr deep links | after 3 | integration |
| 5 | phase-05-verify.md | full unit + typecheck | after 4 | all green |

## Dependencies

```
0 → (1a ∥ 1b) → 2 → 3 → 4 → 5
```

## Risk

| Risk | Mitigation |
|------|------------|
| list self-scope widens attack surface | Server: non-director only `appUserId = caller` |
| nav rename breaks e2e menuNav | Update journeys that say “Duyệt KPI” |
| managerId vs track confusion | Form actions match existing procedures only |
| GĐ without AppUser | Same as confirm today |

## Reports

- Structure authority: `docs/ux-resource-centric-structure.md`  
- Prior advise: `plans/reports/research-advise-260811-system-structure-odoo-lean.md`  

## Next action

Execute phase 0 → parallel 1a/1b (TDD) → 2… under cook `--auto`.
