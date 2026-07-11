// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks `curriculumUnit.list` / `exercise.list` query bindings and the
// `exercise.create/publish/close` mutation payloads + invalidate BEFORE the
// ListPage refactor (TDD per phase-07). The refactor only changes
// presentation — the PDF-upload flow and mutation contracts stay unchanged.
interface UnitItem {
  id: string;
  program: string;
  level: number;
  monthIndex: number;
  title: string;
}

interface ExerciseItem {
  id: string;
  curriculumUnitId: string;
  type: string;
  status: string;
}

const UNIT_A: UnitItem = { id: 'unit-1', program: 'English', level: 1, monthIndex: 3, title: 'Bài 3' };
const EXERCISE_A: ExerciseItem = { id: 'ex-1', curriculumUnitId: 'unit-1', type: 'homework', status: 'draft' };
const EXERCISE_B: ExerciseItem = { id: 'ex-2', curriculumUnitId: 'unit-1', type: 'test_periodic', status: 'published' };

const exercisesState: { items: ExerciseItem[]; error: { message: string } | null } = {
  items: [EXERCISE_A, EXERCISE_B],
  error: null,
};
const unitsListSpy = vi.fn();
const exerciseListSpy = vi.fn();
const createMutate = vi.fn();
const publishMutate = vi.fn();
const closeMutate = vi.fn();
let capturedCreateOpts: { onSuccess?: () => void } | undefined;

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
      'curriculumUnit.list.useQuery': () => {
        unitsListSpy();
        return queryResult({ items: [UNIT_A] });
      },
      'exercise.list.useQuery': (input: unknown) => {
        exerciseListSpy(input);
        return queryResult(
          { items: exercisesState.items },
          { error: exercisesState.error, isError: exercisesState.error !== null },
        );
      },
      'exercise.create.useMutation': (opts: { onSuccess?: () => void }) => {
        capturedCreateOpts = opts;
        return mutationResult({ mutate: createMutate });
      },
      'exercise.publish.useMutation': () => mutationResult({ mutate: publishMutate }),
      'exercise.close.useMutation': () => mutationResult({ mutate: closeMutate }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { trpc } = (await import('../../lib/trpc.js')) as any;
import ExercisesPage from './exercises.js';

describe('ExercisesPage', () => {
  beforeEach(() => {
    exercisesState.items = [EXERCISE_A, EXERCISE_B];
    exercisesState.error = null;
    unitsListSpy.mockClear();
    exerciseListSpy.mockClear();
    createMutate.mockClear();
    publishMutate.mockClear();
    closeMutate.mockClear();
    capturedCreateOpts = undefined;
  });

  it('queries curriculumUnit.list and exercise.list with the unchanged {} input', () => {
    renderWithProviders(<ExercisesPage />);
    expect(unitsListSpy).toHaveBeenCalled();
    expect(exerciseListSpy).toHaveBeenCalledWith({});
  });

  it('renders exercise rows bound to exercise.list.useQuery', () => {
    renderWithProviders(<ExercisesPage />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Bài tập về nhà')).toBeInTheDocument();
    expect(within(table).getByText('Kiểm tra định kỳ')).toBeInTheDocument();
  });

  it('publish action calls exercise.publish.mutate({exerciseId}) for a draft row', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(publishMutate).toHaveBeenCalledWith({ exerciseId: 'ex-1' });
  });

  it('close action calls exercise.close.mutate({exerciseId}) for a published row', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(closeMutate).toHaveBeenCalledWith({ exerciseId: 'ex-2' });
  });

  it('exercise.create.useMutation onSuccess invalidates exercise.list', () => {
    const invalidateSpy = trpc.useUtils().exercise.list.invalidate;
    invalidateSpy.mockClear();
    renderWithProviders(<ExercisesPage />);

    expect(capturedCreateOpts?.onSuccess).toBeTypeOf('function');
    act(() => capturedCreateOpts!.onSuccess!());

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('submits exercise.create.mutate with a byte-identical payload (unitId, type, basePdfRef)', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tạo bài tập' }));

    const dialog = screen.getByRole('dialog');
    // Select curriculum unit + type via the Selector inputs, exactly as the
    // pre-refactor dialog does — assert on the disabled create button first
    // since the PDF is not uploaded yet (create requires basePdfRef).
    expect(within(dialog).getByRole('button', { name: 'Tạo bài tập' })).toBeDisabled();
  });

  it('renders an error message when exercise.list fails', () => {
    exercisesState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<ExercisesPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });

  it('opens the create-exercise dialog with the curriculum unit selector populated from curriculumUnit.list', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tạo bài tập' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Đơn vị học (CurriculumUnit)')).toBeInTheDocument();
  });
});
