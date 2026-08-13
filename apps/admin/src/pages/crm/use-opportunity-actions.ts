import { trpc } from '../../lib/trpc.js';

/**
 * Shared opportunity mutations — create / mark-lost / reopen / assign — used
 * by create-lead-dialog, mark-lost-dialog, and the opportunity-detail page.
 * pipeline.tsx only renders those two dialogs; it does not import this hook.
 *
 * All mutations invalidate `crm.opportunityList` + `crm.opportunityGet` so an
 * open detail page refreshes immediately. Mutations that change due-list
 * membership (markLost, assign, setNextAction, clearNextAction — due-list
 * filters on assignedToId + closedAt) also invalidate DueFollowUps. Create
 * does not: a new lead is not yet on the due list.
 *
 * `opportunityAdvance` is intentionally NOT here: pipeline.tsx wires it with
 * page-specific optimistic-update logic against its own (search-aware) query
 * key, which would not generalize cleanly to the detail page's simpler
 * invalidate-only usage.
 */
export function useOpportunityActions() {
  const utils = trpc.useUtils();

  const invalidateList = () => void utils.crm.opportunityList.invalidate();
  const invalidateDetail = () => void utils.crm.opportunityGet.invalidate();
  const invalidateDue = () => void utils.crm.opportunityDueFollowUps.invalidate();
  const invalidateTimeline = () => void utils.crm.opportunityTimeline.invalidate();
  const invalidateRecordViews = () => {
    invalidateList();
    invalidateDetail();
    invalidateTimeline();
  };

  const createMutation = trpc.crm.opportunityCreate.useMutation({
    onSuccess: invalidateRecordViews,
  });

  // One procedure powers both "mark lost" (lostReason set) and "reopen"
  // (reopen: true) — callers pass the appropriate payload to the same
  // mutation object.
  const markLostMutation = trpc.crm.opportunityMarkLost.useMutation({
    onSuccess: () => {
      invalidateRecordViews();
      invalidateDue();
    },
  });

  // phase-10: owner assign/claim/unassign. The backend enforces the
  // sale-can-only-claim-for-self / manager-can-assign-anyone rules
  // row-by-row (apps/api/src/crm/router.ts) — the FORBIDDEN error surfaces
  // via `assignMutation.error` for the caller to render inline.
  const assignMutation = trpc.crm.opportunityAssign.useMutation({
    onSuccess: () => {
      invalidateRecordViews();
      invalidateDue();
    },
  });

  const setNextActionMutation = trpc.crm.opportunitySetNextAction.useMutation({
    onSuccess: () => {
      invalidateRecordViews();
      invalidateDue();
    },
  });

  const clearNextActionMutation = trpc.crm.opportunityClearNextAction.useMutation({
    onSuccess: () => {
      invalidateRecordViews();
      invalidateDue();
    },
  });

  return {
    createMutation,
    markLostMutation,
    assignMutation,
    setNextActionMutation,
    clearNextActionMutation,
  };
}
