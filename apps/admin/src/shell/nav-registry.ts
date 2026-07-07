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
}

export const NAV_MODULES: NavModule[] = [
  {
    id: 'finance',
    label: 'Kinh doanh',
    icon: '💰',
    path: '/finance',
    children: [
      { id: 'receipts', label: 'Phiếu thu', path: '/finance', icon: '🧾', permission: { module: 'finance', action: 'receiptList' } },
      { id: 'crm', label: 'CRM', path: '/crm', icon: '📋', permission: { module: 'crm', action: 'opportunityList' } },
    ],
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
    ],
  },
  {
    id: 'hr',
    label: 'Nhân sự',
    icon: '👥',
    path: '/hr',
    children: [
      { id: 'checkin', label: 'Chấm công', path: '/hr/checkin', icon: '🕐', permission: { module: 'checkIn', action: 'punch' } },
      { id: 'shifts', label: 'Ca làm việc', path: '/hr/shifts', icon: '📋', permission: { module: 'shift', action: 'submit' } },
      { id: 'payroll', label: 'Lương / KPI', path: '/hr/payroll', icon: '💵', permission: { module: 'payslip', action: 'assemble' } },
    ],
  },
  {
    id: 'ops',
    label: 'Điều hành',
    icon: '⚙️',
    path: '/ops',
    children: [
      { id: 'revenue', label: 'Doanh thu', path: '/ops/revenue', icon: '📊' },
      { id: 'recon', label: 'Đối soát', path: '/ops/recon', icon: '🔍', permission: { module: 'reconciliation', action: 'review' } },
    ],
  },
  {
    id: 'admin',
    label: 'Quản trị',
    icon: '🛡️',
    path: '/admin',
    children: [
      { id: 'users', label: 'Người dùng', path: '/admin/users', icon: '👤', permission: { module: 'user', action: 'manage' } },
      { id: 'students', label: 'Học viên', path: '/admin/students', icon: '🎓', permission: { module: 'student', action: 'lookup' } },
      { id: 'facilities', label: 'Cơ sở', path: '/admin/facilities', icon: '🏫', permission: { module: 'facility', action: 'list' } },
    ],
  },
];
