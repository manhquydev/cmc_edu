// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Residual EmptyState screen (HR remediation phase 5, rolled in from
// `260707-0915-ui-implementation` phase-06). Flagged reason: `finance.
// refundCreate` mutation exists (apps/api/src/finance/router.ts) but no
// receipt-search/approval UX exists yet — skip-build branch.
vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_kinh_doanh'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import RefundPage from './refund.js';

describe('RefundPage', () => {
  it('renders a premium coming-soon EmptyState flagging the missing UX (not missing mutation)', () => {
    const { container } = renderWithProviders(<RefundPage />);
    expect(screen.getByText('Tính năng chưa áp dụng')).toBeInTheDocument();
    expect(screen.getByText(/chưa có màn tìm phiếu thu/)).toBeInTheDocument();
    expect(container.querySelector('svg[data-icon="card"]')).toBeInTheDocument();
  });
});
