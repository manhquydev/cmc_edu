import type { Role } from '@cmc/auth';

export interface NavEntry {
  id: string;
  label: string;
  path: string;
  icon: string;
  permission?: { module: string; action: string };
}

export interface NavModule {
  id: string;
  label: string;
  icon: string;
  path: string;
  children?: NavEntry[];
  roles?: readonly Role[];
}

export const NAV_MODULES: NavModule[] = [
  {
    id: 'cockpit',
    label: 'Tổng quan',
    icon: '📊',
    path: '/cockpit',
  },
  {
    id: 'teaching',
    label: 'Giảng dạy',
    icon: '📚',
    path: '/teaching',
    children: [
      { id: 'schedule', label: 'Lịch dạy', path: '/teaching/schedule', icon: '📅' },
      { id: 'attendance', label: 'Điểm danh', path: '/teaching/attendance', icon: '✅', permission: { module: 'attendance', action: 'mark' } },
      { id: 'grading', label: 'Chấm bài', path: '/teaching/grading', icon: '📝', permission: { module: 'submission', action: 'grade' } },
      { id: 'session-evidence', label: 'Nhật ký buổi học', path: '/teaching/session-evidence', icon: '📸' },
      { id: 'exercises', label: 'Bài tập', path: '/teaching/exercises', icon: '📋', permission: { module: 'exercise', action: 'manage' } },
    ],
  },
  {
    id: 'classes-students',
    label: 'Lớp & Học sinh',
    icon: '🎓',
    path: '/admin/students',
    children: [
      { id: 'students', label: 'Học viên', path: '/admin/students', icon: '🎓', permission: { module: 'student', action: 'lookup' } },
      { id: 'classes', label: 'Lớp học', path: '/admin/classes', icon: '🏫' },
    ],
  },
  {
    id: 'finance-ops',
    label: 'Tài chính & Điều hành',
    icon: '💰',
    path: '/finance',
    children: [
      { id: 'receipts', label: 'Phiếu thu', path: '/finance', icon: '🧾', permission: { module: 'finance', action: 'receiptList' } },
      { id: 'crm', label: 'CRM', path: '/crm', icon: '📋', permission: { module: 'crm', action: 'opportunityList' } },
      { id: 'revenue', label: 'Doanh thu', path: '/ops/revenue', icon: '📊' },
      { id: 'recon', label: 'Đối soát', path: '/ops/recon', icon: '🔍', permission: { module: 'reconciliation', action: 'review' } },
    ],
  },
  {
    id: 'admin',
    label: 'Quản trị',
    icon: '🛡️',
    path: '/admin',
    roles: ['super_admin'],
    children: [
      { id: 'users', label: 'Người dùng', path: '/admin/users', icon: '👤', permission: { module: 'user', action: 'manage' } },
      { id: 'facilities', label: 'Cơ sở', path: '/admin/facilities', icon: '🏫', permission: { module: 'facility', action: 'list' } },
    ],
  },
];

type CanDoFn = (module: string, action: string) => boolean;

export function visibleModulesFor(
  roles: readonly Role[],
  canDo: CanDoFn,
): NavModule[] {
  return NAV_MODULES.filter((mod) => {
    if (mod.roles && mod.roles.length > 0) {
      if (!roles.some((r) => mod.roles!.includes(r))) return false;
    }

    if (mod.children && mod.children.length > 0) {
      const hasVisible = mod.children.some((child) =>
        child.permission ? canDo(child.permission.module, child.permission.action) : true,
      );
      if (!hasVisible) return false;
    }

    return true;
  });
}
