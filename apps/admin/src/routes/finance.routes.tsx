import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';
import { PermissionGate } from '../lib/permission-gate.js';

const ReceiptListPage = lazy(() => import('../pages/finance/receipt-list.js'));
const ReceiptDetailPage = lazy(() => import('../pages/finance/receipt-detail.js'));
const ReceiptCreatePage = lazy(() => import('../pages/finance/receipt-create.js'));
const ClassPlacementPage = lazy(() => import('../pages/enrollment/class-placement.js'));
// Approved-receipt index for refund form-depth (HITL on /finance/:id).
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
        {/* Match API: finance.receiptGet → requirePermission('finance','receiptGet'). */}
        <PermissionGate
          module="finance"
          action="receiptGet"
          title="Chi tiết phiếu thu"
          breadcrumbs={[{ label: 'Tài chính & Điều hành' }, { label: 'Phiếu thu' }, { label: 'Chi tiết' }]}
          requirementLabel="xem phiếu thu (finance.receiptGet)"
        >
          <ReceiptDetailPage />
        </PermissionGate>
      </Suspense>
    ),
  },
];
