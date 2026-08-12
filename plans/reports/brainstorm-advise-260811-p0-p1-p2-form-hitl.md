# Brainstorm + Advise — P0 ship → P1 form tests → P2 demote dual HITL

## Contract
| Field | Content |
|-------|---------|
| **Outcome** | typecheck ship gate green; form unit locks HITL; list aftersale/KPI open-row only; bulk KPI period kept |
| **Constraints** | No API mutation shape change; parents link-request Duyệt stays; TDD |
| **Non-goals** | Chatter; timesheet; TEKY kanban; remove bulkApprove |
| **Accept** | `pnpm test:ui-frames` + densify unit suite green; list tests assert no Tiếp nhận/Xác nhận on rows; e2e form path for aftersale+KPI confirm |

## Advise
- P0 root on e857: **ui-ratchet** regression (not frames tier) → write baseline for densify inline styles.
- P2 demote **after** form unit tests exist (TDD: write form mutate tests first while list still has buttons, then demote list + rewrite list tests).
