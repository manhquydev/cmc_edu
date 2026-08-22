// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderWithProviders } from '../../test/render-with-providers.js';

// Locks students list FilterBar → student.lookup (name/phone) contract.
// Lookup only runs when query ≥2 chars; bulk copy uses clipboard when rows selected.

const STUDENTS = [
  { id: 'st-1', fullName: 'Nguyễn Văn A', lifecycle: 'active' },
  { id: 'st-2', fullName: 'Trần Thị B', lifecycle: 'active' },
];

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
        return queryResult(STUDENTS);
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

  it('hydrates an initial q deep link and preserves the query on row navigation', () => {
    const { router } = renderWithProviders(<StudentListPage />, {
      route: '/admin/students?q=Nguyễn&page=1',
    });
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    expect(router.state.location.pathname).toBe('/admin/students/st-1');
    expect(router.state.location.search).toBe('?q=Nguyễn&page=1');
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

  it('pins FilterBar text field width 180px on the real students ListPage', () => {
    const css = readFileSync(resolve(process.cwd(), '../../packages/ui/src/console.css'), 'utf8');
    const sheet = document.createElement('style');
    sheet.textContent = css;
    document.head.appendChild(sheet);
    try {
      renderWithProviders(<StudentListPage />, { route: '/admin/students' });
      const textField = document.querySelector('.console-filter-field--text') as HTMLElement | null;
      expect(textField).not.toBeNull();
      expect(getComputedStyle(textField!).width).toBe('180px');
    } finally {
      sheet.remove();
    }
  });
});
