// Phase 06 owns this file — real admin pages registered here.
// Route tree under /admin/* covers:
//   Students, Parents, Classes, Courses, Engagement,
//   Facilities, Users, NetworkIP, ShiftConfig, Report Cards.
//
// Note: /admin/report-cards is the accessible path for the teaching/report-cards
// page because teaching.routes.tsx is owned by phase 04 and cannot be modified here.
// A future phase should move this route to /teaching/report-cards.

import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';
import { PermissionGate } from '../lib/permission-gate.js';
import { staffProfilePath, classSectionPath, studentSectionPath } from '@cmc/links';

// ── Students ────────────────────────────────────────────────────────────────
const StudentListPage = lazy(() => import('../pages/students/index.js'));
const StudentDetailPage = lazy(() => import('../pages/students/student-detail.js'));

// ── Parents (guardian link request queue) ───────────────────────────────────
const ParentListPage = lazy(() => import('../pages/parents/index.js'));
const ParentDetailPage = lazy(() => import('../pages/parents/parent-detail.js'));

// ── Classes & Courses ────────────────────────────────────────────────────────
const ClassListPage = lazy(() => import('../pages/classes/index.js'));
const ClassDetailPage = lazy(() => import('../pages/classes/class-detail.js'));
const CourseListPage = lazy(() => import('../pages/courses/index.js'));

// ── Engagement ───────────────────────────────────────────────────────────────
const GiftsPage = lazy(() => import('../pages/engagement/gifts.js'));
const RewardsQueuePage = lazy(() => import('../pages/engagement/rewards.js'));
const RewardsDetailPage = lazy(() => import('../pages/engagement/rewards-detail.js'));
const LeaderboardPage = lazy(() => import('../pages/engagement/leaderboard.js'));

// ── Admin (super_admin gated) ────────────────────────────────────────────────
const FacilitiesPage = lazy(() => import('../pages/admin/facilities.js'));
const NetworkIpPage = lazy(() => import('../pages/admin/network-ip.js'));
const ShiftConfigPage = lazy(() => import('../pages/admin/shift-config.js'));
const AuditLogPage = lazy(() => import('../pages/admin/audit-log.js'));

// ── Report cards / AI assessment ─────────────────────────────────────────────
const ReportCardsPage = lazy(() => import('../pages/teaching/report-cards.js'));

function Fallback() {
  return <ComingSoon />;
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}

// /admin/users/:staffId → canonical /hr/staff/:staffId/profile (replace).
function UsersDetailRedirect() {
  const { staffId = '' } = useParams<{ staffId: string }>();
  return <Navigate to={staffProfilePath(staffId)} replace />;
}

// Phase 5: base detail paths redirect (replace) to the default section; the
// section itself is the durable URL. Unknown sections fall through to the
// route-level not-found (path no longer matches) rather than a silent render.
function ClassDetailRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={{ pathname: classSectionPath(id, 'overview'), search: location.search }} replace />;
}

function StudentDetailRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={{ pathname: studentSectionPath(id, 'profile'), search: location.search }} replace />;
}

// Section gates mirror the API contracts exactly (Phase 5): the shell and
// overview read `class.read`; the roster reads `classRoster.read` (teachers
// hold it while plain sale staff do not); sessions use `class.read`, the
// contract `classSession.list` itself enforces.
function ClassSectionGate({ section, children }: { section: string; children: React.ReactNode }) {
  const module = section === 'students' ? 'classRoster' : 'class';
  const requirementLabel =
    section === 'students' ? 'xem danh sách học viên của lớp (classRoster.read)' : 'xem lớp học (class.read)';
  return (
    <PermissionGate
      module={module}
      action="read"
      title="Chi tiết lớp"
      breadcrumbs={[{ label: 'Lớp & Học sinh' }, { label: 'Lớp học' }, { label: 'Chi tiết' }]}
      requirementLabel={requirementLabel}
    >
      {children}
    </PermissionGate>
  );
}

