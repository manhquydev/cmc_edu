// Canonical /go/:entity/:id module — keep this file as the only place that
// owns the go resolver route. routes/index.tsx only assembles module arrays.

import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';

const GoResolverPage = lazy(() => import('../pages/go-resolver.js'));

export const goRoutes: RouteObject[] = [
  {
    path: 'go/:entity/:id',
    element: (
      <Suspense fallback={<Skeleton height={200} radius={0} />}>
        <GoResolverPage />
      </Suspense>
    ),
  },
];
