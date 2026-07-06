// Unit tests: RBAC registry. See TL14 §5 (permission matrix) and ADR-B
// (docs/16 — money gate must exclude `sale`).

import { describe, expect, it } from 'vitest';
import { can } from './index.js';

describe('can()', () => {
  it('denies a null (unauthenticated) subject', () => {
    expect(can(null, 'finance', 'receiptApprove')).toBe(false);
  });

  it('denies unknown module.action pairs even for a broad role', () => {
    const subject = { userId: 'u1', roles: ['giam_doc_kinh_doanh'] as const };
    expect(can(subject, 'not-a-module', 'not-a-real-action')).toBe(false);
  });

  it('sale cannot approve receipts (ADR-B money gate)', () => {
    const sale = { userId: 'u-sale', roles: ['sale'] as const };
    expect(can(sale, 'finance', 'receiptApprove')).toBe(false);
  });

  it('sale can create draft receipts', () => {
    const sale = { userId: 'u-sale', roles: ['sale'] as const };
    expect(can(sale, 'finance', 'receiptCreate')).toBe(true);
  });

  it('giam_doc_kinh_doanh can approve receipts', () => {
    const gdkd = { userId: 'u-gdkd', roles: ['giam_doc_kinh_doanh'] as const };
    expect(can(gdkd, 'finance', 'receiptApprove')).toBe(true);
  });

  it('giam_doc_dao_tao can approve receipts (second-eyes gate, ADR-B)', () => {
    const gddt = { userId: 'u-gddt', roles: ['giam_doc_dao_tao'] as const };
    expect(can(gddt, 'finance', 'receiptApprove')).toBe(true);
  });

  it('super_admin bypasses every gate, including money gates', () => {
    const admin = { userId: 'u-admin', roles: ['super_admin'] as const };
    expect(can(admin, 'finance', 'receiptApprove')).toBe(true);
    expect(can(admin, 'anything', 'at-all')).toBe(true);
  });

  it('a subject with multiple roles is allowed if any role grants the permission', () => {
    const multi = { userId: 'u-multi', roles: ['cskh', 'sale'] as const };
    expect(can(multi, 'finance', 'receiptCreate')).toBe(true);
  });

  it('finance.receiptList/receiptGet: sale (drafter) is excluded, same SoD roster as receiptApprove (K3)', () => {
    const sale = { userId: 'u-sale', roles: ['sale'] as const };
    const gdkd = { userId: 'u-gdkd', roles: ['giam_doc_kinh_doanh'] as const };
    expect(can(sale, 'finance', 'receiptList')).toBe(false);
    expect(can(sale, 'finance', 'receiptGet')).toBe(false);
    expect(can(gdkd, 'finance', 'receiptList')).toBe(true);
    expect(can(gdkd, 'finance', 'receiptGet')).toBe(true);
  });

  it('guardian.listPendingLinks shares the approveLink roster (K3)', () => {
    const giaoVien = { userId: 'u-gv', roles: ['giao_vien'] as const };
    const hr = { userId: 'u-hr', roles: ['hr'] as const };
    expect(can(giaoVien, 'guardian', 'listPendingLinks')).toBe(true);
    expect(can(hr, 'guardian', 'listPendingLinks')).toBe(false);
  });

  it('student.lookup is staff-only, restricted to the roles that need a studentId (K4)', () => {
    const sale = { userId: 'u-sale', roles: ['sale'] as const };
    const giaoVien = { userId: 'u-gv', roles: ['giao_vien'] as const };
    expect(can(sale, 'student', 'lookup')).toBe(true);
    expect(can(giaoVien, 'student', 'lookup')).toBe(false);
  });

  it('facility.create/list is super_admin only — every registered role is FORBIDDEN (K7)', () => {
    const gdkd = { userId: 'u-gdkd', roles: ['giam_doc_kinh_doanh'] as const };
    const admin = { userId: 'u-admin', roles: ['super_admin'] as const };
    expect(can(gdkd, 'facility', 'create')).toBe(false);
    expect(can(gdkd, 'facility', 'list')).toBe(false);
    expect(can(admin, 'facility', 'create')).toBe(true);
    expect(can(admin, 'facility', 'list')).toBe(true);
  });
});
