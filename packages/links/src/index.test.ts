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
  kpiScoresPath,
} from './index.js';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('links builders', () => {
  it('builds entity detail paths including shiftRegistration', () => {
    expect(links.opportunity(UUID)).toBe(`/crm/opportunities/${UUID}`);
    expect(links.receipt(UUID)).toBe(`/finance/${UUID}`);
    expect(links.student(UUID)).toBe(`/admin/students/${UUID}`);
    expect(links.classBatch(UUID)).toBe(`/admin/classes/${UUID}`);
    expect(links.shiftRegistration(UUID)).toBe(`/hr/shifts/${UUID}`);
    expect(links.kpiScore(UUID)).toBe(`/hr/kpi/${UUID}`);
    expect(links.afterSaleCase(UUID)).toBe(`/crm/aftersale/${UUID}`);
    expect(links.parentAccount(UUID)).toBe(`/admin/parents/${UUID}`);
    expect(links.classSession(UUID)).toBe(`/teaching/sessions/${UUID}`);
  });

  it('builds go paths', () => {
    expect(goPath('opportunity', UUID)).toBe(`/go/opportunity/${UUID}`);
    expect(goPath('receipt', UUID)).toBe(`/go/receipt/${UUID}`);
    expect(goPath('shiftRegistration', UUID)).toBe(`/go/shiftRegistration/${UUID}`);
    expect(goPath('kpiScore', UUID)).toBe(`/go/kpiScore/${UUID}`);
    expect(goPath('afterSaleCase', UUID)).toBe(`/go/afterSaleCase/${UUID}`);
    expect(goPath('parentAccount', UUID)).toBe(`/go/parentAccount/${UUID}`);
    expect(goPath('classSession', UUID)).toBe(`/go/classSession/${UUID}`);
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
    expect(resolveGo('kpiScore', UUID)).toBe(`/hr/kpi/${UUID}`);
    expect(resolveGo('afterSaleCase', UUID)).toBe(`/crm/aftersale/${UUID}`);
    expect(resolveGo('parentAccount', UUID)).toBe(`/admin/parents/${UUID}`);
    expect(resolveGo('classSession', UUID)).toBe(`/teaching/sessions/${UUID}`);
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

  it('kpiScoresPath builds board query filters', () => {
    expect(kpiScoresPath()).toBe('/hr/kpi');
    expect(kpiScoresPath({ period: '2026-08' })).toBe('/hr/kpi?period=2026-08');
    expect(kpiScoresPath({ period: '2026-08', status: 'submitted' })).toBe(
      '/hr/kpi?period=2026-08&status=submitted',
    );
    expect(kpiScoresPath({ period: 'bad' })).toBe('/hr/kpi');
  });
});
