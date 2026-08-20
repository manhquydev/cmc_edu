import { describe, expect, it } from 'vitest';
import { NAV_MODULES, isNavChildVisible, visibleModulesFor, visibleNavPathsFor } from './nav-registry.js';
import { ACTIVE_ROLES, can } from '@cmc/auth';
import type { Role } from '@cmc/auth';

const allTrue = () => true;
const allFalse = () => false;

function moduleIds(roles: readonly Role[], canDo = allTrue) {
  return visibleModulesFor(roles, canDo).map((m) => m.id);
}

describe('visibleModulesFor', () => {
  // The count is asserted, not just named: without `toHaveLength` these two
  // stayed green while a new module row appeared, and the test name became a
  // false statement nobody was told about.
  it('returns exactly 6 groups for sale (no Quản trị)', () => {
    const ids = moduleIds(['sale']);
    expect(ids).toHaveLength(6);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('finance-ops');
    expect(ids).toContain('engagement');
    expect(ids).toContain('hr');
    expect(ids).not.toContain('admin');
  });

  it('returns exactly 6 groups for giao_vien (no Quản trị)', () => {
    const ids = moduleIds(['giao_vien']);
    expect(ids).toHaveLength(6);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('teaching');
    expect(ids).toContain('engagement');
    expect(ids).toContain('hr');
    expect(ids).not.toContain('admin');
  });

  it('returns the 7th Quản trị group ONLY for super_admin', () => {
    const ids = moduleIds(['super_admin']);
    expect(ids).toHaveLength(7);
    expect(ids).toContain('admin');
    // The "ONLY" half was never asserted, so the name outran the test.
    for (const role of ['sale', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'giao_vien'] as Role[]) {
      expect(moduleIds([role]), `${role} must not see Quản trị`).not.toContain('admin');
    }
  });

  // HR remediation phase 5 (R3-10, red-team #22): 5-role nav matrix —
  // contract change ON PURPOSE, replaces the pre-phase "no hr module" lock.
  it('shows the hr module (Chấm công/Đăng ký ca/Của tôi) for every active role', () => {
    const activeRoles: Role[] = [
      'sale', 'giam_doc_kinh_doanh', 'giao_vien', 'giam_doc_dao_tao', 'super_admin',
    ];
    for (const role of activeRoles) {
      const ids = moduleIds([role]);
      expect(ids).toContain('hr');
    }
  });

  it('shows Chấm công/Đăng ký ca/Của tôi with no permission gate (visible even when canDo is false)', () => {
    const modules = visibleModulesFor(['sale'], allFalse);
    const hr = modules.find((m) => m.id === 'hr');
    const childIds = hr?.children?.map((c) => c.id) ?? [];
    expect(childIds).toContain('checkin');
    expect(childIds).toContain('shifts');
    expect(childIds).toContain('my');
  });

  // Per-item nav visibility is filtered by permission when set. Shared
  // workspaces (KPI, checkin, shifts, my) omit the gate; server scopes rows.
  it('tags Chốt lương / Bậc lương with director permission keys; KPI is ungated shared board', () => {
    const hr = NAV_MODULES.find((m) => m.id === 'hr');
    const kpiChild = hr?.children?.find((c) => c.id === 'kpi');
    const payrollChild = hr?.children?.find((c) => c.id === 'payroll');
    const tierChild = hr?.children?.find((c) => c.id === 'salary-tiers');
    expect(kpiChild?.label).toBe('KPI');
    expect(kpiChild?.permission).toBeUndefined();
    expect(payrollChild?.permission).toEqual({ module: 'payslip', action: 'assemble' });
    expect(tierChild?.permission).toEqual({ module: 'salaryTier', action: 'manage' });
  });

  it('leaves Chấm công / Đăng ký ca / Của tôi / KPI without a permission gate', () => {
    const hr = NAV_MODULES.find((m) => m.id === 'hr');
    for (const id of ['checkin', 'shifts', 'my', 'kpi']) {
      expect(hr?.children?.find((c) => c.id === id)?.permission).toBeUndefined();
    }
  });

  it('lists shift-config under Nhân sự so the directors who may configure shifts can see it', () => {
    // Under Quản trị it was unreachable: that module is roles:['super_admin'],
    // so the two directors holding shift.manage never saw the entry.
    const modules = visibleModulesFor(['giam_doc_dao_tao'], allTrue);
    const hr = modules.find((m) => m.id === 'hr');
    const shiftConfig = hr?.children?.find((c) => c.id === 'shift-config');
    expect(shiftConfig).toBeDefined();
    expect(shiftConfig?.permission).toEqual({ module: 'shift', action: 'manage' });
    expect(shiftConfig?.path).toBe('/admin/shift-config');

    const admin = modules.find((m) => m.id === 'admin');
    expect(admin?.children?.find((c) => c.id === 'shift-config')).toBeUndefined();
  });

  it('gates admin network-ip entry with facilityNetwork.manage', () => {
    const modules = visibleModulesFor(['super_admin'], allTrue);
    const admin = modules.find((m) => m.id === 'admin');
    const networkIp = admin?.children?.find((c) => c.id === 'network-ip');
    expect(networkIp).toBeDefined();
    expect(networkIp?.permission).toEqual({ module: 'facilityNetwork', action: 'manage' });
  });

  it('gates admin audit-log entry with audit.list', () => {
    const modules = visibleModulesFor(['super_admin'], allTrue);
    const admin = modules.find((m) => m.id === 'admin');
    const auditLog = admin?.children?.find((c) => c.id === 'audit-log');
    expect(auditLog).toBeDefined();
    expect(auditLog?.permission).toEqual({ module: 'audit', action: 'list' });
  });

  it('shows Lớp & Học sinh with students entry', () => {
    const modules = visibleModulesFor(['sale'], allTrue);
    const classModule = modules.find((m) => m.id === 'classes-students');
    expect(classModule).toBeDefined();
    expect(classModule!.children?.some((c) => c.id === 'students')).toBe(true);
  });

  // Gap-closure: nav entry for the parent directory (parentAccount.read).
  // Deliberately placed under Lớp & Học sinh, NOT Quản trị — the roster for
  // parentAccount.read is giam_doc_kinh_doanh/giam_doc_dao_tao/sale, and
  // Quản trị is `roles: ['super_admin']`, which would hide the entry from
  // exactly the roles the permission grants it to (same class of bug as
  // shift-config).
  it('gates the parents entry with parentAccount.read under Lớp & Học sinh, not Quản trị', () => {
    const classModule = NAV_MODULES.find((m) => m.id === 'classes-students');
    const parentsChild = classModule?.children?.find((c) => c.id === 'parents');
    expect(parentsChild).toBeDefined();
    expect(parentsChild?.path).toBe('/admin/parents');
    expect(parentsChild?.permission).toEqual({ module: 'parentAccount', action: 'read' });

    const admin = NAV_MODULES.find((m) => m.id === 'admin');
    expect(admin?.children?.find((c) => c.id === 'parents')).toBeUndefined();
  });

  it('shows the parents entry to every role that holds parentAccount.read', () => {
    for (const role of ['sale', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'] as Role[]) {
      const paths = visibleNavPathsFor([role], (mod, act) =>
        can({ userId: 'u', roles: [role] }, mod, act),
      );
      expect(paths, `${role} should see /admin/parents`).toContain('/admin/parents');
    }
  });

  it('keeps modules visible when at least one child has no permission gate', () => {
    const ids = moduleIds(['sale'], allFalse);
    expect(ids).toContain('cockpit');
    // The hr group still qualifies: Chấm công / Đăng ký ca / Của tôi are
    // self-scoped and deliberately carry no permission key.
    expect(ids).toContain('hr');
  });

  // Contract change, on purpose: every entry under Tài chính & Điều hành now
  // carries a permission key (Doanh thu was the last one without), so a role
  // with no finance permission no longer sees an entire group of screens that
  // would answer 403. Previously the ungated Doanh thu entry kept the whole
  // group on screen for everyone.
  it('drops the finance group entirely for a role with no finance permission', () => {
    expect(moduleIds(['sale'], allFalse)).not.toContain('finance-ops');
  });
});

// These assert the sidebar as a role actually sees it: the real registry drives
// `can()`, and the child gate runs — the same two steps `shell.tsx` performs.
// Asserting through `visibleModulesFor` alone would report a screen as visible
// whenever any sibling entry is, which hides exactly this class of bug.
describe('nav entries a role really sees (module gate + child gate, real permissions)', () => {
  function pathsFor(role: Role): string[] {
    return visibleNavPathsFor([role], (mod, act) => can({ userId: 'u', roles: [role] }, mod, act));
  }

  it('hides the class-administration screen from sale and giao_vien', () => {
    expect(pathsFor('sale')).not.toContain('/admin/classes');
    expect(pathsFor('giao_vien')).not.toContain('/admin/classes');
  });

  it('keeps the class-administration screen for giam_doc_dao_tao', () => {
    expect(pathsFor('giam_doc_dao_tao')).toContain('/admin/classes');
  });

  it('shows the teaching schedule to every role that can read a class', () => {
    for (const role of ['giao_vien', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh', 'sale'] as Role[]) {
      expect(pathsFor(role), `${role} should see /teaching/schedule`).toContain('/teaching/schedule');
    }
  });

  it('shows the session log only to teachers, who alone can write one', () => {
    expect(pathsFor('giao_vien')).toContain('/teaching/session-evidence');
    expect(pathsFor('sale')).not.toContain('/teaching/session-evidence');
    expect(pathsFor('giam_doc_kinh_doanh')).not.toContain('/teaching/session-evidence');
  });

  it('withholds the revenue screen from sale, who cannot list receipts (ADR-B)', () => {
    expect(pathsFor('sale')).not.toContain('/ops/revenue');
    expect(pathsFor('giam_doc_kinh_doanh')).toContain('/ops/revenue');
  });

  // Placeholder screens must not get menu entries. /finance/refund is built
  // (approved-receipt index → form). Leaderboard remains URL-only.
  it('points no menu entry at a placeholder screen', () => {
    const placeholders = ['/admin/engagement/leaderboard'];
    const everyPath = NAV_MODULES.flatMap((mod) => [mod.path, ...(mod.children ?? []).map((c) => c.path)]);
    for (const path of placeholders) expect(everyPath).not.toContain(path);
  });

  it('shows Hoàn tiền index to roles that can list receipts', () => {
    expect(pathsFor('giam_doc_kinh_doanh')).toContain('/finance/refund');
    expect(pathsFor('giam_doc_dao_tao')).toContain('/finance/refund');
    expect(pathsFor('sale')).not.toContain('/finance/refund');
  });

  it('shows the reward queue to the three roles that can manage rewards', () => {
    for (const role of ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] as Role[]) {
      expect(pathsFor(role), `${role} should see /admin/engagement/rewards`)
        .toContain('/admin/engagement/rewards');
    }
  });

  // Quà tặng is the gift-catalogue MANAGEMENT screen: nav + route both gate on
  // `gift.upsert` (giam_doc_kinh_doanh / giam_doc_dao_tao). Sale holds only
  // `gift.list` (redemption naming) and must NOT see the management entry —
  // flow-manifest P4-02 + gift-config-nav.journey pin this negation.
  it('shows the gift catalogue only to roles that can manage gifts (gift.upsert)', () => {
    for (const role of ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] as Role[]) {
      expect(pathsFor(role), `${role} should see /admin/engagement/gifts`)
        .toContain('/admin/engagement/gifts');
    }
    expect(pathsFor('sale'), 'sale must not see /admin/engagement/gifts')
      .not.toContain('/admin/engagement/gifts');
  });

  it('hides the engagement screens from giao_vien, who holds neither key', () => {
    expect(pathsFor('giao_vien')).not.toContain('/admin/engagement/rewards');
    expect(pathsFor('giao_vien')).not.toContain('/admin/engagement/gifts');
  });

  it('shows the course catalogue only to giam_doc_dao_tao', () => {
    expect(pathsFor('giam_doc_dao_tao')).toContain('/admin/courses');
    for (const role of ['giam_doc_kinh_doanh', 'sale', 'giao_vien'] as Role[]) {
      expect(pathsFor(role), `${role} must not see /admin/courses`).not.toContain('/admin/courses');
    }
  });

  // The module row is a button that navigates to `mod.path` (`side-nav.tsx`),
  // and children only appear once the module is active — so every role that
  // sees a group is sent to that group's landing screen before it can pick
  // anything. A landing screen the role cannot operate is the 403 dead end the
  // gift entry was narrowed to avoid; gating the child but not the row would
  // have left the dead end one click away.
  // Known, pre-dating this test: sale sees Tài chính & Điều hành (via CRM,
  // Sau bán, Xếp lớp) but the group lands on `/finance`, whose receipt queue
  // ADR-B withholds from sale — so sale gets a shell whose queries answer 403.
  // Changing the group's landing screen is a product call, not a test fix, so
  // it is recorded here rather than waved through: the assertion below fails if
  // this is ever repaired, which is the prompt to delete the entry.
  const KNOWN_UNUSABLE_LANDINGS = [{ role: 'sale', module: 'finance-ops' }];

  it('lands every role on a module screen it can actually operate', () => {
    const unusable: string[] = [];

    for (const role of ACTIVE_ROLES) {
      const canDo = (mod: string, act: string) => can({ userId: 'u', roles: [role] }, mod, act);
      for (const mod of visibleModulesFor([role], canDo)) {
        // The landing screen's own menu entry carries the key that screen needs.
        const landing = (mod.children ?? []).find((child) => child.path === mod.path);
        if (landing && !isNavChildVisible(landing, canDo)) {
          unusable.push(`${role} → ${mod.id} (${mod.path})`);
        }
      }
    }

    const expected = KNOWN_UNUSABLE_LANDINGS.map((k) => {
      const mod = NAV_MODULES.find((m) => m.id === k.module);
      return `${k.role} → ${k.module} (${mod?.path})`;
    });
    expect(unusable.sort()).toEqual(expected.sort());
  });

  it('shows class placement to the roles that can enrol, not to teachers', () => {
    for (const role of ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'] as Role[]) {
      expect(pathsFor(role), `${role} should see /finance/class-placement`)
        .toContain('/finance/class-placement');
    }
    expect(pathsFor('giao_vien')).not.toContain('/finance/class-placement');
  });

  it('leaves every active role a usable sidebar', () => {
    for (const role of ACTIVE_ROLES) {
      expect(pathsFor(role).length, `${role} has an empty sidebar`).toBeGreaterThan(0);
    }
  });
});
