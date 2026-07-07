// Unit tests: staff-session sign/verify/cookie helpers (S2).

import { describe, expect, it } from 'vitest';
import type { Role as AuthRole } from '@cmc/auth';
import {
  STAFF_SESSION_SECRET_DEV_DEFAULT,
  buildStaffCookieHeader,
  clearStaffCookieHeader,
  parseStaffCookie,
  signStaffToken,
  verifyStaffToken,
} from './staff-session.js';

const SECRET = 'test-secret-32-chars-long-enough!!';
const CLAIMS = {
  userId: 'u-001',
  roles: ['super_admin'] as AuthRole[],
  facilityId: 'f-001',
};

describe('staff-session — sign / verify', () => {
  it('round-trips valid claims', () => {
    const token = signStaffToken({ ...CLAIMS }, SECRET);
    const result = verifyStaffToken(token, SECRET);
    expect(result).toMatchObject({ userId: 'u-001', facilityId: 'f-001' });
    expect(result?.roles).toContain('super_admin');
  });

  it('rejects token signed with a different secret', () => {
    const token = signStaffToken({ ...CLAIMS }, SECRET);
    expect(verifyStaffToken(token, 'wrong-secret')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signStaffToken({ ...CLAIMS }, SECRET);
    const [h, , sig] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ userId: 'evil', roles: ['super_admin'], facilityId: 'f-evil', iat: 0, exp: 9999999999 }), 'utf8').toString('base64url');
    expect(verifyStaffToken(`${h!}.${tampered}.${sig!}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    // 1 ms TTL → already expired after sign
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ ...CLAIMS, iat: now, exp: now - 1 }), 'utf8').toString('base64url');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'CMC-STAFF-1' }), 'utf8').toString('base64url');
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
    expect(verifyStaffToken(`${header}.${payload}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects malformed token (not 3 parts)', () => {
    expect(verifyStaffToken('onlyone', SECRET)).toBeNull();
    expect(verifyStaffToken('two.parts', SECRET)).toBeNull();
  });

  it('rejects dev default when explicitly tested for insecurity', () => {
    // Dev default must be a known constant so boot-check can detect it.
    expect(STAFF_SESSION_SECRET_DEV_DEFAULT).toMatch(/dev-only/);
  });
});

describe('staff-session — cookie header helpers', () => {
  it('buildStaffCookieHeader includes HttpOnly SameSite Max-Age', () => {
    const h = buildStaffCookieHeader('mytoken', false);
    expect(h).toContain('cmc_staff_session=mytoken');
    expect(h).toContain('HttpOnly');
    expect(h).toContain('SameSite=Lax');
    expect(h).toContain('Max-Age=');
  });

  it('buildStaffCookieHeader adds Secure in prod', () => {
    expect(buildStaffCookieHeader('tok', true)).toContain('Secure');
    expect(buildStaffCookieHeader('tok', false)).not.toContain('Secure');
  });

  it('clearStaffCookieHeader sets Max-Age=0', () => {
    const h = clearStaffCookieHeader(false);
    expect(h).toContain('Max-Age=0');
    expect(h).toContain('cmc_staff_session=');
  });
});

describe('staff-session — parseStaffCookie', () => {
  it('extracts token from cookie header', () => {
    expect(parseStaffCookie('cmc_staff_session=abc123')).toBe('abc123');
  });

  it('handles multiple cookies', () => {
    expect(parseStaffCookie('other=x; cmc_staff_session=tok; another=y')).toBe('tok');
  });

  it('returns null when cookie is absent', () => {
    expect(parseStaffCookie(undefined)).toBeNull();
    expect(parseStaffCookie('other=x')).toBeNull();
  });

  it('returns null for empty value', () => {
    expect(parseStaffCookie('cmc_staff_session=')).toBeNull();
  });
});
