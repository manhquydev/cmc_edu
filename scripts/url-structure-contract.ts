/**
 * Closed-world URL contract — as-built is authority.
 *
 * Canonical surfaces (fail the gate when they disagree):
 *   1. React Router trees (admin + LMS)
 *   2. @cmc/links entity + workspace builders
 *   3. admin nav-registry
 *   4. flow-manifest uiRoutes
 *
 * TL06 (`docs/06-kien-truc-url-routing.md`) is a July paper map. It is
 * recorded on rows as `paper` for visibility only. A paper path that differs
 * from as-built is not a defect and does not fail CI. Product migration
 * (e.g. /admin/students → /students) needs an explicit locked decision.
 *
 * Adding a registered screen requires a row with `asBuilt`. New routes that
 * are not listed fail `pnpm check:url-structure`.
 *
 * Authority: packages/links · route trees · nav-registry ·
 * docs/ux-resource-centric-structure.md (form-depth recipe, 2026-08-11).
 */

export type UrlApp = 'admin' | 'lms';

/** How the as-built path is shaped — not a verdict against TL06. */
export type UrlFamily =
  | 'form-depth'
  | 'index-resource'
  | 'admin-module'
  | 'workspace'
  | 'shell'
  | 'lms'
  | 'paper-only';

export interface UrlContractEntry {
  id: string;
  app: UrlApp;
  /** July TL06 §3 path, params normalised to `:id`. Advisory only. */
  paper?: string;
  /** Exact registered router path. Absent = paper-only, no screen. */
  asBuilt?: string;
  /** Extra registered paths that must redirect to `asBuilt`. */
  redirectFrom?: readonly string[];
  family: UrlFamily;
  note?: string;
}

function row(entry: UrlContractEntry): UrlContractEntry {
  return entry;
}

/** Stale paths that must not be registered. */
export const FORBIDDEN_PATHS = [
  '/login/otp-phone',
  '/attendance/shifts',
  '/hr/salary-structure',
  '/hr/my-payslip',
] as const;

/** Router plumbing — not a business resource, excluded from the catalog. */
export const INFRA_PATHS = new Set([
  '/',
  '/go/:entity/:id',
  '/design',
]);

