// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the class-management UI gap fix: `classBatch.create` gộp sẵn tạo lớp
// + ScheduleSlot + sinh ClassSession trong 1 transaction
// (apps/api/src/class/class-batch-router.ts) nhưng trước phase này KHÔNG UI
// nào gọi nó — người dùng phải nhập UUID tay ở nơi khác hoặc không tạo được
// lớp. Test khoá payload chính xác của form (course dropdown, không phải
// paste UUID) và việc hiển thị slotsCreated/sessionsCreated sau khi tạo.
// `ClassListPage` reads `useSession()` (session-context.js -> trpc.js), so
// importing it pulls in this mocked module before this file's own top-level
// `const`s run — fixtures referenced directly (not inside a deferred
// closure) by the mock factory MUST be `vi.hoisted`, same as
// class-detail.test.tsx's CLASS/TEACHERS/SESSIONS/UNITS.
const { COURSES, TEACHERS, CLASSES, UNITS, navigateSpy } = vi.hoisted(() => ({
  COURSES: { items: [{ id: 'course-1', program: 'UCREA', name: 'UCREA Cấp 1' }] },
  TEACHERS: { items: [{ id: 't-1', fullName: 'Trần Thị B' }] },
  CLASSES: {
    items: [
      {
        id: 'class-1',
        code: 'HN-UCREA',
        program: 'UCREA',
        status: 'active',
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-12-01T00:00:00.000Z',
        teacherId: null,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  },
  UNITS: {
    items: [
      {
        id: 'unit-101',
        program: 'UCREA',
        title: 'Unit 1',
        orderGlobal: 101,
        level: 'U2',
        monthIndex: 1,
        unitType: 'core',
      },
    ],
  },
  // Spy navigate: createMemoryRouter + nested <Routes> hits RR7 data-router
  // AbortSignal errors in jsdom when asserting destination pages via real nav.
  navigateSpy: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

const courseListSpy = vi.fn();
const classBatchListSpy = vi.fn();
const pickListSpy = vi.fn();
const createMutate = vi.fn();
let createOnSuccess: ((res: unknown) => void) | undefined;

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
      'classBatch.list.useQuery': (...args: unknown[]) => {
        classBatchListSpy(...args);
        return queryResult(CLASSES);
      },
      'course.list.useQuery': (input: unknown) => {
        courseListSpy(input);
        return queryResult(COURSES);
      },
      'user.pickList.useQuery': (input: unknown) => {
        pickListSpy(input);
        return queryResult(TEACHERS);
      },
      'curriculumUnit.list.useQuery': () => queryResult(UNITS),
      'lmsOps.createClassWithUnits.useMutation': (opts: { onSuccess?: (res: unknown) => void }) => {
        createOnSuccess = opts?.onSuccess;
        return mutationResult({
          mutate: (...a: unknown[]) => {
            createMutate(...a);
          },
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import ClassListPage from './index.js';

function renderListPage(route = '/admin/classes') {
  return renderWithProviders(<ClassListPage />, { route });
}

async function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: '+ Tạo lớp' }));
}

async function selectFromDropdown(label: string | RegExp, optionName: string | RegExp) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
}

// `isRequired` fields append a " ∙ Required" badge inside the <label>, so an
// exact-string getByLabelText match fails — same reasoning as
// finance/receipt-create.test.tsx's `/^Họ tên học viên/` pattern. The weekday
// Selector and slot time TextInputs are NOT marked isRequired, so those keep
// exact-string matches.
//
// S6 fix: the course picker is now AsyncEntityCombobox, which renders a
// second labelled control — a "Khoá học — tìm kiếm" search TextInput
// alongside the "Khoá học ∙ Required" Selector. A bare `/^Khoá học/` prefix
// matches both; the negative lookahead excludes the search input specifically.
async function fillValidForm() {
  await openCreateDialog();
  await selectFromDropdown(/^Khoá học(?!\s*—)/, /UCREA Cấp 1/);
  await selectFromDropdown(/^Unit bắt đầu/, /#101/);
  fireEvent.change(screen.getByLabelText(/^Ngày bắt đầu \(YYYY-MM-DD\)/), { target: { value: '2026-08-01' } });
  fireEvent.change(screen.getByLabelText(/^Ngày kết thúc \(YYYY-MM-DD\)/), { target: { value: '2026-12-01' } });
  await selectFromDropdown('Thứ', 'Thứ 2');
  fireEvent.change(screen.getByLabelText('Giờ bắt đầu (HH:mm)'), { target: { value: '18:00' } });
  fireEvent.change(screen.getByLabelText('Giờ kết thúc (HH:mm)'), { target: { value: '19:30' } });
}

describe('ClassListPage — Tạo lớp', () => {
  beforeEach(() => {
    courseListSpy.mockClear();
    classBatchListSpy.mockClear();
    pickListSpy.mockClear();
    createMutate.mockClear();
    navigateSpy.mockClear();
    createOnSuccess = undefined;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hosts FilterBar and debounces search into classBatch.list({ search })', async () => {
    renderListPage();
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();
    classBatchListSpy.mockClear();
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'HN-UCREA' } });
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      expect(classBatchListSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'HN-UCREA', page: 1, pageSize: 20 }),
      );
    });
  });

  it('hydrates initial q/page deep links and preserves the query on row navigation', async () => {
    renderListPage('/admin/classes?q=HN-UCREA&page=2');
    await vi.advanceTimersByTimeAsync(350);

    expect(classBatchListSpy).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      search: 'HN-UCREA',
    });
    fireEvent.click(screen.getByText('HN-UCREA'));
    expect(navigateSpy).toHaveBeenCalledWith({
      pathname: '/admin/classes/class-1',
      search: '?q=HN-UCREA&page=2',
    });
  });

  it('queries course.list({page:1, pageSize:100}) and user.pickList({role: "giao_vien"}) to populate dropdowns instead of accepting a pasted UUID', async () => {
    renderListPage();
    await openCreateDialog();
    expect(courseListSpy).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    expect(pickListSpy).toHaveBeenCalledWith({ role: 'giao_vien' });
    // No free-text UUID field for course/teacher — only comboboxes.
    expect(screen.queryByLabelText(/Course ID|courseId/i)).not.toBeInTheDocument();
  });

  // S6 fix: course.list used to be a static pageSize:100 fetch with no search
  // affordance — course #101+ was unreachable in this create dialog.
  it('debounces the course search box into course.list({..., search})', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderListPage();
      await openCreateDialog();
      courseListSpy.mockClear();
      fireEvent.change(screen.getByLabelText('Khoá học — tìm kiếm'), {
        target: { value: 'UCREA' },
      });
      await vi.advanceTimersByTimeAsync(350);
      await waitFor(() => {
        expect(courseListSpy).toHaveBeenCalledWith({ page: 1, pageSize: 100, search: 'UCREA' });
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps "Tạo lớp" disabled until course, dates and a valid weekly slot are filled', async () => {
    renderListPage();
    await openCreateDialog();
    expect(screen.getByRole('button', { name: 'Tạo lớp' })).toBeDisabled();

    await fillValidForm();
    expect(screen.getByRole('button', { name: 'Tạo lớp' })).not.toBeDisabled();
  });

  it('calls lmsOps.createClassWithUnits.mutate with startUnitId + calendar payload', async () => {
    renderListPage();
    await fillValidForm();
    await selectFromDropdown('Giáo viên (tuỳ chọn)', 'Trần Thị B');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));

    expect(createMutate).toHaveBeenCalledWith({
      courseId: 'course-1',
      startUnitId: 'unit-101',
      startDate: '2026-08-01',
      endDate: '2026-12-01',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      teacherId: 't-1',
    });
  });

  it('omits teacherId from the payload when no teacher is picked (optional field)', async () => {
    renderListPage();
    await fillValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));

    expect(createMutate).toHaveBeenCalledWith({
      courseId: 'course-1',
      startUnitId: 'unit-101',
      startDate: '2026-08-01',
      endDate: '2026-12-01',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    expect(createMutate.mock.calls[0]?.[0]).not.toHaveProperty('teacherId');
  });

  it('shows stamped unit create result and "Xem lớp" navigates to the new class', async () => {
    renderListPage();
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo lớp' }));

    act(() =>
      createOnSuccess?.({
        classBatchId: 'cb-new',
        code: 'HN-UCREA-2026-001',
        sessionsCreated: 12,
        sessionsStamped: 12,
        startUnitOrderGlobal: 101,
      }),
    );

    expect(screen.getByText('Đã tạo lớp HN-UCREA-2026-001')).toBeInTheDocument();
    expect(
      screen.getByText(/Đã sinh 12 buổi, stamp 12 unit \(neo order 101\)/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem lớp' }));
    expect(navigateSpy).toHaveBeenCalledWith('/admin/classes/cb-new');
  });
});
