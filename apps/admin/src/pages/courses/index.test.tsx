// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/render-with-providers.js';

const createMutate = vi.fn();
const listQuerySpy = vi.fn();
let createOnSuccess: (() => void) | undefined;

const listState: {
  data:
    | {
        items: Array<{ id: string; name: string; program: string; createdAt: Date }>;
        total: number;
        page: number;
        pageSize: number;
      }
    | undefined;
} = {
  data: {
    items: [{ id: 'c1', name: 'Existing', program: 'UCREA', createdAt: new Date('2026-01-01') }],
    total: 1,
    page: 1,
    pageSize: 50,
  },
};

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult, mutationResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'course.list.useQuery': (...args: unknown[]) => {
        listQuerySpy(...args);
        return queryResult(listState.data);
      },
      'course.create.useMutation': (opts: { onSuccess?: () => void }) => {
        createOnSuccess = opts?.onSuccess;
        return mutationResult({
          mutate: (...a: unknown[]) => {
            createMutate(...a);
            createOnSuccess?.();
          },
          reset: vi.fn(),
        });
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import CourseListPage from './index.js';
import { trpc } from '../../lib/trpc.js';

describe('CourseListPage — Tạo khoá', () => {
  beforeEach(() => {
    createMutate.mockClear();
    listQuerySpy.mockClear();
    createOnSuccess = undefined;
    listState.data = {
      items: [{ id: 'c1', name: 'Existing', program: 'UCREA', createdAt: new Date('2026-01-01') }],
      total: 1,
      page: 1,
      pageSize: 50,
    };
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hosts FilterBar and debounces search + program into course.list', async () => {
    renderWithProviders(<CourseListPage />);
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();
    listQuerySpy.mockClear();
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Timeline' } });
    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => {
      expect(listQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Timeline', page: 1, pageSize: 20 }),
      );
    });
    listQuerySpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Chương trình' }));
    fireEvent.click(screen.getByRole('option', { name: 'UCREA' }));
    await waitFor(() => {
      expect(listQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({ program: 'UCREA', page: 1 }),
      );
    });
  });

  it('shows create action and keeps Tạo disabled until program + name are set', async () => {
    renderWithProviders(<CourseListPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tạo khoá' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Tạo', exact: true })).toBeDisabled();

    fireEvent.click(within(dialog).getByLabelText(/^Chương trình/));
    fireEvent.click(await screen.findByRole('option', { name: 'UCREA' }));
    fireEvent.change(within(dialog).getByLabelText(/^Tên khoá học/), {
      target: { value: 'UCREA Timeline 1' },
    });
    expect(within(dialog).getByRole('button', { name: 'Tạo', exact: true })).not.toBeDisabled();
  });

  it('calls course.create.mutate with program + name and invalidates list on success', async () => {
    const invalidateSpy = trpc.useUtils().course.list.invalidate as ReturnType<typeof vi.fn>;
    invalidateSpy.mockClear();

    renderWithProviders(<CourseListPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tạo khoá' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/^Chương trình/));
    fireEvent.click(await screen.findByRole('option', { name: 'UCREA' }));
    fireEvent.change(within(dialog).getByLabelText(/^Tên khoá học/), {
      target: { value: 'UCREA Timeline 1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo', exact: true }));

    expect(createMutate).toHaveBeenCalledWith({
      program: 'UCREA',
      name: 'UCREA Timeline 1',
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('lists existing courses from course.list with CategoryChip for program', () => {
    const { container } = renderWithProviders(<CourseListPage />);
    expect(screen.getByText('Existing')).toBeInTheDocument();
    const chip = container.querySelector('.console-category-chip[data-category="a"]');
    expect(chip).toBeTruthy();
    expect(chip).toHaveTextContent('UCREA');
  });

  it('shows first-run empty when no filters and total is 0', () => {
    listState.data = { items: [], total: 0, page: 1, pageSize: 20 };
    renderWithProviders(<CourseListPage />);
    expect(screen.getByText('Chưa có khoá học nào')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo khoá đầu tiên' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Tạo khoá' })).toHaveLength(1);
  });

  it('under-claims with a neutral string when filters are active and total is 0', async () => {
    listState.data = { items: [], total: 0, page: 1, pageSize: 20 };
    renderWithProviders(<CourseListPage />);
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'nope' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(screen.getByText('Không có khoá học khớp bộ lọc hiện tại')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có khoá học nào')).not.toBeInTheDocument();
  });
});
