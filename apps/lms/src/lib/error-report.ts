// Client-side error capture — same-origin report to the API (plan P2-A contract).
//
// Every browser error path (window.onerror / unhandledrejection / React
// ErrorBoundary) funnels through reportError(), which POSTs a JSON body to
// /api/track-error on the same origin. The call is fire-and-forget and
// fail-open: it NEVER throws, never blocks the app, and silently drops
// reports when the endpoint is unavailable (e.g. the dev-server proxy does
// not forward /api — production nginx routes it to the API server).
//
// Rate control: at most 1 report per 2s and 10 reports per page load, so a
// crashing loop cannot flood the API.

export type ErrorKind =
  | 'unhandledrejection'
  | 'window.onerror'
  | 'react-boundary'
  | 'console-error';

export interface ErrorReportOptions {
  /** 10-char [A-Z0-9] correlation code shown to the user. */
  code: string;
  message: string;
  stack?: string | null;
  /** Page URL at the time of the error; defaults to window.location.href. */
  url?: string;
  kind: ErrorKind;
  extra?: Record<string, unknown> | null;
}

const REPORT_URL = '/api/track-error';
const DEDUPE_WINDOW_MS = 2_000;
const MAX_REPORTS_PER_PAGE_LOAD = 10;

const CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 10;

let lastReportAt = 0;
let reportsSent = 0;

/** Deterministic short hash of a string: one independent FNV-1a pass per
 *  output character so every position derives from the full input. */
function shortHash(input: string): number[] {
  const out: number[] = [];
  for (let pos = 0; pos < CODE_LENGTH; pos++) {
    let hash = 0x811c9dc5 ^ (pos * 0x9e3779b1);
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    out.push(hash >>> 0);
  }
  return out;
}

/** 10-char [A-Z0-9] correlation code derived from crypto.randomUUID()
 *  (fallback: timestamp + random for non-secure contexts). */
export function generateErrorCode(): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return shortHash(raw)
    .map((h) => CODE_ALPHABET[h % CODE_ALPHABET.length])
    .join('');
}

/** Fire-and-forget same-origin report. Never throws; dedupes to 1 report per
 *  2s and 10 per page load. */
export function reportError(opts: ErrorReportOptions): void {
  try {
    const now = Date.now();
    if (now - lastReportAt < DEDUPE_WINDOW_MS) return;
    if (reportsSent >= MAX_REPORTS_PER_PAGE_LOAD) return;
    lastReportAt = now;
    reportsSent += 1;

    if (typeof fetch !== 'function') return;

    void fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: opts.code,
        message: opts.message,
        stack: opts.stack ?? null,
        url: opts.url ?? (typeof window !== 'undefined' ? window.location.href : ''),
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        kind: opts.kind,
        extra: opts.extra ?? null,
      }),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget: the report must never surface or rethrow.
    });
  } catch {
    // reportError must never throw, even if globals are unavailable.
  }
}
