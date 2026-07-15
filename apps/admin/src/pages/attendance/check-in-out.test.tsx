// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// ADR 0043 phase 7 — locks the daily in/out punch UI:
//   - "Chấm công" click → checkInOut.punch.mutate({}) (offsite reason optional).
//   - Success → button shows "Đã ghi nhận" for 5s, then auto-reverts to
//     clickable "Chấm công" (fake timers).
//   - appCode OFFSITE_REASON_REQUIRED → opens a reason modal; confirming
//     re-mutates punch({reason}).
//   - appCode COOLDOWN → cooldown banner, no modal.
//   - No manual-punch-by-arbitrary-date form anymore (ManualPunchForm removed
//     — ADR 0043 §10, "chấm bù ngày quên" bỏ hẳn).
//   - "Phiếu của tôi" shows Giờ vào/Giờ ra columns; a `rejected` row offers
//     "Gửi lại" → manualPunch.resubmit.mutate({ticketId, reason}).
//   - "Duyệt chấm công" tab only renders for canDo('manualPunch','approve').
let punchOnSuccess: ((data: unknown) => void) | undefined;
let punchOnError: ((err: { message: string; data?: { appCode?: string } | null }) => void) | undefined;
let resubmitOnError: ((err: { message: string }) => void) | undefined;
const punchMutate = vi.fn();
const resubmitMutate = vi.fn();
const approveMutate = vi.fn();
const rejectMutate = vi.fn();

