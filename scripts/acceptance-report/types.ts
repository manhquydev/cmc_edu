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
  /** Phase 5 (plans/260723-1422-may-hoa-nghiem-thu-ba-tang): relative path (from
   *  repo root) to a `.journey.ui.spec.ts` file that drives this flow end-to-end
   *  through the real UI, menu-first, one role per browser context. This is
   *  metadata only — the verifier checks the file exists and has >=1 `test(`,
   *  it never runs Playwright. "Has a journey spec" is NOT the same signal as
   *  "passed in CI last run" — see render.ts's coverage badge for the split. */
  journey?: string;
  /** Why this flow is not green, when that is already known and verified.
   *  Written by triage, read by the renderer — it never changes `FlowStatus`,
   *  it only replaces an unexplained red with a stated reason. A red flow with
   *  no reason here is rendered as "đỏ chưa triage" rather than failing the
   *  tool: a hard failure here would brick the whole ledger and reward typing
   *  any reason at all to get it rendering again. */
  statusReason?: StatusReason;
}

export type StatusReasonCode =
  /** Journey exists but is parked as `test.fixme` — the app is broken and the
   *  fix belongs to a later plan. `detail` must carry verified evidence. */
  | 'red-fixme'
  /** No UI path exists for some step, so no journey can drive this flow.
   *  `detail` must quote the grep command and its output. */
  | 'no-ui-path'
  /** Triage found the declared `journey` does not actually drive the
   *  procedures/routes this flow claims (rule H2). This one DOES fail the
   *  tool — it is a structural lie in the manifest, not a red flow. */
  | 'h2-mismatch';

export interface StatusReason {
  code: StatusReasonCode;
  detail: string;
}

export type FlowStatus = 'built' | 'partial' | 'missing';

/** What a reader of the Nghiệm thu tab sees. `proven` is reachable only through
 *  ingested Playwright results — never from anything hand-written. */
export type AcceptanceState = 'proven' | 'built-unproven' | 'not-yet';

/** Why a flow landed in its state. One state + one reason badge, so the reader
 *  is never asked to reconcile two competing status dimensions. */
export type EvidenceBadge =
  | 'proven'
  /** No results file at all — nothing has been ingested. */
  | 'no-results'
  /** Results exist but were produced at a different commit than HEAD. */
  | 'stale'
  /** Results exist at the right commit but this flow's declared spec is not in
   *  them — the run covered only part of the suite. */
  | 'partial'
  /** Spec ran and failed, and the manifest states a verified reason. */
  | 'red-fixme'
  /** Spec ran and failed with no stated reason. Loud on purpose. */
  | 'red-untriaged'
  /** Spec ran but every test was fixme/skip — zero real assertions executed.
   *  Never proven: an all-skipped file passing is a vacuous green. */
  | 'vacuous'
  /** Flow declares no journey spec. */
  | 'no-journey'
  /** Flow declares no journey because no UI path exists (evidence in detail). */
  | 'no-ui-path'
  /** Triage proved the declared journey does not drive what this flow claims,
   *  so its result — pass or fail — is not evidence about this flow. */
  | 'h2-mismatch'
  /** The journey passed, but the static scan still says the flow is not fully
   *  built. ⬤ asserts both, so this stops at "built-unproven"/"not-yet". */
  | 'passed-not-built';

export interface FlowEvidence {
  state: AcceptanceState;
  badge: EvidenceBadge;
  /** Human-readable reason shown next to the badge, when there is one. */
  detail?: string;
}

/** How one spec file behaved in a run. Counts come from Playwright's own
 *  retry-resolved `test.status`, not from raw per-attempt results. */
export interface SpecFacts {
  outcome: 'pass' | 'fail' | 'skipped';
  passed: number;
  failed: number;
  skipped: number;
  /** Annotation types seen on this spec's tests, e.g. `fixme`, `skip`. */
  annotations: string[];
}

/** Everything the ingester knows after reading a Playwright JSON report.
 *  Deliberately manifest-blind: it reports what ran, never what should have. */
export interface RunFacts {
  /** Commit the run was executed at, injected into the report metadata at run
   *  time. `null` when the report predates SHA injection. */
  sha: string | null;
  /** Whether the worktree had uncommitted changes when the run started. A
   *  commit alone does not identify what ran if the tree was modified. */
  dirty: boolean;
  /** Every Playwright project present in the report, e.g. `['ui-chromium']`. */
  projects: string[];
  /** Count of run-level errors (globalSetup crash, config error). */
  runErrors: number;
  /** Repo-relative spec path → how that spec behaved. */
  specs: Record<string, SpecFacts>;
}

export interface FlowVerification {
  flow: FlowEntry;
  status: FlowStatus;
  /** What a real Playwright run says about this flow. Composed, not stored —
   *  recomputed from the results file on every report run. */
  evidence: FlowEvidence;
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

export interface ActorAuditSummary {
  findings: { flowId: string; kind: string; subject: string; detail: string }[];
  ungatedProcedureCount: number;
  inconclusiveActorCount: number;
}

export interface OrphanResult {
  /** All scanned procedures not referenced by any manifest flow (documented + untriaged). */
  procedures: string[];
  /** Orphans that are known capabilities without a WF flow, each with a reason (E7 category c). */
  documented: { procedure: string; reason: string }[];
  /** Orphans NOT yet triaged — real capability surfaced by the tool, needs a decision. Should be empty. */
  untriaged: string[];
}

/** Provenance of the run backing this report — the part a reader has to trust
 *  before trusting any ⬤ badge below it. */
export interface EvidenceRun {
  /** Where the results were read from, repo-relative. */
  resultsPath: string;
  present: boolean;
  /** Commit the run was executed at, or null when unknown/absent. */
  sha: string | null;
  headSha: string;
  /** Run happened against a modified worktree — the result is advisory only. */
  dirty: boolean;
  projects: string[];
  runErrors: number;
  /** Declared journey specs the run never executed. Non-empty means the run
   *  covered only part of the suite and cannot back a ledger of record. */
  unrunJourneys: string[];
}

export interface VerificationResult {
  generatedAt: string;
  commit: string;
  evidenceRun: EvidenceRun;
  flows: FlowVerification[];
  orphans: OrphanResult;
  /** Actor↔permission consistency — a flow naming a role that cannot do the work. */
  actorAudit: ActorAuditSummary;
  scan: {
    trpcNamespaceCount: number;
    unresolvedNamespaces: readonly string[];
  };
}
