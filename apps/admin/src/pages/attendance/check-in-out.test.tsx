// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks attendance/check-in-out's two distinct punch paths + phiếu của tôi
// (HR remediation phase 5, red-team #5): auto punch → `checkInOut.punch.mutate()`
// (no args) and manual-punch fallback → `manualPunch.create.mutate({ticketDate,
// note})`. Both are audit-sensitive attendance writes — mutate payloads MUST
// stay byte-identical; the refactor only changes presentation (FormPage
// header/children/actions/result slots). Result/error feedback renders via
// plain `Banner` with `description` (always visible) — NOT `ResultPanel`,
// which routes its `message` through Astryx `Banner` `children` and collapses
// behind a click (see receipt-create.tsx TODO(astryx-review)).
//
// Error branching MUST read `err.data.appCode` (IP_NOT_ALLOWED/COOLDOWN —
// errorFormatter, apps/api/src/errors.ts's AppCodeError) — NOT string-match
// `err.message`. This is the contract-change lock for red-team #5.
let punchOnSuccess: ((data: unknown) => void) | undefined;
let punchOnError: ((err: { message: string; data?: { appCode?: string } | null }) => void) | undefined;
const punchMutate = vi.fn();
const manualMutate = vi.fn();

const myTicketsSpy = vi.fn();
let myTickets: Array<Record<string, unknown>> = [];

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'checkInOut.punch.useMutation': (options: {
        onSuccess?: (data: unknown) => void;
        onError?: (err: { message: string; data?: { appCode?: string } | null }) => void;
      }) => {
        punchOnSuccess = options?.onSuccess;
        punchOnError = options?.onError;
        return mutationResult({ mutate: punchMutate });
      },
      'manualPunch.create.useMutation': () => mutationResult({ mutate: manualMutate }),
      'manualPunch.list.useQuery': (input: unknown) => {
        myTicketsSpy(input);
        return queryResult(myTickets);
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import CheckInOutPage from './check-in-out.js';

describe('CheckInOutPage', () => {
  beforeEach(() => {
    punchMutate.mockClear();
    manualMutate.mockClear();
    myTicketsSpy.mockClear();
    myTickets = [];
  });

  it('calls checkInOut.punch.mutate with no arguments when "Chấm công" is clicked', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchMutate).toHaveBeenCalledWith();
  });

  it('renders an always-visible success banner with the punch time on punch success', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchOnSuccess).toBeDefined();
    act(() => punchOnSuccess?.({ punchAt: '2026-07-08T02:00:00.000Z' }));
    expect(screen.getByText('Đã ghi nhận')).toBeInTheDocument();
    expect(screen.getByText(/Chấm công lúc/)).toBeInTheDocument();
  });

  it('shows the IP-mismatch banner and reveals the manual punch form on appCode=IP_NOT_ALLOWED', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchOnError).toBeDefined();
    act(() =>
      punchOnError?.({
        message: 'IP address not in any authorized network. Submit a manual punch request instead.',
        data: { appCode: 'IP_NOT_ALLOWED' },
      }),
    );
    expect(screen.getByText('Ngoài mạng cơ sở')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu chấm công thủ công')).toBeInTheDocument();
  });

  it('shows the cooldown banner on appCode=COOLDOWN', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() =>
      punchOnError?.({ message: 'Cooldown: last punch was less than 5 minutes ago.', data: { appCode: 'COOLDOWN' } }),
    );
    expect(screen.getByText('Chờ cooldown')).toBeInTheDocument();
  });

  it('does NOT branch on message text alone when appCode is absent (falls through to generic error)', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() =>
      punchOnError?.({ message: 'IP address not in any authorized network', data: null }),
    );
    // No appCode on the error → generic banner, NOT the IP-mismatch banner —
    // proves the branch reads data.appCode, not message string-matching.
    expect(screen.queryByText('Ngoài mạng cơ sở')).toBeNull();
    expect(screen.getByText('Lỗi chấm công')).toBeInTheDocument();
  });

  it('shows a generic error banner with the raw message on any other error', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() => punchOnError?.({ message: 'Lỗi máy chủ không xác định' }));
    expect(screen.getByText('Lỗi chấm công')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ không xác định')).toBeInTheDocument();
  });

  it('submits manualPunch.create.mutate with a byte-identical {ticketDate, note} payload', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu chấm công thủ công' }));
    fireEvent.change(screen.getByLabelText(/^Ngày cần chấm/), { target: { value: '2026-07-08' } });
    fireEvent.change(screen.getByLabelText(/^Lý do/), { target: { value: 'Thiết bị hỏng WiFi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(manualMutate).toHaveBeenCalledWith({ ticketDate: '2026-07-08', note: 'Thiết bị hỏng WiFi' });
  });

  it('does not enable manualPunch submit with an invalid ticket date format', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu chấm công thủ công' }));
    fireEvent.change(screen.getByLabelText(/^Ngày cần chấm/), { target: { value: 'not-a-date' } });
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDisabled();
  });

  it('closes the manual punch form when "Đóng" is clicked', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu chấm công thủ công' }));
    expect(screen.getByText('Yêu cầu chấm công thủ công')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText('Yêu cầu chấm công thủ công')).toBeNull();
  });

  it('always renders the punch-without-shift invariant note', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByText('Ghi nhận không cần ca')).toBeInTheDocument();
  });

  it('queries manualPunch.list with scope=mine for the "Phiếu của tôi" section', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(myTicketsSpy).toHaveBeenCalledWith({ scope: 'mine' });
  });

  it('renders my tickets with a Vietnamese status label', () => {
    myTickets = [{ id: 't1', ticketDate: '2026-07-01T00:00:00.000Z', status: 'pending', note: 'Quên chấm' }];
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByText('Phiếu của tôi')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByText('Quên chấm')).toBeInTheDocument();
  });

  it('shows an empty state when there are no manual tickets', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByText('Chưa có yêu cầu chấm công thủ công nào.')).toBeInTheDocument();
  });
});
