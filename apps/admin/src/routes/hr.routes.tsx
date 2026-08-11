import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { NAV_MODULES, isNavChildVisible } from '../shell/nav-registry.js';

const CheckInOutPage = lazy(() => import('../pages/attendance/check-in-out.js'));
const ShiftsPage = lazy(() => import('../pages/attendance/shifts.js'));
const ShiftsNewPage = lazy(() => import('../pages/attendance/shifts-new.js'));
const ShiftsDetailPage = lazy(() => import('../pages/attendance/shifts-detail.js'));
const PayrollPage = lazy(() => import('../pages/hr/payroll.js'));
const KpiPage = lazy(() => import('../pages/hr/kpi.js'));
const MyHrPage = lazy(() => import('../pages/hr/my-hr.js'));
const SalaryTiersPage = lazy(() => import('../pages/hr/salary-tiers.js'));

function Fallback() {
  return <Skeleton height={200} radius={0} />;
}

// `/hr` itself has no screen of its own — the module mixes screens open to
// every active role (Chấm công/Đăng ký ca/Của tôi, no permission key) with
// director-only ones (Duyệt KPI/Chốt lương/Bậc lương). Land on the first
// child the current role can actually open, reusing the same nav-registry
// order and gate the sidebar already renders, instead of a ComingSoon dead
// end nobody assigned this role can walk past.
function HrIndex() {
  const { canDo } = useSession();
  const hrModule = NAV_MODULES.find((mod) => mod.id === 'hr');
  const firstOpenChild = hrModule?.children?.find((child) => isNavChildVisible(child, canDo));
  return <Navigate to={firstOpenChild?.path ?? '/hr/checkin'} replace />;
}

export const hrRoutes: RouteObject[] = [
  { index: true, element: <HrIndex /> },
  {
    path: 'checkin',
    element: (
      <Suspense fallback={<Fallback />}>
        <CheckInOutPage />
      </Suspense>
    ),
  },
  {
    path: 'shifts',
    element: (
      <Suspense fallback={<Fallback />}>
        <ShiftsPage />
      </Suspense>
    ),
  },
  // Static before :registrationId (React Router match order).
  {
    path: 'shifts/new',
    element: (
      <Suspense fallback={<Fallback />}>
        <ShiftsNewPage />
      </Suspense>
    ),
  },
  {
    path: 'shifts/:registrationId',
    element: (
      <Suspense fallback={<Fallback />}>
        <ShiftsDetailPage />
      </Suspense>
    ),
  },
  {
    path: 'payroll',
    element: (
      <Suspense fallback={<Fallback />}>
        <PayrollPage />
      </Suspense>
    ),
  },
  {
    path: 'kpi',
    element: (
      <Suspense fallback={<Fallback />}>
        <KpiPage />
      </Suspense>
    ),
  },
  {
    path: 'my',
    element: (
      <Suspense fallback={<Fallback />}>
        <MyHrPage />
      </Suspense>
    ),
  },
  {
    path: 'salary-tiers',
    element: (
      <Suspense fallback={<Fallback />}>
        <SalaryTiersPage />
      </Suspense>
    ),
  },
];
