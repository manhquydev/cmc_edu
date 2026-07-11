// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks attendance/check-in-out's two distinct punch paths BEFORE the
// FormPage refactor (TDD per phase-05): auto punch → `checkInOut.punch.mutate()`
// (no args) and manual-punch fallback → `manualPunch.create.mutate({ticketDate,
// note})`. Both are audit-sensitive attendance writes — mutate payloads MUST
// stay byte-identical; the refactor only changes presentation (FormPage
// header/children/actions/result slots). Result/error feedback renders via
// plain `Banner` with `description` (always visible) — NOT `ResultPanel`,
// which routes its `message` through Astryx `Banner` `children` and collapses
// behind a click (see receipt-create.tsx TODO(astryx-review)).
let punchOnSuccess: ((data: unknown) => void) | undefined;
let punchOnError: ((err: { message: string }) => void) | undefined;
const punchMutate = vi.fn();
const manualMutate = vi.fn();

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
        onError?: (err: { message: string }) => void;
      }) => {
        punchOnSuccess = options?.onSuccess;
        punchOnError = options?.onError;
        return mutationResult({ mutate: punchMutate });
      },
      'manualPunch.create.useMutation': () => mutationResult({ mutate: manualMutate }),
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

  it('shows the IP-mismatch banner and reveals the manual punch form on IP-fail error', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchOnError).toBeDefined();
    act(() => punchOnError?.({ message: 'IP address not in any authorized network' }));
    expect(screen.getByText('Ngoài mạng cơ sở')).toBeInTheDocument();
    expect(screen.getByText('Yêu cầu chấm công thủ công')).toBeInTheDocument();
  });

  it('shows the cooldown banner on a cooldown error', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() => punchOnError?.({ message: 'Cooldown active, wait' }));
    expect(screen.getByText('Chờ cooldown')).toBeInTheDocument();
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
});
