// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation, useRoutes } from 'react-router-dom';
import { renderWithProviders } from '../test/render-with-providers.js';

// Phase 5: receipt detail sections are durable URLs under /finance/:id.
// Base /finance/:id redirects (replace) to the overview section; unknown
// sections fall through to route-level not-found.

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: ['super_admin'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

vi.mock('../pages/finance/receipt-detail.js', () => ({ default: () => <div>RECEIPT_DETAIL_PAGE</div> }));

const { financeRoutes } = await import('./finance.routes.js');

function FinanceRoutesHarness() {
  const location = useLocation();
  const routed = useRoutes([
    { path: '/finance', children: financeRoutes },
    { path: '*', element: <div>NOT_FOUND_MARKER</div> },
  ]);
  return (
    <>
      <div data-testid="location-marker">{location.pathname}{location.search}</div>
      {routed}
    </>
  );
}

function renderFinance(route: string) {
  return renderWithProviders(<FinanceRoutesHarness />, { route });
}

describe('financeRoutes — durable receipt sections (Phase 5)', () => {
  it('base receipt detail redirects (replace) to the overview section', async () => {
    renderFinance('/finance/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?page=2&status=approved');
    expect(await screen.findByText('RECEIPT_DETAIL_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location-marker')).toHaveTextContent(
      '/finance/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/overview?page=2&status=approved',
    );
  });

  it('base receipt redirect replaces the history entry', async () => {
    const { router } = renderFinance('/before');
    await router.navigate('/finance/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?status=approved');
    expect(await screen.findByText('RECEIPT_DETAIL_PAGE')).toBeInTheDocument();
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/before');
  });

  it('resolves the order-lines section subpath', async () => {
    renderFinance('/finance/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/order-lines');
    expect(await screen.findByText('RECEIPT_DETAIL_PAGE')).toBeInTheDocument();
  });

  it('unknown receipt sections fall through to route-level not-found', async () => {
    renderFinance('/finance/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bogus');
    expect(await screen.findByText('NOT_FOUND_MARKER')).toBeInTheDocument();
    expect(screen.queryByText('RECEIPT_DETAIL_PAGE')).not.toBeInTheDocument();
  });
});
