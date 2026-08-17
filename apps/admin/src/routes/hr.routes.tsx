import { lazy, Suspense } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { NAV_MODULES, isNavChildVisible } from '../shell/nav-registry.js';
import { staffProfilePath } from '@cmc/links';

const CheckInOutPage = lazy(() => import('../pages/attendance/check-in-out.js'));
const CheckInTicketDetailPage = lazy(
  () => import('../pages/attendance/check-in-ticket-detail.js'),
);
const ShiftsPage = lazy(() => import('../pages/attendance/shifts.js'));
const ShiftsNewPage = lazy(() => import('../pages/attendance/shifts-new.js'));
const ShiftsDetailPage = lazy(() => import('../pages/attendance/shifts-detail.js'));
const PayrollPage = lazy(() => import('../pages/hr/payroll.js'));
const KpiPage = lazy(() => import('../pages/hr/kpi.js'));
const KpiDetailPage = lazy(() => import('../pages/hr/kpi-detail.js'));
const MyHrPage = lazy(() => import('../pages/hr/my-hr.js'));
const SalaryTiersPage = lazy(() => import('../pages/hr/salary-tiers.js'));
const StaffListPage = lazy(() => import('../pages/hr/staff/index.js'));
const StaffNewPage = lazy(() => import('../pages/hr/staff/staff-new.js'));
const StaffDetailLayout = lazy(() => import('../pages/hr/staff/staff-detail.js'));
const StaffProfileSection = lazy(() => import('../pages/hr/staff/profile.js'));
const StaffAccessSection = lazy(() => import('../pages/hr/staff/access.js'));

function Fallback() {
  return <Skeleton height={200} radius={0} />;
}

// Base detail path (/hr/staff/:staffId) redirects (replace) to the default
// /profile section — the only exact-base redirect; unknown sections are
// route-level not-found (D1/D7).
function StaffBaseRedirect() {
  const { staffId = '' } = useParams<{ staffId: string }>();
  return <Navigate to={staffProfilePath(staffId)} replace />;
}

// `/hr` itself has no screen of its own — the module mixes screens open to
// every active role (Chấm công/Đăng ký ca/Của tôi, no permission key) with
// director-gated ones (Chốt lương/Bậc lương; KPI is shared board). Land on the first
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
  // Static list above; UUID form for ManualAttendanceTicket (form-depth HITL).
  {
    path: 'checkin/:ticketId',
    element: (
      <Suspense fallback={<Fallback />}>
        <CheckInTicketDetailPage />
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
    path: 'kpi/:scoreId',
    element: (
      <Suspense fallback={<Fallback />}>
        <KpiDetailPage />
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
  // ── Staff (canonical /hr/staff surface, D1) ──────────────────────────────
  // Static /new precedes /:staffId (React Router match order). The bare
  // /:staffId path redirects (replace) to the default /profile section.
  {
    path: 'staff',
    element: (
      <Suspense fallback={<Fallback />}>
        <StaffListPage />
      </Suspense>
    ),
  },
  {
    path: 'staff/new',
    element: (
      <Suspense fallback={<Fallback />}>
        <StaffNewPage />
      </Suspense>
    ),
  },
  {
    path: 'staff/:staffId',
    element: <StaffBaseRedirect />,
  },
  {
    path: 'staff/:staffId/profile',
    element: (
      <Suspense fallback={<Fallback />}>
        <StaffDetailLayout />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Fallback />}>
            <StaffProfileSection />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: 'staff/:staffId/access',
    element: (
      <Suspense fallback={<Fallback />}>
        <StaffDetailLayout />
      </Suspense>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Fallback />}>
            <StaffAccessSection />
          </Suspense>
        ),
      },
    ],
  },
];
