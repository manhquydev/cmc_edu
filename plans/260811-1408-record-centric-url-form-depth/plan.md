# Plan: Record-centric URL + form depth (Odoo-like UX, CMC path grammar)

**ID:** `260811-1408-record-centric-url-form-depth`  
**Status:** ACTIVE — phases 0–4 done (e2e local green 2026-08-11); phase 05 matrix ready for post-merge  
**Mode:** careful multi-phase; **pilot Work Schedule first**, then system roll-out  
**Do not:** clone Odoo hash (`#action=&model=`); big-bang rewrite all modules at once  

## Outcome

Every **business record** the user works on has a **stable form URL**, list is only the **index**, browser back/share/F5/HITL agent work like Odoo’s form depth — implemented with **CMC path-based SPA** (TL06), Console form chrome (DetailPage + statusbar), not expand-in-tab.

## Authority

| Source | Role |
|--------|------|
| `docs/06-kien-truc-url-routing.md` | URL grammar (path, not hash) |
| `docs/27-workflow-spec-p3.md` | `/hr/shifts/:id` already specified |
| `plans/reports/brainstorm-advise-260811-url-depth-work-schedule-form.md` | Advise base |
| `plans/reports/research-260811-odoo-webclient-url-depth-hr-work-schedule.md` | Odoo principles |
| This plan `decisions.md` | Locked choices |

## Locked decisions (summary)

See **[decisions.md](./decisions.md)**. Short form:

1. Path form: `/hr/shifts`, `/hr/shifts/new`, `/hr/shifts/:registrationId`  
2. UUID ids; `@cmc/links` + optional `/go/…`  
3. List = index; form = work surface (matrix, statusbar, actions)  
4. Expand-under-tab is **secondary/degraded**, not primary  
5. After shifts pilot: same pattern for remaining “shallow” modules  

## Phases

| Phase | File | Goal | Risk |
|-------|------|------|------|
| 0 | [phase-00-contract-doc-align.md](./phase-00-contract-doc-align.md) | Align docs + decision freeze; inventory modules | Low |
| 1 | [phase-01-links-api-get.md](./phase-01-links-api-get.md) | `links.shiftRegistration` + `shift.get` (if needed) | Med |
| 2 | [phase-02-routes-list-form.md](./phase-02-routes-list-form.md) | Routes + list page + form page shell | Med–High |
| 3 | [phase-03-form-ux-business.md](./phase-03-form-ux-business.md) | Move Work Schedule UX onto form; 3 ca; approve | High |
| 4 | [phase-04-e2e-go-deep-link.md](./phase-04-e2e-go-deep-link.md) | e2e deep link, go resolver, remove expand-primary | Med |
| 5 | [phase-05-system-rollout-matrix.md](./phase-05-system-rollout-matrix.md) | Prioritized matrix for rest of ERP | Low (planning) |

## Dependencies

```
0 → 1 → 2 → 3 → 4
              ↘ 5 (can draft in parallel after 0)
```

## Global acceptance (program)

- [ ] Cold-start: paste `/hr/shifts/{uuid}` → form of that registration  
- [ ] List row click → form URL (history entry)  
- [ ] Back → list (scope query preserved when possible)  
- [ ] GĐ share link → same form  
- [ ] No Planned / CONFIRMED on shift form  
- [ ] Sale SINGLE 3 ca / GV MULTIPLE 3 ca still correct  
- [ ] Unit + e2e green on touched surfaces  
- [ ] Rollout matrix published for other modules (phase 5)  

## Explicit non-goals (this program)

- Port Odoo OWL / action integers / hash router  
- Rewrite all modules in one PR  
- Kanban Search OS full parity  
- Change payroll domain math  

## Risk controls

| Risk | Control |
|------|---------|
| Scope explosion | Pilot **only shifts** through phase 4 |
| API gap | Phase 1 must land `get` before form route |
| UI regression | Keep existing submit/approve tests; add deep-link tests |
| Doc drift TL06 `/attendance` vs `/hr` | Code authority `/hr/shifts` |
| Heavy UX | Phase 3 reuses existing matrix/CSS; no redesign from zero |

## Reports

- `reports/` — phase completion, reviews  
- Prior research linked above  

## Next action

1. **Phase 04:** prove Playwright deep-link + `/go/shiftRegistration` + UAT paths (do not open P2 modules until green).  
2. **Phase 05:** matrix drafted — owner confirms next module (recommend KPI).  
3. Review: `plans/reports/review-260811-record-centric-shift-pilot.md`.
