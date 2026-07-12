// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Residual EmptyState screen (HR remediation phase 5, rolled in from
// `260707-0915-ui-implementation` phase-06) — no backend build here.
vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import AfterSalePage from './aftersale.js';

describe('AfterSalePage', () => {
  it('renders a premium coming-soon EmptyState with the alert LineIcon', () => {
    const { container } = renderWithProviders(<AfterSalePage />);
    expect(screen.getByText('Tính năng chưa áp dụng')).toBeInTheDocument();
    expect(container.querySelector('svg[data-icon="alert"]')).toBeInTheDocument();
  });
});
