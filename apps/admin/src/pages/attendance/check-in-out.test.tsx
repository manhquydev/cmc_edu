// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// ADR 0043 phase 7 + geofence GPS:
//   - "Chấm công" click → capture geo (optional) then punch.mutate.
//   - Success → button shows "Đã ghi nhận" for 5s, then auto-reverts.
//   - appCode OFFSITE_REASON_REQUIRED → opens reason modal; confirming
//     re-mutates punch with same captured geo.
//   - Approve opens detail Dialog with day punches (not plain ConfirmDialog).
let punchOnSuccess: ((data: unknown) => void) | undefined;
let punchOnError: ((err: { message: string; data?: { appCode?: string; appData?: { geoThresholdM?: number } } | null }) => void) | undefined;
let resubmitOnError: ((err: { message: string }) => void) | undefined;
const punchMutate = vi.fn();
const resubmitMutate = vi.fn();
const approveMutate = vi.fn();
const rejectMutate = vi.fn();

const myTicketsSpy = vi.fn();
const inboxSpy = vi.fn();
const dayPunchesSpy = vi.fn();
const geoSummarySpy = vi.fn();
let myTickets: Array<Record<string, unknown>> = [];
let dayPunches: Array<Record<string, unknown>> = [];
let geoSummary: Array<Record<string, unknown>> = [];
// Real SessionProvider + real @cmc/auth `can()` (render-with-providers.tsx
// pattern, matches shifts.test.tsx) — vary the mocked session's roles rather
// than mocking session-context.js directly.
let sessionRoles: string[] = ['sale'];

const captureGeoMock = vi.fn<() => Promise<{ lat: number; lng: number; accuracyM: number } | null>>();

