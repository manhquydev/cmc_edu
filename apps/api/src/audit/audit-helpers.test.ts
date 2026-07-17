// Phase-04 super-admin-completion: pure unit tests for the audit middleware's
// building blocks (actor resolution, entity/entityId derivation, sensitive-
// field denylist) — decoupled from the tRPC wiring and the DB so the 3
// actor-kind branches and the denylist can be exhaustively covered without a
// real router call for each case (integration wiring lives in
// ../trpc-audit-middleware.test.ts).

import { describe, expect, it } from 'vitest';
import { deriveEntity, deriveEntityId, resolveAuditActor, sanitizeAuditData } from './audit-helpers.js';
import type { Context } from '../trpc.js';

function baseCtx(overrides: Partial<Context>): Context {
  return {
    subject: null,
    facilityId: null,
    lmsSubject: null,
    // db is unused by these pure helpers.
    db: undefined as never,
    ip: null,
    ...overrides,
  };
}

describe('resolveAuditActor', () => {
  it('staff session → raw userId (no prefix)', () => {
    const ctx = baseCtx({ subject: { userId: 'staff-1', roles: ['sale'] } });
    expect(resolveAuditActor(ctx)).toBe('staff-1');
  });

  it('LMS parent session → parent:<parentAccountId>', () => {
    const ctx = baseCtx({ lmsSubject: { parentAccountId: 'pa-1', kind: 'parent' } });
    expect(resolveAuditActor(ctx)).toBe('parent:pa-1');
  });

  it('LMS student session (studentId selected) → student:<studentId>', () => {
    const ctx = baseCtx({ lmsSubject: { parentAccountId: 'pa-1', studentId: 'st-1', kind: 'student' } });
    expect(resolveAuditActor(ctx)).toBe('student:st-1');
  });

  it('LMS student kind WITHOUT a selected studentId falls back to parent:<parentAccountId>', () => {
    const ctx = baseCtx({ lmsSubject: { parentAccountId: 'pa-1', kind: 'student' } });
    expect(resolveAuditActor(ctx)).toBe('parent:pa-1');
  });

  it('no session at all → anonymous', () => {
    const ctx = baseCtx({});
    expect(resolveAuditActor(ctx)).toBe('anonymous');
  });
});

describe('deriveEntity', () => {
  it('takes the first dot segment of the tRPC path', () => {
    expect(deriveEntity('facilityNetwork.create')).toBe('facilityNetwork');
    expect(deriveEntity('checkInOut.punch')).toBe('checkInOut');
  });

  it('a path with no dot returns itself', () => {
    expect(deriveEntity('health')).toBe('health');
  });
});

describe('deriveEntityId', () => {
  it('prefers a plain "id" field on the input', () => {
    expect(deriveEntityId({ id: 'abc-1', name: 'x' }, undefined)).toBe('abc-1');
  });

  it('falls back to any input key ending in "Id"', () => {
    expect(deriveEntityId({ receiptId: 'r-1' }, undefined)).toBe('r-1');
  });

  it('falls back to the mutation result\'s "id" when input has none', () => {
    expect(deriveEntityId({ name: 'no id here' }, { id: 'result-1' })).toBe('result-1');
  });

  it('returns empty string when neither input nor result yields an id-like field', () => {
    expect(deriveEntityId(undefined, undefined)).toBe('');
    expect(deriveEntityId({ reason: 'no id' }, { ok: true })).toBe('');
  });
});

describe('sanitizeAuditData', () => {
  it('passes through ordinary fields unchanged', () => {
    expect(sanitizeAuditData({ name: 'Cơ sở HN', label: 'Trụ sở chính' })).toEqual({
      name: 'Cơ sở HN',
      label: 'Trụ sở chính',
    });
  });

  it('strips password/otp/token/secret-named fields (case-insensitive)', () => {
    const input = {
      userId: 'u1',
      password: 'hunter2',
      newPassword: 'hunter3',
      otpCode: '123456',
      refreshToken: 'tok',
      clientSecret: 'shh',
    };
    expect(sanitizeAuditData(input)).toEqual({ userId: 'u1' });
  });

  it('non-object input (e.g. no-arg mutation) returns undefined', () => {
    expect(sanitizeAuditData(undefined)).toBeUndefined();
    expect(sanitizeAuditData('a string')).toBeUndefined();
  });

  it('post-review fix: strips a field named exactly "code" (lmsAuth.verifyOtp\'s plaintext OTP)', () => {
    expect(sanitizeAuditData({ phone: '0900000000', code: '123456' })).toEqual({ phone: '0900000000' });
  });

  it('does NOT strip legitimate business identifiers that merely contain "code" as a substring', () => {
    expect(sanitizeAuditData({ facilityCode: 'HN', employeeCode: 'CMC001' })).toEqual({
      facilityCode: 'HN',
      employeeCode: 'CMC001',
    });
  });
});
