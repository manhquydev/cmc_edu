// Single source of truth for "is this opportunity lost?" — used by the CRM
// stage machine, the finance receipt create/approve gates (phase-02), and the
// walk-in / entrance-test flows (phases 5, 7).
//
// There is NO dedicated "lost" OpportunityStage value (schema.prisma). A lost
// opportunity is one whose `closedAt` is set while its stage is still somewhere
// in O1..O4 — i.e. it was closed WITHOUT enrolling. An O5_ENROLLED opportunity
// also carries a `closedAt` (the enrollment instant), but that is a WON close,
// not a lost one — so O5 is explicitly excluded.

export interface OpportunityLostShape {
  stage: string;
  closedAt: Date | null;
}

/** True when the opportunity was closed without enrolling (lost), false for an
 * open opportunity (no closedAt) or a won one (O5_ENROLLED). */
export function isOpportunityLost(opp: OpportunityLostShape): boolean {
  return opp.closedAt != null && opp.stage !== 'O5_ENROLLED';
}
