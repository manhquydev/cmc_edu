// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const approveMutate = vi.fn();
const rejectMutate = vi.fn();

const { REG_ID, REG } = vi.hoisted(() => {
  const REG_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const GROUP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const TPL_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  return {
    REG_ID,
    REG: {
      id: REG_ID,
      fromDate: '2099-08-12T00:00:00.000Z',
      toDate: '2099-08-18T00:00:00.000Z',
      status: 'submitted',
      selectionMode: 'SINGLE',
      rejectReason: null,
      appUser: { id: 'au1', fullName: 'Nguyễn Văn A', userId: 'u-owner' },
      shiftGroup: {
        id: GROUP_ID,
        name: 'Kinh doanh',
        type: 'KINH_DOANH',
        selectionMode: 'SINGLE',
        templates: [{ id: TPL_ID, name: 'Ca 1', startTime: '08:30', endTime: '18:00' }],
      },
      entries: [{ id: 'e1', date: '2099-08-12', shiftTemplateId: TPL_ID }],
    },
  };
});

// Avoid nested MemoryRouter (renderWithProviders already mounts RouterProvider).
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ registrationId: REG_ID }),
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
      'shift.get.useQuery': queryResult(REG),
      'shift.approve.useMutation': () => mutationResult({ mutate: approveMutate }),
      'shift.reject.useMutation': () => mutationResult({ mutate: rejectMutate }),
      'shift.cancel.useMutation': () => mutationResult({ mutate: vi.fn() }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ShiftsDetailPage from './shifts-detail.js';

describe('ShiftsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form for a registration from shift.get', () => {
    renderWithProviders(<ShiftsDetailPage />, { route: `/hr/shifts/${REG_ID}` });
    expect(screen.getByText(/Work Schedule \/ Nguyễn Văn A/)).toBeInTheDocument();
    expect(screen.getAllByText(/Kinh doanh/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Chờ duyệt/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Tổng ca làm việc: 1/)).toBeInTheDocument();
    // Console form grammar (not one-off statusbar CSS)
    expect(screen.getByText('Thông tin phiếu')).toBeInTheDocument();
    expect(screen.getByText('Đăng ký lịch làm việc')).toBeInTheDocument();
  });

  it('shows Duyệt for matching director on submitted', () => {
    renderWithProviders(<ShiftsDetailPage />, { route: `/hr/shifts/${REG_ID}` });
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  });

  it('keeps reject action on form for director (resource-centric HITL)', () => {
    renderWithProviders(<ShiftsDetailPage />, { route: `/hr/shifts/${REG_ID}` });
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
  });

  it('calls shift.approve.mutate({registrationId}) after ConfirmDialog', () => {
    renderWithProviders(<ShiftsDetailPage />, { route: `/hr/shifts/${REG_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).toHaveBeenCalledWith({ registrationId: REG_ID });
  });
});
