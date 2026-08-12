import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';
import { PermissionGate } from '../lib/permission-gate.js';

const CrmPipelinePage = lazy(() => import('../pages/crm/pipeline.js'));
const OpportunityDetailPage = lazy(() => import('../pages/crm/opportunity-detail.js'));
const CrmBulkImportPage = lazy(() => import('../pages/crm/bulk-import.js'));
const CrmReportPage = lazy(() => import('../pages/crm/report.js'));
// Residual EmptyState screens rolled in from `260707-0915-ui-implementation`
// phase-06 (HR remediation phase 5, 2026-07-12) — no backend yet, see the
// page files' own header comments.
const PostSaleMeetingPage = lazy(() => import('../pages/crm/post-sale-meeting.js'));
const AfterSalePage = lazy(() => import('../pages/crm/aftersale.js'));
const AfterSaleDetailPage = lazy(() => import('../pages/crm/aftersale-detail.js'));

function Fallback() {
  return <ComingSoon />;
}

export const crmRoutes: RouteObject[] = [
  {
    index: true,
    element: (
      <Suspense fallback={<Fallback />}>
        <CrmPipelinePage />
      </Suspense>
    ),
  },
  {
    path: 'opportunities/:id',
    element: (
      <Suspense fallback={<Fallback />}>
        {/* Match API: crm.opportunityGet → requirePermission('crm','opportunityList'). */}
        <PermissionGate
          module="crm"
          action="opportunityList"
          title="Chi tiết cơ hội"
          breadcrumbs={[{ label: 'Kinh doanh' }, { label: 'Pipeline CRM' }, { label: 'Chi tiết' }]}
          requirementLabel="xem cơ hội CRM (crm.opportunityList)"
        >
          <OpportunityDetailPage />
        </PermissionGate>
      </Suspense>
    ),
  },
  {
    path: 'bulk-import',
    element: (
      <Suspense fallback={<Fallback />}>
        <PermissionGate
          module="crm"
          action="opportunityCreate"
          title="Nhập lead hàng loạt"
          breadcrumbs={[
            { label: 'Kinh doanh' },
            { label: 'Pipeline CRM' },
            { label: 'Nhập hàng loạt' },
          ]}
          requirementLabel="tạo cơ hội CRM (crm.opportunityCreate)"
        >
          <CrmBulkImportPage />
        </PermissionGate>
      </Suspense>
    ),
  },
  {
    path: 'report',
    element: (
      <Suspense fallback={<Fallback />}>
        <PermissionGate
          module="crm"
          action="report"
          title="Báo cáo tuyển sinh"
          breadcrumbs={[
            { label: 'Kinh doanh' },
            { label: 'Pipeline CRM' },
            { label: 'Báo cáo' },
          ]}
          requirementLabel="xem báo cáo tuyển sinh (crm.report)"
        >
          <CrmReportPage />
        </PermissionGate>
      </Suspense>
    ),
  },
  {
    path: 'post-sale-meeting',
    element: (
      <Suspense fallback={<Fallback />}>
        <PostSaleMeetingPage />
      </Suspense>
    ),
  },
  {
    path: 'aftersale',
    element: (
      <Suspense fallback={<Fallback />}>
        <AfterSalePage />
      </Suspense>
    ),
  },
  {
    path: 'aftersale/:caseId',
    element: (
      <Suspense fallback={<Fallback />}>
        <PermissionGate
          module="afterSale"
          action="manage"
          title="Case sau bán"
          breadcrumbs={[{ label: 'CRM' }, { label: 'Sau bán' }, { label: 'Chi tiết' }]}
          requirementLabel="quản lý sau bán (afterSale.manage)"
        >
          <AfterSaleDetailPage />
        </PermissionGate>
      </Suspense>
    ),
  },
];
