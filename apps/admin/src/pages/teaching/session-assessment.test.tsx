// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the per-session assessment screen (HR remediation phase 5, R2 #C4):
// roster HS `present` (attendance.listBySession) → AI draft
// (assessment.draftComment) → GV confirm từng em (assessment.confirm) or
// "Xác nhận tất cả" (sequential mutateAsync over draft-status students).
// vi.hoisted: referenced synchronously inside the vi.mock factory below,
// which vitest hoists above regular top-level statements.
const { CLASS_A, SESSION_A, STUDENTS } = vi.hoisted(() => ({
  CLASS_A: { id: 'batch-1', code: 'CB001', program: 'IELTS Foundation' },
  SESSION_A: { id: 'sess-1', sessionDate: '2026-07-10T00:00:00.000Z', status: 'confirmed' },
  STUDENTS: [
    { enrollmentId: 'e1', studentId: 'st-1', fullName: 'Nguyễn Văn A', status: 'active' },
    { enrollmentId: 'e2', studentId: 'st-2', fullName: 'Trần Thị B', status: 'active' },
  ],
}));
let rosterItems: Array<{ enrollmentId: string; studentId: string; status: string | null; markedAt: null }> = [
  { enrollmentId: 'e1', studentId: 'st-1', status: 'present', markedAt: null },
  { enrollmentId: 'e2', studentId: 'st-2', status: 'absent', markedAt: null },
];

let assessmentItems: Array<{ id: string; studentId: string; status: string; content: string }> = [];
let evidenceResult: { status: string; photos: Array<{ id: string; blobRef: string }> } | null = null;

