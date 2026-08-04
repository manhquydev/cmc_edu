import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@cmc/ui';
import { SessionProvider } from '../lib/session-context.js';

// Standard render wrapper for admin screen tests.
// Uses createMemoryRouter (data router) so useBlocker / leave-guards work;
// ToastProvider covers useToast; SessionProvider uses mocked trpc when present.
export function renderWithProviders(ui: ReactElement, opts: { route?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '*', element: ui }],
    { initialEntries: [opts.route ?? '/'] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
