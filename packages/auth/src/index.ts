// @cmc/auth — permission registry (single source of RBAC truth).
//
// Business stories must gate through can()/requirePermission rather than
// hardcoding role arrays (docs/18 §5). This is the P1 substrate: the 9-role
// catalog (docs/14) and the P1 permission subset (docs/14 §5). Framework-light
// on purpose — no @trpc/server dependency here; the tRPC middleware wiring
// (`requirePermission`) lives in apps/api/src/trpc.ts, which imports `can()`.

/** The 9 official roles (docs/14 §1). Do not add roles here without an ADR. */
export const ROLES = [
  'super_admin',
  'giam_doc_kinh_doanh',
  'giam_doc_dao_tao',
  'sale',
  'giao_vien',
  'ke_toan',
  'cskh',
  'ctv_mkt',
  'hr',
] as const;

export type Role = (typeof ROLES)[number];

/** ADR-D amendment (2026-07-08): 5 roles actively operating the ERP.
 *  Roles outside this list are inert enum values — no permissions, no
 *  assignment. Re-activate = add here + permissions + UI + new ADR. */
export const ACTIVE_ROLES = [
  'super_admin',
  'giam_doc_kinh_doanh',
  'giam_doc_dao_tao',
  'sale',
  'giao_vien',
] as const;

export type ActiveRole = (typeof ACTIVE_ROLES)[number];

/** Human-readable Vietnamese labels for UI badges/greetings (not for API keys). */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Quản trị hệ thống',
  giam_doc_kinh_doanh: 'Giám đốc kinh doanh',
  giam_doc_dao_tao: 'Giám đốc đào tạo',
  sale: 'Sale',
  giao_vien: 'Giáo viên',
  ke_toan: 'Kế toán',
  cskh: 'CSKH',
  ctv_mkt: 'CTV marketing',
  hr: 'Nhân sự',
};

