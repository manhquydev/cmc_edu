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
      { id: 'schedule', label: 'Lịch dạy', path: '/teaching/schedule', icon: 'calendar', permission: { module: 'class', action: 'read' } },
      { id: 'attendance', label: 'Điểm danh', path: '/teaching/attendance', icon: 'check-circle', permission: { module: 'attendance', action: 'mark' } },
      { id: 'grading', label: 'Chấm bài', path: '/teaching/grading', icon: 'edit', permission: { module: 'submission', action: 'grade' } },
      // Every mutation on the page (upsert/addPhoto/publish) is teacher-only,
      // so the menu entry follows the same key instead of inviting a 403.
      { id: 'session-evidence', label: 'Nhật ký buổi học', path: '/teaching/session-evidence', icon: 'camera', permission: { module: 'sessionEvidence', action: 'upsert' } },
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
      // Class administration, not class picking: `class.read` exists so other
      // screens can choose a class, and must not open this surface.
      { id: 'classes', label: 'Lớp học', path: '/admin/classes', icon: 'layers', permission: { module: 'class', action: 'create' } },
      // Course catalogue: authoring courses is what the screen does, so it
      // follows `course.manage` — the same key its route gate already uses,
      // which keeps the menu from offering a screen that answers 403.
      { id: 'courses', label: 'Khoá học', path: '/admin/courses', icon: 'book', permission: { module: 'course', action: 'manage' } },
      // Gap-closure: parents provisioned automatically by receipt approval
      // (provisioning/provision-from-receipt.ts) never surface in
      // guardian.listPendingLinks (that queue is only self-service link
      // requests), so this was the only way for staff to ever find one to
      // backfill their email. Lives here rather than under Quản trị — same
      // reason shift-config was moved out of it (comment above, `hr` group):
      // permission roster for `parentAccount.updateEmail` is
      // giam_doc_kinh_doanh/sale, but the whole Quản trị module is
      // `roles: ['super_admin']`, which would hide this entry from the very
      // roles the permission grants it to.
      { id: 'parents', label: 'Phụ huynh', path: '/admin/parents', icon: 'users', permission: { module: 'parentAccount', action: 'updateEmail' } },
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
      // Built entirely on `finance.receiptList`, which the ADR-B money gate
      // withholds from sale — the menu entry must not promise more than that.
      { id: 'revenue', label: 'Doanh thu', path: '/ops/revenue', icon: 'card', permission: { module: 'finance', action: 'receiptList' } },
      { id: 'recon', label: 'Đối soát', path: '/ops/recon', icon: 'search', permission: { module: 'reconciliation', action: 'review' } },
      // Residual EmptyState screens rolled in from `260707-0915-ui-implementation`
      // phase-06 (2026-07-12) — no backend build here, see the page files.
      { id: 'post-sale-meeting', label: 'Họp sau bán', path: '/crm/post-sale-meeting', icon: 'users', permission: { module: 'parentMeeting', action: 'manage' } },
      { id: 'aftersale', label: 'Sau bán', path: '/crm/aftersale', icon: 'alert', permission: { module: 'afterSale', action: 'manage' } },
      // Xếp lớp for students already enrolled. `enrollment.enroll` is the key
      // every action on the screen goes through, and it is the same key the
      // route gate checks — the menu promises exactly what the screen allows.
      { id: 'class-placement', label: 'Xếp lớp', path: '/finance/class-placement', icon: 'layers', permission: { module: 'enrollment', action: 'enroll' } },
      // Hoàn tiền: procedure `finance.refundCreate` đã có, nhưng MÀN chưa xây —
      // `/finance/refund` hiện là EmptyState "Tính năng chưa áp dụng", và sổ
      // nghiệm thu đã hạ P1-08 khỏi `built` vì đúng lý do đó. Để entry này lại
      // nghĩa là GĐKD bấm vào menu rồi gặp trang trống ngay ngày go-live.
      // Khôi phục khi màn được xây, cùng lúc P1-08 quay lại `built`.
    ],
  },
  {
    // Loyalty screens, previously reachable only by typing the URL. The group
    // carries no `roles` list — like Tài chính & Điều hành it appears or
    // disappears purely on its children's keys, so giao_vien (who holds
    // neither) sees no group at all.
    //
    // `path` must name a route that exists AND one every role that sees this
    // row can operate. The row is a button that navigates there, and children
    // only unfold once the module is active, so the landing screen is forced on
    // whoever opens the group. Đổi thưởng is the only correct choice: everyone
    // holding `gift.upsert` also holds `rewards.manage`, but not the reverse —
    // landing on Quà tặng would walk sale into a catalogue it may read and may
    // not change, which is the dead end the gift entry below is narrowed to
    // avoid. (`/admin/engagement` itself has no route and would render
    // ComingSoon.)
    id: 'engagement',
    label: 'Gắn kết',
    icon: 'star',
    path: '/admin/engagement/rewards',
    children: [
      // Configuration screen whose only mutation is `gift.upsert`, so the entry
      // follows that key rather than the wider `gift.list` — a sale led in here
      // would meet a 403 on every action. Sale's way into the loyalty flow is
      // Đổi thưởng below, which it can actually operate.
      { id: 'gifts', label: 'Quà tặng', path: '/admin/engagement/gifts', icon: 'gift', permission: { module: 'gift', action: 'upsert' } },
      { id: 'rewards', label: 'Đổi thưởng', path: '/admin/engagement/rewards', icon: 'trophy', permission: { module: 'rewards', action: 'manage' } },
      // Bảng xếp hạng (`/admin/engagement/leaderboard`) is deliberately absent:
      // it is still an EmptyState placeholder, and a menu entry pointing at one
      // is what got Hoàn tiền removed above. Add it when the screen is built.
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
      // Lives here rather than under Quản trị: configuring shift groups and
      // templates is an HR task the two directors own (`shift.manage`), and the
      // whole Quản trị module is gated `roles: ['super_admin']` — listing it
      // there hid the screen from the very people allowed to use it. The route
      // itself stays at /admin/shift-config.
      { id: 'shift-config', label: 'Ca làm việc', path: '/admin/shift-config', icon: 'clock', permission: { module: 'shift', action: 'manage' } },
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
      // Phase-04 super-admin-completion: global audit-log viewer.
      { id: 'audit-log', label: 'Nhật ký hệ thống', path: '/admin/audit-log', icon: 'search', permission: { module: 'audit', action: 'list' } },
    ],
  },
];

type CanDoFn = (module: string, action: string) => boolean;

/** Whether a leaf nav entry is visible. `visibleModulesFor` only decides
 *  module-row visibility, so this is the predicate that actually hides an
 *  individual menu item — shared with `shell.tsx` so a test asserting nav
 *  visibility exercises the same code the sidebar runs. */
export function isNavChildVisible(
  child: { permission?: { module: string; action: string } },
  canDo: CanDoFn,
): boolean {
  return child.permission ? canDo(child.permission.module, child.permission.action) : true;
}

/** Leaf paths a role actually sees in the sidebar: module gate then child gate.
 *  Use this rather than `visibleModulesFor` when asserting "can role X see
 *  screen Y" — the module gate alone reports a screen as visible whenever any
 *  sibling entry is visible. */
export function visibleNavPathsFor(roles: readonly Role[], canDo: CanDoFn): string[] {
  return visibleModulesFor(roles, canDo).flatMap((mod) =>
    mod.children && mod.children.length > 0
      ? mod.children.filter((child) => isNavChildVisible(child, canDo)).map((child) => child.path)
      : [mod.path],
  );
}

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
