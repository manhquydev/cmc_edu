# Phase 05 — System roll-out matrix (post-pilot)

**Status:** draft inventory published 2026-08-11 (execution gated on phase 04 e2e green)  
**Risk:** Low for this phase (planning + inventory)  
**Depends on:** pilot phases 1–4 complete before executing module rows  

## Goal

Repeat the same **Odoo-like form depth principles** (list = index, form = work surface, stable path URL) across ERP modules that still lack form URLs — **one module at a time**, same checklist. Grammar is **CMC path** (TL06), never Odoo hash.

## Checklist per module (copy)

1. Document list + detail path in TL06 (if missing)  
2. `links.*` + UUID validation (+ optional `/go/{entity}/:id`)  
3. API `get` by id (or prove list+id enough for cold-start)  
4. Route `resource/:id` (+ `/new` if create is large; static before param)  
5. List navigate → form; form uses `DetailPage` + statusbar + primary actions  
6. Back/share/F5 tests (unit + journey when business-critical)  
7. Optional `CopyLinkButton mode="go"` on form header  

## Pattern library (from shifts pilot)

| Concern | Canonical reference |
|---------|---------------------|
| Links + go entity | `packages/links` `links.shiftRegistration` |
| Cold-start API | `shift.get` facility + owner/director gate |
| Routes | `hr.routes.tsx` — `shifts`, `shifts/new`, `shifts/:registrationId` |
| List index | `shifts.tsx` — tabs + **Mở phiếu** + scope query |
| Compose | `shifts-new.tsx` → submit → form id |
| Form work surface | `shifts-detail.tsx` — statusbar, matrix, approve/reject/cancel, Copy link |
| Plan decisions | `decisions.md` D1–D10 |

## Inventory (as-built 2026-08-11)

### Already form-depth (P0 baseline)

| Module | List | Detail URL | links /go | Notes |
|--------|------|------------|-----------|-------|
| Receipt | `/finance` | `/finance/:id` | `receipt` | Reference chrome |
| Opportunity | `/crm` | `/crm/opportunities/:id` | `opportunity` | Reference chrome |
| Student | admin list | `/admin/students/:id` | `student` | |
| Class batch | admin list | `/admin/classes/:id` | `classBatch` | |
| Session | teaching | `/teaching/sessions/:sessionId` | workspace qs | Evidence/attendance query |
| **Shift registration** | `/hr/shifts` | **`/hr/shifts/:registrationId`** | **`shiftRegistration`** | **Pilot 0–3 done; phase 04 e2e open** |

### Shallow / query-workspace (candidates)

| Priority | Module | List today | Detail today | Target detail URL | Est. PR | Blockers / notes |
|----------|--------|------------|--------------|-------------------|---------|------------------|
| **P1 pilot** | Shift registration | `/hr/shifts` | form route | `/hr/shifts/:id` | M (landed) | Phase 04: journey green + UAT docs |
| **P2** | KPI score | `/hr/kpi` | in-page / period table | `/hr/kpi/:scoreId` | M | Need `kpi.get` + row identity; period still filter |
| **P2** | Payslip line | `/hr/payroll?userId&period` | query workspace | evaluate `/hr/payroll/slips/:id` **or** keep workspace | L | Domain is period×user; path form only if slip is first-class UUID |
| **P3** | Aftersale case | `/crm/aftersale` | dialog/list only | `/crm/aftersale/:id` | M | Confirm case id model + get API |
| **P3** | Refund | `/finance/refund` | partial | `/finance/refunds/:id` | M–L | Route order vs `/finance/:id` receipt |
| **P4** | Rewards / gifts | engagement lists | often none | per domain | S–M | Low HITL pressure |
| **Skip** | Check-in | `/hr/checkin` | self workspace | stay workspace | — | Not a multi-record form |
| **Skip** | Salary tiers | `/hr/salary-tiers` | admin grid | stay list+edit | — | Config, not workflow record |
| **Skip** | My HR | `/hr/my` | self | stay | — | |

## Execution rule (hard)

```
No second module starts form-depth until shifts pilot phase 04 e2e is green.
```

When unblocked, order of attack:

1. **P2 KPI** — highest GĐ share-link value after shifts  
2. **P3 Aftersale** — case-centric support  
3. **P3 Refund** — money risk; careful route ranking  
4. **P2 Payroll** — only after product decision path-vs-workspace  

## Acceptance (phase 05 deliverable)

- [x] Matrix reviewed against as-built routes + links (2026-08-11)  
- [x] Each P2+ has estimated PR size (S/M/L)  
- [x] No big-bang PR spanning >1 domain without plan  
- [ ] Owner confirms KPI vs Aftersale as first post-pilot module  
- [ ] Each future module opens its own `plans/<ts>-form-depth-<module>/`  

## Next after pilot 04 green

Open a short plan per module using the checklist above; reuse Console `DetailPage` / EntityHeader / CopyLinkButton patterns from receipt + opportunity + shifts.
