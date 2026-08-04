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
