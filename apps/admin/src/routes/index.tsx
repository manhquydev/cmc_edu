// Route tree — this file ONLY imports and assembles module route arrays.
// Phases 03-06 each own their own {module}.routes.tsx — never edit this file
// to add new routes; add them to the appropriate module file instead.
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Skeleton } from '@mantine/core';
import { Shell } from '../shell/shell.js';
import { LoginPage } from '../pages/login.js';
import { ComingSoon } from '../pages/coming-soon.js';
import { financeRoutes } from './finance.routes.js';
import { crmRoutes } from './crm.routes.js';
import { teachingRoutes } from './teaching.routes.js';
import { hrRoutes } from './hr.routes.js';
import { opsRoutes } from './ops.routes.js';
import { adminRoutes } from './admin.routes.js';
import { useSession } from '../lib/session-context.js';

// Phase 1 spike (plans/260710-0236-astryx-ui-migration): dev-only route,
// no auth, not linked from any nav. Removed after the GO/NO-GO gate.
const AstryxSpikePage = import.meta.env.DEV
  ? lazy(() => import('../pages/sandbox/astryx-spike.js').then((m) => ({ default: m.AstryxSpikePage })))
  : null;

const CockpitPage = lazy(() => import('../pages/cockpit.js'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, isLoading } = useSession();
  if (isLoading) return <Skeleton height="100vh" radius={0} />;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  ...(AstryxSpikePage
    ? [
        {
          path: '/__astryx-spike',
          element: (
            <Suspense fallback={<Skeleton height="100vh" radius={0} />}>
              <AstryxSpikePage />
            </Suspense>
          ),
        },
      ]
    : []),
  {
    path: '/',
    element: <RequireAuth><Shell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/cockpit" replace /> },
      {
        path: 'cockpit',
        element: (
          <Suspense fallback={<Skeleton height={200} radius="xs" m="md" />}>
            <CockpitPage />
          </Suspense>
        ),
      },
      { path: 'finance', children: financeRoutes },
      { path: 'crm', children: crmRoutes },
      { path: 'teaching', children: teachingRoutes },
      { path: 'hr', children: hrRoutes },
      { path: 'ops', children: opsRoutes },
      { path: 'admin', children: adminRoutes },
      { path: '*', element: <ComingSoon /> },
    ],
  },
]);
