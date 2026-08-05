// Shared types for the offline presentation deck generator.
// Content is written by humans; status labels are composed from measured JSON only.

export type Cluster = 'P1' | 'P2' | 'P3' | 'P4' | 'ADMIN';

/** Two-tier audience-facing status (D8). Never invent from docs alone. */
export type AudienceStatus =
  | 'verified-correct' // đúng nghiệp vụ
  | 'reachable-only' // chạy được, chưa kiểm số học
  | 'not-proven' // chưa chứng minh
  | 'unmeasured'; // chưa đo (thiếu JSON)

export type DiagramKind = 'swimlane' | 'journey' | 'control-gate' | 'before-after';

export interface FlowTierLabel {
  id: string;
  displayName: string;
  cluster: Cluster;
  actorRoles: string[];
  uiRoutes: string[];
  /** Tầng "chạy thông" from verification.json */
  reachability: 'proven' | 'not-yet' | 'unmeasured';
  /** Tầng "đúng nghiệp vụ" from business-verification.json */
  correctness: AudienceStatus;
  moneyStateCritical: boolean;
  /** True when this id is listed in criticalReachableOnly */
  criticalSmokeOnly: boolean;
  audienceLabel: string;
  audienceHint?: string;
}

export interface LoadWarnings {
  missingVerification: boolean;
  missingBusiness: boolean;
  /** SHA mismatch between measured data and HEAD */
  stale: boolean;
  measuredCommit: string | null;
  headCommit: string | null;
  /** Flow ids present in manifest but not in a status file (or vice versa) */
  idMismatches: string[];
  /** Always true unless --release passed and validated */
  draftBanner: boolean;
}

export interface DeckFlowData {
  flows: FlowTierLabel[];
  warnings: LoadWarnings;
  counts: {
    total: number;
    proven: number;
    notYet: number;
    verifiedCorrect: number;
    reachableOnly: number;
    notProven: number;
    unmeasured: number;
    criticalReachableOnly: string[];
  };
}

export interface SwimlaneStep {
  actor: string;
  action: string;
  system?: boolean;
}

export interface JourneyMilestone {
  time?: string;
  title: string;
  detail?: string;
}

export interface ControlGateOption {
  label: string;
  kind: 'approve' | 'reject' | 'return' | 'escalate';
  note?: string;
}

export interface BeforeAfterSide {
  title: string;
  items: string[];
}

export interface ScreenSketchRegion {
  /** percent 0–100 */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind?: 'header' | 'nav' | 'table' | 'button' | 'card' | 'text';
}

/** Human-authored copy for one business flow (Phase 3). */
export interface FlowCopy {
  id: string;
  /** Vietnamese customer-facing title — never raw displayName jargon */
  title: string;
  diagram: DiagramKind;
  /** Ai bắt đầu? */
  whoStarts: string;
  /** Ai duyệt? (or "không cần duyệt") */
  whoApproves: string;
  /** Hệ thống tự làm gì? */
  systemDoes: string;
  /** Xem kết quả ở màn nào — from manifest uiRoutes, humanized */
  resultScreen: string;
  /** Important rules (thresholds, SoD, deadlines) */
  rules?: string[];
  /** Diagram payload */
  steps?: SwimlaneStep[];
  milestones?: JourneyMilestone[];
  gateOptions?: ControlGateOption[];
  before?: BeforeAfterSide;
  after?: BeforeAfterSide;
  /** Optional SVG layout sketch of the main screen */
  screenSketch?: {
    title: string;
    regions: ScreenSketchRegion[];
  };
  /** Source section pointer for fact-check (docs path + heading), not shown to audience */
  sourceRef?: string;
  notes?: string[];
}

export interface SpineBeat {
  id: string;
  title: string;
  /** Body copy for the customer-facing slide — ≤ 25 words */
  lines: string[];
  diagram?: DiagramKind;
  steps?: SwimlaneStep[];
  milestones?: JourneyMilestone[];
  gateOptions?: ControlGateOption[];
  before?: BeforeAfterSide;
  after?: BeforeAfterSide;
  bridgeQuestion?: string;
  notes?: string[];
}

export interface HomeMapBlock {
  id: string;
  label: string;
  kind: 'role' | 'cluster' | 'gate' | 'system' | 'ai';
  /** reveal.js slide id to jump to */
  href: string;
}
