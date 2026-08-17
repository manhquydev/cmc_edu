// Shared entity → URL builders for ERP admin deep links.
// Pure TypeScript — no runtime deps — importable from apps/admin (Vite) and
// (later) apps/api (Node). Entity detail paths + /go resolver + workspace
// query builders live here as the machine-readable source of truth.

/** UUID v1–v5 shape used at every deep-link id boundary. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read a query param only when it is a UUID — garbage ids never reach the API. */
export function readUuidParam(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key);
  return raw && UUID_RE.test(raw) ? raw : null;
}

export const links = {
  opportunity: (id: string) => `/crm/opportunities/${id}`,
  receipt: (id: string) => `/finance/${id}`,
  student: (id: string) => `/admin/students/${id}`,
  classBatch: (id: string) => `/admin/classes/${id}`,
  /** ShiftRegistration form (Work Schedule) — UUID. */
  shiftRegistration: (id: string) => `/hr/shifts/${id}`,
  /** KpiScore form (shared KPI workspace) — UUID. */
  kpiScore: (id: string) => `/hr/kpi/${id}`,
  /** AfterSaleCase form — UUID. */
  afterSaleCase: (id: string) => `/crm/aftersale/${id}`,
  /** ParentAccount form — UUID. */
  parentAccount: (id: string) => `/admin/parents/${id}`,
  /** ClassSession form — UUID. */
  classSession: (id: string) => `/teaching/sessions/${id}`,
  /** ManualAttendanceTicket form (check-in offsite approval) — UUID. */
  manualPunchTicket: (id: string) => `/hr/checkin/${id}`,
  /** Reward redemption form (engagement queue) — UUID. */
  reward: (id: string) => `/admin/engagement/rewards/${id}`,
  /** Exercise form (teaching catalog publish/close) — UUID. */
  exercise: (id: string) => `/teaching/exercises/${id}`,
  /** Staff record detail (canonical /hr/staff surface) — UUID. */
  staff: (id: string) => `/hr/staff/${id}`,
} as const;

export type LinkEntity = keyof typeof links;

export const goPath = (entity: LinkEntity, id: string): string =>
  `/go/${entity}/${id}`;

/**
 * Resolve a canonical `/go/:entity/:id` into a real admin path.
 * Returns null for unknown entity keys (incl. prototype names), non-UUID ids,
 * or empty input — never throws.
 */
export function resolveGo(entity: string, id: string): string | null {
  // Object.hasOwn — never `in` (prototype chain: 'toString' in links === true).
  if (!Object.hasOwn(links, entity)) return null;
  if (!UUID_RE.test(id)) return null;
  return links[entity as LinkEntity](id);
}

function withQuery(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Workspace list for shift registrations (not a /go entity). */
export function shiftRegistrationsPath(q?: {
  scope?: 'mine' | 'inbox';
}): string {
  const params = new URLSearchParams();
  if (q?.scope === 'mine' || q?.scope === 'inbox') {
    params.set('scope', q.scope);
  }
  return withQuery('/hr/shifts', params);
}

export function shiftRegistrationNewPath(): string {
  return '/hr/shifts/new';
}

/** Workspace list for check-in / manual punch tickets (not a /go entity alone). */
export function checkInPath(q?: { scope?: 'mine' | 'inbox' }): string {
  const params = new URLSearchParams();
  if (q?.scope === 'mine' || q?.scope === 'inbox') {
    params.set('scope', q.scope);
  }
  return withQuery('/hr/checkin', params);
}

/** KPI board (list) — period/status query filters. */
export function kpiScoresPath(q?: {
  period?: string;
  status?: 'draft' | 'submitted' | 'confirmed' | 'approved';
}): string {
  const params = new URLSearchParams();
  if (q?.period && /^\d{4}-\d{2}$/.test(q.period)) {
    params.set('period', q.period);
  }
  if (q?.status) {
    params.set('status', q.status);
  }
  return withQuery('/hr/kpi', params);
}

/** Workspace deep-link builders (query params — not routed through /go). */
export function attendancePath(q: {
  classBatchId?: string;
  sessionId?: string;
}): string {
  const params = new URLSearchParams();
  if (q.classBatchId && UUID_RE.test(q.classBatchId)) {
    params.set('classBatchId', q.classBatchId);
  }
  if (q.sessionId && UUID_RE.test(q.sessionId)) {
    params.set('sessionId', q.sessionId);
  }
  return withQuery('/teaching/attendance', params);
}

/** Grading queue: selected submission (submission.listForGrading item id). */
export function gradingPath(q: { submissionId?: string }): string {
  const params = new URLSearchParams();
  if (q.submissionId && UUID_RE.test(q.submissionId)) {
    params.set('submissionId', q.submissionId);
  }
  return withQuery('/teaching/grading', params);
}

/**
 * Payroll: period is YYYY-MM (not UUID); userId is AppUser.id UUID.
 * Sensitive: serves with Referrer-Policy same-origin (nginx).
 */
export function payrollPath(q: { userId?: string; period?: string }): string {
  const params = new URLSearchParams();
  if (q.period && /^\d{4}-\d{2}$/.test(q.period)) {
    params.set('period', q.period);
  }
  if (q.userId && UUID_RE.test(q.userId)) {
    params.set('userId', q.userId);
  }
  return withQuery('/hr/payroll', params);
}

/** Session evidence workspace — same param shape as attendance. */
export function sessionEvidencePath(q: {
  classBatchId?: string;
  sessionId?: string;
}): string {
  const params = new URLSearchParams();
  if (q.classBatchId && UUID_RE.test(q.classBatchId)) {
    params.set('classBatchId', q.classBatchId);
  }
  if (q.sessionId && UUID_RE.test(q.sessionId)) {
    params.set('sessionId', q.sessionId);
  }
  return withQuery('/teaching/session-evidence', params);
}

/** Canonical staff list — q/page are the ONLY persisted list keys (D1). */
export function staffListPath(q?: { q?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (q?.q) params.set('q', q.q);
  if (q?.page && q.page > 1) params.set('page', String(q.page));
  return withQuery('/hr/staff', params);
}

/** Canonical staff create page (static /new precedes /:staffId in routes). */
export function staffNewPath(): string {
  return '/hr/staff/new';
}

/** Staff detail default section (/hr/staff/:staffId redirects here). */
export function staffProfilePath(id: string): string {
  return `/hr/staff/${id}/profile`;
}

/** Staff access section (roles + reset password) — UUID. */
export function staffAccessPath(id: string): string {
  return `/hr/staff/${id}/access`;
}
