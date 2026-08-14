// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks students list FilterBar → student.lookup (name/phone) contract.
// Lookup only runs when query ≥2 chars; bulk copy uses clipboard when rows selected.

const STUDENTS = [
  { id: 'st-1', fullName: 'Nguyễn Văn A', lifecycle: 'active' },
  { id: 'st-2', fullName: 'Trần Thị B', lifecycle: 'active' },
];

/** `student.lookup` caps at LOOKUP_LIMIT=20 — a full page means "maybe more". */
const CAPPED_STUDENTS = Array.from({ length: 20 }, (_, i) => ({
  id: `st-${i + 1}`,
  fullName: `Học viên ${i + 1}`,
  lifecycle: 'active',
}));

let lookupRows: { id: string; fullName: string; lifecycle: string }[] = STUDENTS;
let lookupError: { message: string } | null = null;

const lookupSpy = vi.fn();

vi.mock('../../lib/trpc.js', async () => {
  const { buildTrpcMock, queryResult } = await import('../../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock({
      'session.me.useQuery': queryResult({
        userId: 'u1',
        roles: ['giam_doc_dao_tao'],
        facilityId: 'f1',
        config: { approvalSecondEyeThreshold: 20_000_000 },
      }),
      'student.lookup.useQuery': (input: unknown, opts?: { enabled?: boolean }) => {
        lookupSpy(input, opts);
        if (!opts?.enabled) return queryResult(undefined);
        if (lookupError) {
          return queryResult(undefined, { isError: true, isSuccess: false, error: lookupError });
        }
        return queryResult(lookupRows);
      },
    }),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import StudentListPage from './index.js';

describe('StudentListPage', () => {
  beforeEach(() => {
    lookupSpy.mockClear();
    lookupRows = STUDENTS;
    lookupError = null;
  });

  it('shows the ≥2 char hint and does not query lookup until enough input', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    expect(screen.getByText(/ít nhất 2 ký tự/i)).toBeInTheDocument();
    // enabled: false calls still hit the mock; last call should be disabled.
    const last = lookupSpy.mock.calls.at(-1);
    expect(last?.[1]?.enabled).toBe(false);
  });

  it('renders FilterBar and queries student.lookup by name when typing ≥2 chars', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    expect(lookupSpy).toHaveBeenCalledWith(
      { name: 'Nguyễn' },
      expect.objectContaining({ enabled: true }),
    );
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getAllByText('Đang học').length).toBeGreaterThanOrEqual(2);
  });

  it('queries by phone when the filter starts with a digit', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: '0901' } });
    expect(lookupSpy).toHaveBeenCalledWith(
      { phone: '0901' },
      expect.objectContaining({ enabled: true }),
    );
  });

  it('renders ListPagination after a successful search', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument();
  });

  it('enables bulk copy of selected student names', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);

    const bulkBtn = screen.getByRole('button', { name: 'Sao chép tên' });
    expect(bulkBtn).not.toBeDisabled();
    fireEvent.click(bulkBtn);
    expect(writeText).toHaveBeenCalled();
  });

  // `student.lookup` never reports how many students the facility has, so an
  // empty result may not claim `first-run` or `filtered`. Neutral string only.
  it('says nothing it cannot know when the lookup returns zero rows', () => {
    lookupRows = [];
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    expect(screen.getByText(/Không tìm thấy học viên khớp từ khóa này/)).toBeInTheDocument();
    expect(document.querySelector('[data-empty-kind]')).toBeNull();
    expect(screen.queryByText(/Chưa có học viên nào/)).toBeNull();
    expect(screen.queryByText(/bộ lọc/i)).toBeNull();
  });

  it('keeps the search-gated hint instead of a first-run story before 2 chars', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    expect(screen.getByText(/ít nhất 2 ký tự/i)).toBeInTheDocument();
    expect(document.querySelector('[data-empty-kind]')).toBeNull();
  });

  it('under-claims in kanban view too when nothing matches', () => {
    lookupRows = [];
    renderWithProviders(<StudentListPage />, { route: '/admin/students?view=kanban' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    expect(screen.getByText(/Không tìm thấy học viên khớp từ khóa này/)).toBeInTheDocument();
    expect(document.querySelector('[data-empty-kind]')).toBeNull();
    // Kanban branch, not the table falling back to its own empty copy.
    expect(document.querySelector('.console-list')).toBeNull();
  });

  it('reports a failed kanban lookup as a failure, not as "no match"', () => {
    lookupError = { message: 'Mất kết nối' };
    renderWithProviders(<StudentListPage />, { route: '/admin/students?view=kanban' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    expect(screen.getByText(/Không tải được danh sách học viên: Mất kết nối/)).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy học viên khớp từ khóa này/)).toBeNull();
  });

  it('exposes no sortable column — student.lookup accepts no sort field', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    expect(document.querySelector('[aria-sort]')).toBeNull();
    expect(document.querySelector('.console-list-sort')).toBeNull();
  });

  it('never offers select-all-matching: a capped lookup knows no total', () => {
    lookupRows = CAPPED_STUDENTS;
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Học' } });

    // Page fully selected (10 of the 20 loaded rows) — the widen prompt's trigger.
    fireEvent.click(screen.getByLabelText('Chọn tất cả trên trang'));
    const bulkBar = screen.getByRole('toolbar', { name: 'Thao tác hàng loạt' });
    expect(within(bulkBar).getByText('10')).toBeInTheDocument();

    expect(document.querySelector('.console-bulk-widen')).toBeNull();
    expect(screen.queryByText(/khớp bộ lọc/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Chọn tất cả \d+/ })).toBeNull();
  });

  it('warns that a full result page is the lookup cap, not the match count', () => {
    lookupRows = CAPPED_STUDENTS;
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Học' } });

    expect(screen.getByText(/giới hạn 20 kết quả tra cứu/)).toBeInTheDocument();
  });

  it('drops the cap warning when the result set is below the limit', () => {
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Nguyễn' } });

    expect(screen.queryByText(/giới hạn 20 kết quả tra cứu/)).toBeNull();
  });

  it('pins the Odoo search box height 35px on the real students ListPage', () => {
    const css = readFileSync(resolve(process.cwd(), '../../packages/ui/src/console.css'), 'utf8');
    expect(css).toMatch(
      /\.o_web_client \.console-search-box[\s\S]{0,400}height:\s*var\(--console-search-height,\s*35px\)/,
    );
    renderWithProviders(<StudentListPage />, { route: '/admin/students' });
    expect(document.querySelector('.console-search-box')).not.toBeNull();
  });
});
