import type { Role } from '@cmc/auth';
import type { IconName } from '@cmc/ui';

export interface NavEntry {
  id: string;
  label: string;
  path: string;
  icon: IconName;
  permission?: { module: string; action: string };
}

export interface NavModule {
  id: string;
  label: string;
  icon: IconName;
  path: string;
  children?: NavEntry[];
  roles?: readonly Role[];
}

// `icon` is a LineIcon key (see @cmc/ui line-icon) — monochrome outline icons,
// never emoji (reference study: one consistent icon language, no colour).
export const NAV_MODULES: NavModule[] = [
  {
    id: 'cockpit',
    label: 'Tổng quan',
    icon: 'grid',
    path: '/cockpit',
  },
  {
    id: 'teaching',
    label: 'Giảng dạy',
    icon: 'book',
    path: '/teaching',
    children: [
      { id: 'schedule', label: 'Lịch dạy', path: '/teaching/schedule', icon: 'calendar' },
      { id: 'attendance', label: 'Điểm danh', path: '/teaching/attendance', icon: 'check-circle', permission: { module: 'attendance', action: 'mark' } },
      { id: 'grading', label: 'Chấm bài', path: '/teaching/grading', icon: 'edit', permission: { module: 'submission', action: 'grade' } },
      { id: 'session-evidence', label: 'Nhật ký buổi học', path: '/teaching/session-evidence', icon: 'camera' },
      { id: 'exercises', label: 'Bài tập', path: '/teaching/exercises', icon: 'clipboard', permission: { module: 'exercise', action: 'manage' } },
    ],
  },
  {
    id: 'classes-students',
    label: 'Lớp & Học sinh',
    icon: 'users',
    path: '/admin/students',
    children: [
      { id: 'students', label: 'Học viên', path: '/admin/students', icon: 'user', permission: { module: 'student', action: 'lookup' } },
      { id: 'classes', label: 'Lớp học', path: '/admin/classes', icon: 'layers' },
    ],
  },
  {
    id: 'finance-ops',
    label: 'Tài chính & Điều hành',
    icon: 'dollar',
    path: '/finance',
    children: [
      { id: 'receipts', label: 'Phiếu thu', path: '/finance', icon: 'receipt', permission: { module: 'finance', action: 'receiptList' } },
      { id: 'crm', label: 'CRM', path: '/crm', icon: 'target', permission: { module: 'crm', action: 'opportunityList' } },
      { id: 'revenue', label: 'Doanh thu', path: '/ops/revenue', icon: 'card' },
      { id: 'recon', label: 'Đối soát', path: '/ops/recon', icon: 'search', permission: { module: 'reconciliation', action: 'review' } },
    ],
  },
  {
    id: 'admin',
    label: 'Quản trị',
    icon: 'shield',
    path: '/admin',
    roles: ['super_admin'],
    children: [
      { id: 'users', label: 'Người dùng', path: '/admin/users', icon: 'user', permission: { module: 'user', action: 'manage' } },
      { id: 'facilities', label: 'Cơ sở', path: '/admin/facilities', icon: 'building', permission: { module: 'facility', action: 'list' } },
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
