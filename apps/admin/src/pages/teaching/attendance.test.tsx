// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the class -> session picker flow (post-audit fix: the page used to
// require a hand-typed `?session=<uuid>` URL param that no in-app link ever
// supplied — a dead end). Picker pattern mirrors session-assessment.tsx
// (classBatch.list -> classSession.list -> attendance.listBySession), and
// locks the `attendance.markAll` BULK payload (full record set) + the
// "never default an untouched row to present" fix.
// vi.hoisted: referenced synchronously inside the vi.mock factory below,
// which vitest hoists above regular top-level statements (same pattern as
// session-assessment.test.tsx).
const { CLASS_A, SESSION_A, STUDENTS } = vi.hoisted(() => ({
  // Real UUID shape so URL state filter (UUID_RE) accepts picker selections.
  CLASS_A: {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CB001',
    program: 'IELTS Foundation',
  },
  SESSION_A: {
    id: '22222222-2222-4222-8222-222222222222',
    sessionDate: '2026-07-10T00:00:00.000Z',
    status: 'confirmed',
  },
  STUDENTS: [
    { enrollmentId: 'enr-1', studentId: 'stu-11111111', fullName: 'Nguyễn Văn A', status: 'active' },
    { enrollmentId: 'enr-2', studentId: 'stu-22222222', fullName: 'Trần Thị B', status: 'active' },
  ],
}));

interface RosterItem {
  enrollmentId: string;
  studentId: string;
  status: string | null;
}

const ITEM_A: RosterItem = { enrollmentId: 'enr-1', studentId: 'stu-11111111', status: null };
const ITEM_B: RosterItem = { enrollmentId: 'enr-2', studentId: 'stu-22222222', status: null };

const rosterState: { items: RosterItem[]; error: { message: string } | null } = {
  items: [ITEM_A, ITEM_B],
  error: null,
};
const listQuerySpy = vi.fn();
const sessionListSpy = vi.fn();
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
      'classBatch.list.useQuery': queryResult({ items: [CLASS_A] }),
      'classSession.list.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        if (!opts?.enabled) return queryResult(undefined);
        sessionListSpy(input);
        return queryResult([SESSION_A]);
      },
      'classBatch.listStudents.useQuery': (_input: unknown, opts: { enabled?: boolean } | undefined) =>
        opts?.enabled ? queryResult(STUDENTS) : queryResult(undefined),
      'attendance.listBySession.useQuery': (input: unknown, opts: { enabled?: boolean } | undefined) => {
        if (!opts?.enabled) return queryResult(undefined);
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

async function pickClassAndSession() {
  // S6 fix: the class picker is now AsyncEntityCombobox (server search +
  // pin-selected, so record #101+ can't silently disappear) — its inner
  // Selector no longer sets `hasSearch` (AsyncEntityCombobox owns its own
  // search input instead), which is what flips Astryx's accessible role
  // from "button" to "combobox", matching the session picker beside it.
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn lớp học' }));
  fireEvent.click(await screen.findByRole('option', { name: /CB001/ }));
  fireEvent.click(await screen.findByRole('combobox', { name: 'Chọn buổi học' }));
  fireEvent.click(await screen.findByRole('option', { name: /confirmed/ }));
}

describe('AttendancePage', () => {
  beforeEach(() => {
    rosterState.items = [ITEM_A, ITEM_B];
    rosterState.error = null;
    listQuerySpy.mockClear();
    sessionListSpy.mockClear();
    markAllMutate.mockClear();
  });

  it('does not query attendance.listBySession before a session is picked', () => {
    renderWithProviders(<AttendancePage />);
    expect(listQuerySpy).not.toHaveBeenCalled();
  });

  it('queries attendance.listBySession with the sessionId chosen via the class -> session picker', async () => {
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();
    expect(listQuerySpy).toHaveBeenCalledWith({ sessionId: SESSION_A.id });
  });

  it('hydrates class + session from URL query params', () => {
    renderWithProviders(<AttendancePage />, {
      route: `/teaching/attendance?classBatchId=${CLASS_A.id}&sessionId=${SESSION_A.id}`,
    });
    expect(listQuerySpy).toHaveBeenCalledWith({ sessionId: SESSION_A.id });
  });

  it('treats non-UUID query params as unset (no session list / roster queries)', () => {
    renderWithProviders(<AttendancePage />, {
      route: '/teaching/attendance?classBatchId=abc&sessionId=not-a-uuid',
    });
    expect(sessionListSpy).not.toHaveBeenCalled();
    expect(listQuerySpy).not.toHaveBeenCalled();
  });

  it('renders roster rows with the student full name, not a raw UUID', async () => {
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.queryByText('STU-1111')).toBeNull();
  });

  it('shows every untouched row as "Chưa điểm danh", not defaulted to present', async () => {
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();
    expect(await screen.findAllByRole('button', { name: 'Chưa điểm danh' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Có mặt' })).toBeNull();
  });

  it('shows a validation banner and does NOT call markAll.mutate when Save is clicked with nothing marked', async () => {
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu điểm danh' }));

    expect(markAllMutate).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'Chưa có học sinh nào được điểm danh. Vui lòng chọn trạng thái cho ít nhất một học sinh trước khi lưu.',
      ),
    ).toBeInTheDocument();
  });

  it('calls attendance.markAll.mutate with only the explicitly toggled rows (bulk payload)', async () => {
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();

    const unmarkedButtons = await screen.findAllByRole('button', { name: 'Chưa điểm danh' });
    fireEvent.click(unmarkedButtons[0]!); // enr-1 -> present

    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm danh' }));

    expect(markAllMutate).toHaveBeenCalledWith({
      sessionId: SESSION_A.id,
      entries: [{ enrollmentId: 'enr-1', status: 'present' }],
    });
  });

  it('toggles a row status through the present -> late -> absent cycle before saving', async () => {
    rosterState.items = [
      { enrollmentId: 'enr-1', studentId: 'stu-11111111', status: 'present' },
      { enrollmentId: 'enr-2', studentId: 'stu-22222222', status: 'present' },
    ];
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();

    // Row A starts "Có mặt" (present, seeded from a prior mark) — one click cycles to "late".
    fireEvent.click((await screen.findAllByRole('button', { name: 'Có mặt' }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điểm danh' }));

    expect(markAllMutate).toHaveBeenCalledWith({
      sessionId: SESSION_A.id,
      entries: [
        { enrollmentId: 'enr-1', status: 'late' },
        { enrollmentId: 'enr-2', status: 'present' },
      ],
    });
  });

  it('renders an error message when attendance.listBySession fails', async () => {
    rosterState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<AttendancePage />);
    await pickClassAndSession();
    expect(await screen.findByText('Lỗi mạng')).toBeInTheDocument();
  });
});