vi.mock('../../lib/capture-geolocation.js', () => ({
  captureGeolocation: () => captureGeoMock(),
}));

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
        onError?: (err: {
          message: string;
          data?: { appCode?: string; appData?: { geoThresholdM?: number } } | null;
        }) => void;
      }) => {
        punchOnSuccess = options?.onSuccess;
        punchOnError = options?.onError;
        return mutationResult({ mutate: punchMutate });
      },
      'checkInOut.geoPunchSummary.useQuery': (input: unknown) => {
        geoSummarySpy(input);
        return queryResult(geoSummary);
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
      'manualPunch.dayPunches.useQuery': (input: unknown, opts?: { enabled?: boolean }) => {
        dayPunchesSpy(input);
        if (opts?.enabled === false) return queryResult([]);
        return queryResult(dayPunches);
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

import CheckInOutPage, { offsiteGeoHint } from './check-in-out.js';

describe('CheckInOutPage', () => {
  beforeEach(() => {
    punchMutate.mockClear();
    resubmitMutate.mockClear();
    approveMutate.mockClear();
    rejectMutate.mockClear();
    myTicketsSpy.mockClear();
    inboxSpy.mockClear();
    dayPunchesSpy.mockClear();
    geoSummarySpy.mockClear();
    myTickets = [];
    dayPunches = [];
    geoSummary = [];
    sessionRoles = ['sale'];
    captureGeoMock.mockReset();
    captureGeoMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls checkInOut.punch.mutate({}) when geo denied/null', async () => {
    captureGeoMock.mockResolvedValue(null);
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() => expect(punchMutate).toHaveBeenCalledWith({}));
  });

  it('sends geo when capture succeeds', async () => {
    captureGeoMock.mockResolvedValue({ lat: 21.0, lng: 105.8, accuracyM: 30 });
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() =>
      expect(punchMutate).toHaveBeenCalledWith({ geo: { lat: 21.0, lng: 105.8, accuracyM: 30 } }),
    );
  });

  it('renders an always-visible success banner + button shows "Đã ghi nhận" then auto-reverts after 5s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() => expect(punchOnSuccess).toBeDefined());
    act(() => punchOnSuccess?.({ punchAt: '2026-07-08T02:00:00.000Z' }));

    expect(screen.getByText('Đã ghi nhận')).toBeInTheDocument();
    expect(screen.getByText(/Chấm công lúc/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chấm công' })).toBeNull();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('button', { name: 'Chấm công' })).toBeInTheDocument();
  });

  it('appCode=OFFSITE_REASON_REQUIRED opens the reason modal (no ManualPunchForm)', async () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() => expect(punchOnError).toBeDefined());
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

  it('confirming the offsite reason modal re-mutates punch with same geo', async () => {
    captureGeoMock.mockResolvedValue({ lat: 21.1, lng: 105.9, accuracyM: 40 });
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() => expect(punchMutate).toHaveBeenCalled());
    act(() => punchOnError?.({ message: 'x', data: { appCode: 'OFFSITE_REASON_REQUIRED' } }));

    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đi công tác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(punchMutate).toHaveBeenLastCalledWith({
      reason: 'Đi công tác',
      geo: { lat: 21.1, lng: 105.9, accuracyM: 40 },
    });
  });

  it('shows the cooldown banner on appCode=COOLDOWN, not the offsite-reason banner', async () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() => expect(punchOnError).toBeDefined());
    act(() => punchOnError?.({ message: 'Cooldown: last punch was less than 10 seconds ago.', data: { appCode: 'COOLDOWN' } }));
    expect(screen.getByText('Chờ cooldown')).toBeInTheDocument();
    expect(screen.queryByText('Ngoài mạng cơ sở — cần nhập lý do')).toBeNull();
  });

  it('does NOT branch on message text alone when appCode is absent (falls through to generic error)', async () => {
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Chấm công' }));
    await waitFor(() => expect(punchOnError).toBeDefined());
    act(() => punchOnError?.({ message: 'Ngoài mạng cơ sở', data: null }));
    expect(screen.queryByText('Ngoài mạng cơ sở — cần nhập lý do')).toBeNull();
    expect(screen.getByText('Lỗi chấm công')).toBeInTheDocument();
  });

  it('offsiteGeoHint covers denied / accuracy / outside cases', () => {
    expect(offsiteGeoHint(null, 200)).toMatch(/Không lấy được vị trí/);
    expect(offsiteGeoHint({ lat: 1, lng: 2, accuracyM: 350 }, 200)).toMatch(/vượt ngưỡng 200m/);
    expect(offsiteGeoHint({ lat: 1, lng: 2, accuracyM: 30 }, 200)).toMatch(/ngoài vùng/);
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

  it('inbox tab "Hàng chờ phiếu" is absent for a role without manualPunch.approve', () => {
    sessionRoles = ['sale'];
    renderWithProviders(<CheckInOutPage />);
    expect(screen.queryByRole('button', { name: 'Hàng chờ phiếu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duyệt chấm công' })).toBeNull();
  });

  it('inbox tab "Hàng chờ phiếu" queries scope=inbox for giam_doc_kinh_doanh', () => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ phiếu' }));
    expect(inboxSpy).toHaveBeenCalledWith({ scope: 'inbox' });
    expect(geoSummarySpy).toHaveBeenCalledWith({ days: 30 });
  });

  it('primary punch surface is a single large CTA card (resource check-in, not dual apps)', () => {
    renderWithProviders(<CheckInOutPage />);
    expect(screen.getByTestId('check-in-punch-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chấm công' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chấm công' })).toBeInTheDocument();
    // Tab hierarchy under one resource page — not a separate "Duyệt chấm công" product.
    expect(screen.getByRole('button', { name: 'Tự chấm' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt chấm công' })).toBeNull();
  });

  it('approve detail dialog shows verification badges and distance snapshot, not coords', () => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    myTickets = [
      {
        id: 't-appr',
        ticketDate: '2026-07-01T00:00:00.000Z',
        status: 'pending',
        note: 'đi họp',
        checkInAt: '2026-07-01T02:00:00.000Z',
        checkOutAt: null,
        appUser: { fullName: 'Nguyen A' },
      },
    ];
    dayPunches = [
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
    ];
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ phiếu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(screen.getByText('GPS')).toBeInTheDocument();
    expect(screen.getByText('Offsite')).toBeInTheDocument();
    expect(screen.getByText(/cách tâm 180m \(bán kính 200m\)/)).toBeInTheDocument();
    expect(screen.queryByText(/21\./)).toBeNull();
    expect(screen.getByText('Chấm công GPS gần đây')).toBeInTheDocument();
  });

  it('geoPunchSummary empty state', () => {
    sessionRoles = ['giam_doc_kinh_doanh'];
    geoSummary = [];
    renderWithProviders(<CheckInOutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ phiếu' }));
    expect(screen.getByText('Không có punch GPS 30 ngày qua.')).toBeInTheDocument();
  });
});
