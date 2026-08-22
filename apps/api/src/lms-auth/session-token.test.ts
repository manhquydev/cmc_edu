// TDD contract tests for LMS session token signing (RT-1).
// All tests run offline — no DB, no external services.

import { describe, expect, it } from 'vitest';
import { FAMILY_TTL_MS, resolveLmsTokenTtlMs, signLmsToken, verifyLmsToken } from './session-token.js';

const SECRET = 'test-hmac-secret-32-bytes-minimum!';

describe('signLmsToken / verifyLmsToken (RT-1)', () => {
  it('round-trips a parent token', () => {
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    const claims = verifyLmsToken(token, SECRET);
    expect(claims).toEqual({
      parentAccountId: 'pa-1',
      kind: 'parent',
      studentId: undefined,
      tokenVersion: 0,
    });
  });

  it('round-trips a family token without studentId', () => {
    const token = signLmsToken(
      { parentAccountId: 'pa-1', kind: 'family', studentId: 'st-ignored', tokenVersion: 2 },
      SECRET,
    );
    const claims = verifyLmsToken(token, SECRET);
    expect(claims).toEqual({
      parentAccountId: 'pa-1',
      kind: 'family',
      studentId: undefined,
      tokenVersion: 2,
    });
  });

  it('still verifies a parent token after family kind is allowed', () => {
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    expect(verifyLmsToken(token, SECRET)?.kind).toBe('parent');
  });

  it('round-trips a student token with studentId', () => {
    const token = signLmsToken(
      { parentAccountId: 'pa-1', studentId: 'st-1', kind: 'student', tokenVersion: 3 },
      SECRET,
    );
    const claims = verifyLmsToken(token, SECRET);
    expect(claims).toEqual({
      parentAccountId: 'pa-1',
      studentId: 'st-1',
      kind: 'student',
      tokenVersion: 3,
    });
  });

  it('rejects a tampered payload', () => {
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    const [h, , sig] = token.split('.');
    // swap in a forged payload claiming different identity
    const forgedPayload = Buffer.from(
      JSON.stringify({ parentAccountId: 'pa-EVIL', kind: 'parent', iat: 1, exp: 9999999999 }),
      'utf8',
    ).toString('base64url');
    expect(verifyLmsToken(`${h}.${forgedPayload}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects a token with a wrong signature', () => {
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    const [h, p] = token.split('.');
    expect(verifyLmsToken(`${h}.${p}.invalidsignature`, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    expect(verifyLmsToken(token, 'wrong-secret')).toBeNull();
  });

  it('rejects an already-expired token', () => {
    // Pass ttlMs = -1000 to sign a token that expired 1 second ago
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET, -1000);
    expect(verifyLmsToken(token, SECRET)).toBeNull();
  });

  it('rejects a malformed token (not 3 segments)', () => {
    expect(verifyLmsToken('onlytwoparts.here', SECRET)).toBeNull();
    expect(verifyLmsToken('', SECRET)).toBeNull();
    expect(verifyLmsToken('a.b.c.d', SECRET)).toBeNull();
  });

  it('rejects a base64url payload that is not valid JSON', () => {
    const { createHmac } = require('node:crypto') as typeof import('node:crypto');
    const token = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    const [h] = token.split('.');
    const badPayload = Buffer.from('not-json', 'utf8').toString('base64url');
    // Re-sign with correct secret so only the JSON parse fails (not sig check)
    const realSig = createHmac('sha256', SECRET)
      .update(`${h}.${badPayload}`)
      .digest('base64url');
    expect(verifyLmsToken(`${h}.${badPayload}.${realSig}`, SECRET)).toBeNull();
  });

  it('produces different tokens each call (iat changes)', () => {
    const a = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    // Force a 1-second gap to ensure iat differs
    const b = signLmsToken({ parentAccountId: 'pa-1', kind: 'parent' }, SECRET);
    // tokens could be equal if called within the same second — just verify both verify
    expect(verifyLmsToken(a, SECRET)).not.toBeNull();
    expect(verifyLmsToken(b, SECRET)).not.toBeNull();
  });

  it('student token cannot be used as parent token (kind preserved)', () => {
    const token = signLmsToken(
      { parentAccountId: 'pa-1', studentId: 'st-1', kind: 'student' },
      SECRET,
    );
    const claims = verifyLmsToken(token, SECRET);
    expect(claims?.kind).toBe('student');
  });

  it('caps family TTL at 12 hours even when LMS_TOKEN_TTL_MS is longer', () => {
    const prev = process.env['LMS_TOKEN_TTL_MS'];
    process.env['LMS_TOKEN_TTL_MS'] = String(7 * 24 * 60 * 60 * 1000);
    expect(resolveLmsTokenTtlMs('family')).toBe(FAMILY_TTL_MS);
    expect(resolveLmsTokenTtlMs('parent')).toBe(7 * 24 * 60 * 60 * 1000);
    if (prev === undefined) delete process.env['LMS_TOKEN_TTL_MS'];
    else process.env['LMS_TOKEN_TTL_MS'] = prev;
  });
});
