import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';

const CheckInOutPage = lazy(() => import('../pages/attendance/check-in-out.js'));
const ShiftsPage = lazy(() => import('../pages/attendance/shifts.js'));
const PayrollPage = lazy(() => import('../pages/hr/payroll.js'));
const KpiPage = lazy(() => import('../pages/hr/kpi.js'));

function Fallback() {
  return <ComingSoon />;
}

export const hrRoutes: RouteObject[] = [
  { index: true, element: <ComingSoon /> },
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
];
