// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the post-sale parent-meeting screen wired to the real
// `parentMeeting` router (list/schedule/complete/cancel —
// apps/api/src/meeting/router.ts):
// - list renders from the server response (never references `remindedAt` —
//   that column is dropped in phase 10 and the router never returns it)
// - the status filter re-queries with the chosen status
// - the "Đặt lịch họp" dialog picks a student via the shared StudentPicker
//   and calls `parentMeeting.schedule.mutate` with {studentId, scheduledAt}
// - the double-booking `warning` the mutation can return is surfaced inline,
//   non-fatally (the dialog does NOT re-show an error)
// - per-scheduled-row actions (Hoàn thành/Hủy) call their matching mutation
interface MeetingRowMock {
  id: string;
  studentId: string;
  studentName: string | null;
  scheduledAt: string;
  status: string;
  result: string | null;
  createdAt: string;
}

// Deliberately distinct from the meeting rows' student names below so the
// picker's search-result text can never collide with a list row's text.
const STUDENT_RESULTS = [{ id: 'st-pick', fullName: 'Lê Thị C', lifecycle: 'active' }];

const MEETING_SCHEDULED: MeetingRowMock = {
  id: 'meet-1',
  studentId: 'st-1',
  studentName: 'Nguyễn Văn A',
  scheduledAt: '2026-08-01T03:00:00.000Z',
  status: 'scheduled',
  result: null,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const MEETING_DONE: MeetingRowMock = {
  id: 'meet-2',
  studentId: 'st-2',
  studentName: 'Trần Thị B',
  scheduledAt: '2026-07-15T03:00:00.000Z',
  status: 'done',
  result: 'Phụ huynh hài lòng',
  createdAt: '2026-07-01T00:00:00.000Z',
};

const listState: { data: { items: MeetingRowMock[]; total: number; page: number; pageSize: number } } = {
  data: { items: [MEETING_SCHEDULED, MEETING_DONE], total: 2, page: 1, pageSize: 20 },
};
const listQuerySpy = vi.fn();
const studentLookupSpy = vi.fn();
const scheduleMutate = vi.fn();
const completeMutate = vi.fn();
const cancelMutate = vi.fn();

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
      'parentMeeting.list.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(listState.data);
      },
      'parentMeeting.schedule.useMutation': () => mutationResult({ mutate: scheduleMutate }),
      'parentMeeting.complete.useMutation': () => mutationResult({ mutate: completeMutate }),
      'parentMeeting.cancel.useMutation': () => mutationResult({ mutate: cancelMutate }),
      'student.lookup.useQuery': (input: unknown, opts?: { enabled?: boolean }) => {
        studentLookupSpy(input);
        if (!opts?.enabled) return queryResult(undefined, { isFetching: false });
        return queryResult(STUDENT_RESULTS, { isFetching: false });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import PostSaleMeetingPage from './post-sale-meeting.js';

// Uses fake timers for the ~300ms StudentPicker debounce — must NOT mix with
// `findBy*`/`waitFor` (their internal polling relies on real timers and
// would hang forever under `vi.useFakeTimers()`); every step here is
// synchronous, driven by explicit `act(() => vi.advanceTimersByTime(...))`.
function openScheduleDialogAndSubmit() {
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch họp' }));
  // Astryx appends " ∙ Required" to an `isRequired` field's accessible
  // label — regex-match the leading text (same convention as
  // create-lead-dialog.test.tsx's `/^Họ tên/`).
  fireEvent.change(screen.getByLabelText(/^Học viên/), { target: { value: 'Lê Thị' } });
  act(() => vi.advanceTimersByTime(300));
  fireEvent.click(screen.getByText('Lê Thị C'));
  const datetimeInput = screen.getByLabelText('Thời gian họp');
  fireEvent.change(datetimeInput, { target: { value: '2026-08-01T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));
}

describe('PostSaleMeetingPage', () => {
  beforeEach(() => {
    listState.data = { items: [MEETING_SCHEDULED, MEETING_DONE], total: 2, page: 1, pageSize: 20 };
    listQuerySpy.mockClear();
    studentLookupSpy.mockClear();
    scheduleMutate.mockClear();
    completeMutate.mockClear();
    cancelMutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render the stale "no backend" EmptyState stub', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    expect(screen.queryByText('Tính năng chưa áp dụng')).not.toBeInTheDocument();
  });

  it('renders meetings from parentMeeting.list', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Phụ huynh hài lòng')).toBeInTheDocument();
  });

  it('never references remindedAt anywhere on the screen', () => {
    const { container } = renderWithProviders(<PostSaleMeetingPage />);
    expect(container.textContent).not.toMatch(/remindedAt|reminded at|Đã nhắc/i);
  });

  it('queries parentMeeting.list with {page: 1, pageSize: 20} by default (no status key)', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('re-queries with the chosen status when the status filter changes', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    listQuerySpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(screen.getByRole('option', { name: 'Hoàn thành' }));
    expect(listQuerySpy).toHaveBeenCalledWith({ status: 'done', page: 1, pageSize: 20 });
  });

  it('renders FilterBar search region and ListPagination footer', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument();
  });

  it('shows "Hoàn thành"/"Hủy" only on the scheduled meeting', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    expect(screen.getAllByRole('button', { name: 'Hoàn thành' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Hủy' })).toHaveLength(1);
  });

  it('calls parentMeeting.cancel.mutate({meetingId}) when "Hủy" is clicked', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(cancelMutate).toHaveBeenCalledWith({ meetingId: 'meet-1' });
  });

  it('opens the complete dialog and calls parentMeeting.complete.mutate({meetingId, result})', () => {
    renderWithProviders(<PostSaleMeetingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    fireEvent.change(screen.getByLabelText(/^Kết quả buổi họp/), { target: { value: 'Đã trao đổi xong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(completeMutate).toHaveBeenCalledWith(
      { meetingId: 'meet-1', result: 'Đã trao đổi xong' },
      expect.anything(),
    );
  });

  it('opens the schedule dialog, picks a student via StudentPicker, and calls parentMeeting.schedule.mutate with {studentId, scheduledAt}', () => {
    vi.useFakeTimers();
    renderWithProviders(<PostSaleMeetingPage />);
    openScheduleDialogAndSubmit();

    expect(scheduleMutate).toHaveBeenCalledWith(
      { studentId: 'st-pick', scheduledAt: new Date('2026-08-01T10:00').toISOString() },
      expect.anything(),
    );
  });

  it('renders the double-booking warning inline (non-fatally) when the schedule response includes one', () => {
    vi.useFakeTimers();
    renderWithProviders(<PostSaleMeetingPage />);
    openScheduleDialogAndSubmit();

    const [, callOptions] = scheduleMutate.mock.calls[0] as [
      unknown,
      { onSuccess?: (res: { warning?: string }) => void },
    ];
    act(() =>
      callOptions.onSuccess?.({
        warning: 'Học sinh này đã có 1 lịch họp trùng giờ — vui lòng xác nhận.',
      }),
    );

    expect(screen.getByText('Học sinh này đã có 1 lịch họp trùng giờ — vui lòng xác nhận.')).toBeInTheDocument();
    // Non-fatal: the dialog stays open with a "Đóng" action instead of an error.
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
  });

  it('closes the schedule dialog directly (no warning) after a successful schedule', () => {
    vi.useFakeTimers();
    renderWithProviders(<PostSaleMeetingPage />);
    openScheduleDialogAndSubmit();

    const [, callOptions] = scheduleMutate.mock.calls[0] as [
      unknown,
      { onSuccess?: (res: { warning?: string }) => void },
    ];
    act(() => callOptions.onSuccess?.({}));

    const dialogEl = screen.getByText('Đặt lịch họp phụ huynh').closest('dialog');
    expect(dialogEl?.hasAttribute('open')).toBe(false);
  });

  it('does not render pictographic emoji anywhere on the screen', () => {
    const { container } = renderWithProviders(<PostSaleMeetingPage />);
    // eslint-disable-next-line no-misleading-character-class
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
