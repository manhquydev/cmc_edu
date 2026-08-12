// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

interface FolderItem {
  id: string;
  name: string;
  description: string | null;
  archivedAt: Date | null;
}

interface ExerciseItem {
  id: string;
  folderId: string;
  title: string;
  type: string;
  status: string;
}

const FOLDER_A: FolderItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Chưa phân loại',
  description: null,
  archivedAt: null,
};
const DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PUBLISHED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXERCISE_A: ExerciseItem = {
  id: DRAFT_ID,
  folderId: FOLDER_A.id,
  title: 'Bài tập buổi 1',
  type: 'homework',
  status: 'draft',
};
const EXERCISE_B: ExerciseItem = {
  id: PUBLISHED_ID,
  folderId: FOLDER_A.id,
  title: 'Kiểm tra giữa kỳ',
  type: 'test_periodic',
  status: 'published',
};

const foldersState: { items: FolderItem[]; error: { message: string } | null } = {
  items: [FOLDER_A],
  error: null,
};
const exercisesState: { items: ExerciseItem[]; error: { message: string } | null } = {
  items: [EXERCISE_A, EXERCISE_B],
  error: null,
};
const folderListSpy = vi.fn();
const exerciseListSpy = vi.fn();
const createMutate = vi.fn();
const createFolderMutate = vi.fn();
const updateFolderMutate = vi.fn();
const archiveFolderMutate = vi.fn();
const navigateMock = vi.fn();
let capturedCreateOpts: { onSuccess?: () => void } | undefined;
let capturedCreateFolderOpts: { onSuccess?: (row: FolderItem) => void } | undefined;

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
      'exerciseFolder.list.useQuery': () => {
        folderListSpy();
        return queryResult(
          { items: foldersState.items },
          { error: foldersState.error, isError: foldersState.error !== null },
        );
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
      'exerciseFolder.create.useMutation': (opts: { onSuccess?: (row: FolderItem) => void }) => {
        capturedCreateFolderOpts = opts;
        return mutationResult({ mutate: createFolderMutate });
      },
      'exerciseFolder.update.useMutation': () => mutationResult({ mutate: updateFolderMutate }),
      'exerciseFolder.archive.useMutation': () => mutationResult({ mutate: archiveFolderMutate }),
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
    foldersState.items = [FOLDER_A];
    foldersState.error = null;
    exercisesState.items = [EXERCISE_A, EXERCISE_B];
    exercisesState.error = null;
    folderListSpy.mockClear();
    exerciseListSpy.mockClear();
    createMutate.mockClear();
    createFolderMutate.mockClear();
    updateFolderMutate.mockClear();
    archiveFolderMutate.mockClear();
    navigateMock.mockClear();
    capturedCreateOpts = undefined;
    capturedCreateFolderOpts = undefined;
  });

  it('queries exerciseFolder.list and exercise.list by the selected folder', () => {
    renderWithProviders(<ExercisesPage />);
    expect(folderListSpy).toHaveBeenCalled();
    expect(exerciseListSpy).toHaveBeenCalledWith({ folderId: FOLDER_A.id });
  });

  it('renders folder name and exercise title / type / status', () => {
    renderWithProviders(<ExercisesPage />);
    expect(screen.getAllByText('Chưa phân loại').length).toBeGreaterThanOrEqual(1);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Bài tập buổi 1')).toBeInTheDocument();
    expect(within(table).getByText('Kiểm tra giữa kỳ')).toBeInTheDocument();
    expect(within(table).getByText('Bài tập về nhà')).toBeInTheDocument();
    expect(within(table).getByText('Kiểm tra định kỳ')).toBeInTheDocument();
    expect(within(table).getByText('Nháp')).toBeInTheDocument();
  });

  it('does not mention curriculum unit on the library screen', () => {
    renderWithProviders(<ExercisesPage />);
    expect(screen.queryByText(/CurriculumUnit/)).toBeNull();
    expect(screen.queryByText('Đơn vị học')).toBeNull();
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
      {
        id: closedId,
        folderId: FOLDER_A.id,
        title: 'Bài đã đóng',
        type: 'homework',
        status: 'closed',
      },
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

  it('create-exercise dialog is disabled until title, type and PDF are set', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tạo bài tập' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Thư mục: Chưa phân loại/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tạo bài tập' })).toBeDisabled();
  });

  it('opens the create-folder dialog from the folder pane', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Thư mục' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Tạo thư mục' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tạo thư mục' })).toBeDisabled();
    expect(capturedCreateFolderOpts?.onSuccess).toBeTypeOf('function');
  });

  it('asks before archiving a folder and calls exerciseFolder.archive', () => {
    renderWithProviders(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn thư mục' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Dãy bài đã gán cho lớp không đổi/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ẩn thư mục' }));
    expect(archiveFolderMutate).toHaveBeenCalledWith({ folderId: FOLDER_A.id });
  });

  it('filters the long list by title locally', () => {
    renderWithProviders(<ExercisesPage />);
    const search = screen.getByLabelText('Tìm kiếm');
    fireEvent.change(search, { target: { value: 'giữa kỳ' } });
    const table = screen.getByRole('table');
    expect(within(table).getByText('Kiểm tra giữa kỳ')).toBeInTheDocument();
    expect(within(table).queryByText('Bài tập buổi 1')).toBeNull();
  });

  it('renders an error message when exercise.list fails', () => {
    exercisesState.error = { message: 'Lỗi mạng' };
    renderWithProviders(<ExercisesPage />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });
});
