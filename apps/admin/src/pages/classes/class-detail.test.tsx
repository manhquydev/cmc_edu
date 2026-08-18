// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks class-detail's HR remediation phase 5 additions (R2 #C5, R2 #H6):
// teacher picker (`classBatch.assignTeacher`, giao_vien-only dropdown) +
// `done` SessionStatus badge + hidden "Huỷ" button for done sessions.
//
// Also locks the class-management UI gap fix: curriculum-unit assignment
// (`classSession.assignUnit` — the ONLY writer of `curriculumUnitId`, which
// gates whether a student can ever open an exercise, class-session-router.ts),
// and the cancel-session confirmation step (`classSession.cancel` must only
// fire after the ConfirmDialog confirm click).
const { CLASS, TEACHERS, SESSIONS, UNITS } = vi.hoisted(() => ({
  CLASS: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    code: 'CB001',
    program: 'IELTS',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    roomId: null,
    teacherId: null,
    teacherAppUserId: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  TEACHERS: {
    items: [
      { id: 't-1', fullName: 'Trần Thị B', roles: ['giao_vien'] },
      { id: 's-1', fullName: 'Nguyễn Văn A', roles: ['sale'] },
    ],
  },
  SESSIONS: [
    { id: 'sess-1', sessionDate: '2026-01-05T00:00:00.000Z', startTime: '2026-01-05T08:00:00.000Z', endTime: '2026-01-05T09:00:00.000Z', status: 'done', curriculumUnitId: null },
    { id: 'sess-2', sessionDate: '2026-01-06T00:00:00.000Z', startTime: '2026-01-06T08:00:00.000Z', endTime: '2026-01-06T09:00:00.000Z', status: 'planned', curriculumUnitId: null },
  ],
  UNITS: {
    items: [
      { id: 'unit-1', program: 'IELTS', level: 'U2', monthIndex: 1, unitType: 'lesson', title: 'Đơn vị 1' },
      { id: 'unit-2', program: 'IELTS', level: 'U2', monthIndex: 2, unitType: 'lesson', title: 'Đơn vị 2' },
    ],
  },
}));
const currentRoles = vi.hoisted(() => ({ value: ['giam_doc_dao_tao'] as string[] }));

const assignTeacherMutate = vi.fn();
const assignUnitMutate = vi.fn();
const cancelMutate = vi.fn();
const pickListSpy = vi.fn();
const navigateMock = vi.fn();

