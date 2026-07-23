import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';
import { PermissionGate } from '../lib/permission-gate.js';

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
    //
    // Gated in its own right, not by the menu: hiding a nav entry does not stop
    // a typed URL, and this was the one screen here with no check of its own.
    // The gate is a UI boundary, not a security one — `student.lookup` still
    // admits giao_vien at the API, so a teacher determined to call it directly
    // can. What it does buy is that a teacher who lands on the URL gets a plain
    // "no access" page instead of an operable-looking screen whose writes all
    // fail — the same reason the three admin screens carry one.
    path: 'class-placement',
    element: (
      <Suspense fallback={<Fallback />}>
        <PermissionGate
          module="enrollment"
          action="enroll"
          title="Xếp lớp"
          breadcrumbs={[{ label: 'Tài chính & Điều hành' }, { label: 'Xếp lớp' }]}
          requirementLabel="xếp lớp cho học viên (enrollment.enroll)"
        >
          <ClassPlacementPage />
        </PermissionGate>
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
