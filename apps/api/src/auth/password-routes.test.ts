// Integration tests for staff email/password login (password-routes.ts):
// credential verification, no-leak generic failures, per-account lockout,
// cookie issuance, and the HTTP wrapper's JSON contract.

import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../lms-auth/password-hash.js';
import { verifyStaffToken, STAFF_COOKIE_NAME } from './staff-session.js';
import {
  attemptStaffPasswordLogin,
  handleStaffPasswordLogin,
  GENERIC_STAFF_LOGIN_FAILURE,
  MAX_STAFF_LOGIN_ATTEMPTS,
} from './password-routes.js';
import {
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDb,
  testDbBypass,
} from '../test/db.js';

const SECRET = 'test-staff-password-secret-32ch!!';
const PASSWORD = 'correct-horse-battery-1';

function uniqueUser(): { userId: string; email: string } {
  const suffix = randomUUID().slice(0, 8);
  return { userId: `pwlogin-${suffix}`, email: `pwlogin-${suffix}@test.cmc` };
}

function fakeRes(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  let status = 0;
  const headers: Record<string, string> = {};
  let body = '';
  const res = {
    get _status() { return status; },
    get _headers() { return headers; },
    get _body() { return body; },
    writeHead(code: number, hdrs?: Record<string, string>) {
      status = code;
      if (hdrs) Object.assign(headers, hdrs);
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

function fakeJsonReq(payload: unknown): IncomingMessage {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const req = Readable.from([Buffer.from(raw, 'utf8')]) as unknown as IncomingMessage;
  (req as { headers: Record<string, string> }).headers = {
    'content-type': 'application/json',
  };
  (req as { method: string }).method = 'POST';
  (req as { url: string }).url = '/auth/staff-login';
  return req;
}

describe('staff password login (integration)', () => {
  let facilityId: string;

  beforeEach(async () => {
    process.env['STAFF_SESSION_SECRET'] = SECRET;
    const facility = await createTestFacility('PW Login Test');
    facilityId = facility.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('valid credentials → ok with verifiable staff token and claims', async () => {
    const { userId, email } = uniqueUser();
    await seedAppUser({
      facilityId,
      userId,
      email,
      roles: ['super_admin'],
      passwordHash: hashPassword(PASSWORD),
    });

    const result = await attemptStaffPasswordLogin(testDb(), email, PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mustChangePassword).toBe(false);

    const claims = verifyStaffToken(result.token, SECRET);
    expect(claims).not.toBeNull();
    expect(claims?.userId).toBe(userId);
    expect(claims?.facilityId).toBe(facilityId);
    expect(claims?.roles).toEqual(['super_admin']);
  });

  it('email match is case-insensitive and whitespace-tolerant', async () => {
    const { userId, email } = uniqueUser();
    await seedAppUser({ facilityId, userId, email, passwordHash: hashPassword(PASSWORD) });

    const result = await attemptStaffPasswordLogin(
      testDb(),
      `  ${email.toUpperCase()}  `,
      PASSWORD,
    );
    expect(result.ok).toBe(true);
  });

  it('surfaces mustChangePassword from the row', async () => {
    const { userId, email } = uniqueUser();
    await seedAppUser({
      facilityId,
      userId,
      email,
      passwordHash: hashPassword(PASSWORD),
      mustChangePassword: true,
    });

    const result = await attemptStaffPasswordLogin(testDb(), email, PASSWORD);
    expect(result).toMatchObject({ ok: true, mustChangePassword: true });
  });

  it('unknown email, inactive account, and missing hash all fail identically', async () => {
    const inactive = uniqueUser();
    await seedAppUser({
      facilityId,
      userId: inactive.userId,
      email: inactive.email,
      passwordHash: hashPassword(PASSWORD),
      isActive: false,
    });
    const noHash = uniqueUser();
    await seedAppUser({ facilityId, userId: noHash.userId, email: noHash.email });

    expect(await attemptStaffPasswordLogin(testDb(), 'nobody@test.cmc', PASSWORD)).toEqual({
      ok: false,
    });
    expect(await attemptStaffPasswordLogin(testDb(), inactive.email, PASSWORD)).toEqual({
      ok: false,
    });
    expect(await attemptStaffPasswordLogin(testDb(), noHash.email, PASSWORD)).toEqual({
      ok: false,
    });
  });

  it('wrong password increments attempts; MAX attempts locks the account', async () => {
    const { userId, email } = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId,
      email,
      passwordHash: hashPassword(PASSWORD),
    });

    for (let i = 0; i < MAX_STAFF_LOGIN_ATTEMPTS; i += 1) {
      expect(await attemptStaffPasswordLogin(testDb(), email, 'wrong-password-x')).toEqual({
        ok: false,
      });
    }

    const row = await testDbBypass((tx) =>
      tx.appUser.findUniqueOrThrow({ where: { id: seeded.id } }),
    );
    expect(row.loginAttempts).toBe(MAX_STAFF_LOGIN_ATTEMPTS);
    expect(row.loginLockedUntil).not.toBeNull();
    expect(row.loginLockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Even the CORRECT password fails while locked (no-leak).
    expect(await attemptStaffPasswordLogin(testDb(), email, PASSWORD)).toEqual({ ok: false });
  });

  it('an expired lock allows login again and resets the counters', async () => {
    const { userId, email } = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId,
      email,
      passwordHash: hashPassword(PASSWORD),
      loginAttempts: MAX_STAFF_LOGIN_ATTEMPTS,
      loginLockedUntil: new Date(Date.now() - 60_000),
    });

    const result = await attemptStaffPasswordLogin(testDb(), email, PASSWORD);
    expect(result.ok).toBe(true);

    const row = await testDbBypass((tx) =>
      tx.appUser.findUniqueOrThrow({ where: { id: seeded.id } }),
    );
    expect(row.loginAttempts).toBe(0);
    expect(row.loginLockedUntil).toBeNull();
  });

  it('successful login writes a secret-free audit row', async () => {
    const { userId, email } = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId,
      email,
      passwordHash: hashPassword(PASSWORD),
    });

    await attemptStaffPasswordLogin(testDb(), email, PASSWORD);

    const audit = await testDbBypass((tx) =>
      tx.auditLog.findFirst({
        where: { action: 'auth.staffPasswordLogin', entityId: seeded.id },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(audit).not.toBeNull();
    expect(audit?.actor).toBe(userId);
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);
  });

  it('HTTP wrapper: 200 + staff cookie on success', async () => {
    const { userId, email } = uniqueUser();
    await seedAppUser({ facilityId, userId, email, passwordHash: hashPassword(PASSWORD) });

    const res = fakeRes();
    await handleStaffPasswordLogin(fakeJsonReq({ email, password: PASSWORD }), res);

    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true, mustChangePassword: false });
    const cookie = res._headers['Set-Cookie'];
    expect(cookie).toContain(`${STAFF_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('HTTP wrapper: 401 with the generic message on bad credentials', async () => {
    const res = fakeRes();
    await handleStaffPasswordLogin(
      fakeJsonReq({ email: 'nobody@test.cmc', password: 'nope-nope-1' }),
      res,
    );
    expect(res._status).toBe(401);
    expect(JSON.parse(res._body)).toEqual({ error: GENERIC_STAFF_LOGIN_FAILURE });
    expect(res._headers['Set-Cookie']).toBeUndefined();
  });

  it('HTTP wrapper: 400 on malformed JSON', async () => {
    const res = fakeRes();
    await handleStaffPasswordLogin(fakeJsonReq('this-is-not-json'), res);
    expect(res._status).toBe(400);
  });
});
