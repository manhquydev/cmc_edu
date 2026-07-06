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
export const PERMISSIONS: Record<string, readonly Role[]> = {
  'crm.opportunityList': ['giam_doc_kinh_doanh', 'sale', 'cskh', 'ctv_mkt'],
  'crm.opportunityLookup': ['giam_doc_kinh_doanh', 'sale', 'ke_toan'],
  'crm.opportunityCreate': ['giam_doc_kinh_doanh', 'sale'],
  'crm.opportunityAdvance': ['giam_doc_kinh_doanh', 'sale'],
  'crm.opportunityMarkLost': ['giam_doc_kinh_doanh', 'sale'],
  'finance.receiptCreate': ['giam_doc_kinh_doanh', 'sale', 'ke_toan'],
  // Money gate (ADR-B, docs/16): approver must differ from the drafting sale
  // rep for basic separation of duties — `sale` MUST NOT appear here.
  'finance.receiptApprove': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'ke_toan'],
  'finance.refundCreate': ['giam_doc_kinh_doanh', 'ke_toan'],
  'enrollment.enroll': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  // K8 remediation: blocks a Student's LMS access (`StudentLifecycle.blocked_lms`,
  // docs/19 §2) — restricted to the same "independent second eye" roles as
  // the ADR-B over-threshold approval (a sensitive, hard-to-reverse action),
  // not the general enrollment-management roster.
  'enrollment.blockLms': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'guardian.approveLink': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien', 'cskh'],
  // K3 remediation (deep-review consolidated report): the HITL work-queue for
  // the money gate — an approver cannot approve what they cannot find.
  // Deliberately the SAME roster as `finance.receiptApprove` (docs/14 §5
  // matrix): visibility into the approval queue is only useful to the roles
  // that can actually act on it. `sale` (the drafter) is excluded here too,
  // same SoD rationale as receiptApprove.
  'finance.receiptList': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'ke_toan'],
  'finance.receiptGet': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'ke_toan'],
  // K3 remediation: the pending-review queue for guardian link requests.
  // Same roster as `guardian.approveLink` — listing the queue is a
  // prerequisite to acting on it, not a broader read grant.
  'guardian.listPendingLinks': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien', 'cskh'],
  // K4 remediation: staff-only student lookup (docs/08 §7 child-data
  // minimization) — restricted to the roles that actually need a resulting
  // `studentId` downstream: `finance.receiptCreate` renewals (GĐKD/sale/
  // ke_toan) and `enrollment.enroll` (GĐKD/GĐĐT/sale).
  'student.lookup': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'ke_toan'],
  // K7 remediation: no role entry on purpose — only `super_admin`'s registry
  // bypass (see `can()` below) may create/list facilities. Every other role
  // falls through to the empty array and is FORBIDDEN.
  'facility.create': [],
  'facility.list': [],
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

  return subject.roles.some((role) => allowedRoles.includes(role));
}
