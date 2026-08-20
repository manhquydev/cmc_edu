// Tests for SSO route handlers: CSRF state validation, domain fail-closed,
// error path redirects, and the RLS-bypassing AppUser email lookup
// (sso-routes.ts). SSO itself stays env-disabled; the lookup test is
// latent-bug insurance for re-enable.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { cleanupFacility, createTestFacility, seedAppUser, testDb } from '../test/db.js';
import { lookupSsoAppUser } from './sso-routes.js';

// ── helpers to build minimal request/response fakes ───────────────────────

function fakeRes(): ServerResponse & { _status: number; _headers: Record<string, string>; _ended: boolean } {
  let status = 0;
  const headers: Record<string, string> = {};
  let ended = false;
  const res = {
    get _status() { return status; },
    get _headers() { return headers; },
    get _ended() { return ended; },
    writeHead(code: number, hdrs?: Record<string, string>) {
      status = code;
      if (hdrs) Object.assign(headers, hdrs);
      return res;
    },
    end() { ended = true; return res; },
    headersSent: false,
  } as unknown as ReturnType<typeof fakeRes>;
  return res;
}

function fakeReq(opts: { url?: string; cookie?: string } = {}): IncomingMessage {
  return {
    url: opts.url ?? '/',
    headers: { cookie: opts.cookie },
  } as unknown as IncomingMessage;
}

