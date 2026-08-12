// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const publishMutate = vi.fn();
const closeMutate = vi.fn();

const { EXERCISE_ID, EXERCISE } = vi.hoisted(() => {
  const EXERCISE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    EXERCISE_ID,
    EXERCISE: {
      id: EXERCISE_ID,
      folderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      orderInFolder: 1,
      title: 'Bài tập buổi 1',
      type: 'homework',
      status: 'draft',
      basePdfRef: 'exercise-pdf/seed.pdf',
      maxScore: 10,
      starReward: 10,
      createdById: 'u-director',
      folder: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Chưa phân loại',
        description: null,
        archivedAt: null,
      },
    },
  };
});

let exerciseState = { ...EXERCISE };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ exerciseId: EXERCISE_ID }),
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u-director',
          roles: ['giam_doc_dao_tao'],
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'exercise.get.useQuery': () => queryResult(exerciseState),
      'exercise.publish.useMutation': () => mutationResult({ mutate: publishMutate }),
      'exercise.close.useMutation': () => mutationResult({ mutate: closeMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ExerciseDetailPage from './exercise-detail.js';

describe('ExerciseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exerciseState = { ...EXERCISE, status: 'draft' };
  });

  it('renders form from exercise.get with Console grammar', () => {
    renderWithProviders(<ExerciseDetailPage />, {
      route: `/teaching/exercises/${EXERCISE_ID}`,
    });
    expect(screen.getAllByText('Bài tập buổi 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Chưa phân loại').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Thông tin bài tập')).toBeInTheDocument();
    expect(screen.getAllByText(/Nháp/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows form HITL Công bố for draft', () => {
    renderWithProviders(<ExerciseDetailPage />, {
      route: `/teaching/exercises/${EXERCISE_ID}`,
    });
    expect(screen.getByRole('button', { name: 'Công bố' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
  });

  it('calls exercise.publish.mutate after ConfirmDialog', () => {
    renderWithProviders(<ExerciseDetailPage />, {
      route: `/teaching/exercises/${EXERCISE_ID}`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Công bố' }));
    expect(publishMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Công bố' }));
    expect(publishMutate).toHaveBeenCalledWith({ exerciseId: EXERCISE_ID });
  });

  it('shows Đóng for published status', () => {
    exerciseState = { ...EXERCISE, status: 'published' };
    renderWithProviders(<ExerciseDetailPage />, {
      route: `/teaching/exercises/${EXERCISE_ID}`,
    });
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
  });

  it('calls exercise.close.mutate after ConfirmDialog on published', () => {
    exerciseState = { ...EXERCISE, status: 'published' };
    renderWithProviders(<ExerciseDetailPage />, {
      route: `/teaching/exercises/${EXERCISE_ID}`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng bài tập' }));
    expect(closeMutate).toHaveBeenCalledWith({ exerciseId: EXERCISE_ID });
  });

  it('hides lifecycle actions when closed', () => {
    exerciseState = { ...EXERCISE, status: 'closed' };
    renderWithProviders(<ExerciseDetailPage />, {
      route: `/teaching/exercises/${EXERCISE_ID}`,
    });
    expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
  });
});
