import { trpc } from '../../lib/trpc.js';

/**
 * Shared opportunity mutations — create / mark-lost / reopen / assign — used
 * by BOTH the pipeline dashboard (pipeline.tsx, create-lead-dialog.tsx,
 * mark-lost-dialog.tsx) and the opportunity-detail page. All four
 * invalidate `crm.opportunityList` on success so any open list picks up the
 * change.
 *
 * `opportunityAdvance` is intentionally NOT here: pipeline.tsx wires it with
 * page-specific optimistic-update logic against its own (search-aware) query
 * key, which would not generalize cleanly to the detail page's simpler
 * invalidate-only usage.
 */
export function useOpportunityActions() {
  const utils = trpc.useUtils();

  const invalidateList = () => void utils.crm.opportunityList.invalidate();

  const createMutation = trpc.crm.opportunityCreate.useMutation({
    onSuccess: invalidateList,
  });

  // One procedure powers both "mark lost" (lostReason set) and "reopen"
  // (reopen: true) — callers pass the appropriate payload to the same
  // mutation object.
  const markLostMutation = trpc.crm.opportunityMarkLost.useMutation({
    onSuccess: invalidateList,
  });

  // phase-10: owner assign/claim/unassign. The backend enforces the
  // sale-can-only-claim-for-self / manager-can-assign-anyone rules
  // row-by-row (apps/api/src/crm/router.ts) — the FORBIDDEN error surfaces
  // via `assignMutation.error` for the caller to render inline.
  const assignMutation = trpc.crm.opportunityAssign.useMutation({
    onSuccess: invalidateList,
  });

  return { createMutation, markLostMutation, assignMutation };
}
