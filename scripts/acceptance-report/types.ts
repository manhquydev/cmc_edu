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
}

export interface OrphanResult {
  /** Scanned procedures (namespace.procedure) not referenced by any manifest flow. */
  procedures: string[];
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
