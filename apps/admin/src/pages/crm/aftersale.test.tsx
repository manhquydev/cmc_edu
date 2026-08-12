// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks the after-sale case screen wired to the real `afterSale` router
// (list/create/advance/resolve/close — apps/api/src/after-sale/router.ts):
// - list renders from the server response (studentName resolved server-side)
// - the status filter re-queries with the chosen status
// - the "Tạo case" dialog picks a student via the shared StudentPicker
//   (student.lookup) and calls `afterSale.create.mutate` with the exact
//   {studentId, description, priority} payload
// - list is index-only: lifecycle HITL is on form /crm/aftersale/:id
interface CaseRowMock {
  id: string;
  studentId: string;
  studentName: string | null;
  priority: string;
  status: string;
  description: string;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// Deliberately distinct from the case rows' student names below so the
// picker's search-result text can never collide with a list row's text.
const STUDENT_RESULTS = [{ id: 'st-pick', fullName: 'Lê Thị C', lifecycle: 'active' }];

const CASE_OPEN: CaseRowMock = {
  id: 'case-1',
  studentId: 'st-1',
  studentName: 'Nguyễn Văn A',
  priority: 'normal',
  status: 'open',
  description: 'Phàn nàn về lịch học',
  resolution: null,
  resolvedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const CASE_RESOLVED: CaseRowMock = {
  id: 'case-2',
  studentId: 'st-2',
  studentName: 'Trần Thị B',
  priority: 'high',
  status: 'resolved',
  description: 'Đổi lớp học',
  resolution: 'Đã đổi lớp',
  resolvedAt: '2026-07-02T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
};

const listState: { data: { items: CaseRowMock[]; total: number; page: number; pageSize: number } } = {
  data: { items: [CASE_OPEN, CASE_RESOLVED], total: 2, page: 1, pageSize: 20 },
};
const listQuerySpy = vi.fn();
const studentLookupSpy = vi.fn();
const createMutate = vi.fn();
const advanceMutate = vi.fn();
const resolveMutate = vi.fn();
const closeMutate = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['sale'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'afterSale.list.useQuery': (input: unknown) => {
        listQuerySpy(input);
        return queryResult(listState.data);
      },
      'afterSale.create.useMutation': () => mutationResult({ mutate: createMutate }),
      'afterSale.advance.useMutation': () => mutationResult({ mutate: advanceMutate }),
      'afterSale.resolve.useMutation': () => mutationResult({ mutate: resolveMutate }),
      'afterSale.close.useMutation': () => mutationResult({ mutate: closeMutate }),
      'student.lookup.useQuery': (input: unknown, opts?: { enabled?: boolean }) => {
        studentLookupSpy(input);
        if (!opts?.enabled) return queryResult(undefined, { isFetching: false });
        return queryResult(STUDENT_RESULTS, { isFetching: false });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import AfterSalePage from './aftersale.js';

describe('AfterSalePage', () => {
  beforeEach(() => {
    listState.data = { items: [CASE_OPEN, CASE_RESOLVED], total: 2, page: 1, pageSize: 20 };
    listQuerySpy.mockClear();
    studentLookupSpy.mockClear();
    createMutate.mockClear();
    advanceMutate.mockClear();
    resolveMutate.mockClear();
    closeMutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render the stale "no backend" EmptyState stub', () => {
    renderWithProviders(<AfterSalePage />);
    expect(screen.queryByText('Tính năng chưa áp dụng')).not.toBeInTheDocument();
  });

  it('renders cases from afterSale.list', () => {
    renderWithProviders(<AfterSalePage />);
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Phàn nàn về lịch học')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
  });

  it('queries afterSale.list with {page: 1, pageSize: 20} by default (no status key)', () => {
    renderWithProviders(<AfterSalePage />);
    expect(listQuerySpy).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('re-queries with the chosen status when the status filter changes', () => {
    renderWithProviders(<AfterSalePage />);
    listQuerySpy.mockClear();
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(screen.getByRole('option', { name: 'Mở' }));
    expect(listQuerySpy).toHaveBeenCalledWith({ status: 'open', page: 1, pageSize: 20 });
  });

  it('renders FilterBar search region and ListPagination footer', () => {
    renderWithProviders(<AfterSalePage />);
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument();
  });

  it('list is index-only: open form only (no lifecycle HITL on rows)', () => {
    renderWithProviders(<AfterSalePage />);
    expect(screen.getAllByRole('button', { name: 'Mở phiếu' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Tiếp nhận' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Giải quyết' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đóng' })).toBeNull();
    expect(advanceMutate).not.toHaveBeenCalled();
    expect(closeMutate).not.toHaveBeenCalled();
    expect(resolveMutate).not.toHaveBeenCalled();
  });

  it('opens the create-case dialog, picks a student via StudentPicker, and calls afterSale.create.mutate with {studentId, description, priority}', () => {
    vi.useFakeTimers();
    renderWithProviders(<AfterSalePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo case' }));
    expect(screen.getByText('Tạo case chăm sóc sau bán')).toBeInTheDocument();

    // Astryx appends " ∙ Required" to an `isRequired` field's accessible
    // label — regex-match the leading text (same convention as
    // create-lead-dialog.test.tsx's `/^Họ tên/`).
    fireEvent.change(screen.getByLabelText(/^Học viên/), { target: { value: 'Lê Thị' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText('Lê Thị C'));

    fireEvent.change(screen.getByLabelText(/^Mô tả/), { target: { value: 'Cần chăm sóc thêm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }));

    expect(createMutate).toHaveBeenCalledWith(
      { studentId: 'st-pick', description: 'Cần chăm sóc thêm', priority: 'normal' },
      expect.anything(),
    );
  });

  it('closes the create-case dialog after a successful create', () => {
    vi.useFakeTimers();
    renderWithProviders(<AfterSalePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo case' }));
    fireEvent.change(screen.getByLabelText(/^Học viên/), { target: { value: 'Lê Thị' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText('Lê Thị C'));
    fireEvent.change(screen.getByLabelText(/^Mô tả/), { target: { value: 'Cần chăm sóc thêm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }));

    const [, callOptions] = createMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    act(() => callOptions.onSuccess?.());

    const dialogEl = screen.getByText('Tạo case chăm sóc sau bán').closest('dialog');
    expect(dialogEl?.hasAttribute('open')).toBe(false);
  });

  it('does not render pictographic emoji anywhere on the screen', () => {
    const { container } = renderWithProviders(<AfterSalePage />);
    // eslint-disable-next-line no-misleading-character-class
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
