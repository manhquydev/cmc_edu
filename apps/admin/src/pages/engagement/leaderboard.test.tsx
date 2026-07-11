// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// leaderboard has no backend (no ranked-aggregate endpoint over StarTransaction
// — scouted in plan.md) — stays a premium coming-soon EmptyState. Real build
// deferred to phase-08. Locks: no emoji text node, LineIcon trophy present.
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

import LeaderboardPage from './leaderboard.js';

describe('LeaderboardPage', () => {
  it('renders a premium coming-soon EmptyState with no emoji', () => {
    const { container } = renderWithProviders(<LeaderboardPage />);
    expect(screen.getByText('Tính năng chưa áp dụng')).toBeInTheDocument();
    // No pictographic emoji anywhere in the rendered text (locked no-emoji rule).
    expect(container.textContent).not.toMatch(/🏆|⭐|📋/u);
  });

  it('renders the trophy LineIcon (monochrome svg, not emoji)', () => {
    const { container } = renderWithProviders(<LeaderboardPage />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
