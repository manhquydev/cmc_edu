// Types shared across the acceptance ledger tool (manifest, scanners, verifier, renderer).
// See plans/260717-1213-so-nghiem-thu-song/phase-01-flow-manifest-static-verifier.md.

export type Cluster = 'P1' | 'P2' | 'P3' | 'P4' | 'ADMIN';

export interface FlowEntry {
  /** WF code from TL25 (docs/25-ma-tran-truy-vet-p1.md), e.g. "P1-03". */
  id: string;
  /** Vietnamese, non-technical name shown in the Nghiệm thu tab. */
  displayName: string;
  cluster: Cluster;
  /** Roles from packages/auth (ROLES/ACTIVE_ROLES) who act in this flow. */
  actorRoles: string[];
  expected: {
    /** "finance.receiptApprove" — namespace.procedure, namespace = appRouter key. */
    trpc: string[];
    /** Full composed UI path, e.g. "/finance/receipts/:id". */
    uiRoutes: string[];
    /** Prisma model names touched by this flow. */
    models: string[];
  };
  /** Reserved for Phase 4 (gated) — UI spec that captures evidence for this flow. */
  uiEvidenceSpec?: string;
}

export type FlowStatus = 'built' | 'partial' | 'missing';

export interface FlowVerification {
  flow: FlowEntry;
  status: FlowStatus;
  missing: {
    trpc: string[];
    uiRoutes: string[];
    models: string[];
  };
  /** Routes that exist but render a placeholder rather than a working screen.
   *  A flow with any of these is not built, however complete the rest looks —
   *  the route resolving is what previously let a "coming soon" page count as a
   *  delivered feature. */
  placeholderRoutes: { path: string; kind: string }[];
}

export interface OrphanResult {
  /** All scanned procedures not referenced by any manifest flow (documented + untriaged). */
  procedures: string[];
  /** Orphans that are known capabilities without a WF flow, each with a reason (E7 category c). */
  documented: { procedure: string; reason: string }[];
  /** Orphans NOT yet triaged — real capability surfaced by the tool, needs a decision. Should be empty. */
  untriaged: string[];
}

export interface VerificationResult {
  generatedAt: string;
  commit: string;
  flows: FlowVerification[];
  orphans: OrphanResult;
  scan: {
    trpcNamespaceCount: number;
    unresolvedNamespaces: readonly string[];
  };
}
