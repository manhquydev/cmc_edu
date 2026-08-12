// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// List is index-only: row actions navigate to form; publish/close live on
// exercise-detail (not this page).

interface UnitItem {
  id: string;
  program: string;
  level: string;
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
const DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PUBLISHED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXERCISE_A: ExerciseItem = {
  id: DRAFT_ID,
  curriculumUnitId: 'unit-1',
  type: 'homework',
  status: 'draft',
};
const EXERCISE_B: ExerciseItem = {
  id: PUBLISHED_ID,
  curriculumUnitId: 'unit-1',
  type: 'test_periodic',
  status: 'published',
};

const exercisesState: { items: ExerciseItem[]; error: { message: string } | null } = {
  items: [EXERCISE_A, EXERCISE_B],
  error: null,
};
const unitsListSpy = vi.fn();
const exerciseListSpy = vi.fn();
const createMutate = vi.fn();
const navigateMock = vi.fn();
let capturedCreateOpts: { onSuccess?: () => void } | undefined;

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
    navigateMock.mockClear();
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

  it('list is index-only: Mở phiếu navigates to form; no list-row Công bố/Đóng', () => {
    renderWithProviders(<ExercisesPage />);
    expect(screen.queryByRole('button', { name: 'Công bố', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đóng', exact: true })).toBeNull();

    const openButtons = screen.getAllByRole('button', { name: 'Mở phiếu' });
    expect(openButtons).toHaveLength(2);
    fireEvent.click(openButtons[0]);
    expect(navigateMock).toHaveBeenCalledWith(`/teaching/exercises/${DRAFT_ID}`);
  });

  it('still offers Mở phiếu for closed rows (view-only form)', () => {
    const closedId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    exercisesState.items = [
      { id: closedId, curriculumUnitId: 'unit-1', type: 'homework', status: 'closed' },
    ];
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở phiếu' }));
    expect(navigateMock).toHaveBeenCalledWith(`/teaching/exercises/${closedId}`);
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