/** Display label for a role key; unknown strings pass through unchanged. */
export function formatRole(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

/** Join multiple roles for greetings: "Giáo viên, Sale". */
export function formatRoles(roles: readonly string[]): string {
  return roles.map(formatRole).join(', ');
}

export type PermissionModule = string;
export type PermissionAction = string;

export interface AuthSubject {
  userId: string;
  roles: readonly Role[];
}

function permissionKey(module: PermissionModule, action: PermissionAction): string {
  return `${module}.${action}`;
}

/**
 * `module.action` -> roles allowed (docs/14 §5, P1 subset). `super_admin` is
 * intentionally omitted from every entry: it bypasses the registry entirely
 * in `can()` rather than being duplicated into each row.
 */
export const PERMISSIONS: Record<string, readonly ActiveRole[]> = {
  'crm.opportunityList': ['giam_doc_kinh_doanh', 'sale'],
  'crm.opportunityLookup': ['giam_doc_kinh_doanh', 'sale'],
  'crm.opportunityCreate': ['giam_doc_kinh_doanh', 'sale'],
  'crm.opportunityAdvance': ['giam_doc_kinh_doanh', 'sale'],
  'crm.opportunityMarkLost': ['giam_doc_kinh_doanh', 'sale'],
  // phase-10: role gate only opens the door; the row-level ownership rule
  // (a sale may claim ONLY their own unassigned/already-theirs leads; GĐ KD may
  // reassign anyone) is coded in the crm.opportunityAssign procedure.
  'crm.opportunityAssign': ['giam_doc_kinh_doanh', 'sale'],
  'finance.receiptCreate': ['giam_doc_kinh_doanh', 'sale'],
  // Money gate (ADR-B, docs/16): approver must differ from the drafting sale
  // rep for basic separation of duties — `sale` MUST NOT appear here.
  'finance.receiptApprove': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'finance.refundCreate': ['giam_doc_kinh_doanh'],
  'enrollment.enroll': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  'enrollment.blockLms': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'guardian.approveLink': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
  // Money-gate visibility (ADR-B SoD): same roster as receiptApprove — only
  // roles that can act on the approval queue see it. `sale` excluded.
  'finance.receiptList': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'finance.receiptGet': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'guardian.listPendingLinks': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
  'student.lookup': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
  'facility.create': [],
  'facility.list': [],
  'facility.manage': [],
  'audit.list': [],
  'course.manage': ['giam_doc_dao_tao'],
  'room.manage': ['giam_doc_dao_tao'],
  'class.create': ['giam_doc_dao_tao'],
  // Reading a class is not creating one. Every role that must *pick* a class to
  // do its own job — sale/GĐKD drafting a tuition receipt, a teacher opening a
  // session — reads through this key. Writes (`class.create`) stay GĐĐT-only.
  'class.read': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
  // Deliberately narrower than `class.read`: the class roster carries children's
  // full names, so it is limited to the roles that teach or run the class.
  // Enforced here at the API layer — a nav entry or a `canDo()` check in the
  // browser cannot stop a session from calling the procedure directly.
  'classRoster.read': ['giao_vien', 'giam_doc_dao_tao'],
  'schedule.generate': ['giam_doc_dao_tao'],
  'attendance.mark': ['giao_vien', 'giam_doc_dao_tao'],
  'exercise.manage': ['giam_doc_dao_tao'],
  'exercise.view': ['giao_vien', 'giam_doc_dao_tao'],
  // Staff email backfill — GĐKD + sale (the roles that capture email at enrollment).
  'parentAccount.updateEmail': ['giam_doc_kinh_doanh', 'sale'],
  'submission.grade': ['giao_vien', 'giam_doc_dao_tao'],
  'assessment.draft': ['giao_vien', 'giam_doc_dao_tao'],
  'assessment.confirm': ['giao_vien'],
  'sessionEvidence.upsert': ['giao_vien'],
  'sessionEvidence.publish': ['giao_vien'],
  'user.manage': [],
  // Fills staff dropdowns (payroll, salary tiers, teacher assignment) with a
  // handful of fields. Its own key on purpose: reusing a payroll permission
  // would make class administration depend on who may assemble payslips, so
  // widening class administration later would quietly widen the money gate.
  'staff.pickList': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'facilityNetwork.manage': [],
  // All active staff roles can punch in (ADR-D: dormant roles removed).
  // ADR 0043 phase 4: `manualPunch.create` key removed — the procedure it
  // gated was deleted (tickets now only originate from checkInOut.punch's
  // ensureDayTicket); `manualPunch.resubmit` uses an owner check instead of
  // a permission key (protectedProcedure), same posture as `shift.cancel`.
  'checkIn.punch': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
  'manualPunch.approve': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'shift.manage': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  'shift.submit': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh', 'giao_vien', 'sale'],
  'shift.approve': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // HR remediation phase 2 (R3-4): `compensation.upsertRate` removed — the
  // sole baseSalary source is now `salaryTier.manage`'s SalaryTier catalog.
  'compensationPolicy.manage': [],
  'salaryTier.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'payslip.assemble': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'payslip.finalize': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'payslip.reopen': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'studentAccount.resetPassword': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // HR remediation phase 3 (docs/20): `kpi.submit` removed — auto-scored
  // lifecycle replaces the manual-entry procedure (red-team #10).
  // `kpi.refresh`/`kpi.submitSlip` — active staff, same roster `kpi.submit` had.
  'kpi.refresh': ['giao_vien', 'sale', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  'kpi.submitSlip': ['giao_vien', 'sale', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  'kpi.confirm': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // `kpi.approve` key still gates `kpi.override` (standalone approve procedure
  // removed — red-team #11, `approved` is reachable only via bulkApprove).
  'kpi.approve': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  'kpi.bulkApprove': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  'gift.upsert': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // Gift/reward/meeting/appointment — directors + sale (ADR-D: hr removed).
  'gift.list': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  'rewards.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  'parentMeeting.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  'testAppointment.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  'afterSale.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  'student.setLifecycle': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'reconciliation.review': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
};

/**
 * Authorization primitive: does `subject` may perform `module.action`?
 * `super_admin` bypasses everything; otherwise looks up the registry.
 */
export function can(
  subject: AuthSubject | null,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  if (!subject) return false;
  if (subject.roles.includes('super_admin')) return true;

  const allowedRoles = PERMISSIONS[permissionKey(module, action)];
  if (!allowedRoles) return false;

  return subject.roles.some((role) => (allowedRoles as readonly Role[]).includes(role));
}
