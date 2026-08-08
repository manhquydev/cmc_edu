// Shared one-step opportunity stage advance (phase-07). Used by BOTH
// `crm.opportunityAdvance` (the manual door) and the entrance-test appointment
// lifecycle (schedule → O3, complete → O4). Keeping one implementation means
// the one-step-at-a-time rule, the lost-opp rejection, and the FOR UPDATE
// serialization can never drift between the two doors.
//
// Deliberately PURE (no audit write): the tRPC middleware audits
// `crm.opportunityAdvance` automatically, and the appointment path writes its
// own CRM stage-change audit row so history stays complete regardless of which
// door advanced the opp. Adding an audit write here would double-count the
// manual door.

import type { Prisma } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { isOpportunityLost } from './opportunity-lost.js';

/** Linear advance order (WF-P1-01) — O5 is reached only via receiptApprove. */
export const ADVANCE_ORDER = ['O1_LEAD', 'O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const;

/**
 * Advances the opportunity exactly one stage toward `toStage`, inside the
 * caller's transaction. Locks the row FOR UPDATE (serializes against a
 * concurrent markLost / a second advance door), rejects a lost opp, and rejects
 * any non-adjacent target. Returns the updated row plus the prior stage (for the
 * caller's audit). Throws NOT_FOUND / BAD_REQUEST on the respective failures.
 */
export async function advanceOpportunityOneStep(
  tx: Prisma.TransactionClient,
  facilityId: string,
  opportunityId: string,
  toStage: string,
) {
  const rows = await tx.$queryRaw<{ id: string; stage: string; closedAt: Date | null }[]>`
    SELECT "id", "stage", "closedAt" FROM "Opportunity"
    WHERE "id" = ${opportunityId} AND "facilityId" = ${facilityId}
    FOR UPDATE
  `;
  const opportunity = rows[0];
  if (!opportunity) throw notFound('Opportunity not found.');
  if (isOpportunityLost(opportunity)) {
    throw badRequest('Opportunity is marked lost; reopen it before advancing.');
  }

  const currentIndex = ADVANCE_ORDER.indexOf(opportunity.stage as (typeof ADVANCE_ORDER)[number]);
  const targetIndex = ADVANCE_ORDER.indexOf(toStage as (typeof ADVANCE_ORDER)[number]);
  if (currentIndex === -1 || targetIndex !== currentIndex + 1) {
    throw badRequest(
      `Invalid stage transition from ${opportunity.stage} to ${toStage}; opportunities advance one stage at a time.`,
    );
  }

  // Use the validated literal (not the raw `string` arg) so Prisma's
  // OpportunityStage enum type is satisfied without a cast.
  const nextStage = ADVANCE_ORDER[targetIndex];
  // P2 rotting clock: every CRM-domain stage UPDATE must reset stageChangedAt.
  // Finance O4↔O5 transitions deliberately do NOT touch this field.
  const updated = await tx.opportunity.update({
    where: { id: opportunity.id },
    data: { stage: nextStage, stageChangedAt: new Date() },
  });
  return { opportunity: updated, fromStage: opportunity.stage } as const;
}