export const adminRoutes: RouteObject[] = [
  { index: true, element: <ComingSoon /> },

  // Students
  { path: 'students', element: <S><StudentListPage /></S> },
  // Base detail redirects (replace) to the default section; sections are the
  // durable URLs. Section routes are EXPLICIT (no generic :section catch-all)
  // so unknown sections fall through to route-level not-found.
  { path: 'students/:id', element: <StudentDetailRedirect /> },
  ...(['profile', 'enrollments'] as const).map((section) => ({
    path: `students/:id/${section}`,
    element: (
      <S>
        {/* Match API: student.get → requirePermission('student','lookup'). */}
        <PermissionGate
          module="student"
          action="lookup"
          title="Chi tiết học viên"
          breadcrumbs={[{ label: 'Lớp & Học sinh' }, { label: 'Học viên' }, { label: 'Chi tiết' }]}
          requirementLabel="tra cứu học viên (student.lookup)"
        >
          <StudentDetailPage />
        </PermissionGate>
      </S>
    ),
  })),

  // Parents (directory + guardian link queue)
  { path: 'parents', element: <S><ParentListPage /></S> },
  {
    path: 'parents/:parentId',
    element: (
      <S>
        <PermissionGate
          module="parentAccount"
          action="read"
          title="Chi tiết phụ huynh"
          breadcrumbs={[
            { label: 'Lớp & Học sinh' },
            { label: 'Phụ huynh' },
            { label: 'Chi tiết' },
          ]}
          requirementLabel="tra cứu phụ huynh (parentAccount.read)"
        >
          <ParentDetailPage />
        </PermissionGate>
      </S>
    ),
  },

  // Classes
  { path: 'classes', element: <S><ClassListPage /></S> },
  // Base redirects (replace) to the overview section (Phase 5).
  { path: 'classes/:id', element: <ClassDetailRedirect /> },
  ...(['overview', 'students', 'sessions'] as const).map((section) => ({
    path: `classes/:id/${section}`,
    element: (
      <S>
        <ClassSectionGate section={section}>
          <ClassDetailPage />
        </ClassSectionGate>
      </S>
    ),
  })),

  // Courses. The menu now points here under Lớp & Học sinh, but the gate stays:
  // a hidden nav entry does not stop a typed URL, and without this check a role
  // without `course.manage` gets a shell whose every query answers 403.
  {
    path: 'courses',
    element: (
      <S>
        <PermissionGate module="course" action="manage" title="Khoá học" breadcrumbs={[{ label: 'Quản trị' }, { label: 'Khoá học' }]} requirementLabel="quản lý khoá học (course.manage)">
          <CourseListPage />
        </PermissionGate>
      </S>
    ),
  },

  // Engagement — same: the Gắn kết menu group now reaches both screens, and the
  // gift/reward rosters deliberately exclude giao_vien (ADR-D). The gift menu
  // entry is narrower than this gate on purpose — it follows `gift.upsert`, the
  // screen's only mutation, so sale is not invited into a read-only dead end.
  {
    path: 'engagement/gifts',
    element: (
      <S>
        <PermissionGate module="gift" action="list" title="Quà tặng" breadcrumbs={[{ label: 'Gắn kết' }, { label: 'Quà tặng' }]} requirementLabel="xem danh mục quà tặng (gift.list)">
          <GiftsPage />
        </PermissionGate>
      </S>
    ),
  },
  // Static list before :rewardId (form-depth HITL).
  {
    path: 'engagement/rewards',
    element: (
      <S>
        <PermissionGate module="rewards" action="manage" title="Đổi thưởng" breadcrumbs={[{ label: 'Gắn kết' }, { label: 'Đổi thưởng' }]} requirementLabel="quản lý đổi thưởng (rewards.manage)">
          <RewardsQueuePage />
        </PermissionGate>
      </S>
    ),
  },
  {
    path: 'engagement/rewards/:rewardId',
    element: (
      <S>
        <PermissionGate module="rewards" action="manage" title="Đổi thưởng" breadcrumbs={[{ label: 'Gắn kết' }, { label: 'Đổi thưởng' }]} requirementLabel="quản lý đổi thưởng (rewards.manage)">
          <RewardsDetailPage />
        </PermissionGate>
      </S>
    ),
  },
  { path: 'engagement/leaderboard', element: <S><LeaderboardPage /></S> },

  // Admin (gated in page component)
  { path: 'facilities', element: <S><FacilitiesPage /></S> },
  // /admin/users is a compatibility redirect only — the canonical staff
  // surface is /hr/staff (D1). Both list and detail redirect with replace so
  // no second editable screen exists and old bookmarks land on one surface.
  { path: 'users', element: <Navigate to="/hr/staff" replace /> },
  {
    path: 'users/:staffId',
    element: <UsersDetailRedirect />,
  },
  { path: 'network-ip', element: <S><NetworkIpPage /></S> },
  { path: 'shift-config', element: <S><ShiftConfigPage /></S> },
  { path: 'audit-log', element: <S><AuditLogPage /></S> },

  // Report cards / AI assessment
  // TODO(phase-07): move to /teaching/report-cards once teaching.routes.tsx ownership allows.
  { path: 'report-cards', element: <S><ReportCardsPage /></S> },
];
