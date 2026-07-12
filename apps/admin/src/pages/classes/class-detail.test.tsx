// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks class-detail's HR remediation phase 5 additions (R2 #C5, R2 #H6):
// teacher picker (`classBatch.assignTeacher`, giao_vien-only dropdown) +
// `done` SessionStatus badge + hidden "Huỷ" button for done sessions.
const { CLASS, TEACHERS, SESSIONS } = vi.hoisted(() => ({
  CLASS: {
    id: 'cb-1',
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
    { id: 'sess-1', sessionDate: '2026-01-05T00:00:00.000Z', startTime: '2026-01-05T08:00:00.000Z', endTime: '2026-01-05T09:00:00.000Z', status: 'done', isMakeup: false },
    { id: 'sess-2', sessionDate: '2026-01-06T00:00:00.000Z', startTime: '2026-01-06T08:00:00.000Z', endTime: '2026-01-06T09:00:00.000Z', status: 'planned', isMakeup: false },
  ],
}));

const assignTeacherMutate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'cb-1' }) };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_dao_tao'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'classBatch.get.useQuery': queryResult(CLASS),
      'classBatch.listStudents.useQuery': queryResult([]),
      'classSession.list.useQuery': queryResult(SESSIONS),
      'user.list.useQuery': queryResult(TEACHERS),
      'classBatch.assignTeacher.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { assignTeacherMutate(...a); opts?.onSuccess?.(); } }),
      'classSession.confirm.useMutation': () => mutationResult(),
      'classSession.cancel.useMutation': () => mutationResult(),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ClassDetailPage from './class-detail.js';

describe('ClassDetailPage', () => {
  beforeEach(() => {
    assignTeacherMutate.mockClear();
  });

  it('shows a teacher picker filtered to giao_vien AppUsers only', async () => {
    renderWithProviders(<ClassDetailPage />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Giáo viên' }));
    expect(await screen.findByRole('option', { name: 'Trần Thị B' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Nguyễn Văn A' })).toBeNull();
  });

  it('calls classBatch.assignTeacher.mutate({classBatchId, teacherAppUserId}) when a teacher is picked', async () => {
    renderWithProviders(<ClassDetailPage />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Giáo viên' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Trần Thị B' }));
    expect(assignTeacherMutate).toHaveBeenCalledWith({ classBatchId: 'cb-1', teacherAppUserId: 't-1' });
  });

  it('shows a done badge and hides the Huỷ button for a done session', () => {
    renderWithProviders(<ClassDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buổi học' }));
    const doneRow = screen.getByText(/5\/1\/2026/).closest('tr')!;
    expect(within(doneRow).getByText('done')).toBeInTheDocument();
    expect(within(doneRow).queryByRole('button', { name: 'Huỷ' })).toBeNull();
  });

  it('still shows the Huỷ button for a non-done, non-cancelled session', () => {
    renderWithProviders(<ClassDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buổi học' }));
    const plannedRow = screen.getByText(/6\/1\/2026/).closest('tr')!;
    expect(within(plannedRow).getByRole('button', { name: 'Huỷ' })).toBeInTheDocument();
  });
});
