// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// shift-config has write mutations (shift.createGroup/createTemplate —
// shift/router.ts:77,96) but no list/read query, so the screen cannot bind
// to real data. Stays a premium coming-soon EmptyState; real build deferred
// to phase-08. Locks: no emoji text node, LineIcon clock present.
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

import ShiftConfigPage from './shift-config.js';

describe('ShiftConfigPage', () => {
  it('renders a premium coming-soon EmptyState with no emoji', () => {
    const { container } = renderWithProviders(<ShiftConfigPage />);
    expect(screen.getByText('Tính năng chưa áp dụng')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/⏰/u);
  });

  it('renders the clock LineIcon (monochrome svg, not emoji)', () => {
    const { container } = renderWithProviders(<ShiftConfigPage />);
    expect(container.querySelector('svg[data-icon="clock"]')).toBeInTheDocument();
  });
});
