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

  // Phase 2 (sensitive-field schema sweep, red-team SA-4): sanitize was
  // shallow — a sensitive field nested inside an array/object input passed
  // through untouched. shift.submit's real `entries: z.array(z.object(...))`
  // shape (shift/router.ts:64-77) is the motivating example.
  describe('recursion (nested objects/arrays)', () => {
    it('strips a sensitive field nested inside a plain object', () => {
      expect(sanitizeAuditData({ studentId: 's1', meta: { token: 'tok', note: 'ok' } })).toEqual({
        studentId: 's1',
        meta: { note: 'ok' },
      });
    });

    it('strips a sensitive field nested inside an array of objects (shift.submit shape)', () => {
      const input = {
        shiftGroupId: 'g1',
        entries: [
          { date: '2026-08-01', shiftTemplateId: 't1', secret: 'x' },
          { date: '2026-08-02', shiftTemplateId: 't2' },
        ],
      };
      expect(sanitizeAuditData(input)).toEqual({
        shiftGroupId: 'g1',
        entries: [
          { date: '2026-08-01', shiftTemplateId: 't1' },
          { date: '2026-08-02', shiftTemplateId: 't2' },
        ],
      });
    });

    it('negative: a nested legitimate field (e.g. resultHash) is NOT stripped by recursion', () => {
      const input = { assessmentId: 'a1', meta: { resultHash: 'abc123', resultLength: 42 } };
      expect(sanitizeAuditData(input)).toEqual(input);
    });

    // Code review finding: `Object.entries(new Date())` is `[]` (Date has no
    // enumerable own properties) — without a Date guard the generic object
    // branch would silently rewrite a nested Date into `{}`.
    it('preserves a nested Date instance instead of collapsing it to {}', () => {
      const when = new Date('2026-01-01T00:00:00.000Z');
      expect(sanitizeAuditData({ startDate: when, name: 'x' })).toEqual({
        startDate: when,
        name: 'x',
      });
    });
  });
});
