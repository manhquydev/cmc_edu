# Advise — residual list density (post explore agent)

**Source:** explore subagent list-density plan  
**Date:** 2026-08-11  

## Matrix (chrome vs open-row)

| List | ListPage ops | FilterBar | Open-row HITL |
|------|:---:|:---:|:---:|
| receipt | ✓ | ✓ | ✓ reference |
| shifts | ✓ shell | N/A (tabs scope) | ✓ inbox; body residual **done** this cook |
| kpi | ✓ | ✓ | dual list+form keep (domain); **onRowClick** added |
| aftersale | ✓ | ✓ | list lifecycle keep; **onRowClick** added |
| parents | ✓ | ✓ | link-request list HITL OK until form depth |

## Implemented after advise
1. Shifts list body: no extra padding / no WS_CSS on list tabs; WS_CSS stays compose-only.  
2. Aftersale + KPI: `onRowClick` → form (receipt parity).  
3. No bulk-approve on shifts; no domain change.

## Next (optional product)
- Aftersale: demote list Tiếp nhận/Giải quyết/Đóng → form-only (test rewrite).  
- KPI: demote list Xác nhận/Ghi đè → form-only (keep bulk period).  
- Parents: ListPagination on directory tab.  
