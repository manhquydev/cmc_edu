// Same-origin client error report endpoint (P3 of
// plans/260815-1616-uat-live-test-audit). The browser cannot reach GlitchTip
// directly (loopback bind + private bridge network — see lib/instrument.ts),
// so the admin/LMS global error handlers (window.onerror, unhandledrejection,
// React ErrorBoundary) forward client-side failures to this route. It logs the
// report through pino and captures it via Sentry with the SAME reqId the
// request already carries (server.ts reqIdOf) — preserving the logs ↔
// GlitchTip correlation pivot (scout-260815-observability §1-2).
//
// Deliberately UNAUTHENTICATED: window.onerror / unhandledrejection fire
// outside any session guarantee, and the payload is only error text the client
// could already see in its own console. Abuse is throttled at nginx
// (rate-limit zones in infra/nginx/api-locations.conf) — no server-side
// session check here.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Sentry } from './instrument.js';
import { serviceLogger } from './logger.js';

const log = serviceLogger('api');

/** Mount path for the client error report route (server.ts). */
export const TRACK_ERROR_PATH = '/api/track-error';

/** Body cap: a client report is a message + stack + context — 64 KB is far
 * beyond any realistic payload and tight enough that a runaway body is
 * rejected before it can be buffered whole. */
export const MAX_TRACK_ERROR_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** Reads the request body, aborting once `limit` bytes is exceeded (before
 * buffering the whole oversized payload into memory) — same technique as
 * exercise/upload-route.ts readBodyWithLimit. */
async function readBodyWithLimit(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > limit) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Lenient coercion for optional client fields: a sloppy client must never 400
 * a telemetry endpoint — anything non-string becomes null. */
function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : String(value);
}

/**
 * `POST /api/track-error` — same-origin client error report.
 *
 * Contract (plans/260815-1616-uat-live-test-audit P2-A):
 *   body: { code?: string|null, message: string, stack?: string|null,
 *           url?: string|null, userAgent?: string|null,
 *           kind?: string|null, extra?: object|null }
 *   200:  { ok: true, code: <client code, else the request reqId> }
 *   400:  missing/non-string message, or non-JSON body
 *   413:  body over MAX_TRACK_ERROR_BYTES
 *
 * `reqId` is passed in from server.ts (reqIdOf) so the pino line and the
 * Sentry tags share the request's correlation id.
 */
export async function handleTrackError(
  req: IncomingMessage,
  res: ServerResponse,
  reqId: string,
): Promise<void> {
  // Fast-path a declared oversized body without reading it.
  const declaredLength = Number(req.headers['content-length'] ?? Number.NaN);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TRACK_ERROR_BYTES) {
    sendJson(res, 413, { error: `Error report exceeds the ${MAX_TRACK_ERROR_BYTES}-byte limit.` });
    return;
  }

  let body: Buffer;
  try {
    body = await readBodyWithLimit(req, MAX_TRACK_ERROR_BYTES);
  } catch {
    sendJson(res, 413, { error: `Error report exceeds the ${MAX_TRACK_ERROR_BYTES}-byte limit.` });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body.' });
    return;
  }

  const obj = parsed as Record<string, unknown> | null | undefined;
  const message = obj?.message;
  if (typeof message !== 'string' || message.trim() === '') {
    sendJson(res, 400, { error: 'Field "message" is required and must be a non-empty string.' });
    return;
  }

  const code = toNullableString(obj?.code);
  const kind = toNullableString(obj?.kind);
  const url = toNullableString(obj?.url)?.split('?')[0] ?? null; // strip query strings (may carry staff UUIDs) before pino/Sentry
  const stack = toNullableString(obj?.stack);
  const userAgent = toNullableString(obj?.userAgent);
  const rawExtra = obj?.extra;
  const clientExtra =
    rawExtra !== null && typeof rawExtra === 'object' && !Array.isArray(rawExtra)
      ? (rawExtra as Record<string, unknown>)
      : null;

  // Structured log line — reqId is the pivot to the Sentry event tags below
  // (`jq 'select(.reqId=="<id>")'`). err stays undefined: this is a CLIENT
  // error, there is no server-side Error object to attach.
  log.error(
    { reqId, clientCode: code ?? null, kind, url, message, err: undefined },
    'client error report',
  );

  // Fail-open: a down GlitchTip (or any Sentry hiccup) must never turn a client
  // error report into a server 5xx — observability is not a hard dependency.
  try {
    Sentry.captureException(new Error(message), {
      tags: {
        clientCode: code ?? null,
        reqId,
        kind: kind ?? null,
        url: url ?? null,
      },
      extra: { stack, userAgent, clientExtra },
    });
  } catch {
    // swallow — the pino line above already recorded the report
  }

  // Return the client's own code when it provided one (its displayed error
  // code stays stable), else hand back the server-generated reqId so the user
  // can be given a correlation code even when the client generated none.
  sendJson(res, 200, { ok: true, code: code ?? reqId });
}