const myTicketsSpy = vi.fn();
const inboxSpy = vi.fn();
let myTickets: Array<Record<string, unknown>> = [];
// Real SessionProvider + real @cmc/auth `can()` (render-with-providers.tsx
// pattern, matches shifts.test.tsx) — vary the mocked session's roles rather
// than mocking session-context.js directly.
let sessionRoles: string[] = ['sale'];

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: sessionRoles,
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
      'manualPunch.list.useQuery': (input: unknown) => {
        const scope = (input as { scope?: string })?.scope;
        if (scope === 'inbox') {
          inboxSpy(input);
          return queryResult(myTickets);
        }
        myTicketsSpy(input);
        return queryResult(myTickets);
      },
      'manualPunch.resubmit.useMutation': (options: { onError?: (err: { message: string }) => void }) => {
        resubmitOnError = options?.onError;
        return mutationResult({ mutate: resubmitMutate });
      },
      'manualPunch.approve.useMutation': () => mutationResult({ mutate: approveMutate }),
      'manualPunch.reject.useMutation': () => mutationResult({ mutate: rejectMutate }),
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
    resubmitMutate.mockClear();
    approveMutate.mockClear();
    rejectMutate.mockClear();
    myTicketsSpy.mockClear();
    inboxSpy.mockClear();
    myTickets = [];
    sessionRoles = ['sale'];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls checkInOut.punch.mutate({}) when "Chấm công" is clicked', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchMutate).toHaveBeenCalledWith({});
  });

  it('renders an always-visible success banner + button shows "Đã ghi nhận" then auto-reverts after 5s', () => {
    vi.useFakeTimers();
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchOnSuccess).toBeDefined();
    act(() => punchOnSuccess?.({ punchAt: '2026-07-08T02:00:00.000Z' }));

    expect(screen.getByText('Đã ghi nhận')).toBeInTheDocument();
    expect(screen.getByText(/Chấm công lúc/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chấm công' })).toBeNull();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('button', { name: 'Chấm công' })).toBeInTheDocument();
  });

  it('appCode=OFFSITE_REASON_REQUIRED opens the reason modal (no ManualPunchForm)', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    expect(punchOnError).toBeDefined();
    act(() =>
      punchOnError?.({
        message: 'Ngoài mạng cơ sở — cần nhập lý do.',
        data: { appCode: 'OFFSITE_REASON_REQUIRED' },
      }),
    );
    expect(screen.getByText('Ngoài mạng cơ sở — cần nhập lý do')).toBeInTheDocument();
    // No arbitrary-date manual punch form exists anymore.
    expect(screen.queryByLabelText(/^Ngày cần chấm/)).toBeNull();
  });

  it('confirming the offsite reason modal re-mutates punch({reason})', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() => punchOnError?.({ message: 'x', data: { appCode: 'OFFSITE_REASON_REQUIRED' } }));

    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đi công tác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(punchMutate).toHaveBeenLastCalledWith({ reason: 'Đi công tác' });
  });

  it('shows the cooldown banner on appCode=COOLDOWN, not the offsite-reason banner', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() => punchOnError?.({ message: 'Cooldown: last punch was less than 10 seconds ago.', data: { appCode: 'COOLDOWN' } }));
    expect(screen.getByText('Chờ cooldown')).toBeInTheDocument();
    expect(screen.queryByText('Ngoài mạng cơ sở — cần nhập lý do')).toBeNull();
  });

  it('does NOT branch on message text alone when appCode is absent (falls through to generic error)', () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    act(() => punchOnError?.({ message: 'Ngoài mạng cơ sở', data: null }));
    expect(screen.queryByText('Ngoài mạng cơ sở — cần nhập lý do')).toBeNull();
    expect(screen.getByText('Lỗi chấm công')).toBeInTheDocument();
  });

  it('always renders the punch-without-shift invariant note', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByText('Ghi nhận không cần ca')).toBeInTheDocument();
  });

  it('queries manualPunch.list with scope=mine for "Phiếu của tôi"', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(myTicketsSpy).toHaveBeenCalledWith({ scope: 'mine' });
  });

  it('renders my tickets with Giờ vào/Giờ ra columns and a Vietnamese status label', () => {
    myTickets = [
      {
        id: 't1',
        ticketDate: '2026-07-01T00:00:00.000Z',
        status: 'pending',
        note: 'Quên chấm',
        checkInAt: '2026-07-01T02:00:00.000Z',
        checkOutAt: '2026-07-01T10:00:00.000Z',
      },
    ];
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByText('Phiếu của tôi')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByText('Quên chấm')).toBeInTheDocument();
  });

  it('a rejected ticket shows "Gửi lại"; confirming calls manualPunch.resubmit.mutate', () => {
    myTickets = [
      { id: 't2', ticketDate: '2026-07-02T00:00:00.000Z', status: 'rejected', note: 'thiếu', checkInAt: null, checkOutAt: null },
    ];
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    fireEvent.change(screen.getByLabelText(/^Lý do gửi lại/), { target: { value: 'Đã bổ sung' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại yêu cầu' }));
    expect(resubmitMutate).toHaveBeenCalledWith({ ticketId: 't2', reason: 'Đã bổ sung' });
  });

  it('resubmit failure keeps the dialog open with the typed reason intact (code-review fix)', () => {
    myTickets = [
      { id: 't2b', ticketDate: '2026-07-02T00:00:00.000Z', status: 'rejected', note: 'thiếu', checkInAt: null, checkOutAt: null },
    ];
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    fireEvent.change(screen.getByLabelText(/^Lý do gửi lại/), { target: { value: 'Đã bổ sung' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại yêu cầu' }));
    expect(resubmitOnError).toBeDefined();
    act(() => resubmitOnError?.({ message: 'Lỗi máy chủ' }));
    // The textarea must still show what the user typed — not cleared by the
    // confirm click, only clearable on success or explicit cancel.
    expect(screen.getByLabelText(/^Lý do gửi lại/)).toHaveValue('Đã bổ sung');
  });

  it('a pending ticket does NOT show "Gửi lại"', () => {
    myTickets = [{ id: 't3', ticketDate: '2026-07-03T00:00:00.000Z', status: 'pending', note: '', checkInAt: null, checkOutAt: null }];
    renderWithProviders(<CheckInOutPage />);
    expect(screen.queryByRole('button', { name: 'Gửi lại' })).toBeNull();
  });

  it('shows an empty state when there are no manual tickets', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByText('Chưa có yêu cầu chấm công thủ công nào.')).toBeInTheDocument();
  });

  it('"Duyệt chấm công" tab is absent for a role without manualPunch.approve', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<CheckInOutPage />);
    expect(screen.queryByRole('button', { name: 'Duyệt chấm công' })).toBeNull();
  });

  it('"Duyệt chấm công" tab renders and queries scope=inbox for giam_doc_kinh_doanh', () => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt chấm công' }));
    expect(inboxSpy).toHaveBeenCalledWith({ scope: 'inbox' });
  });
});
