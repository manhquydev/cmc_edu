// Client-side error capture for the CMC EDU Admin app.
//
// The browser cannot reach GlitchTip/Sentry directly (loopback), so runtime
// errors are reported same-origin to the API, which is responsible for
// forwarding them into the server capture pipeline keyed by reqId (see
// apps/api/src/lib/instrument.ts). This module is deliberately fail-open:
// reporting must never throw or disturb the app — every failure is caught and
// only logged.

export type ErrorKind = 'window.onerror' | 'unhandledrejection' | 'react-boundary';

export interface ErrorReportInput {
  /** 10-char [A-Z0-9] correlation code shown to the user / logged locally. */
  code: string;
  message: string;
  stack?: string | null;
  url?: string;
  kind: ErrorKind;
  extra?: Record<string, unknown> | null;
}

const REPORT_URL = '/api/track-error';

/** Flood control: at most 1 report per 2 s, at most 10 per page load. */
const MIN_REPORT_INTERVAL_MS = 2_000;
const MAX_REPORTS_PER_PAGE_LOAD = 10;

let lastReportAt = 0;
let reportsSent = 0;

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 10;

/** FNV-1a 32-bit hash — deterministic mapping (same input → same hash). */
function fnv1a32(input: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 10-char [A-Z0-9] correlation code derived from a fresh crypto.randomUUID
 * via a deterministic short hash (two seeded 32-bit hashes → 64-bit value →
 * base-36). Falls back to a time+random source where crypto.randomUUID is
 * unavailable (non-secure contexts).
 */
export function generateErrorCode(): string {
  let uuid: string;
  try {
    uuid = crypto.randomUUID();
  } catch {
    uuid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  const hi = fnv1a32(uuid, 0x9e3779b9);
  const lo = fnv1a32(uuid, 0x85ebca6b);
  let value = BigInt(hi) * (1n << 32n) + BigInt(lo);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code = CODE_ALPHABET[Number(value % 36n)] + code;
    value /= 36n;
  }
  return code;
}

/**
 * Fire-and-forget same-origin report to POST /api/track-error. Same-origin
 * fetch sends cookies by default (no credentials option needed). Never throws:
 * failures are caught and logged. Reports exceeding the flood-control budget
 * are dropped.
 */
export function reportError(input: ErrorReportInput): void {
  const now = Date.now();
  if (reportsSent >= MAX_REPORTS_PER_PAGE_LOAD || now - lastReportAt < MIN_REPORT_INTERVAL_MS) {
    return;
  }
  reportsSent += 1;
  lastReportAt = now;

  const body = {
    code: input.code,
    message: input.message,
    stack: input.stack ?? null,
    url: input.url ?? (typeof window !== 'undefined' ? window.location.href : null),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    route: typeof window !== 'undefined' ? window.location.pathname : null,
    kind: input.kind,
    extra: input.extra ?? null,
  };

  void fetch(REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((cause: unknown) => {
    // Capture must fail open — a reporting failure is never user-visible.
    console.error('[error-report] report failed', cause);
  });
}
