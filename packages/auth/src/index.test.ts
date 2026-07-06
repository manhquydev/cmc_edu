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
});
