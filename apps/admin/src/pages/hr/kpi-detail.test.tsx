// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const { SCORE_ID, SCORE } = vi.hoisted(() => {
  const SCORE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    SCORE_ID,
    SCORE: {
      id: SCORE_ID,
      appUserId: 'au1',
      period: '2026-08',
      status: 'submitted',
      value: 1_500_000,
      override: false,
      overrideReason: null,
      tierMissing: false,
      fullName: 'Nguyễn Văn A',
      position: 'Sale',
      appUser: {
        id: 'au1',
        fullName: 'Nguyễn Văn A',
        userId: 'u-owner',
        managerId: 'au-mgr',
        roles: ['sale'],
        position: 'Sale',
      },
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ scoreId: SCORE_ID }),
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u-director',
          roles: ['giam_doc_kinh_doanh'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'kpi.get.useQuery': queryResult(SCORE),
      'kpi.confirm.useMutation': () => mutationResult({ mutate: vi.fn() }),
      'kpi.override.useMutation': () => mutationResult({ mutate: vi.fn() }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import KpiDetailPage from './kpi-detail.js';

describe('KpiDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form from kpi.get', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    expect(screen.getByText(/Phiếu KPI/)).toBeInTheDocument();
    expect(screen.getAllByText(/Nguyễn Văn A/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1\.500\.000|1,500,000|1500000/)).toBeInTheDocument();
  });

  it('shows Xác nhận for director on submitted', () => {
    renderWithProviders(<KpiDetailPage />, { route: `/hr/kpi/${SCORE_ID}` });
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
  });
});
