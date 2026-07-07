import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';

const ReceiptListPage = lazy(() => import('../pages/finance/receipt-list.js'));
const ReceiptDetailPage = lazy(() => import('../pages/finance/receipt-detail.js'));
const ReceiptCreatePage = lazy(() => import('../pages/finance/receipt-create.js'));
const ClassPlacementPage = lazy(() => import('../pages/enrollment/class-placement.js'));

function Fallback() {
  return <ComingSoon />;
}

export const financeRoutes: RouteObject[] = [
  {
    index: true,
    element: (
      <Suspense fallback={<Fallback />}>
        <ReceiptListPage />
      </Suspense>
    ),
  },
  {
    // Static path before :id so React Router v6 matches /finance/new first.
    path: 'new',
    element: (
      <Suspense fallback={<Fallback />}>
        <ReceiptCreatePage />
      </Suspense>
    ),
  },
  {
    // Class placement for existing students — separate from new-student onboarding.
    path: 'class-placement',
    element: (
      <Suspense fallback={<Fallback />}>
        <ClassPlacementPage />
      </Suspense>
    ),
  },
  {
    path: ':id',
    element: (
      <Suspense fallback={<Fallback />}>
        <ReceiptDetailPage />
      </Suspense>
    ),
  },
];
