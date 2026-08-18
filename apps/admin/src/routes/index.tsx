// Route tree — this file ONLY imports and assembles module route arrays.
// Phases 03-06 each own their own {module}.routes.tsx — never edit this file
// to add new routes; add them to the appropriate module file instead.
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';
import { Shell } from '../shell/shell.js';
import { LoginPage } from '../pages/login.js';
import RouteNotFoundPage from '../pages/route-not-found.js';
import { financeRoutes } from './finance.routes.js';
import { crmRoutes } from './crm.routes.js';
import { teachingRoutes } from './teaching.routes.js';
import { hrRoutes } from './hr.routes.js';
import { opsRoutes } from './ops.routes.js';
import { adminRoutes } from './admin.routes.js';
import { goRoutes } from './go.routes.js';
import { designRoutes } from './design.routes.js';
import { useSession } from '../lib/session-context.js';
import { shouldCaptureReturnTo } from '../lib/safe-return-to.js';

const CockpitPage = lazy(() => import('../pages/cockpit.js'));
// Forced password rotation: rendered INSIDE Shell in chrome-suppressed mode
// (no navbar/app-switcher/⌘K) so the user cannot navigate away mid-rotation.
const ChangePasswordPage = lazy(() => import('../pages/change-password.js'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <Skeleton height="100vh" radius={0} />;
  // No pathname allow-list — every child of Shell requires a staff session.
  if (!me) {
    // Preserve the deep-link destination across login (and change-password)
    // via ?returnTo=. Policy lives in safe-return-to.ts — do not re-list
    // excluded paths here.
    if (shouldCaptureReturnTo(location.pathname)) {
      const dest = `${location.pathname}${location.search}`;
      return <Navigate to={`/login?returnTo=${encodeURIComponent(dest)}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Vite `base` (docker: /admin/) becomes import.meta.env.BASE_URL so the data
// router matches URLs under the nginx /admin/ prefix.
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth><Shell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/cockpit" replace /> },
      {
        path: 'cockpit',
        element: (
          <Suspense fallback={<Skeleton height={200} radius={0} />}>
            <CockpitPage />
          </Suspense>
        ),
      },
      // Forced password rotation lives INSIDE Shell in chrome-suppressed mode
      // (decision 10/10b) — no navbar/app-switcher/⌘K while rotating.
      {
        path: 'change-password',
        element: (
          <Suspense fallback={<Skeleton height="100vh" radius={0} />}>
            <ChangePasswordPage />
          </Suspense>
        ),
      },
      { path: 'finance', children: financeRoutes },
      { path: 'crm', children: crmRoutes },
      { path: 'teaching', children: teachingRoutes },
      { path: 'hr', children: hrRoutes },
      { path: 'ops', children: opsRoutes },
      { path: 'admin', children: adminRoutes },
      // Canonical deep-link resolver — before wildcard so /go/* is never 404.
      ...goRoutes,
      // Design-system showcase lab (observation page; deletable after review).
      ...designRoutes,
      // Footgun: bare /classes is not registered (list lives at /admin/classes).
      // Redirect before the route-level not-found so typed/bookmarked URLs work.
      { path: 'classes', element: <Navigate to="/admin/classes" replace /> },
      { path: '*', element: <RouteNotFoundPage /> },
    ],
  },
  ],
  routerBasename === '/' ? undefined : { basename: routerBasename },
);
