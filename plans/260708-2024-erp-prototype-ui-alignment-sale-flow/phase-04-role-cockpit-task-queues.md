---
phase: 4
title: "Role-Cockpit-Task-Queues"
status: pending
priority: P2
dependencies: [3]
effort: "M-L"
---

# Phase 4: Role-Cockpit-Task-Queues

## Overview
Replace the shallow cockpit with a role-tailored **full-panel** cockpit (G4) — "Việc cần bạn xử" task
queue **+ stat cards + a pipeline O1→O5 side panel** per active role, matching the prototype — and fix the
dead "Phiếu thu chờ duyệt" counter (D-UI-1). Delivers the landing screen each active role sees.
<!-- Updated: Validation Session 1 — upgraded from light queue-only to full panel (stats + pipeline). -->

## Layout (per prototype cockpit)
Three regions per role: (1) **stat cards** row (counts, deep-linked), (2) **"Việc cần bạn xử"** task queue
(title + meta + deep-link), (3) **side panel** — sales pipeline O1→O5 for sale/GĐKD, today's schedule for
giao_vien, system health for super_admin. All regions use ONLY existing endpoints, each `canDo`-gated.

## Requirements
- Functional:
  - **D-UI-1 — counter fix.** `cockpit.tsx` `PendingReceiptsCard` must count receipts awaiting approval by
    the real state. `ReceiptStatus` = `draft/approved/sent/cancelled` (no `pending`); pending-approval =
    `status === 'draft'`. Fix the filter so the count reflects actual drafts.
  - **G4 — role task queues.** Render a "Việc cần bạn xử" list per active role, each item = title + meta +
    deep-link, gated by `canDo()` (never fire a query the role can't run). Minimum viable per role, using
    ONLY existing endpoints:
    - **giam_doc_kinh_doanh / giam_doc_dao_tao:** draft receipts awaiting approval (deep-link `/finance`),
      over-threshold receipts flagged (reuse `me.config.approvalSecondEyeThreshold`).
    - **sale:** O4_TESTED opportunities ready to Ghi danh (deep-link to the picker), open after-sale (if
      endpoint present).
    - **giao_vien:** ungraded submissions (existing `submission.listForGrading`), assessments awaiting
      confirm (if endpoint present).
    - **super_admin:** system stat cards (existing).
  - **Stat cards + pipeline side panel.** Stat cards (draft-receipt count, over-threshold count, ungraded
    count — per role, deep-linked). Side panel: sale/GĐKD → pipeline funnel O1→O5 from `crm.opportunityList`
    per-stage counts; giao_vien → today's schedule; super_admin → existing system stats. Reuse existing
    endpoints only; each region `canDo`-gated.
  - Empty state stays "Không có nhiệm vụ nào chờ xử lý cho vai trò này" when a role's queue is empty.
- Non-functional: no query fired without permission; no new backend endpoints (reuse existing lists);
  typecheck + build clean.

## Architecture
- `cockpit.tsx` becomes role-aware: a `TASK_SOURCES` map keyed by role → array of `{ title, meta,
  countQuery, href, gate }`. Each source uses an existing `trpc.*.useQuery` guarded by `canDo(gate)`.
- The counter fix is a one-line predicate change (`'pending'` → `'draft'`) plus a rename of the card logic
  to avoid re-introducing the wrong literal.
- Keep it data-light: counts + deep-links, not full embedded tables (prototype's cockpit is a queue, detail
  lives on the target screen).

## Related Code Files
- Modify: `apps/admin/src/pages/cockpit.tsx` (counter fix + role task queues)
- Read: `apps/api/src/submission/router.ts` (`listForGrading`), `apps/api/src/finance/router.ts`
  (`receiptList`), `apps/api/src/crm/router.ts` (`opportunityList`) — reuse only
- Create (test): `apps/admin/src/pages/cockpit-counter.test.ts` (pure predicate: counts drafts, ignores
  approved/sent/cancelled)

## Implementation Steps (TDD)
1. **RED — counter predicate.** Extract the pending-count predicate into a tiny pure function
   `countPendingApproval(receipts)` and test it: 3 drafts + 1 approved + 1 cancelled → 3; empty → 0;
   no receipt with the (nonexistent) `pending` status is ever required.
2. **GREEN.** Implement the predicate; wire `PendingReceiptsCard` to it. The dead `'pending'` literal is
   gone.
3. **Role panels.** Build the `TASK_SOURCES` map; render per-role the 3 regions (stat cards + queue +
   side panel) with `canDo` gates and deep-links; preserve the empty state. Pipeline side panel uses
   `crm.opportunityList` per-stage counts (O1→O5) for sale/GĐKD.
4. **Verify.** `pnpm --filter @cmc/admin typecheck` + `build`; run counter test; manual per role via
   RoleSwitcher (against a seeded facility): GĐKD sees draft-receipt count > 0 and a task item; sale sees
   O4 opps; giao_vien sees ungraded; empty roles show the empty state.

## Success Criteria
- [ ] `countPendingApproval` counts `draft` receipts (test green); GĐKD cockpit shows the real draft count,
      not 0.
- [ ] Each active role's cockpit shows the full panel (stat cards + "Việc cần bạn xử" queue + side panel)
      built only from endpoints that role can call (no 403-triggering queries).
- [ ] sale/GĐKD side panel shows the O1→O5 pipeline funnel counts.
- [ ] Empty state preserved when a role's queue is empty.
- [ ] No new backend endpoints; admin typecheck + build clean.

## Risk Assessment
- **Firing a query a role lacks permission for → 403 noise** → every source is `canDo`-gated before the
  query mounts (existing pattern in `cockpit.tsx`).
- **Panel scope** — DECIDED (Validation S1): full panel (stats + queue + pipeline) is in scope this round,
  but bounded to EXISTING endpoints + `canDo` gates. Guard against adding new backend endpoints or rich
  embedded tables (detail stays on the target screen).
- **Counter regression** → the extracted predicate is unit-tested so the wrong literal can't silently
  return.
- Rollback: revert `cockpit.tsx`; the counter predicate + test are self-contained.
