import { describe, expect, it } from 'vitest';
import { NAV_MODULES, visibleModulesFor } from './nav-registry.js';
import type { Role } from '@cmc/auth';

const allTrue = () => true;
const allFalse = () => false;

function moduleIds(roles: readonly Role[], canDo = allTrue) {
  return visibleModulesFor(roles, canDo).map((m) => m.id);
}

describe('visibleModulesFor', () => {
  it('returns exactly 5 groups for sale (hr, no Quản trị)', () => {
    const ids = moduleIds(['sale']);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('finance-ops');
    expect(ids).toContain('hr');
    expect(ids).not.toContain('admin');
  });

  it('returns exactly 5 groups for giao_vien', () => {
    const ids = moduleIds(['giao_vien']);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('teaching');
    expect(ids).toContain('hr');
    expect(ids).not.toContain('admin');
  });

  it('returns 6th Quản trị group ONLY for super_admin', () => {
    const ids = moduleIds(['super_admin']);
    expect(ids).toContain('admin');
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

  // Per-item nav visibility (module.children entries) is filtered downstream
  // by `shell.tsx`'s `isChildVisible={(c) => c.permission ? canDo(...) : true}`
  // — `visibleModulesFor` only decides module-row visibility. Assert the
  // metadata this depends on is correct: Duyệt KPI / Chốt lương / Bậc lương
  // carry the 2-GĐ+super_admin permission keys already in the registry.
  it('tags Duyệt KPI / Chốt lương / Bậc lương with the 2-GĐ+super_admin permission keys', () => {
    const hr = NAV_MODULES.find((m) => m.id === 'hr');
    const kpiChild = hr?.children?.find((c) => c.id === 'kpi');
    const payrollChild = hr?.children?.find((c) => c.id === 'payroll');
    const tierChild = hr?.children?.find((c) => c.id === 'salary-tiers');
    expect(kpiChild?.permission).toEqual({ module: 'kpi', action: 'confirm' });
    expect(payrollChild?.permission).toEqual({ module: 'payslip', action: 'assemble' });
    expect(tierChild?.permission).toEqual({ module: 'salaryTier', action: 'manage' });
  });

  it('leaves Chấm công / Đăng ký ca / Của tôi without a permission gate', () => {
    const hr = NAV_MODULES.find((m) => m.id === 'hr');
    for (const id of ['checkin', 'shifts', 'my']) {
      expect(hr?.children?.find((c) => c.id === id)?.permission).toBeUndefined();
    }
  });

  it('gates admin shift-config entry with a permission key (module already super_admin-only)', () => {
    const modules = visibleModulesFor(['super_admin'], allTrue);
    const admin = modules.find((m) => m.id === 'admin');
    const shiftConfig = admin?.children?.find((c) => c.id === 'shift-config');
    expect(shiftConfig).toBeDefined();
    expect(shiftConfig?.permission).toEqual({ module: 'compensationPolicy', action: 'manage' });
  });

  it('shows Lớp & Học sinh with students entry', () => {
    const modules = visibleModulesFor(['sale'], allTrue);
    const classModule = modules.find((m) => m.id === 'classes-students');
    expect(classModule).toBeDefined();
    expect(classModule!.children?.some((c) => c.id === 'students')).toBe(true);
  });

  it('keeps modules visible when at least one child has no permission gate', () => {
    const ids = moduleIds(['sale'], allFalse);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('finance-ops');
  });
});
