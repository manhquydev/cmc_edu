import type { Role } from '@cmc/auth';
import type { NavModule } from '@cmc/ui';

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
      // HR remediation phase 5 (R2 #C4): per-session assessment screen — same
      // permission as assessment.draftComment (giao_vien|giam_doc_dao_tao).
      { id: 'session-assessment', label: 'Nhận xét buổi học', path: '/teaching/session-assessment', icon: 'edit', permission: { module: 'assessment', action: 'draft' } },
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
      // Residual EmptyState screens rolled in from `260707-0915-ui-implementation`
      // phase-06 (2026-07-12) — no backend build here, see the page files.
      { id: 'post-sale-meeting', label: 'Họp sau bán', path: '/crm/post-sale-meeting', icon: 'users', permission: { module: 'parentMeeting', action: 'manage' } },
      { id: 'aftersale', label: 'Sau bán', path: '/crm/aftersale', icon: 'alert', permission: { module: 'afterSale', action: 'manage' } },
      { id: 'refund', label: 'Hoàn tiền', path: '/finance/refund', icon: 'card', permission: { module: 'finance', action: 'refundCreate' } },
    ],
  },
  {
    // HR remediation phase 5 (R3-10, red-team #22): 5-role nav matrix.
    // Chấm công / Đăng ký ca / Của tôi carry no `permission` gate — visible to
    // every active role (self-scoped procedures, no dedicated permission key).
    // Duyệt KPI / Chốt lương / Bậc lương gate on the 2-GĐ+super_admin
    // permission keys already in the registry (kpi.confirm, payslip.assemble,
    // salaryTier.manage) — no new permission keys invented here.
    id: 'hr',
    label: 'Nhân sự',
    icon: 'users',
    path: '/hr',
    children: [
      { id: 'checkin', label: 'Chấm công', path: '/hr/checkin', icon: 'clock' },
      { id: 'shifts', label: 'Đăng ký ca', path: '/hr/shifts', icon: 'calendar' },
      { id: 'my', label: 'Của tôi', path: '/hr/my', icon: 'user' },
      { id: 'kpi', label: 'Duyệt KPI', path: '/hr/kpi', icon: 'target', permission: { module: 'kpi', action: 'confirm' } },
      { id: 'payroll', label: 'Chốt lương', path: '/hr/payroll', icon: 'dollar', permission: { module: 'payslip', action: 'assemble' } },
      { id: 'salary-tiers', label: 'Bậc lương', path: '/hr/salary-tiers', icon: 'layers', permission: { module: 'salaryTier', action: 'manage' } },
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
      // Phase-03 super-admin-completion: IP range management + self-detect.
      { id: 'network-ip', label: 'IP mạng', path: '/admin/network-ip', icon: 'globe', permission: { module: 'facilityNetwork', action: 'manage' } },
      // super_admin-only (compensationPolicy.manage has an empty role list —
      // only the super_admin bypass in can() satisfies it).
      { id: 'shift-config', label: 'Ca làm việc', path: '/admin/shift-config', icon: 'clock', permission: { module: 'compensationPolicy', action: 'manage' } },
      // Phase-04 super-admin-completion: global audit-log viewer.
      { id: 'audit-log', label: 'Nhật ký hệ thống', path: '/admin/audit-log', icon: 'search', permission: { module: 'audit', action: 'list' } },
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
