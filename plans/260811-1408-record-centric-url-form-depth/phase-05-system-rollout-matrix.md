# Phase 05 — System roll-out matrix (post-pilot)

**Status:** pending (planning can start after phase 00)  
**Risk:** Low for this phase (planning only)  
**Depends on:** pilot phases 1–4 complete before executing module rows  

## Goal

Repeat the same grammar across ERP modules that still lack form URLs — **one module at a time**, same checklist.

## Checklist per module (copy)

1. Document list + detail path in TL06 (if missing)  
2. `links.*` + UUID validation  
3. API `get` by id (or prove list+id enough)  
4. Route `resource/:id` (+ `/new` if create is large)  
5. List navigate → form; form DetailPage chrome  
6. Back/share/F5 tests  
7. Optional `/go/{entity}/:id`  

## Priority matrix (draft)

| Priority | Module | List today | Detail today | Target detail URL |
|----------|--------|------------|--------------|-------------------|
| P0 done | Receipt | `/finance` | route | `/finance/:id` |
| P0 done | Opportunity | `/crm` | route | `/crm/opportunities/:id` |
| P0 done | Student / Class / Session | admin/teaching | route | existing |
| **P1 pilot** | **Shift registration** | `/hr/shifts` | expand | **`/hr/shifts/:id`** |
| P2 | Payslip | `/hr/payroll?userId` | query | `/hr/payroll/:payslipId` (evaluate) |
| P2 | KPI slip | `/hr/kpi` | in-page | `/hr/kpi/:scoreId` |
| P3 | Aftersale case | `/crm/aftersale` | ? | `/crm/aftersale/:id` |
| P3 | Refund | empty/partial | ? | `/finance/refunds/:id` |
| P4 | Rewards / gifts | list | often none | per domain |
| Skip | Check-in workspace | `/hr/checkin` | self | stay workspace |

## Rule

No second module starts form-depth until shifts pilot e2e green (phase 04).

## Acceptance (phase 05 deliverable)

- [ ] Matrix reviewed and ordered with dates  
- [ ] Each P2+ has estimated PR size (S/M/L)  
- [ ] No big-bang PR spanning >1 domain without plan  
