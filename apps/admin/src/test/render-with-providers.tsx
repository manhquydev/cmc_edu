import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@cmc/ui';
import { SessionProvider } from '../lib/session-context.js';

// Standard render wrapper for admin screen tests.
// Uses createMemoryRouter (data router) so useBlocker / leave-guards work;
// ToastProvider covers useToast; SessionProvider uses mocked trpc when present.
// `routes` overrides the default catch-all when a page test needs real path
// params (:id/:section) to be populated from the URL.
export function renderWithProviders(
  ui: ReactElement,
  opts: { route?: string; routes?: RouteObject[] } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    opts.routes ?? [{ path: '*', element: ui }],
    { initialEntries: [opts.route ?? '/'] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return Object.assign(view, { router });
}