export const URL_CONTRACT: readonly UrlContractEntry[] = [
  // ── Teaching ─────────────────────────────────────────────────────────────
  row({ id: 'teaching-index', app: 'admin', asBuilt: '/teaching', family: 'shell', note: 'Index reuses cockpit' }),
  row({ id: 'teaching-schedule', app: 'admin', paper: '/teaching/schedule', asBuilt: '/teaching/schedule', family: 'workspace' }),
  row({ id: 'teaching-attendance', app: 'admin', paper: '/teaching/attendance', asBuilt: '/teaching/attendance', family: 'workspace' }),
  row({ id: 'teaching-attendance-report', app: 'admin', paper: '/teaching/attendance/report', family: 'paper-only' }),
  row({ id: 'teaching-grading', app: 'admin', paper: '/teaching/grading', asBuilt: '/teaching/grading', family: 'workspace' }),
  row({
    id: 'teaching-report-cards',
    app: 'admin',
    paper: '/teaching/report-cards',
    asBuilt: '/admin/report-cards',
    family: 'admin-module',
    note: 'admin.routes still owns the page; code TODO to move under /teaching',
  }),
  row({ id: 'teaching-report-cards-detail', app: 'admin', paper: '/teaching/report-cards/:id', family: 'paper-only' }),
  row({ id: 'teaching-session', app: 'admin', asBuilt: '/teaching/sessions/:sessionId', family: 'form-depth' }),
  row({ id: 'teaching-session-evidence', app: 'admin', asBuilt: '/teaching/session-evidence', family: 'workspace' }),
  row({ id: 'teaching-session-assessment', app: 'admin', asBuilt: '/teaching/session-assessment', family: 'workspace' }),
  row({ id: 'teaching-exercises', app: 'admin', asBuilt: '/teaching/exercises', family: 'form-depth' }),
  row({ id: 'teaching-exercise-detail', app: 'admin', asBuilt: '/teaching/exercises/:exerciseId', family: 'form-depth' }),
  row({
    id: 'teaching-exercise-sequence',
    app: 'admin',
    asBuilt: '/teaching/classes/:classBatchId/exercise-sequence',
    family: 'form-depth',
  }),

  // ── Academic / loyalty under /admin (accepted as-built, Aug 11 matrix) ───
  row({
    id: 'students',
    app: 'admin',
    paper: '/students',
    asBuilt: '/admin/students',
    family: 'admin-module',
    note: 'Migration to /students is not locked. /classes has a compat redirect; this list does not.',
  }),
  row({ id: 'students-detail', app: 'admin', paper: '/students/:id', asBuilt: '/admin/students/:id', family: 'admin-module' }),
  row({
    id: 'classes',
    app: 'admin',
    paper: '/classes',
    asBuilt: '/admin/classes',
    redirectFrom: ['/classes'],
    family: 'admin-module',
  }),
  row({ id: 'classes-detail', app: 'admin', paper: '/classes/:id', asBuilt: '/admin/classes/:id', family: 'admin-module' }),
  row({ id: 'courses', app: 'admin', paper: '/courses', asBuilt: '/admin/courses', family: 'admin-module' }),
  row({ id: 'courses-detail', app: 'admin', paper: '/courses/:id', family: 'paper-only' }),
  row({ id: 'parents', app: 'admin', paper: '/parents', asBuilt: '/admin/parents', family: 'admin-module' }),
  row({ id: 'parents-detail', app: 'admin', paper: '/parents/:id', asBuilt: '/admin/parents/:parentId', family: 'admin-module' }),
  row({ id: 'curriculum', app: 'admin', paper: '/curriculum', family: 'paper-only' }),
  row({ id: 'curriculum-detail', app: 'admin', paper: '/curriculum/:id', family: 'paper-only' }),
  row({ id: 'level-progress', app: 'admin', paper: '/level-progress', family: 'paper-only' }),
  row({ id: 'certificates', app: 'admin', paper: '/certificates', family: 'paper-only' }),
  row({ id: 'certificates-detail', app: 'admin', paper: '/certificates/:id', family: 'paper-only' }),

  // ── CRM ──────────────────────────────────────────────────────────────────
  row({
    id: 'crm-opportunities',
    app: 'admin',
    paper: '/crm/opportunities',
    asBuilt: '/crm',
    family: 'index-resource',
    note: 'Pipeline list is the CRM index; form is /crm/opportunities/:id',
  }),
  row({
    id: 'crm-opportunity-detail',
    app: 'admin',
    paper: '/crm/opportunities/:id',
    asBuilt: '/crm/opportunities/:id',
    family: 'form-depth',
  }),
  row({ id: 'crm-contacts', app: 'admin', paper: '/crm/contacts', family: 'paper-only' }),
  row({ id: 'crm-contacts-detail', app: 'admin', paper: '/crm/contacts/:id', family: 'paper-only' }),
  row({ id: 'crm-aftersale', app: 'admin', paper: '/crm/aftersale', asBuilt: '/crm/aftersale', family: 'form-depth' }),
  row({ id: 'crm-aftersale-detail', app: 'admin', asBuilt: '/crm/aftersale/:caseId', family: 'form-depth' }),
  row({
    id: 'parent-meetings',
    app: 'admin',
    paper: '/parent-meetings',
    asBuilt: '/crm/post-sale-meeting',
    family: 'workspace',
  }),
  row({ id: 'parent-meetings-detail', app: 'admin', paper: '/parent-meetings/:id', family: 'paper-only' }),
  row({ id: 'crm-bulk-import', app: 'admin', asBuilt: '/crm/bulk-import', family: 'workspace' }),
  row({ id: 'crm-report', app: 'admin', asBuilt: '/crm/report', family: 'workspace' }),

  // ── Finance: area index IS the receipt list (locked as-built recipe) ─────
  row({
    id: 'receipts',
    app: 'admin',
    paper: '/finance/receipts',
    asBuilt: '/finance',
    family: 'index-resource',
    note: 'Receipt list is the finance index; UUID form is /finance/:id — form-depth reference chrome',
  }),
  row({ id: 'receipts-new', app: 'admin', paper: '/finance/receipts/new', asBuilt: '/finance/new', family: 'index-resource' }),
  row({ id: 'receipts-detail', app: 'admin', paper: '/finance/receipts/:id', asBuilt: '/finance/:id', family: 'index-resource' }),
  row({
    id: 'revenue-report',
    app: 'admin',
    paper: '/finance/revenue-report',
    asBuilt: '/ops/revenue',
    family: 'workspace',
  }),
  row({
    id: 'reconciliation',
    app: 'admin',
    paper: '/finance/reconciliation',
    asBuilt: '/ops/recon',
    family: 'workspace',
  }),
  row({ id: 'refunds', app: 'admin', paper: '/finance/refunds', asBuilt: '/finance/refund', family: 'index-resource' }),
  row({
    id: 'refunds-detail',
    app: 'admin',
    paper: '/finance/refunds/:id',
    family: 'paper-only',
    note: 'Refund writes on the receipt form /finance/:id',
  }),
  row({ id: 'finance-outbox', app: 'admin', paper: '/finance/outbox', family: 'paper-only' }),
  row({ id: 'finance-class-placement', app: 'admin', asBuilt: '/finance/class-placement', family: 'workspace' }),
  row({ id: 'ops-index', app: 'admin', asBuilt: '/ops', family: 'shell', note: 'ComingSoon shell' }),

  // ── HR ───────────────────────────────────────────────────────────────────
  row({ id: 'hr-index', app: 'admin', asBuilt: '/hr', family: 'shell', note: 'Role-aware redirect to first visible child' }),
  row({ id: 'hr-staff', app: 'admin', paper: '/hr/staff', family: 'paper-only' }),
  row({ id: 'hr-staff-detail', app: 'admin', paper: '/hr/staff/:id', family: 'paper-only' }),
  row({ id: 'hr-payroll', app: 'admin', paper: '/hr/payroll', asBuilt: '/hr/payroll', family: 'workspace' }),
  row({
    id: 'hr-payroll-detail',
    app: 'admin',
    paper: '/hr/payroll/:id',
    family: 'paper-only',
    note: 'Payslip addressing is ?userId=&period= not a form path',
  }),
  row({ id: 'hr-kpi', app: 'admin', paper: '/hr/kpi', asBuilt: '/hr/kpi', family: 'form-depth' }),
  row({ id: 'hr-kpi-detail', app: 'admin', asBuilt: '/hr/kpi/:scoreId', family: 'form-depth' }),
  row({ id: 'hr-salary-tiers', app: 'admin', paper: '/hr/salary-tiers', asBuilt: '/hr/salary-tiers', family: 'workspace' }),
  row({ id: 'hr-my', app: 'admin', paper: '/hr/my', asBuilt: '/hr/my', family: 'workspace' }),
  row({
    id: 'check-in',
    app: 'admin',
    paper: '/attendance/check-in-out',
    asBuilt: '/hr/checkin',
    family: 'workspace',
  }),
  row({ id: 'check-in-ticket', app: 'admin', asBuilt: '/hr/checkin/:ticketId', family: 'form-depth' }),
  row({ id: 'hr-shifts', app: 'admin', paper: '/hr/shifts', asBuilt: '/hr/shifts', family: 'form-depth' }),
  row({ id: 'hr-shifts-new', app: 'admin', paper: '/hr/shifts/new', asBuilt: '/hr/shifts/new', family: 'form-depth' }),
  row({
    id: 'hr-shifts-detail',
    app: 'admin',
    paper: '/hr/shifts/:id',
    asBuilt: '/hr/shifts/:registrationId',
    family: 'form-depth',
  }),

  // ── Admin settings / engagement ──────────────────────────────────────────
  row({ id: 'admin-index', app: 'admin', asBuilt: '/admin', family: 'shell', note: 'ComingSoon shell' }),
  row({ id: 'admin-facilities', app: 'admin', paper: '/admin/facilities', asBuilt: '/admin/facilities', family: 'admin-module' }),
  row({ id: 'admin-facilities-detail', app: 'admin', paper: '/admin/facilities/:id', family: 'paper-only' }),
  row({ id: 'admin-users', app: 'admin', paper: '/admin/users', asBuilt: '/admin/users', family: 'admin-module' }),
  row({ id: 'admin-users-detail', app: 'admin', paper: '/admin/users/:id', family: 'paper-only' }),
  row({ id: 'admin-network-ip', app: 'admin', paper: '/admin/network-ip', asBuilt: '/admin/network-ip', family: 'admin-module' }),
  row({ id: 'admin-shift-config', app: 'admin', paper: '/admin/shift-config', asBuilt: '/admin/shift-config', family: 'admin-module' }),
  row({ id: 'admin-audit-log', app: 'admin', asBuilt: '/admin/audit-log', family: 'admin-module' }),
  row({
    id: 'engagement-rewards',
    app: 'admin',
    paper: '/engagement/rewards',
    asBuilt: '/admin/engagement/rewards',
    family: 'admin-module',
  }),
  row({
    id: 'engagement-reward-detail',
    app: 'admin',
    asBuilt: '/admin/engagement/rewards/:rewardId',
    family: 'admin-module',
  }),
  row({
    id: 'engagement-leaderboard',
    app: 'admin',
    paper: '/engagement/leaderboard',
    asBuilt: '/admin/engagement/leaderboard',
    family: 'admin-module',
  }),
  row({ id: 'engagement-gifts', app: 'admin', asBuilt: '/admin/engagement/gifts', family: 'admin-module' }),
  row({ id: 'engagement-badges', app: 'admin', paper: '/engagement/badges', family: 'paper-only' }),
  row({ id: 'engagement-badges-detail', app: 'admin', paper: '/engagement/badges/:id', family: 'paper-only' }),
  row({ id: 'notifications', app: 'admin', paper: '/notifications', family: 'paper-only' }),
  row({ id: 'search', app: 'admin', paper: '/search', family: 'paper-only' }),
  row({ id: 'cockpit', app: 'admin', paper: '/cockpit', asBuilt: '/cockpit', family: 'shell' }),
  row({ id: 'admin-login', app: 'admin', paper: '/login', asBuilt: '/login', family: 'shell' }),
  row({
    id: 'admin-change-password',
    app: 'admin',
    paper: '/login/change-password',
    asBuilt: '/change-password',
    family: 'shell',
  }),

  // ── LMS ──────────────────────────────────────────────────────────────────
  row({ id: 'lms-login', app: 'lms', paper: '/login', asBuilt: '/login', family: 'lms' }),
  row({
    id: 'lms-change-password',
    app: 'lms',
    paper: '/login/change-password',
    asBuilt: '/student/change-password',
    family: 'lms',
  }),
  row({ id: 'lms-select-child', app: 'lms', paper: '/select-child', family: 'paper-only' }),
  row({
    id: 'lms-child-exercises',
    app: 'lms',
    paper: '/child/:id/exercises',
    asBuilt: '/parent/homework/:studentId',
    family: 'lms',
    note: 'Parent homework results; student works at /student/exercise/:sessionExerciseId',
  }),
  row({
    id: 'lms-child-report-card',
    app: 'lms',
    paper: '/child/:id/report-card',
    asBuilt: '/parent/report-card/:studentId',
    family: 'lms',
  }),
  row({ id: 'lms-parent-index', app: 'lms', asBuilt: '/parent', family: 'lms' }),
  row({ id: 'lms-parent-home', app: 'lms', asBuilt: '/parent/home', family: 'lms' }),
  row({ id: 'lms-parent-evidence', app: 'lms', asBuilt: '/parent/evidence/:studentId', family: 'lms' }),
  row({ id: 'lms-parent-consent', app: 'lms', asBuilt: '/parent/consent/:studentId', family: 'lms' }),
  row({ id: 'lms-parent-reset', app: 'lms', asBuilt: '/parent/reset-password/:studentId', family: 'lms' }),
  row({ id: 'lms-student-index', app: 'lms', asBuilt: '/student', family: 'lms' }),
  row({ id: 'lms-student-home', app: 'lms', asBuilt: '/student/home', family: 'lms' }),
  row({ id: 'lms-student-exercise', app: 'lms', asBuilt: '/student/exercise/:sessionExerciseId', family: 'lms' }),
  row({ id: 'lms-student-gifts', app: 'lms', asBuilt: '/student/gifts', family: 'lms' }),
];

export function assertNeverFamily(value: never): never {
  throw new Error(`unhandled UrlFamily: ${String(value)}`);
}

export function familyLabel(family: UrlFamily): string {
  switch (family) {
    case 'form-depth':
      return 'list + :uuid form (Aug 11 recipe)';
    case 'index-resource':
      return 'area index is the resource list';
    case 'admin-module':
      return 'mounted under /admin (admin.routes.tsx)';
    case 'workspace':
      return 'query-addressed workspace';
    case 'shell':
      return 'shell / login / index redirect';
    case 'lms':
      return 'LMS /parent or /student';
    case 'paper-only':
      return 'July TL06 path, no as-built screen';
    default:
      return assertNeverFamily(family);
  }
}
