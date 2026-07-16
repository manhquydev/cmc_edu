// Phase 06 owns this file — real admin pages registered here.
// Route tree under /admin/* covers:
//   Students, Parents, Classes, Courses, Engagement,
//   Facilities, Users, NetworkIP, ShiftConfig, Report Cards.
//
// Note: /admin/report-cards is the accessible path for the teaching/report-cards
// page because teaching.routes.tsx is owned by phase 04 and cannot be modified here.
// A future phase should move this route to /teaching/report-cards.

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';

// ── Students ────────────────────────────────────────────────────────────────
const StudentListPage = lazy(() => import('../pages/students/index.js'));
const StudentDetailPage = lazy(() => import('../pages/students/student-detail.js'));

// ── Parents (guardian link request queue) ───────────────────────────────────
const ParentListPage = lazy(() => import('../pages/parents/index.js'));

// ── Classes & Courses ────────────────────────────────────────────────────────
const ClassListPage = lazy(() => import('../pages/classes/index.js'));
const ClassDetailPage = lazy(() => import('../pages/classes/class-detail.js'));
const CourseListPage = lazy(() => import('../pages/courses/index.js'));

// ── Engagement ───────────────────────────────────────────────────────────────
const GiftsPage = lazy(() => import('../pages/engagement/gifts.js'));
const RewardsQueuePage = lazy(() => import('../pages/engagement/rewards.js'));
const LeaderboardPage = lazy(() => import('../pages/engagement/leaderboard.js'));

// ── Admin (super_admin gated) ────────────────────────────────────────────────
const FacilitiesPage = lazy(() => import('../pages/admin/facilities.js'));
const UsersPage = lazy(() => import('../pages/admin/users.js'));
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

export const adminRoutes: RouteObject[] = [
  { index: true, element: <ComingSoon /> },

  // Students
  { path: 'students', element: <S><StudentListPage /></S> },
  { path: 'students/:id', element: <S><StudentDetailPage /></S> },

  // Parents (guardian link queue)
  { path: 'parents', element: <S><ParentListPage /></S> },

  // Classes
  { path: 'classes', element: <S><ClassListPage /></S> },
  { path: 'classes/:id', element: <S><ClassDetailPage /></S> },

  // Courses
  { path: 'courses', element: <S><CourseListPage /></S> },

  // Engagement
  { path: 'engagement/gifts', element: <S><GiftsPage /></S> },
  { path: 'engagement/rewards', element: <S><RewardsQueuePage /></S> },
  { path: 'engagement/leaderboard', element: <S><LeaderboardPage /></S> },

  // Admin (gated in page component)
  { path: 'facilities', element: <S><FacilitiesPage /></S> },
  { path: 'users', element: <S><UsersPage /></S> },
  { path: 'network-ip', element: <S><NetworkIpPage /></S> },
  { path: 'shift-config', element: <S><ShiftConfigPage /></S> },
  { path: 'audit-log', element: <S><AuditLogPage /></S> },

  // Report cards / AI assessment
  // TODO(phase-07): move to /teaching/report-cards once teaching.routes.tsx ownership allows.
  { path: 'report-cards', element: <S><ReportCardsPage /></S> },
];
