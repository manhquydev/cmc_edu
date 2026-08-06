// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the post-audit grading-screen fixes:
//  - the queue/detail views show `studentFullName` instead of a raw UUID
//    (submission.listForGrading now joins `student.fullName`)
//  - the client no longer hardcodes a 0-10 score ceiling (an exercise can
//    have any `maxScore`) — a real server-side rejection (score above the
//    exercise's actual maxScore) is surfaced via the error banner, never
//    silent; NumberInput's own `min={0}` is what keeps a negative score from
//    ever reaching state in the first place
//  - the fake `?class=` filter (never wired to the query) is gone

interface SubmissionItem {
  id: string;
  exerciseId: string;
  studentId: string;
  studentFullName?: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
  annotationLayer: unknown;
  teacherAnnotationLayer: unknown;
  basePdfRef: string | null;
}

const ITEM_SUBMITTED: SubmissionItem = {
  id: '33333333-3333-4333-8333-333333333333',
  exerciseId: 'ex-1',
  studentId: 'stu-11111111',
  studentFullName: 'Nguyễn Văn A',
  status: 'submitted',
  score: null,
  submittedAt: '2026-07-20T00:00:00.000Z',
  gradedAt: null,
  annotationLayer: {},
  teacherAnnotationLayer: null,
  basePdfRef: null,
};

let listItems: SubmissionItem[] = [ITEM_SUBMITTED];
const listQuerySpy = vi.fn();
const gradeMutate = vi.fn();
let gradeErrorMessage: string | null = null;

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
      'submission.listForGrading.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult({ items: listItems }, { refetch: vi.fn() });
      },
      'submission.grade.useMutation': () =>
        mutationResult({
          mutate: gradeMutate,
          error: gradeErrorMessage ? { message: gradeErrorMessage } : null,
          isError: gradeErrorMessage !== null,
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import GradingPage from './grading.js';

describe('GradingPage', () => {
  beforeEach(() => {
    listItems = [ITEM_SUBMITTED];
    gradeErrorMessage = null;
    listQuerySpy.mockClear();
    gradeMutate.mockClear();
  });

  it('queries submission.listForGrading with default status submitted (no class filter)', () => {
    renderWithProviders(<GradingPage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ status: 'submitted' });
  });

  it('does not render a "Lớp:" filter label anywhere (removed fake filter)', () => {
    renderWithProviders(<GradingPage />);
    expect(screen.queryByText(/^Lớp:/)).toBeNull();
  });

  it('shows the student full name in the queue, not a raw UUID', () => {
    renderWithProviders(<GradingPage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByText(/^HS: /)).toBeNull();
  });

  it('shows the student full name in the detail pane header once selected', () => {
    renderWithProviders(<GradingPage />);
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    expect(screen.getByText(/Học sinh: Nguyễn Văn A/)).toBeInTheDocument();
  });

  it('hydrates selection from ?submissionId= URL param', () => {
    renderWithProviders(<GradingPage />, {
      route: `/teaching/grading?submissionId=${ITEM_SUBMITTED.id}`,
    });
    expect(screen.getByText(/Học sinh: Nguyễn Văn A/)).toBeInTheDocument();
  });

  it('treats non-UUID submissionId as unset', () => {
    renderWithProviders(<GradingPage />, {
      route: '/teaching/grading?submissionId=not-a-uuid',
    });
    expect(screen.getByText('Chọn một bài để chấm')).toBeInTheDocument();
  });

  it('falls back to a truncated id when studentFullName is missing', () => {
    listItems = [{ ...ITEM_SUBMITTED, studentFullName: undefined }];
    renderWithProviders(<GradingPage />);
    expect(screen.getByText('HS: STU-1111')).toBeInTheDocument();
  });

  it('calls submission.grade.mutate with a score above 10 (no hardcoded 0-10 ceiling on the client)', () => {
    renderWithProviders(<GradingPage />);
    fireEvent.click(screen.getByText('Nguyễn Văn A'));

    fireEvent.change(screen.getByLabelText(/^Điểm/), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chấm bài' }));

    expect(gradeMutate).toHaveBeenCalledWith({ submissionId: ITEM_SUBMITTED.id, score: 85 });
  });

  it('shows a real server rejection (score above exercise.maxScore) via the error banner, not silently', () => {
    gradeErrorMessage = 'score (150) exceeds exercise.maxScore (100).';
    renderWithProviders(<GradingPage />);
    fireEvent.click(screen.getByText('Nguyễn Văn A'));

    fireEvent.change(screen.getByLabelText(/^Điểm/), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chấm bài' }));

    expect(gradeMutate).toHaveBeenCalledWith({ submissionId: ITEM_SUBMITTED.id, score: 150 });
    expect(screen.getByText('score (150) exceeds exercise.maxScore (100).')).toBeInTheDocument();
  });

  it('never sends a negative score — NumberInput\'s own min=0 keeps a "-5" keystroke from ever reaching state (Save stays disabled)', () => {
    renderWithProviders(<GradingPage />);
    fireEvent.click(screen.getByText('Nguyễn Văn A'));

    fireEvent.change(screen.getByLabelText(/^Điểm/), { target: { value: '-5' } });

    expect(screen.getByRole('button', { name: 'Chấm bài' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Chấm bài' }));
    expect(gradeMutate).not.toHaveBeenCalled();
  });
});
