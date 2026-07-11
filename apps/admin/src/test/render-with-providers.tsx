import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../lib/session-context.js';

// Standard render wrapper for admin screen tests: MemoryRouter (MetricCard/
// TaskRow render react-router <Link>), a retry-off QueryClient, and the real
// SessionProvider. When the test mocks `../lib/trpc.js`, SessionProvider's
// `trpc.session.me.useQuery` resolves from the mock — seed `session.me.useQuery`
// in the trpc mock to control the current user.
export function renderWithProviders(ui: ReactElement, opts: { route?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <MemoryRouter initialEntries={[opts.route ?? '/']}>{ui}</MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
}
