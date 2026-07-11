// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// network-ip has no management backend (FacilityNetwork model is read-only
// during checkin punch — checkin/router.ts:48 — no admin CRUD endpoint).
// Stays a premium coming-soon EmptyState; real build deferred to phase-08.
// Locks: no emoji text node, LineIcon globe present.
vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
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

import NetworkIpPage from './network-ip.js';

describe('NetworkIpPage', () => {
  it('renders a premium coming-soon EmptyState with no emoji', () => {
    const { container } = renderWithProviders(<NetworkIpPage />);
    expect(screen.getByText('Tính năng chưa áp dụng')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/🌐/u);
  });

  it('renders the globe LineIcon (monochrome svg, not emoji)', () => {
    const { container } = renderWithProviders(<NetworkIpPage />);
    expect(container.querySelector('svg[data-icon="globe"]')).toBeInTheDocument();
  });
});
