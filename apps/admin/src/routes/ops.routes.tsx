import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';

const RevenueReportPage = lazy(() => import('../pages/finance/revenue-report.js'));
const ReconciliationPage = lazy(() => import('../pages/finance/reconciliation.js'));

function Fallback() {
  return <ComingSoon />;
}

export const opsRoutes: RouteObject[] = [
  { index: true, element: <ComingSoon /> },
  {
    path: 'revenue',
    element: (
      <Suspense fallback={<Fallback />}>
        <RevenueReportPage />
      </Suspense>
    ),
  },
  {
    path: 'recon',
    element: (
      <Suspense fallback={<Fallback />}>
        <ReconciliationPage />
      </Suspense>
    ),
  },
];
