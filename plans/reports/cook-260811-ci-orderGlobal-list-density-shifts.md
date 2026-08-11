# Cook report — CI warning + list density (shifts)

**Date:** 2026-08-11  
**Mode:** ak:cook --auto --tdd · parallel explore agents  

## Brainstorm contract
| Field | Content |
|-------|---------|
| Outcome | Unblock typecheck (orderGlobal); Work Schedule list on Console ListPage ops; resource-centric tab |
| Done | Both |
| Non-goals | Full CI green wait; timesheet; TEKY kanban |

## Critical warnings handled
1. **Push** local commits → origin (PR #110 head updated)  
2. **CI typecheck root cause:** `seedPublishedExercise` missing `orderGlobal` → reuse `seedCurriculumUnit`  
3. **Local proof:** `pnpm --filter @cmc/e2e exec tsc --noEmit` exit 0  

## List density (queue next)
| List | Before | After |
|------|--------|--------|
| `/hr/shifts` | Fragment + PageHeader only; tab “Duyệt / Từ chối” | `ListPage density=ops`; tab **Hàng chờ**; inbox still Mở phiếu only |
| KPI / aftersale / receipt / parents | Already `density=ops` | No change required this batch |

## Tests
- shifts.test.tsx **15** pass  
- e2e typecheck green  

## Agents
- explore: orderGlobal scout  
- explore: list density advise (in flight)  
- code-reviewer: domain no-drift (spawned)  
