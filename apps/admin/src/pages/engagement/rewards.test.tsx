// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Resource-centric list: index-only. Row actions navigate to form; lifecycle
// mutations live on rewards-detail (not this page).

interface RewardRow {
  id: string;
  facilityId: string;
  studentId: string;
  giftId: string;
  status: 'pending' | 'approved' | 'delivered' | 'rejected';
  redeemedAt: string;
  approvedAt: string | null;
  deliveredAt: string | null;
  rejectedAt: string | null;
  rejectionRefundedAt: string | null;
  note: string | null;
  gift: { id: string; name: string; starsRequired: number };
}

const PENDING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const APPROVED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const PENDING_ROW: RewardRow = {
  id: PENDING_ID,
  facilityId: 'f1',
  studentId: 'student-aaaa1111',
  giftId: 'g1',
  status: 'pending',
  redeemedAt: '2026-07-01T00:00:00.000Z',
  approvedAt: null,
  deliveredAt: null,
  rejectedAt: null,
  rejectionRefundedAt: null,
  note: null,
  gift: { id: 'g1', name: 'Bút bi', starsRequired: 10 },
};

const APPROVED_ROW: RewardRow = {
  ...PENDING_ROW,
  id: APPROVED_ID,
  studentId: 'student-bbbb2222',
  status: 'approved',
  approvedAt: '2026-07-02T00:00:00.000Z',
};

const rewardsListState: { data: RewardRow[]; error: { message: string } | null } = {
  data: [PENDING_ROW, APPROVED_ROW],
  error: null,
};
const listQuerySpy = vi.fn();
const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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
      'rewards.list.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(rewardsListState.data, {
          error: rewardsListState.error,
          isError: rewardsListState.error !== null,
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import RewardsQueuePage from './rewards.js';

describe('RewardsQueuePage', () => {
  beforeEach(() => {
    rewardsListState.data = [PENDING_ROW, APPROVED_ROW];
    rewardsListState.error = null;
    navigateMock.mockClear();
    listQuerySpy.mockClear();
  });

  it('renders reward rows bound to rewards.list.useQuery', () => {
    renderWithProviders(<RewardsQueuePage />);
    expect(screen.getAllByText('Bút bi')).toHaveLength(2);
    expect(listQuerySpy).toHaveBeenCalledWith({ status: undefined });
  });

  it('passes the status filter from the URL to rewards.list.useQuery', () => {
    renderWithProviders(<RewardsQueuePage />, { route: '/admin/engagement/rewards?status=pending' });
    expect(listQuerySpy).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('inbox is index-only: Mở phiếu navigates to form; no list-row Duyệt/Giao quà/Từ chối', () => {
    renderWithProviders(<RewardsQueuePage />);
    expect(screen.queryByRole('button', { name: 'Duyệt', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Giao quà', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Từ chối', exact: true })).toBeNull();

    const openButtons = screen.getAllByRole('button', { name: 'Mở phiếu' });
    expect(openButtons).toHaveLength(2);
    fireEvent.click(openButtons[0]);
    expect(navigateMock).toHaveBeenCalledWith(`/admin/engagement/rewards/${PENDING_ID}`);
  });

  it('still offers Mở phiếu for delivered/rejected rows (view-only form)', () => {
    const deliveredId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    rewardsListState.data = [
      {
        ...PENDING_ROW,
        id: deliveredId,
        status: 'delivered',
        deliveredAt: '2026-07-03T00:00:00.000Z',
      },
    ];
    renderWithProviders(<RewardsQueuePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở phiếu' }));
    expect(navigateMock).toHaveBeenCalledWith(`/admin/engagement/rewards/${deliveredId}`);
  });

  it('renders empty state when rewards.list returns no rows', () => {
    rewardsListState.data = [];
    renderWithProviders(<RewardsQueuePage />);
    expect(screen.getByText('Chưa có yêu cầu đổi quà nào')).toBeInTheDocument();
  });

  it('renders error banner when rewards.list fails', () => {
    rewardsListState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<RewardsQueuePage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});
