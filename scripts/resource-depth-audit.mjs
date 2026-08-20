import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE_FILES = {
  'finance.routes.tsx': '/finance',
  'crm.routes.tsx': '/crm',
  'teaching.routes.tsx': '/teaching',
  'hr.routes.tsx': '/hr',
  'ops.routes.tsx': '/ops',
  'admin.routes.tsx': '/admin',
  'go.routes.tsx': '',
  'design.routes.tsx': '',
};

const STATIC_ROUTE_CATEGORIES = new Map([
  ['/login', 'auth'], ['/cockpit', 'dashboard'], ['/change-password', 'workflow'], ['/design', 'exception'],
  ['/classes', 'compatibility'], ['/finance', 'index'], ['/finance/new', 'create'], ['/finance/class-placement', 'workspace'],
  ['/finance/refund', 'workspace'], ['/crm', 'index'], ['/crm/bulk-import', 'workflow'], ['/crm/report', 'dashboard'],
  ['/crm/post-sale-meeting', 'index'], ['/crm/aftersale', 'index'], ['/teaching', 'dashboard'], ['/teaching/schedule', 'workspace'],
  ['/teaching/attendance', 'workspace'], ['/teaching/grading', 'workspace'], ['/teaching/session-evidence', 'workspace'],
  ['/teaching/session-assessment', 'workspace'], ['/teaching/exercises', 'index'], ['/hr', 'compatibility'], ['/hr/checkin', 'workspace'],
  ['/hr/shifts', 'index'], ['/hr/shifts/new', 'create'], ['/hr/payroll', 'workspace'], ['/hr/kpi', 'index'], ['/hr/my', 'workspace'],
  ['/hr/salary-tiers', 'config'], ['/hr/staff', 'index'], ['/hr/staff/new', 'create'], ['/ops', 'exception'], ['/ops/revenue', 'dashboard'],
  ['/ops/recon', 'workspace'], ['/admin', 'exception'], ['/admin/students', 'index'], ['/admin/parents', 'index'],
  ['/admin/classes', 'index'], ['/admin/courses', 'config'], ['/admin/engagement/gifts', 'config'],
  ['/admin/engagement/rewards', 'index'], ['/admin/engagement/leaderboard', 'dashboard'], ['/admin/facilities', 'config'],
  ['/admin/users', 'compatibility'], ['/admin/network-ip', 'config'], ['/admin/shift-config', 'config'],
  ['/admin/audit-log', 'compliance'], ['/admin/report-cards', 'workspace'], ['/admin/permissions', 'config'],
]);

const DETAIL_DEPTH = new Map([
  ['/crm/opportunities/:id', ['get', 'timeline']],
  ['/finance/:id', ['get', 'timeline']],
  ['/finance/:id/:section', ['get', 'timeline']],
  ['/crm/post-sale-meeting/:meetingId/:section?', ['get', 'timeline']],
  ['/admin/students/:id/:section', ['get', 'timeline']],
  ['/admin/parents/:parentId', ['get', 'timeline']],
  ['/admin/classes/:id/:section', ['get', 'timeline']],
  ['/hr/staff/:staffId/profile', ['get']],
  ['/hr/staff/:staffId/access', ['get']],
  ['/hr/staff/:staffId/activity', ['get', 'timeline']],
  ['/crm/aftersale/:caseId', ['get', 'timeline']],
  ['/hr/shifts/:registrationId', ['get', 'timeline']],
]);

const EXCEPTIONS = new Map([
  ['/go/:entity/:id', { category: 'resolver', reason: 'Allowlisted deep-link resolver owns entity routing.', owner: 'go.routes.tsx' }],
  ['/teaching/sessions/:sessionId', { category: 'workspace-detail', reason: 'Existing session workspace uses query-tab contract.', owner: 'teaching.routes.tsx' }],
  ['/teaching/classes/:classBatchId/exercise-sequence', { category: 'subresource-workspace', reason: 'Class-owned sequence is not an independent record.', owner: 'teaching.routes.tsx' }],
  ['/hr/staff/:staffId', { category: 'compatibility', reason: 'Base Staff detail redirects to profile.', owner: 'hr.routes.tsx' }],
  ['/admin/students/:id', { category: 'compatibility', reason: 'Base Student detail redirects to profile.', owner: 'admin.routes.tsx' }],
  ['/admin/classes/:id', { category: 'compatibility', reason: 'Base Class detail redirects to overview.', owner: 'admin.routes.tsx' }],
  ['/teaching/exercises/:exerciseId', { category: 'timeline-gap', reason: 'Exercise is a global catalog with no facilityId; RecordEvent is facility-scoped. Documented in timeline-gap-closure.md.', owner: 'RL6' }],
  ['/hr/checkin/:ticketId', { category: 'timeline-gap', reason: 'ManualAttendanceTicket stays AuditLog-only by decision (RL6).', owner: 'RL6' }],
  ['/hr/kpi/:scoreId', { category: 'timeline-gap', reason: 'KpiScore stays AuditLog-only by decision (RL6).', owner: 'RL6' }],
  ['/admin/engagement/rewards/:rewardId', { category: 'timeline-gap', reason: 'Reward stays AuditLog-only by decision (RL6).', owner: 'RL6' }],
  ['/admin/users/:staffId', { category: 'compatibility', reason: 'Legacy Staff URL redirects to canonical /hr/staff/:staffId.', owner: 'admin.routes.tsx' }],
]);

function normalizeChildPath(prefix, child) {
  const value = child.replace(/\$\{[^}]+\}/g, ':section');
  return `${prefix}/${value}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

export function discoverRoutes() {
  const routes = [];
  for (const [file, prefix] of Object.entries(ROUTE_FILES)) {
    const source = fs.readFileSync(path.join(ROOT, 'apps/admin/src/routes', file), 'utf8');
    const re = /path:\s*['"`]([^'"`]+)['"`]/g;
    for (const match of source.matchAll(re)) routes.push(normalizeChildPath(prefix, match[1]));
  }
  return [...new Set(['/login', '/cockpit', '/change-password', '/finance', '/crm', '/teaching', '/hr', '/ops', '/admin', '/classes', ...routes])];
}

export function auditRoutes(routes = discoverRoutes()) {
  const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
  const unknownRoutes = [];
  const unclassifiedDetails = [];
  for (const route of routes) {
    if (STATIC_ROUTE_CATEGORIES.has(route) || EXCEPTIONS.has(route) || DETAIL_DEPTH.has(route)) continue;
    if (route.includes(':')) unknownRoutes.push(route);
    else unknownRoutes.push(route);
  }
  for (const [route, required] of DETAIL_DEPTH) {
    if (!routes.includes(route)) unclassifiedDetails.push({ route, reason: `Required detail route missing from source: ${required.join(', ')}` });
  }
  return { routes, duplicateRoutes, unknownRoutes, unclassifiedDetails, exceptions: Object.fromEntries(EXCEPTIONS) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = auditRoutes();
  console.log(JSON.stringify(result, null, 2));
  if (result.duplicateRoutes.length || result.unknownRoutes.length || result.unclassifiedDetails.length) process.exitCode = 1;
}
