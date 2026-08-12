// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const approveMutate = vi.fn();
const deliverMutate = vi.fn();
const rejectMutate = vi.fn();

const { REWARD_ID, REWARD } = vi.hoisted(() => {
  const REWARD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    REWARD_ID,
    REWARD: {
      id: REWARD_ID,
      studentId: 'student-aaaa1111',
      status: 'pending',
      redeemedAt: '2026-07-01T00:00:00.000Z',
      note: null,
      gift: { id: 'g1', name: 'Bút bi', starsRequired: 10 },
    },
  };
});

let rewardState = { ...REWARD };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ rewardId: REWARD_ID }),
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u-staff',
          roles: ['sale'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'rewards.get.useQuery': () => queryResult(rewardState),
      'rewards.approve.useMutation': () => mutationResult({ mutate: approveMutate }),
      'rewards.deliver.useMutation': () => mutationResult({ mutate: deliverMutate }),
      'rewards.reject.useMutation': () => mutationResult({ mutate: rejectMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import RewardsDetailPage from './rewards-detail.js';

describe('RewardsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rewardState = { ...REWARD, status: 'pending' };
  });

  it('renders form from rewards.get with Console grammar', () => {
    renderWithProviders(<RewardsDetailPage />, {
      route: `/admin/engagement/rewards/${REWARD_ID}`,
    });
    expect(screen.getByText(/Đổi quà \/ Bút bi/)).toBeInTheDocument();
    expect(screen.getByText('Thông tin phiếu')).toBeInTheDocument();
    expect(screen.getAllByText(/Chờ duyệt/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows form HITL Duyệt/Từ chối for pending', () => {
    renderWithProviders(<RewardsDetailPage />, {
      route: `/admin/engagement/rewards/${REWARD_ID}`,
    });
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Giao quà' })).toBeNull();
  });

  it('calls rewards.approve.mutate after ConfirmDialog', () => {
    renderWithProviders(<RewardsDetailPage />, {
      route: `/admin/engagement/rewards/${REWARD_ID}`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).toHaveBeenCalledWith({ rewardId: REWARD_ID });
  });

  it('shows Giao quà for approved status', () => {
    rewardState = { ...REWARD, status: 'approved' };
    renderWithProviders(<RewardsDetailPage />, {
      route: `/admin/engagement/rewards/${REWARD_ID}`,
    });
    expect(screen.getByRole('button', { name: 'Giao quà' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
  });

  it('calls rewards.deliver.mutate after ConfirmDialog on approved', () => {
    rewardState = { ...REWARD, status: 'approved' };
    renderWithProviders(<RewardsDetailPage />, {
      route: `/admin/engagement/rewards/${REWARD_ID}`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Giao quà' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Giao quà' }));
    expect(deliverMutate).toHaveBeenCalledWith({ rewardId: REWARD_ID });
  });

  it('hides lifecycle actions when delivered', () => {
    rewardState = { ...REWARD, status: 'delivered' };
    renderWithProviders(<RewardsDetailPage />, {
      route: `/admin/engagement/rewards/${REWARD_ID}`,
    });
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Giao quà' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();
  });
});
