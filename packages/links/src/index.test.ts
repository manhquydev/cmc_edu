import { describe, it, expect } from 'vitest';
import {
  UUID_RE,
  attendancePath,
  goPath,
  gradingPath,
  links,
  payrollPath,
  readUuidParam,
  resolveGo,
  sessionEvidencePath,
  shiftRegistrationNewPath,
  shiftRegistrationsPath,
} from './index.js';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('links builders', () => {
  it('builds entity detail paths including shiftRegistration', () => {
    expect(links.opportunity(UUID)).toBe(`/crm/opportunities/${UUID}`);
    expect(links.receipt(UUID)).toBe(`/finance/${UUID}`);
    expect(links.student(UUID)).toBe(`/admin/students/${UUID}`);
    expect(links.classBatch(UUID)).toBe(`/admin/classes/${UUID}`);
    expect(links.shiftRegistration(UUID)).toBe(`/hr/shifts/${UUID}`);
  });

  it('builds go paths', () => {
    expect(goPath('opportunity', UUID)).toBe(`/go/opportunity/${UUID}`);
    expect(goPath('receipt', UUID)).toBe(`/go/receipt/${UUID}`);
    expect(goPath('shiftRegistration', UUID)).toBe(`/go/shiftRegistration/${UUID}`);
  });
});

describe('UUID_RE', () => {
  it('accepts standard UUID strings', () => {
    expect(UUID_RE.test(UUID)).toBe(true);
  });

  it('rejects non-UUID tokens', () => {
    expect(UUID_RE.test('refund')).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
  });
});

describe('resolveGo', () => {
  it('resolves known entity + UUID', () => {
    expect(resolveGo('opportunity', UUID)).toBe(`/crm/opportunities/${UUID}`);
    expect(resolveGo('receipt', UUID)).toBe(`/finance/${UUID}`);
    expect(resolveGo('student', UUID)).toBe(`/admin/students/${UUID}`);
    expect(resolveGo('classBatch', UUID)).toBe(`/admin/classes/${UUID}`);
    expect(resolveGo('shiftRegistration', UUID)).toBe(`/hr/shifts/${UUID}`);
  });

  it('returns null for unknown entity keys', () => {
    expect(resolveGo('unknown', UUID)).toBeNull();
  });

  it('rejects prototype-chain keys (Object.hasOwn, not `in`)', () => {
    expect(resolveGo('toString', UUID)).toBeNull();
    expect(resolveGo('constructor', UUID)).toBeNull();
    expect(resolveGo('__proto__', UUID)).toBeNull();
  });

  it('rejects non-UUID ids (static sibling routes, traversal, empty)', () => {
    expect(resolveGo('receipt', 'refund')).toBeNull();
    expect(resolveGo('opportunity', '..%2F..%2Fadmin%2Fusers')).toBeNull();
    expect(resolveGo('opportunity', '')).toBeNull();
    expect(resolveGo('student', 'not-a-uuid')).toBeNull();
  });
});

describe('attendancePath', () => {
  it('builds workspace query params only for UUIDs', () => {
    expect(attendancePath({ classBatchId: UUID, sessionId: UUID })).toBe(
      `/teaching/attendance?classBatchId=${UUID}&sessionId=${UUID}`,
    );
    expect(attendancePath({ classBatchId: 'abc' })).toBe('/teaching/attendance');
    expect(attendancePath({})).toBe('/teaching/attendance');
  });
});

describe('workspace builders + readUuidParam', () => {
  it('gradingPath uses submissionId', () => {
    expect(gradingPath({ submissionId: UUID })).toBe(
      `/teaching/grading?submissionId=${UUID}`,
    );
    expect(gradingPath({ submissionId: 'sub-1' })).toBe('/teaching/grading');
  });

  it('payrollPath keeps period and filters userId by UUID', () => {
    expect(payrollPath({ period: '2026-08', userId: UUID })).toBe(
      `/hr/payroll?period=2026-08&userId=${UUID}`,
    );
    expect(payrollPath({ period: 'bad', userId: 'nope' })).toBe('/hr/payroll');
  });

  it('sessionEvidencePath mirrors attendance params', () => {
    expect(sessionEvidencePath({ classBatchId: UUID, sessionId: UUID })).toBe(
      `/teaching/session-evidence?classBatchId=${UUID}&sessionId=${UUID}`,
    );
  });

  it('readUuidParam rejects garbage', () => {
    const p = new URLSearchParams('a=abc&b=' + UUID);
    expect(readUuidParam(p, 'a')).toBeNull();
    expect(readUuidParam(p, 'b')).toBe(UUID);
  });

  it('shiftRegistrationsPath + shiftRegistrationNewPath', () => {
    expect(shiftRegistrationsPath()).toBe('/hr/shifts');
    expect(shiftRegistrationsPath({ scope: 'mine' })).toBe('/hr/shifts?scope=mine');
    expect(shiftRegistrationsPath({ scope: 'inbox' })).toBe('/hr/shifts?scope=inbox');
    expect(shiftRegistrationNewPath()).toBe('/hr/shifts/new');
  });
});
