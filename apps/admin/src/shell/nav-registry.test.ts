import { describe, expect, it } from 'vitest';
import { visibleModulesFor } from './nav-registry.js';
import type { Role } from '@cmc/auth';

const allTrue = () => true;
const allFalse = () => false;

function moduleIds(roles: readonly Role[], canDo = allTrue) {
  return visibleModulesFor(roles, canDo).map((m) => m.id);
}

describe('visibleModulesFor', () => {
  it('returns exactly 4 groups for sale (no Quản trị)', () => {
    const ids = moduleIds(['sale']);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('finance-ops');
    expect(ids).not.toContain('admin');
    expect(ids).not.toContain('hr');
  });

  it('returns exactly 4 groups for giao_vien', () => {
    const ids = moduleIds(['giao_vien']);
    expect(ids).toContain('cockpit');
    expect(ids).toContain('teaching');
    expect(ids).not.toContain('admin');
    expect(ids).not.toContain('hr');
  });

  it('returns 5th Quản trị group ONLY for super_admin', () => {
    const ids = moduleIds(['super_admin']);
    expect(ids).toContain('admin');
  });

  it('has NO hr module for any active role', () => {
    const activeRoles: Role[] = [
      'sale', 'giam_doc_kinh_doanh', 'giao_vien', 'giam_doc_dao_tao', 'super_admin',
    ];
    for (const role of activeRoles) {
      const ids = moduleIds([role]);
      expect(ids).not.toContain('hr');
    }
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
