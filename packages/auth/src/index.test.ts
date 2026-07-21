// Unit tests: RBAC registry. See TL14 §5 (permission matrix) and ADR-B
// (docs/16 — money gate must exclude `sale`).

import { describe, expect, it } from 'vitest';
import { ACTIVE_ROLES, can, PERMISSIONS, type Role } from './index.js';

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
    const multi = { userId: 'u-multi', roles: ['sale'] as const };
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

  it('student.lookup: allowed for roles that need studentId (K4); giao_vien included for attendance name resolution (RLS + facilityId predicate)', () => {
    const sale = { userId: 'u-sale', roles: ['sale'] as const };
    const giaoVien = { userId: 'u-gv', roles: ['giao_vien'] as const };
    const cskh = { userId: 'u-cskh', roles: ['cskh'] as const };
    expect(can(sale, 'student', 'lookup')).toBe(true);
    expect(can(giaoVien, 'student', 'lookup')).toBe(true);
    expect(can(cskh, 'student', 'lookup')).toBe(false);
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

// ADR-D amendment — 5 active roles; roster below = current registry MINUS dormant
// roles (ke_toan/cskh/ctv_mkt/hr). Phase 2 cleanup makes this the actual registry.
const ACTIVE_ROLES_TEST = [
  'giam_doc_kinh_doanh',
  'giam_doc_dao_tao',
  'sale',
  'giao_vien',
] as const;

const DEFERRED_ROLES = ['ke_toan', 'cskh', 'ctv_mkt', 'hr'] as const;

const ACTIVE_ROLE_MATRIX: Array<{ key: string; allowed: readonly string[] }> = [
  { key: 'crm.opportunityList', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'crm.opportunityLookup', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'crm.opportunityCreate', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'crm.opportunityAdvance', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'crm.opportunityMarkLost', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'crm.opportunityAssign', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'finance.receiptCreate', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'finance.receiptApprove', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'finance.refundCreate', allowed: ['giam_doc_kinh_doanh'] },
  { key: 'enrollment.enroll', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] },
  { key: 'enrollment.blockLms', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'guardian.approveLink', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'] },
  { key: 'finance.receiptList', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'finance.receiptGet', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'guardian.listPendingLinks', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'] },
  { key: 'student.lookup', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'] },
  { key: 'facility.create', allowed: [] },
  { key: 'facility.list', allowed: [] },
  { key: 'facility.manage', allowed: [] },
  { key: 'audit.list', allowed: [] },
  { key: 'course.manage', allowed: ['giam_doc_dao_tao'] },
  { key: 'room.manage', allowed: ['giam_doc_dao_tao'] },
  { key: 'class.create', allowed: ['giam_doc_dao_tao'] },
  { key: 'schedule.generate', allowed: ['giam_doc_dao_tao'] },
  { key: 'attendance.mark', allowed: ['giao_vien', 'giam_doc_dao_tao'] },
  { key: 'exercise.manage', allowed: ['giam_doc_dao_tao'] },
  { key: 'exercise.view', allowed: ['giao_vien', 'giam_doc_dao_tao'] },
  { key: 'parentAccount.updateEmail', allowed: ['giam_doc_kinh_doanh', 'sale'] },
  { key: 'submission.grade', allowed: ['giao_vien', 'giam_doc_dao_tao'] },
  { key: 'assessment.draft', allowed: ['giao_vien', 'giam_doc_dao_tao'] },
  { key: 'assessment.confirm', allowed: ['giao_vien'] },
  { key: 'sessionEvidence.upsert', allowed: ['giao_vien'] },
  { key: 'sessionEvidence.publish', allowed: ['giao_vien'] },
  { key: 'user.manage', allowed: [] },
  { key: 'facilityNetwork.manage', allowed: [] },
  { key: 'checkIn.punch', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'] },
  { key: 'manualPunch.approve', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'shift.manage', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'shift.submit', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh', 'giao_vien', 'sale'] },
  { key: 'shift.approve', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'compensationPolicy.manage', allowed: [] },
  { key: 'salaryTier.manage', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'payslip.assemble', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'payslip.finalize', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'payslip.reopen', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'studentAccount.resetPassword', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'kpi.refresh', allowed: ['giao_vien', 'sale', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'kpi.submitSlip', allowed: ['giao_vien', 'sale', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'kpi.confirm', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'kpi.approve', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'kpi.bulkApprove', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
  { key: 'gift.upsert', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'gift.list', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] },
  { key: 'rewards.manage', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] },
  { key: 'parentMeeting.manage', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] },
  { key: 'testAppointment.manage', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] },
  { key: 'afterSale.manage', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] },
  { key: 'student.setLifecycle', allowed: ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] },
  { key: 'reconciliation.review', allowed: ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'] },
];

describe('active-role matrix (ADR-D amendment)', () => {
  for (const { key, allowed } of ACTIVE_ROLE_MATRIX) {
    const [mod, act] = key.split('.');

    for (const role of allowed) {
      it(`${key}: ${role} → allowed`, () => {
        const s = { userId: 'u', roles: [role] as Role[] };
        expect(can(s, mod, act)).toBe(true);
      });
    }

    const denied = ACTIVE_ROLES_TEST.filter((r) => !allowed.includes(r));
    for (const role of denied) {
      it(`${key}: ${role} → denied`, () => {
        const s = { userId: 'u', roles: [role] as Role[] };
        expect(can(s, mod, act)).toBe(false);
      });
    }
  }

  it('super_admin bypasses even empty-roster keys (facility.create, user.manage)', () => {
    const admin = { userId: 'u-admin', roles: ['super_admin'] as const };
    expect(can(admin, 'facility', 'create')).toBe(true);
    expect(can(admin, 'user', 'manage')).toBe(true);
    expect(can(admin, 'facilityNetwork', 'manage')).toBe(true);
  });

  it('compensationPolicy.manage: super_admin-only empty roster (HR remediation phase 2)', () => {
    const admin = { userId: 'u-admin', roles: ['super_admin'] as const };
    const gdkd = { userId: 'u-gdkd', roles: ['giam_doc_kinh_doanh'] as const };
    expect(can(admin, 'compensationPolicy', 'manage')).toBe(true);
    expect(can(gdkd, 'compensationPolicy', 'manage')).toBe(false);
  });

  it('sale CANNOT approve/list/get receipts (SoD — ADR-B money gate)', () => {
    const sale = { userId: 'u-sale', roles: ['sale'] as Role[] };
    expect(can(sale, 'finance', 'receiptApprove')).toBe(false);
    expect(can(sale, 'finance', 'receiptList')).toBe(false);
    expect(can(sale, 'finance', 'receiptGet')).toBe(false);
    expect(can(sale, 'finance', 'refundCreate')).toBe(false);
  });
});

describe('deferred roles are denied everywhere', () => {
  const allKeys = Object.keys(PERMISSIONS);
  for (const role of DEFERRED_ROLES) {
    for (const key of allKeys) {
      const [mod, act] = key.split('.');
      it(`${role} denied on ${key}`, () => {
        const s = { userId: 'u', roles: [role] as Role[] };
        expect(can(s, mod, act)).toBe(false);
      });
    }
  }
});

describe('invariant: PERMISSIONS rosters ⊆ 5 active roles', () => {
  const activeSet = new Set<string>(ACTIVE_ROLES);

  it('every role in every PERMISSIONS array is an active role', () => {
    for (const [key, roles] of Object.entries(PERMISSIONS)) {
      for (const role of roles) {
        expect(
          activeSet.has(role),
          `${key} contains deferred role "${role}"`,
        ).toBe(true);
      }
    }
  });
});
