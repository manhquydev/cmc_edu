// Focused tests for the same-origin client error report route
// (lib/track-error-route.ts): request validation (message required, body cap,
// JSON parse) and the 200/400/413 response contract. The handler is exercised
// directly with fake req/res objects (same pattern as auth/password-routes.test.ts)
// — no server, no DB, no nginx.

// Force the fail-open path of lib/instrument.ts (Sentry.init only runs when
// SENTRY_DSN is set) so captureException is a no-op regardless of the host
// environment. The module under test is loaded with a DYNAMIC import so this
// assignment runs before instrument.ts initializes (static imports hoist).
process.env['SENTRY_DSN'] = '';

import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';

const { handleTrackError, MAX_TRACK_ERROR_BYTES } = await import('./track-error-route.js');

const REQ_ID = 'test-reqid-1234';

function fakeRes(): ServerResponse & {
  _status: number;
  _body: string;
} {
  let status = 0;
  let body = '';
  const res = {
    get _status() { return status; },
    get _body() { return body; },
    writeHead(code: number) {
      status = code;
      return res;
    },
    end(chunk?: string) {
      if (chunk) body += chunk;
      return res;
    },
    headersSent: false,
  } as unknown as ReturnType<typeof fakeRes>;
  return res;
}

function jsonReq(payload: unknown, contentLength?: number): IncomingMessage {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const req = Readable.from([Buffer.from(raw, 'utf8')]) as unknown as IncomingMessage;
  (req as { headers: Record<string, string> }).headers = {
    'content-type': 'application/json',
    ...(contentLength !== undefined ? { 'content-length': String(contentLength) } : {}),
  };
  (req as { method: string }).method = 'POST';
  (req as { url: string }).url = '/api/track-error';
  return req;
}

describe('POST /api/track-error', () => {
  it('valid report with a client code → 200 { ok: true, code: <client code> }', async () => {
    const res = fakeRes();
    await handleTrackError(
      jsonReq({
        code: 'ABC123',
        message: 'Cannot read properties of undefined (reading "x")',
        stack: 'at render (App.js:1:1)',
        url: 'https://erp.clawcmc.io.vn/dashboard',
        userAgent: 'Mozilla/5.0 test-agent',
        kind: 'react-boundary',
        extra: { component: 'DashboardPage' },
      }),
      res,
      REQ_ID,
    );
    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true, code: 'ABC123' });
  });

  it('valid report without a client code → 200 with the server reqId as the code', async () => {
    const res = fakeRes();
    await handleTrackError(jsonReq({ message: 'boom' }), res, REQ_ID);
    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true, code: REQ_ID });
  });

  it('missing message → 400', async () => {
    const res = fakeRes();
    await handleTrackError(jsonReq({ kind: 'window.onerror', url: 'https://x/' }), res, REQ_ID);
    expect(res._status).toBe(400);
    expect(JSON.parse(res._body)).toEqual({
      error: 'Field "message" is required and must be a non-empty string.',
    });
  });

  it('non-string message → 400', async () => {
    const res = fakeRes();
    await handleTrackError(jsonReq({ message: 42 }), res, REQ_ID);
    expect(res._status).toBe(400);
  });

  it('malformed JSON → 400', async () => {
    const res = fakeRes();
    await handleTrackError(jsonReq('{this is not json'), res, REQ_ID);
    expect(res._status).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: 'Invalid JSON body.' });
  });

  it('body over the 64 KB cap → 413 (streaming limit)', async () => {
    const res = fakeRes();
    // JSON.stringify of a message at the cap is a few bytes OVER the cap, so
    // readBodyWithLimit aborts mid-stream before buffering the whole payload.
    await handleTrackError(jsonReq({ message: 'x'.repeat(MAX_TRACK_ERROR_BYTES) }), res, REQ_ID);
    expect(res._status).toBe(413);
  });

  it('declared content-length over the cap → 413 without reading the body', async () => {
    const res = fakeRes();
    await handleTrackError(jsonReq({ message: 'small' }, MAX_TRACK_ERROR_BYTES + 1), res, REQ_ID);
    expect(res._status).toBe(413);
  });
});
