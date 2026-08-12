# Brainstorm — next resource-centric wave

**Date:** 2026-08-11  
**Authority:** `docs/ux-resource-centric-structure.md`

## Done (not re-open)

| Item | Status |
|------|--------|
| Structure authority | LOCKED |
| Shifts form-depth + e2e | Done |
| KPI shared workspace + confirm flags | Done |
| Shifts inbox index-only | Done |
| Aftersale form-depth | Done |

## Contract (this wave)

| Field | Content |
|-------|---------|
| **Outcome** | Next document modules get list+form+get+links without role-page bloat |
| **Constraints** | TDD; one module at a time after parallel S items; no payroll path; no refund until route design |
| **Non-goals** | Kanban, Search OS, gifts form |
| **Acceptance** | Parents form green unit; classSession in links; tests pass |

## Priority queue (implement)

| # | Work | Size | Rationale |
|---|------|------|-----------|
| 1 | **Parents form-depth** | M | UUID ready; list+email ops; high staff HITL |
| 2 | **links.classSession** | S | Route exists; complete teaching pack |
| 3 | Refund form-depth | M–L | **Later** — `/finance/:id` collision design |
| 4 | Parents list polish | S | Done with Mở phiếu in same PR |

## Decision

**Implement now:** (1) parents get/form/links/route + (2) classSession links — parallel TDD auto.  
**Defer:** refund, gifts, payroll.