// Roster rows come from the server contract (Phase 5 cross-record link test).
const rosterState = vi.hoisted(() => ({
  rows: [] as Array<{ enrollmentId: string; studentId: string; fullName: string; status: string }>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u1',
          roles: currentRoles.value,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'classBatch.get.useQuery': queryResult(CLASS),
      'classBatch.listStudents.useQuery': queryResult(rosterState.rows),
      'classSession.list.useQuery': queryResult(SESSIONS),
      'curriculumUnit.list.useQuery': queryResult(UNITS),
      'user.pickList.useQuery': (input: unknown) => {
        pickListSpy(input);
        return queryResult(TEACHERS);
      },
      'classBatch.assignTeacher.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { assignTeacherMutate(...a); opts?.onSuccess?.(); } }),
      'classSession.confirm.useMutation': () => mutationResult(),
      'classSession.cancel.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { cancelMutate(...a); opts?.onSuccess?.(); } }),
      'classSession.assignUnit.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { assignUnitMutate(...a); opts?.onSuccess?.(); } }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ClassDetailPage from './class-detail.js';

function renderAt(route: string) {
  return renderWithProviders(<ClassDetailPage />, {
    route,
    routes: [{ path: '/admin/classes/:id/:section', element: <ClassDetailPage /> }],
  });
}

describe('ClassDetailPage', () => {
  beforeEach(() => {
    assignTeacherMutate.mockClear();
    assignUnitMutate.mockClear();
    cancelMutate.mockClear();
    navigateMock.mockClear();
    currentRoles.value = ['giam_doc_dao_tao'];
  });

  it('links Giám đốc đào tạo to the class exercise-sequence work surface', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/overview');
    fireEvent.click(screen.getByRole('button', { name: 'Xếp dãy bài' }));
    expect(navigateMock).toHaveBeenCalledWith('/teaching/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/exercise-sequence');
  });

  // The teacher-only rule now lives on the server (`user.pickList({role})`,
  // matched by the same assertion inside `classBatch.assignTeacher`), so this
  // asserts the picker asks for teachers rather than re-filtering the answer.
  it('asks for teachers only when populating the picker', async () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/overview');
    expect(pickListSpy).toHaveBeenCalledWith({ role: 'giao_vien' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Giáo viên' }));
    expect(await screen.findByRole('option', { name: 'Trần Thị B' })).toBeInTheDocument();
  });

  it('renders Console form chrome without changing assignTeacher contract', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/overview');
    expect(screen.getByText('Thông tin lớp')).toBeInTheDocument();
    expect(screen.getByText('Phân công giáo viên')).toBeInTheDocument();
    // Statusbar labels for active batch
    expect(screen.getAllByText(/Đang mở/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls classBatch.assignTeacher.mutate({classBatchId, teacherAppUserId}) when a teacher is picked', async () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/overview');
    fireEvent.click(screen.getByRole('combobox', { name: 'Giáo viên' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Trần Thị B' }));
    expect(assignTeacherMutate).toHaveBeenCalledWith({ classBatchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', teacherAppUserId: 't-1' });
  });

  it('shows a done badge and hides the Huỷ button for a done session', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');
    const doneRow = screen.getByText(/5\/1\/2026/).closest('tr')!;
    expect(within(doneRow).getByText('done')).toBeInTheDocument();
    expect(within(doneRow).queryByRole('button', { name: 'Huỷ' })).toBeNull();
  });

  it('still shows the Huỷ button for a non-done, non-cancelled session', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');
    const plannedRow = screen.getByText(/6\/1\/2026/).closest('tr')!;
    expect(within(plannedRow).getByRole('button', { name: 'Huỷ' })).toBeInTheDocument();
  });

  // `classSession.assignUnit` is the ONLY writer of `curriculumUnitId`
  // (class-session-router.ts) — without this picker calling it correctly,
  // exercise/open-tier.ts's `curriculumUnitId not null` filter is always
  // empty and students can never open an exercise.
  it('calls classSession.assignUnit.mutate({sessionId, curriculumUnitId}) when a unit is picked for a session', async () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');
    const plannedRow = screen.getByText(/6\/1\/2026/).closest('tr')!;
    // The Selector trigger is a "button" (not "combobox") — `hasSearch` moves
    // the combobox role onto the search input that only exists once opened.
    fireEvent.click(within(plannedRow).getByRole('button', { name: 'Đơn vị học' }));
    fireEvent.click(await screen.findByRole('option', { name: /Đơn vị 1/ }));
    expect(assignUnitMutate).toHaveBeenCalledWith({ sessionId: 'sess-2', curriculumUnitId: 'unit-1' });
  });

  it('does not offer a unit picker for a done session (curriculumUnitId is locked server-side)', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');
    const doneRow = screen.getByText(/5\/1\/2026/).closest('tr')!;
    // A disabled Selector trigger drops the "combobox" role (it can no
    // longer act as one), so the accessible query targets "button" here.
    expect(within(doneRow).getByRole('button', { name: 'Đơn vị học' })).toBeDisabled();
  });

  // Cancelling a session is one-way (attendance already recorded is dropped
  // from the FinalGrade denominator) — the mutate call must only fire after
  // the ConfirmDialog's own confirm click, never straight from the row button.
  it('asks for confirmation before cancelling a session, and only calls classSession.cancel.mutate after confirming', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');
    const plannedRow = screen.getByText(/6\/1\/2026/).closest('tr')!;
    fireEvent.click(within(plannedRow).getByRole('button', { name: 'Huỷ' }));
    expect(cancelMutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ buổi' }));
    expect(cancelMutate).toHaveBeenCalledWith({ sessionId: 'sess-2' });
  });

  it('cancelling the ConfirmDialog does not call classSession.cancel.mutate', () => {
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');
    const plannedRow = screen.getByText(/6\/1\/2026/).closest('tr')!;
    fireEvent.click(within(plannedRow).getByRole('button', { name: 'Huỷ' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(cancelMutate).not.toHaveBeenCalled();
  });

  it('hides class write controls for a class.read-only role', () => {
    currentRoles.value = ['sale'];
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/overview');

    expect(screen.queryByText('Phân công giáo viên')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xếp dãy bài' })).not.toBeInTheDocument();
  });

  it('hides schedule mutations and disables unit assignment without schedule.generate', () => {
    currentRoles.value = ['sale'];
    renderAt('/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/sessions');

    const plannedRow = screen.getByText(/6\/1\/2026/).closest('tr')!;
    expect(within(plannedRow).getByRole('button', { name: 'Đơn vị học' })).toBeDisabled();
    expect(within(plannedRow).queryByRole('button', { name: 'Xác nhận' })).toBeNull();
    expect(within(plannedRow).queryByRole('button', { name: 'Huỷ' })).toBeNull();
  });

  it('links roster students to the canonical profile section with return context', () => {
    rosterState.rows.push({
      enrollmentId: 'e-1',
      studentId: '11111111-2222-4333-8444-555555555555',
      fullName: 'Roster Kid',
      status: 'active',
    });
    renderWithProviders(<ClassDetailPage />, {
      route: '/admin/classes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/students',
      routes: [{ path: '/admin/classes/:id/:section', element: <ClassDetailPage /> }],
    });

    const link = screen.getByText('Roster Kid').closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', '/admin/students/11111111-2222-4333-8444-555555555555/profile');
  });
});
