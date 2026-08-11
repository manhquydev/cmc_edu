// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const approveMutate = vi.fn();
const rejectMutate = vi.fn();

const { TICKET_ID, TICKET, dayPunches } = vi.hoisted(() => {
  const TICKET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    TICKET_ID,
    TICKET: {
      id: TICKET_ID,
      ticketDate: '2026-07-01T00:00:00.000Z',
      status: 'pending',
      note: 'đi họp',
      checkInAt: '2026-07-01T02:00:00.000Z',
      checkOutAt: null,
      appUser: { id: 'au1', fullName: 'Nguyen A', userId: 'u-owner', roles: ['sale'] },
    },
    dayPunches: [
      {
        punchAt: '2026-07-01T02:00:00.000Z',
        verification: 'geo',
        accuracyM: 25,
        geofenceDistanceM: 180,
        matchedRadiusM: 200,
      },
      {
        punchAt: '2026-07-01T02:30:00.000Z',
        verification: 'none',
        accuracyM: null,
        geofenceDistanceM: null,
        matchedRadiusM: null,
      },
    ],
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ ticketId: TICKET_ID }),
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
      'manualPunch.get.useQuery': queryResult(TICKET),
      'manualPunch.dayPunches.useQuery': queryResult(dayPunches),
      'manualPunch.approve.useMutation': () => mutationResult({ mutate: approveMutate }),
      'manualPunch.reject.useMutation': () => mutationResult({ mutate: rejectMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import CheckInTicketDetailPage from './check-in-ticket-detail.js';

describe('CheckInTicketDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form from manualPunch.get with Console grammar', () => {
    renderWithProviders(<CheckInTicketDetailPage />, { route: `/hr/checkin/${TICKET_ID}` });
    expect(screen.getByText(/Chấm công \/ Nguyen A/)).toBeInTheDocument();
    expect(screen.getByText('Thông tin phiếu')).toBeInTheDocument();
    expect(screen.getByText('Punch trong ngày')).toBeInTheDocument();
    expect(screen.getAllByText(/Chờ duyệt/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows day-punch verification badges without coords', () => {
    renderWithProviders(<CheckInTicketDetailPage />, { route: `/hr/checkin/${TICKET_ID}` });
    expect(screen.getByText('GPS')).toBeInTheDocument();
    expect(screen.getByText('Offsite')).toBeInTheDocument();
    expect(screen.getByText(/cách tâm 180m \(bán kính 200m\)/)).toBeInTheDocument();
    expect(screen.queryByText(/21\./)).toBeNull();
  });

  it('shows form HITL Duyệt/Từ chối for director on pending', () => {
    renderWithProviders(<CheckInTicketDetailPage />, { route: `/hr/checkin/${TICKET_ID}` });
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
  });

  it('calls manualPunch.approve.mutate after ConfirmDialog', () => {
    renderWithProviders(<CheckInTicketDetailPage />, { route: `/hr/checkin/${TICKET_ID}` });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
    expect(approveMutate).toHaveBeenCalledWith({ ticketId: TICKET_ID });
  });
});
