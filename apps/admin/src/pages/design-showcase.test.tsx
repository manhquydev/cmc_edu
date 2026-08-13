// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render-with-providers.js';

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_dao_tao'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import DesignShowcasePage from './design-showcase.js';

describe('DesignShowcasePage', () => {
  it('renders the four admin families plus DateTime/Workflow', () => {
    renderWithProviders(<DesignShowcasePage />, { route: '/admin/design' });

    expect(screen.getByText('StatCard / MetricCard')).toBeTruthy();
    expect(screen.getByText('StatusBadge / CountBadge')).toBeTruthy();
    expect(screen.getByText('EmptyState')).toBeTruthy();
    expect(screen.getByText('FilterBar + DataTable')).toBeTruthy();
    expect(screen.getByText('Workflow statusbar')).toBeTruthy();
    expect(screen.getByText('Date / Time / DateTime fields')).toBeTruthy();

    expect(document.querySelector('.console-mc.console-mc--static')).not.toBeNull();
    expect(document.querySelector('a.console-mc')).not.toBeNull();
    expect(document.querySelector('.console-badge-soft')).not.toBeNull();
    expect(document.querySelector('.console-count')).not.toBeNull();
    expect(document.querySelector('.console-empty-ops')).not.toBeNull();
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
  });
});
