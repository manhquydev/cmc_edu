// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the new rewards redemption queue (phase-01, stub→REAL upgrade). The
// backend (`rewards.list` + `approve`/`deliver`/`reject`) already exists
// (apps/api/src/rewards/reward-router.ts) — this test drives the UI contract:
// list binding, status-filter → query input, and each lifecycle action
// calling its mutation with a byte-identical `{rewardId}` payload + invalidate.
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

const PENDING_ROW: RewardRow = {
  id: 'r-pending',
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
  id: 'r-approved',
  studentId: 'student-bbbb2222',
  status: 'approved',
  approvedAt: '2026-07-02T00:00:00.000Z',
};

const rewardsListState: { data: RewardRow[]; error: { message: string } | null } = {
  data: [PENDING_ROW, APPROVED_ROW],
  error: null,
};
const listQuerySpy = vi.fn();
const approveMutate = vi.fn();
const deliverMutate = vi.fn();
const rejectMutate = vi.fn();
let approveOnSuccess: (() => void) | undefined;
let deliverOnSuccess: (() => void) | undefined;
let rejectOnSuccess: (() => void) | undefined;

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
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
      'rewards.approve.useMutation': (options: { onSuccess?: () => void }) => {
        approveOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: approveMutate });
      },
      'rewards.deliver.useMutation': (options: { onSuccess?: () => void }) => {
        deliverOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: deliverMutate });
      },
      'rewards.reject.useMutation': (options: { onSuccess?: () => void }) => {
        rejectOnSuccess = options?.onSuccess;
        return mutationResult({ mutate: rejectMutate });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import RewardsQueuePage from './rewards.js';

describe('RewardsQueuePage', () => {
  beforeEach(() => {
    rewardsListState.data = [PENDING_ROW, APPROVED_ROW];
    rewardsListState.error = null;
  });

  it('renders reward rows bound to rewards.list.useQuery', () => {
    renderWithProviders(<RewardsQueuePage />);
    expect(screen.getAllByText('Bút bi')).toHaveLength(2);
    expect(listQuerySpy).toHaveBeenCalledWith({ status: undefined });
  });

  it('passes the status filter from the URL to rewards.list.useQuery', () => {
    renderWithProviders(<RewardsQueuePage />, { route: '/engagement/rewards?status=pending' });
    expect(listQuerySpy).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('approve action calls rewards.approve.mutate({rewardId}) and invalidates on success only for a pending row', () => {
    const invalidateSpy = trpc.useUtils().rewards.list.invalidate;
    renderWithProviders(<RewardsQueuePage />);

    const approveButtons = screen.getAllByRole('button', { name: 'Duyệt' });
    expect(approveButtons).toHaveLength(1); // only the pending row shows Duyệt
    fireEvent.click(approveButtons[0]);

    expect(approveMutate).toHaveBeenCalledWith({ rewardId: 'r-pending' });
    expect(invalidateSpy).not.toHaveBeenCalled();
    act(() => approveOnSuccess?.());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('deliver action calls rewards.deliver.mutate({rewardId}) only for an approved row', () => {
    renderWithProviders(<RewardsQueuePage />);
    const deliverButtons = screen.getAllByRole('button', { name: 'Giao quà' });
    expect(deliverButtons).toHaveLength(1); // only the approved row shows Giao quà
    fireEvent.click(deliverButtons[0]);
    expect(deliverMutate).toHaveBeenCalledWith({ rewardId: 'r-approved' });
    act(() => deliverOnSuccess?.());
  });

  it('reject action calls rewards.reject.mutate({rewardId}) for pending and approved rows', () => {
    renderWithProviders(<RewardsQueuePage />);
    const rejectButtons = screen.getAllByRole('button', { name: 'Từ chối' });
    expect(rejectButtons).toHaveLength(2); // pending + approved both show Từ chối
    fireEvent.click(rejectButtons[0]);
    expect(rejectMutate).toHaveBeenCalledWith({ rewardId: 'r-pending' });
    act(() => rejectOnSuccess?.());
  });

  it('gates delivered/rejected rows to show no lifecycle actions', () => {
    rewardsListState.data = [
      { ...PENDING_ROW, id: 'r-delivered', status: 'delivered', deliveredAt: '2026-07-03T00:00:00.000Z' },
      { ...PENDING_ROW, id: 'r-rejected', status: 'rejected', rejectedAt: '2026-07-03T00:00:00.000Z' },
    ];
    renderWithProviders(<RewardsQueuePage />);
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Giao quà' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();
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
