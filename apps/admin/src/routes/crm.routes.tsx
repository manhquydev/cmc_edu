import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ComingSoon } from '../pages/coming-soon.js';

const CrmPipelinePage = lazy(() => import('../pages/crm/pipeline.js'));
const OpportunityDetailPage = lazy(() => import('../pages/crm/opportunity-detail.js'));

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
        <OpportunityDetailPage />
      </Suspense>
    ),
  },
];