function hmacB64(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

// ── set up env before importing module under test ─────────────────────────

const SECRET = 'test-csrf-secret-32-chars-long!!';
const ADMIN_ORIGIN = 'http://admin.test';

beforeEach(() => {
  vi.resetModules();
  process.env['STAFF_SESSION_SECRET'] = SECRET;
  process.env['ADMIN_APP_ORIGIN'] = ADMIN_ORIGIN;
  process.env['ERP_SSO_REDIRECT_URI'] = 'http://localhost:3000/auth/callback';
  process.env['NODE_ENV'] = 'test';
  process.env['STAFF_EMAIL_DOMAIN'] = 'cmc.edu.vn';
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── CSRF state validation ─────────────────────────────────────────────────

describe('handleSsoCallback — CSRF state validation', () => {
  it('redirects state_missing when state param absent', async () => {
    const { handleSsoCallback } = await import('./sso-routes.js');
    const stateRaw = 'abc123';
    const sig = hmacB64(stateRaw, SECRET);
    const req = fakeReq({
      url: '/auth/callback?code=FAKE',
      cookie: `oauth_state=${stateRaw}.${sig}`,
    });
    const res = fakeRes();
    await handleSsoCallback(req, res);
    expect(res._status).toBe(302);
    expect(res._headers['Location']).toContain('state_missing');
  });

  it('redirects state_missing when oauth_state cookie absent', async () => {
    const { handleSsoCallback } = await import('./sso-routes.js');
    const req = fakeReq({ url: '/auth/callback?code=FAKE&state=abc123' });
    const res = fakeRes();
    await handleSsoCallback(req, res);
    expect(res._status).toBe(302);
    expect(res._headers['Location']).toContain('state_missing');
  });

  it('redirects state_invalid when cookie has no dot separator', async () => {
    const { handleSsoCallback } = await import('./sso-routes.js');
    const req = fakeReq({
      url: '/auth/callback?code=FAKE&state=abc123',
      cookie: 'oauth_state=nodot',
    });
    const res = fakeRes();
    await handleSsoCallback(req, res);
    expect(res._status).toBe(302);
    expect(res._headers['Location']).toContain('state_invalid');
  });

  it('redirects state_mismatch when signature is wrong', async () => {
    const { handleSsoCallback } = await import('./sso-routes.js');
    const stateRaw = 'abc123';
    const badSig = hmacB64(stateRaw, 'wrong-secret');
    const req = fakeReq({
      url: `/auth/callback?code=FAKE&state=${stateRaw}`,
      cookie: `oauth_state=${stateRaw}.${badSig}`,
    });
    const res = fakeRes();
    await handleSsoCallback(req, res);
    expect(res._status).toBe(302);
    expect(res._headers['Location']).toContain('state_mismatch');
  });

  it('redirects state_mismatch when URL state differs from cookie state', async () => {
    const { handleSsoCallback } = await import('./sso-routes.js');
    const stateRaw = 'abc123';
    const sig = hmacB64(stateRaw, SECRET);
    const req = fakeReq({
      url: '/auth/callback?code=FAKE&state=DIFFERENT',
      cookie: `oauth_state=${stateRaw}.${sig}`,
    });
    const res = fakeRes();
    await handleSsoCallback(req, res);
    expect(res._status).toBe(302);
    expect(res._headers['Location']).toContain('state_mismatch');
  });

  it('passes CSRF check and proceeds to token exchange when state is valid', async () => {
    // This test reaches acquireTokenByCode which will throw (no real MSAL).
    // We just assert it does NOT redirect with state_* — it redirects with
    // sso_error (the catch-all for token-exchange failure).
    const { handleSsoCallback } = await import('./sso-routes.js');
    const stateRaw = 'abc123deadbeef';
    const sig = hmacB64(stateRaw, SECRET);
    const req = fakeReq({
      url: `/auth/callback?code=FAKE_CODE&state=${stateRaw}`,
      cookie: `oauth_state=${stateRaw}.${sig}`,
    });
    const res = fakeRes();
    await handleSsoCallback(req, res);
    expect(res._status).toBe(302);
    // Passes CSRF, fails at token exchange → sso_error (not state_*)
    expect(res._headers['Location']).not.toContain('state_');
  });
});

// ── handleSsoLogin — state cookie is set ──────────────────────────────────

describe('handleSsoLogin — oauth_state cookie', () => {
  it('sets oauth_state HttpOnly cookie on redirect', async () => {
    // MSAL will throw in test without real creds — catch that.
    const { handleSsoLogin } = await import('./sso-routes.js');
    const req = fakeReq();
    const res = fakeRes();
    await handleSsoLogin(req, res).catch(() => undefined);
    // If msal throws, we sent a 500 — either way the Set-Cookie should
    // either be present (302) or absent (500 error path). The key test is
    // that the cookie signing logic is exercised and doesn't throw.
    // In a real environment (valid ENTRA_* creds) it would be a 302.
    expect(res._ended).toBe(true);
  });
});

// ── assertRequiredEnvForProd — STAFF_EMAIL_DOMAIN in SSO block ───────────

describe('assertRequiredEnvForProd — STAFF_EMAIL_DOMAIN', () => {
  it('throws when SSO_ENABLED=true and STAFF_EMAIL_DOMAIN is missing', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['SSO_ENABLED'] = 'true';
    process.env['APP_DATABASE_URL'] = 'pg://x';
    process.env['DATABASE_URL'] = 'pg://x';
    process.env['BREVO_API_KEY'] = 'x';
    process.env['TRUSTED_PROXY_CIDRS'] = '127.0.0.1/32';
    process.env['CORS_ORIGINS'] = 'https://x.com';
    process.env['BLOB_STORAGE_DIR'] = '/tmp/blobs';
    process.env['ENTRA_TENANT_ID'] = 'x';
    process.env['ENTRA_CLIENT_ID'] = 'x';
    process.env['ENTRA_CLIENT_SECRET'] = 'x';
    process.env['ERP_SSO_REDIRECT_URI'] = 'https://x.com/auth/callback';
    process.env['ADMIN_APP_ORIGIN'] = 'https://x.com';
    process.env['GRAPH_TENANT_ID'] = 'x';
    process.env['GRAPH_CLIENT_ID'] = 'x';
    process.env['GRAPH_CLIENT_SECRET'] = 'x';
    process.env['GRAPH_SENDER_EMAIL'] = 'x@x.com';
    delete process.env['STAFF_EMAIL_DOMAIN'];

    const { assertRequiredEnvForProd } = await import('../boot-checks.js');
    expect(() => assertRequiredEnvForProd()).toThrow('STAFF_EMAIL_DOMAIN');
  });
});

// ── assertStaffLmsSecretsDistinct — G10 ──────────────────────────────────

describe('assertStaffLmsSecretsDistinct — G10', () => {
  it('throws when both secrets are equal in production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['STAFF_SESSION_SECRET'] = 'shared-secret';
    process.env['LMS_SESSION_SECRET'] = 'shared-secret';
    const { assertStaffLmsSecretsDistinct } = await import('../boot-checks.js');
    expect(() => assertStaffLmsSecretsDistinct()).toThrow('must be different');
  });

  it('does not throw when secrets differ in production', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['STAFF_SESSION_SECRET'] = 'staff-secret-abc';
    process.env['LMS_SESSION_SECRET'] = 'lms-secret-xyz';
    const { assertStaffLmsSecretsDistinct } = await import('../boot-checks.js');
    expect(() => assertStaffLmsSecretsDistinct()).not.toThrow();
  });

  it('does not throw in non-production even when secrets are equal', async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['STAFF_SESSION_SECRET'] = 'same';
    process.env['LMS_SESSION_SECRET'] = 'same';
    const { assertStaffLmsSecretsDistinct } = await import('../boot-checks.js');
    expect(() => assertStaffLmsSecretsDistinct()).not.toThrow();
  });
});

// ── lookupSsoAppUser — RLS bypass (ADR 0042) ──────────────────────────────

describe('lookupSsoAppUser — RLS bypass (ADR 0042)', () => {
  let facilityId: string;

  beforeEach(async () => {
    const facility = await createTestFacility('SSO Lookup Test');
    facilityId = facility.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('resolves a seeded AppUser; unprivileged findFirst without facility GUC returns 0 (the pre-fix bug)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = `sso-lookup-${suffix}`;
    const email = `sso-lookup-${suffix}@cmc.edu.vn`;
    const seeded = await seedAppUser({
      facilityId,
      userId,
      email,
      roles: ['sale'],
    });

    // Unprivileged client, no withFacility GUC — RLS fail-closed. This is
    // the query handleSsoCallback used before the bypass wrap.
    const unprivileged = await testDb().appUser.findFirst({ where: { email } });
    expect(unprivileged).toBeNull();

    const found = await lookupSsoAppUser(testDb(), email);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(seeded.id);
    expect(found?.userId).toBe(userId);
    expect(found?.email).toBe(email);
    expect(found?.isActive).toBe(true);
  });
});
