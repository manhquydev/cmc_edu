// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';
import {
  buildDisplaySequence,
  canAddExercise,
  canSafelySaveSequence,
  exerciseSequencePath,
  hasAuthoritativeFreeze,
  isSequenceEmpty,
  isSequenceShort,
  moveTailId,
  nextDeliverySession,
  remainingSessionCount,
  tailExerciseIds,
} from './exercise-sequence-model.js';

const CLASS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EX_PUB_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EX_PUB_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EX_PUB_3 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EX_PUB_4 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const EX_DRAFT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const FOLDER_ID = '11111111-1111-4111-8111-111111111111';

const PAST = '2020-01-05T09:00:00.000Z';
const FUTURE_A = '2030-01-06T09:00:00.000Z';
const FUTURE_B = '2030-01-08T09:00:00.000Z';
const FUTURE_C = '2030-01-10T09:00:00.000Z';
const FUTURE_D = '2030-01-12T09:00:00.000Z';

const assignMutate = vi.fn();
const navigateMock = vi.fn();

const fixtures = vi.hoisted(() => ({
  sequenceItems: [] as { position: number; exerciseId: string }[],
  sessions: [] as Array<{
    id: string;
    status: string;
    sessionDate: string;
    endTime: string;
    curriculumUnitId: string | null;
  }>,
  exercises: [] as Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    folderId: string;
  }>,
  classStatus: 'active',
  roles: ['giam_doc_dao_tao'] as string[],
  deliveredOnSave: 0,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ classBatchId: CLASS_ID }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': () =>
        queryResult({
          userId: 'u-director',
          roles: fixtures.roles,
          facilityId: 'f1',
          config: { approvalSecondEyeThreshold: 20_000_000 },
        }),
      'classBatch.get.useQuery': () =>
        queryResult({
          id: CLASS_ID,
          code: 'CB001',
          program: 'IELTS',
          status: fixtures.classStatus,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
        }),
      'lmsOps.listExerciseSequence.useQuery': () =>
        queryResult({ items: fixtures.sequenceItems }),
      'classSession.list.useQuery': () => queryResult(fixtures.sessions),
      'exercise.list.useQuery': () => queryResult({ items: fixtures.exercises }),
      'exerciseFolder.list.useQuery': () =>
        queryResult({
          items: [{ id: FOLDER_ID, name: 'Học kỳ 1', description: null, archivedAt: null }],
        }),
      'lmsOps.assignExerciseSequence.useMutation': (opts?: {
        onSuccess?: (result: { deliveredCount: number; items: { position: number; exerciseId: string }[] }) => void;
      }) =>
        mutationResult({
          mutate: (input: { classBatchId: string; exerciseIds: string[] }) => {
            assignMutate(input);
            const items = input.exerciseIds.map((exerciseId, i) => ({
              position: i + 1,
              exerciseId,
            }));
            fixtures.sequenceItems = items;
            opts?.onSuccess?.({ deliveredCount: fixtures.deliveredOnSave, items });
          },
        }),
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ExerciseSequencePage from './exercise-sequence.js';

function published(id: string, title: string) {
  return { id, title, type: 'homework', status: 'published', folderId: FOLDER_ID };
}

describe('exercise-sequence-model', () => {
  const sessions = [
    { id: 's1', status: 'done', sessionDate: PAST, endTime: PAST, curriculumUnitId: 'u1' },
    { id: 's2', status: 'planned', sessionDate: FUTURE_A, endTime: FUTURE_A, curriculumUnitId: 'u1' },
    { id: 's3', status: 'cancelled', sessionDate: FUTURE_B, endTime: FUTURE_B, curriculumUnitId: 'u1' },
    { id: 's4', status: 'planned', sessionDate: FUTURE_C, endTime: FUTURE_C, curriculumUnitId: null },
  ];

  it('does not treat a session count as an authoritative freeze pointer', () => {
    expect(hasAuthoritativeFreeze(0, null)).toBe(true);
    expect(hasAuthoritativeFreeze(3, null)).toBe(false);
    expect(hasAuthoritativeFreeze(3, 1)).toBe(true);
    expect(
      canSafelySaveSequence({
        serverItemCount: 3,
        authoritativeDeliveredCount: null,
        dirty: true,
        tailIds: [EX_PUB_2],
        tailAllPublished: true,
        readOnly: false,
      }),
    ).toBe(false);
  });

  it('counts remaining sessions excluding cancelled and delivered slots', () => {
    expect(remainingSessionCount(sessions, 1)).toBe(2);
  });

  it('picks the next active session after the freeze pointer', () => {
    const next = nextDeliverySession(sessions, 1);
    expect(next?.id).toBe('s2');
  });

  it('sends only the unlocked tail to assignExerciseSequence', () => {
    const items = [
      { position: 1, exerciseId: EX_PUB_1 },
      { position: 2, exerciseId: EX_PUB_2 },
      { position: 3, exerciseId: EX_PUB_3 },
    ];
    expect(tailExerciseIds(items, 1)).toEqual([EX_PUB_2, EX_PUB_3]);
  });

  it('does not treat a draft as addable and rejects duplicates', () => {
    expect(
      canAddExercise({ status: 'draft', exerciseId: EX_DRAFT, alreadyInSequence: new Set() }),
    ).toBe(false);
    expect(
      canAddExercise({
        status: 'published',
        exerciseId: EX_PUB_1,
        alreadyInSequence: new Set([EX_PUB_1]),
      }),
    ).toBe(false);
    expect(
      canAddExercise({ status: 'published', exerciseId: EX_PUB_2, alreadyInSequence: new Set() }),
    ).toBe(true);
  });

  it('flags empty vs short sequences without inventing repeats', () => {
    expect(isSequenceEmpty(0)).toBe(true);
    expect(isSequenceShort(0, 4)).toBe(false);
    expect(isSequenceShort(2, 4)).toBe(true);
    expect(isSequenceShort(4, 4)).toBe(false);
    // Mid-class: 3 delivered + 3 tail vs 5 remaining — warn on the tail, not total length.
    expect(isSequenceShort(3, 5)).toBe(true);
    expect(isSequenceShort(6, 5)).toBe(false);
  });

  it('reorders only the tail and keeps frozen prefix positions', () => {
    expect(moveTailId([EX_PUB_2, EX_PUB_3], 0, 1)).toEqual([EX_PUB_3, EX_PUB_2]);
    expect(buildDisplaySequence([{ position: 1, exerciseId: EX_PUB_1 }], [EX_PUB_3], 1)).toEqual([
      { position: 1, exerciseId: EX_PUB_1 },
      { position: 2, exerciseId: EX_PUB_3 },
    ]);
  });

  it('builds the teaching work-surface path from the class id', () => {
    expect(exerciseSequencePath(CLASS_ID)).toBe(`/teaching/classes/${CLASS_ID}/exercise-sequence`);
  });
});

describe('ExerciseSequencePage', () => {
  beforeEach(() => {
    assignMutate.mockClear();
    navigateMock.mockClear();
    fixtures.classStatus = 'active';
    fixtures.roles = ['giam_doc_dao_tao'];
    fixtures.deliveredOnSave = 0;
    fixtures.sequenceItems = [];
    fixtures.sessions = [
      { id: 's1', status: 'done', sessionDate: PAST, endTime: PAST, curriculumUnitId: 'u1' },
      { id: 's2', status: 'planned', sessionDate: FUTURE_A, endTime: FUTURE_A, curriculumUnitId: 'u1' },
      { id: 's3', status: 'planned', sessionDate: FUTURE_B, endTime: FUTURE_B, curriculumUnitId: 'u1' },
      { id: 's4', status: 'planned', sessionDate: FUTURE_C, endTime: FUTURE_C, curriculumUnitId: 'u1' },
      { id: 's5', status: 'planned', sessionDate: FUTURE_D, endTime: FUTURE_D, curriculumUnitId: 'u1' },
    ];
    fixtures.exercises = [
      published(EX_PUB_1, 'Bài nghe 1'),
      published(EX_PUB_2, 'Bài nói 2'),
      published(EX_PUB_3, 'Bài đọc 3'),
      published(EX_PUB_4, 'Bài viết 4'),
      { id: EX_DRAFT, title: 'Nháp chưa công bố', type: 'homework', status: 'draft', folderId: FOLDER_ID },
    ];
  });

  it('shows a danger warning when the class has no sequence', () => {
    renderWithProviders(<ExerciseSequencePage />);
    expect(screen.getAllByText('Lớp chưa có dãy bài').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/không có bài tập nào được phát/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu dãy' })).toBeDisabled();
  });

  it('hides draft exercises from the library and does not offer them as addable', () => {
    renderWithProviders(<ExerciseSequencePage />);
    expect(screen.queryByText('Nháp chưa công bố')).toBeNull();
    expect(screen.getByText('Bài nghe 1')).toBeInTheDocument();
  });

  it('adds published exercises and warns when the sequence is shorter than remaining sessions', () => {
    renderWithProviders(<ExerciseSequencePage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm' })[0]!);
    expect(screen.getByText(/Dãy ngắn hơn số buổi còn lại/)).toBeInTheDocument();
    expect(screen.getByText(/Không tự lặp lại bài/)).toBeInTheDocument();
  });

  it('refuses to save an existing sequence until deliveredCount is known', () => {
    fixtures.sequenceItems = [
      { position: 1, exerciseId: EX_PUB_1 },
      { position: 2, exerciseId: EX_PUB_2 },
      { position: 3, exerciseId: EX_PUB_3 },
    ];
    renderWithProviders(<ExerciseSequencePage />);
    expect(screen.getByText(/Chưa biết biên đã phát/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu dãy' })).toBeDisabled();
    expect(assignMutate).not.toHaveBeenCalled();
  });

  it('locks delivered positions after an authoritative save and sends only the tail next', () => {
    fixtures.deliveredOnSave = 1;
    renderWithProviders(<ExerciseSequencePage />);
    for (const btn of screen.getAllByRole('button', { name: 'Thêm' }).slice(0, 3)) {
      fireEvent.click(btn);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Lưu dãy' }));
    expect(assignMutate).toHaveBeenCalledWith({
      classBatchId: CLASS_ID,
      exerciseIds: [EX_PUB_1, EX_PUB_2, EX_PUB_3],
    });
    expect(screen.getByText(/Đã phát — khoá/)).toBeInTheDocument();
    expect(screen.getByText(/không sửa được vì học sinh đã nhận bài này/)).toBeInTheDocument();
    expect(screen.getByText(/Vị trí kế tiếp sẽ phát vào buổi/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Xuống' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu dãy' }));
    expect(assignMutate).toHaveBeenLastCalledWith({
      classBatchId: CLASS_ID,
      exerciseIds: [EX_PUB_3, EX_PUB_2],
    });
  });

  it('can assemble a sequence of at least four published exercises', () => {
    renderWithProviders(<ExerciseSequencePage />);
    const addButtons = screen.getAllByRole('button', { name: 'Thêm' });
    expect(addButtons.length).toBeGreaterThanOrEqual(4);
    for (const btn of addButtons.slice(0, 4)) fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu dãy' }));
    expect(assignMutate).toHaveBeenCalledWith({
      classBatchId: CLASS_ID,
      exerciseIds: [EX_PUB_1, EX_PUB_2, EX_PUB_3, EX_PUB_4],
    });
  });

  it('blocks the screen when the caller lacks exercise.manage', () => {
    fixtures.roles = ['giao_vien'];
    renderWithProviders(<ExerciseSequencePage />);
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(screen.queryByText('Thư viện (đã công bố)')).toBeNull();
  });
});