const draftMutate = vi.fn();
const confirmMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giao_vien'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'classBatch.list.useQuery': queryResult({ items: [CLASS_A] }),
      'classSession.list.useQuery': (_input: unknown, opts: { enabled?: boolean } | undefined) =>
        opts?.enabled ? queryResult([SESSION_A]) : queryResult(undefined),
      'classBatch.listStudents.useQuery': (_input: unknown, opts: { enabled?: boolean } | undefined) =>
        opts?.enabled ? queryResult(STUDENTS) : queryResult(undefined),
      'attendance.listBySession.useQuery': (_input: unknown, opts: { enabled?: boolean } | undefined) =>
        opts?.enabled ? queryResult({ items: rosterItems, total: rosterItems.length }) : queryResult(undefined),
      'assessment.listBySession.useQuery': (_input: unknown, opts: { enabled?: boolean } | undefined) =>
        opts?.enabled ? queryResult({ items: assessmentItems }) : queryResult(undefined),
      'sessionEvidence.getBySession.useQuery': (_input: unknown, opts: { enabled?: boolean } | undefined) =>
        opts?.enabled ? queryResult(evidenceResult) : queryResult(undefined),
      'assessment.draftComment.useMutation': (opts: { onSuccess?: () => void }) =>
        mutationResult({ mutate: (...a: unknown[]) => { draftMutate(...a); opts?.onSuccess?.(); } }),
      'assessment.confirm.useMutation': () =>
        mutationResult({ mutate: confirmMutateAsync, mutateAsync: confirmMutateAsync }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import SessionAssessmentPage from './session-assessment.js';

async function pickClassAndSession() {
  fireEvent.click(screen.getByRole('button', { name: 'Chọn lớp học' }));
  fireEvent.click(await screen.findByRole('option', { name: /CB001/ }));
  fireEvent.click(await screen.findByRole('combobox', { name: 'Chọn buổi học' }));
  fireEvent.click(await screen.findByRole('option', { name: /confirmed/ }));
}

describe('SessionAssessmentPage', () => {
  beforeEach(() => {
    assessmentItems = [];
    evidenceResult = null;
    rosterItems = [
      { enrollmentId: 'e1', studentId: 'st-1', status: 'present', markedAt: null },
      { enrollmentId: 'e2', studentId: 'st-2', status: 'absent', markedAt: null },
    ];
    draftMutate.mockClear();
    confirmMutateAsync.mockClear();
  });

  it('shows only present students in the roster (absent student excluded)', async () => {
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByText('Trần Thị B')).toBeNull();
  });

  it('shows "Chưa có nhận xét" and a draft button for a present student with no assessment yet', async () => {
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Chưa có nhận xét')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo nhận xét AI' })).toBeInTheDocument();
  });

  it('calls assessment.draftComment.mutate({studentId, classSessionId}) when drafting', async () => {
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo nhận xét AI' }));
    expect(draftMutate).toHaveBeenCalledWith({ studentId: 'st-1', classSessionId: 'sess-1' });
  });

  it('shows the editable content + Xác nhận button for a draft assessment', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'draft', content: 'Học sinh tích cực.' }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByDisplayValue('Học sinh tích cực.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
  });

  it('calls assessment.confirm.mutate({assessmentId, content}) when confirming a single student', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'draft', content: 'Học sinh tích cực.' }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(confirmMutateAsync).toHaveBeenCalledWith({ assessmentId: 'a-1', content: 'Học sinh tích cực.' }),
    );
  });

  it('shows a confirmed badge and read-only content for a confirmed assessment', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'confirmed', content: 'Rất tốt.' }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Đã xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Rất tốt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
  });

  it('shows the "Xác nhận tất cả" progress + button in the action bar, disabled when no drafts remain', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'confirmed', content: 'Rất tốt.' }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Nhận xét: 1/1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận tất cả' })).toBeDisabled();
  });

  it('calls confirm.mutateAsync for every draft-status present student on "Xác nhận tất cả"', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'draft', content: 'Học sinh tích cực.' }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận tất cả' }));
    await waitFor(() =>
      expect(confirmMutateAsync).toHaveBeenCalledWith({ assessmentId: 'a-1', content: 'Học sinh tích cực.' }),
    );
  });

  it('shows an info banner when no student is marked present yet', async () => {
    rosterItems = [{ enrollmentId: 'e1', studentId: 'st-1', status: 'absent', markedAt: null }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Chưa có học sinh có mặt')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Tri-state progress display (post-audit fix): Điểm danh / Nhận xét / Ảnh
  // ---------------------------------------------------------------------

  it('shows Điểm danh ✓ when at least one student is present, Ảnh ✗ when no evidence exists', async () => {
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Điểm danh ✓')).toBeInTheDocument();
    expect(screen.getByText('Ảnh ✗')).toBeInTheDocument();
  });

  it('shows Ảnh ✓ when evidence is published with at least one photo', async () => {
    evidenceResult = { status: 'published', photos: [{ id: 'p1', blobRef: 'photos/a.jpg' }] };
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Ảnh ✓')).toBeInTheDocument();
  });

  it('shows Ảnh ✗ when evidence exists but is still draft (not yet published)', async () => {
    evidenceResult = { status: 'draft', photos: [{ id: 'p1', blobRef: 'photos/a.jpg' }] };
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Ảnh ✗')).toBeInTheDocument();
  });

  it('shows the eligibility badge only when all 3 done-conditions are met', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'confirmed', content: 'Rất tốt.' }];
    evidenceResult = { status: 'published', photos: [{ id: 'p1', blobRef: 'photos/a.jpg' }] };
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    expect(await screen.findByText('Đủ điều kiện buổi tự chuyển done')).toBeInTheDocument();
  });

  it('does NOT show the eligibility badge when evidence is missing', async () => {
    assessmentItems = [{ id: 'a-1', studentId: 'st-1', status: 'confirmed', content: 'Rất tốt.' }];
    renderWithProviders(<SessionAssessmentPage />);
    await pickClassAndSession();
    await screen.findByText('Nhận xét: 1/1');
    expect(screen.queryByText('Đủ điều kiện buổi tự chuyển done')).toBeNull();
  });
});
