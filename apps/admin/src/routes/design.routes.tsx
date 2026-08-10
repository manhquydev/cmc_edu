// Design-system showcase lab (observation page; deletable after review).
// Only imports from @cmc/ui (one-door lint) — never @astryxdesign/core.

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';

const DesignShowcasePage = lazy(() => import('../pages/design-showcase.js'));

export const designRoutes: RouteObject[] = [
  {
    path: 'design',
    element: (
      <Suspense fallback={<Skeleton height="100vh" radius={0} />}>
        <DesignShowcasePage />
      </Suspense>
    ),
  },
];
