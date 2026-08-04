import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';

const CockpitPage = lazy(() => import('../pages/cockpit.js'));
const SchedulePage = lazy(() => import('../pages/teaching/schedule.js'));
const SessionDetailPage = lazy(() => import('../pages/teaching/session-detail.js'));
const AttendancePage = lazy(() => import('../pages/teaching/attendance.js'));
const GradingPage = lazy(() => import('../pages/teaching/grading.js'));
const SessionEvidencePage = lazy(() => import('../pages/teaching/session-evidence.js'));
const SessionAssessmentPage = lazy(() => import('../pages/teaching/session-assessment.js'));
const ExercisesPage = lazy(() => import('../pages/teaching/exercises.js'));

function PageFallback() {
  return <Skeleton height={200} radius={0} />;
}

// Phase 04 owns this file — teaching section routes.
// Cockpit is the index so `/teaching` lands on the role-aware dashboard.
export const teachingRoutes: RouteObject[] = [
  {
    index: true,
    element: (
      <Suspense fallback={<PageFallback />}>
        <CockpitPage />
      </Suspense>
    ),
  },
  {
    path: 'schedule',
    element: (
      <Suspense fallback={<PageFallback />}>
        <SchedulePage />
      </Suspense>
    ),
  },
  {
    path: 'sessions/:sessionId',
    element: (
      <Suspense fallback={<PageFallback />}>
        <SessionDetailPage />
      </Suspense>
    ),
  },
  {
    path: 'attendance',
    element: (
      <Suspense fallback={<PageFallback />}>
        <AttendancePage />
      </Suspense>
    ),
  },
  {
    path: 'grading',
    element: (
      <Suspense fallback={<PageFallback />}>
        <GradingPage />
      </Suspense>
    ),
  },
  {
    path: 'session-evidence',
    element: (
      <Suspense fallback={<PageFallback />}>
        <SessionEvidencePage />
      </Suspense>
    ),
  },
  {
    path: 'session-assessment',
    element: (
      <Suspense fallback={<PageFallback />}>
        <SessionAssessmentPage />
      </Suspense>
    ),
  },
  {
    path: 'exercises',
    element: (
      <Suspense fallback={<PageFallback />}>
        <ExercisesPage />
      </Suspense>
    ),
  },
];
