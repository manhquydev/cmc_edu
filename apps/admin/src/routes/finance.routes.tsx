import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';

const ReceiptListPage = lazy(() => import('../pages/finance/receipt-list.js'));
const ReceiptDetailPage = lazy(() => import('../pages/finance/receipt-detail.js'));
const ReceiptCreatePage = lazy(() => import('../pages/finance/receipt-create.js'));
const ClassPlacementPage = lazy(() => import('../pages/enrollment/class-placement.js'));
// Residual EmptyState screen rolled in from `260707-0915-ui-implementation`
// phase-06 (HR remediation phase 5, 2026-07-12) — see the page file's own
// header comment for why it stays an EmptyState (flagged reason).
const RefundPage = lazy(() => import('../pages/finance/refund.js'));

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
    path: 'refund',
    element: (
      <Suspense fallback={<Fallback />}>
        <RefundPage />
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
