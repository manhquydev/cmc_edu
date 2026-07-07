// LMS route tree.
//
// Auth guards use <ParentOnly> and <StudentOnly> from kind-guard.tsx (C5).
// Each guard wraps a <Suspense><Outlet /></Suspense> so lazy pages load with
// a spinner inside the guard rather than outside it.

import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { ParentOnly, StudentOnly } from '../components/kind-guard.js';

// --- lazy page imports ---
const LoginPage = lazy(() => import('../pages/login.js'));

// Parent pages
const ParentHomePage = lazy(() => import('../pages/parent/home.js'));
const SessionEvidencePage = lazy(() => import('../pages/parent/session-evidence.js'));
const ReportCardPage = lazy(() => import('../pages/parent/report-card.js'));
const ConsentSettingsPage = lazy(() => import('../pages/parent/consent-settings.js'));
const ResetChildPasswordPage = lazy(() => import('../pages/parent/reset-child-password.js'));

// Student pages
const StudentHomePage = lazy(() => import('../pages/student/home.js'));
const ExercisePage = lazy(() => import('../pages/student/exercise.js'));
const GiftsPage = lazy(() => import('../pages/student/gifts.js'));
const ChangePasswordPage = lazy(() => import('../pages/student/change-password.js'));

function PageLoader() {
  return (
    <Center style={{ minHeight: '100vh' }}>
      <Loader size="md" />
    </Center>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/parent',
    element: (
      <ParentOnly>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </ParentOnly>
    ),
    children: [
      { index: true, element: <Navigate to="/parent/home" replace /> },
      { path: 'home', element: <ParentHomePage /> },
      { path: 'evidence/:studentId', element: <SessionEvidencePage /> },
      { path: 'report-card/:studentId', element: <ReportCardPage /> },
      { path: 'consent/:studentId', element: <ConsentSettingsPage /> },
      { path: 'reset-password/:studentId', element: <ResetChildPasswordPage /> },
    ],
  },
  {
    path: '/student',
    element: (
      <StudentOnly>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </StudentOnly>
    ),
    children: [
      { index: true, element: <Navigate to="/student/home" replace /> },
      { path: 'home', element: <StudentHomePage /> },
      { path: 'exercise/:exerciseId', element: <ExercisePage /> },
      { path: 'gifts', element: <GiftsPage /> },
      { path: 'change-password', element: <ChangePasswordPage /> },
    ],
  },
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
