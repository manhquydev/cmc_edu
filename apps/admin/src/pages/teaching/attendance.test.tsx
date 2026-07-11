// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks `attendance.listBySession.useQuery` binding + the `attendance.markAll`
// BULK payload (full record set, byte-identical) BEFORE the ListPage refactor
// (TDD per phase-07). The refactor only changes presentation — the toggle
// cycle, save payload and invalidation-free onSuccess (local `saved` flag)
// must stay unchanged.
interface RosterItem {
  enrollmentId: string;
  studentId: string;
  status: string | null;
}

const ITEM_A: RosterItem = { enrollmentId: 'enr-1', studentId: 'stu-11111111', status: 'present' };
const ITEM_B: RosterItem = { enrollmentId: 'enr-2', studentId: 'stu-22222222', status: 'present' };

const rosterState: { items: RosterItem[]; error: { message: string } | null } = {
  items: [ITEM_A, ITEM_B],
  error: null,
};
const listQuerySpy = vi.fn();
const markAllMutate = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  // The page's useEffect depends on `data` by reference (mirrors real
  // react-query: the same object identity across renders until the query
  // actually re-resolves) — cache the built result and only rebuild it when
  // the underlying test fixture (items/error) actually changes, otherwise
  // a fresh object on every render trips the effect into an update loop.
  let cachedItems: RosterItem[] | null = null;
  let cachedError: typeof rosterState.error = null;
  let cached: ReturnType<typeof queryResult> | null = null;
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giao_vien'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'attendance.listBySession.useQuery': (input: unknown) => {
        listQuerySpy(input);
        if (!cached || cachedItems !== rosterState.items || cachedError !== rosterState.error) {
          cachedItems = rosterState.items;
          cachedError = rosterState.error;
          cached = queryResult(
            { items: rosterState.items },
            { error: rosterState.error, isError: rosterState.error !== null },
          );
        }
        return cached;
      },
      'attendance.markAll.useMutation': () => mutationResult({ mutate: markAllMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import AttendancePage from './attendance.js';

describe('AttendancePage', () => {
  beforeEach(() => {
    rosterState.items = [ITEM_A, ITEM_B];
    rosterState.error = null;
    listQuerySpy.mockClear();
    markAllMutate.mockClear();
  });

  it('queries attendance.listBySession with the sessionId from the URL', () => {
    renderWithProviders(<AttendancePage />, { route: '/teaching/attendance?session=sess-1' });
    expect(listQuerySpy).toHaveBeenCalledWith({ sessionId: 'sess-1' });
  });

  it('renders a warning banner (description visible) when no session param is provided', () => {
    renderWithProviders(<AttendancePage />, { route: '/teaching/attendance' });
    expect(
      screen.getByText((_, node) => node?.textContent === 'Vui lòng cung cấp tham số ?session=<sessionId> trên URL.'),
    ).toBeInTheDocument();
  });

  it('renders roster rows bound to attendance.listBySession.useQuery', () => {
    renderWithProviders(<AttendancePage />, { route: '/teaching/attendance?session=sess-1' });
    expect(screen.getByText('STU-1111')).toBeInTheDocument();
    expect(screen.getByText('STU-2222')).toBeInTheDocument();
  });

  it('calls attendance.markAll.mutate with the FULL roster record set (bulk, byte-identical)', () => {
    renderWithProviders(<AttendancePage />, { route: '/teaching/attendance?session=sess-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm danh' }));

    expect(markAllMutate).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      entries: [
        { enrollmentId: 'enr-1', status: 'present' },
        { enrollmentId: 'enr-2', status: 'present' },
      ],
    });
  });

  it('toggles a row status through the present -> late -> absent cycle before saving (bulk payload reflects toggle)', () => {
    renderWithProviders(<AttendancePage />, { route: '/teaching/attendance?session=sess-1' });

    // Row A starts "Có mặt" (present) — one click cycles to "late".
    fireEvent.click(screen.getAllByRole('button', { name: 'Có mặt' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm danh' }));

    expect(markAllMutate).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      entries: [
        { enrollmentId: 'enr-1', status: 'late' },
        { enrollmentId: 'enr-2', status: 'present' },
      ],
    });
  });

  it('renders an error message when attendance.listBySession fails', () => {
    rosterState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<AttendancePage />, { route: '/teaching/attendance?session=sess-1' });
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});
