import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { FilterBar } from './filter-bar.js';
import type { FilterDef } from './filter-bar.js';

const FILTERS: FilterDef[] = [
  { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'a', label: 'A' }] },
  { key: 'from', label: 'Từ ngày', type: 'date' },
  { key: 'q', label: 'Tìm', type: 'text', placeholder: 'Search' },
];

function renderBar(props: Partial<ComponentProps<typeof FilterBar>> = {}) {
  return render(
    <MemoryRouter>
      <FilterBar filters={FILTERS} {...props} />
    </MemoryRouter>,
  );
}

describe('FilterBar', () => {
  it('uses DateField for type=date after opening the filters menu', () => {
    renderBar({ value: { status: '', from: '2026-01-15', q: '' }, onChange: () => {} });
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
    const date = screen.getByLabelText('Từ ngày');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveValue('2026-01-15');
  });

  it('controlled onChange for date', () => {
    const onChange = vi.fn();
    renderBar({ value: { status: '', from: '', q: '' }, onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-08-06' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-08-06' }),
    );
  });

  it('exposes role=search landmark', () => {
    renderBar({ value: { status: '', from: '', q: '' }, onChange: () => {} });
    expect(screen.getByRole('search', { name: 'Bộ lọc' })).toBeInTheDocument();
  });

  it('puts text search in the chrome box without inline width', () => {
    const { container } = renderBar({ value: { status: '', from: '', q: '' }, onChange: () => {} });
    const input = container.querySelector('.console-search-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.style.width).toBe('');
    expect(input.getAttribute('aria-label')).toBe('Tìm');
  });

  it('fires onChange when a select option is chosen from the filters menu', () => {
    const onChange = vi.fn();
    renderBar({ value: { status: '', from: '', q: '' }, onChange });
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc nâng cao' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }));
    fireEvent.click(screen.getByRole('option', { name: 'A' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'a' }));
  });

  it('renders a gray facet chip for an active extra filter and clears it', () => {
    const onChange = vi.fn();
    renderBar({ value: { status: 'a', from: '', q: '' }, onChange });
    expect(screen.getByText('Trạng thái: A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Trạng thái' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: '' }));
  });

  it('respects hasClear: false on select filters (default-domain hygiene)', () => {
    const filters: FilterDef[] = [
      {
        key: 'lost',
        label: 'Hiển thị',
        type: 'select',
        options: [
          { value: 'exclude', label: 'Đang chăm sóc' },
          { value: 'include', label: 'Tất cả' },
        ],
        placeholder: 'Đang chăm sóc',
        hasClear: false,
      },
    ];
    render(
      <MemoryRouter>
        <FilterBar filters={filters} value={{ lost: 'exclude' }} onChange={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('combobox', { name: 'Hiển thị' })).toHaveTextContent('Đang chăm sóc');
    expect(screen.queryByRole('button', { name: 'Bộ lọc nâng cao' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear|xóa|×/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Hiển thị:/)).toBeNull();
  });
});
