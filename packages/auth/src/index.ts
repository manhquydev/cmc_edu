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
  // minimization). `giao_vien` added for attendance name resolution
  // (`student.getManyByIds`) — teachers see only students in their own
  // facility sessions (RLS + facilityId predicate), same minimization rules.
  'student.lookup': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'ke_toan', 'giao_vien'],
  // K7 remediation: no role entry on purpose — only `super_admin`'s registry
  // bypass (see `can()` below) may create/list facilities. Every other role
  // falls through to the empty array and is FORBIDDEN.
  'facility.create': [],
  'facility.list': [],
  // P2-Foundation (docs/26 WF-P2-01, TL19 §1-2): class operations. GDDT owns
  // curriculum/room/class setup; `class.create`/`schedule.generate` also gate
  // `classBatch.list`/`classBatch.get` (no separate read-only permission is
  // named by the spec, so they reuse `class.create`).
  'course.manage': ['giam_doc_dao_tao'],
  'room.manage': ['giam_doc_dao_tao'],
  'class.create': ['giam_doc_dao_tao'],
  'schedule.generate': ['giam_doc_dao_tao'],
  // T1 (docs/26 phase-02, TL19 §5, WF-P2-02): attendance is a teacher-facing
  // action, unlike the GĐĐT-only class-setup perms above. Also gates
  // `classSession.cancel`/`confirm`/`addMakeup` via `schedule.generate`
  // (unchanged, GĐĐT-only — session lifecycle stays a training-ops action).
  'attendance.mark': ['giao_vien', 'giam_doc_dao_tao'],
  // T2-I (docs/26 WF-P2-04, TL19 §3): Exercise/CurriculumUnit management is a
  // director-only action, like `course.manage`/`room.manage` above — the spec
  // names `assessment.*`/`exercise.*` (TL25) but this repo's registry uses one
  // permission key for create/publish/close/upload + `curriculumUnit.list`
  // (documented deviation, phase-03 spec §Procedures).
  'exercise.manage': ['giam_doc_dao_tao'],
  // PDF download for the grading UI — same roster as submission.grade so
  // teachers can display the base PDF while grading submissions.
  'exercise.view': ['giao_vien', 'giam_doc_dao_tao'],
  // Staff email backfill for parents provisioned before email capture was added
  // (phase-01b). Same roster as finance.receiptCreate: the staff who create
  // receipts are the ones who capture email at enrollment time.
  'parentAccount.updateEmail': ['giam_doc_kinh_doanh', 'sale', 'cskh', 'ke_toan'],
  // T2-II (docs/26 WF-P2-06, TL19 §6): grading a Submission (score + Grade +
  // star award) is a teacher-facing action, unlike `exercise.manage`'s
  // director-only scope above — the spec names `giao_vien/GĐĐT/super_admin`
  // (super_admin bypasses via can()'s registry-independent check, so it is
  // never listed in a row here, matching every other entry's convention).
  'submission.grade': ['giao_vien', 'giam_doc_dao_tao'],
  // T3 (docs/26 WF-P2-07): AI-draft is also accessible to GĐĐT (training
  // director) who may need to trigger batch drafts; confirm/discard is
  // teacher-only (GV is the one accountable for what goes to parents).
  'assessment.draft': ['giao_vien', 'giam_doc_dao_tao'],
  'assessment.confirm': ['giao_vien'],
  // T3 (docs/26 WF-P2-08): session evidence is teacher-authored; publish
  // gates what parents can see so it shares the same teacher-only roster.
  'sessionEvidence.upsert': ['giao_vien'],
  'sessionEvidence.publish': ['giao_vien'],
  // P3-I: HR/identity — AppUser (staff) CRUD and facility network management
  // are super_admin-only actions (super_admin already bypasses via can(), so
  // empty arrays would suffice, but we document the intent explicitly).
  'user.manage': [],
  'facilityNetwork.manage': [],
  // P3-I: time-punch (clock-in/out) — all staff roles can punch in.
  'checkIn.punch': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien', 'ke_toan', 'cskh', 'ctv_mkt', 'hr'],
  // P3-I: manual punch ticket creation — all staff can submit.
  'manualPunch.create': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien', 'ke_toan', 'cskh', 'ctv_mkt', 'hr'],
  // P3-I: manual punch approve/reject — director-level only (separation of
  // duties: the person approving their own absence record is a control risk).
  'manualPunch.approve': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // P3-II: shift group/template management — directors and super_admin only.
  'shift.manage': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // P3-II: shift registration submission — all staff roles that register shifts.
  'shift.submit': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh', 'giao_vien', 'sale', 'hr'],
  // P3-II: shift registration approval — director-level only.
  'shift.approve': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // P3-II: salary rate upsert — directors and super_admin only (financial data).
  'compensation.upsertRate': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // P3-II: payslip assembly/finalize/reopen — directors and super_admin only.
  'payslip.assemble': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'payslip.finalize': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  'payslip.reopen': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // C1/phase-01b: staff-side student password reset (back to default). Same
  // director-level roster as other sensitive student-data mutations (GĐKD/GĐĐT
  // have accountability; ke_toan excluded — not a training-ops role).
  'studentAccount.resetPassword': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // P3-II: KPI score submission — all staff can submit their own KPI.
  'kpi.submit': ['giao_vien', 'sale', 'hr', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // P3-II: KPI confirm (by direct manager) — directors are managers in CMC org.
  'kpi.confirm': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // P3-II: KPI approve and override — director-level only.
  'kpi.approve': ['giam_doc_dao_tao', 'giam_doc_kinh_doanh'],
  // P4: Gift catalog management — directors manage the gift catalog.
  'gift.upsert': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // P4: Gift listing for staff — broader roster (sale/hr need to explain to parents).
  'gift.list': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'hr'],
  // P4: Reward management (approve/deliver/reject) — directors + sale + hr.
  'rewards.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'hr'],
  // P4: Parent meeting lifecycle — sale/hr are the CRM-facing roles for meetings.
  'parentMeeting.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'hr'],
  // P4: Test appointment lifecycle — same roster as parent meetings.
  'testAppointment.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'hr'],
  // P4: After-sale case management — directors + sale (customer-success owners).
  'afterSale.manage': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale'],
  // P4: Student lifecycle transitions (active/blocked_lms/withdrawn) — director-only,
  // same separation-of-duties rationale as finance.receiptApprove (no `sale` role).
  'student.setLifecycle': ['giam_doc_kinh_doanh', 'giam_doc_dao_tao'],
  // P5: Reconciliation flag review — directors only (audit surface; flagging is
  // done by the AI-recon worker, human review/dismiss/action is director-level).
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

  return subject.roles.some((role) => allowedRoles.includes(role));
}
