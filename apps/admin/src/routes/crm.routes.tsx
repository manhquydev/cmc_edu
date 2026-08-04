import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';
import { PermissionGate } from '../lib/permission-gate.js';

const CrmPipelinePage = lazy(() => import('../pages/crm/pipeline.js'));
const OpportunityDetailPage = lazy(() => import('../pages/crm/opportunity-detail.js'));
// Residual EmptyState screens rolled in from `260707-0915-ui-implementation`
// phase-06 (HR remediation phase 5, 2026-07-12) — no backend yet, see the
// page files' own header comments.
const PostSaleMeetingPage = lazy(() => import('../pages/crm/post-sale-meeting.js'));
const AfterSalePage = lazy(() => import('../pages/crm/aftersale.js'));

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
];
