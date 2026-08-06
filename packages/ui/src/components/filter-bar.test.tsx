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
  it('uses DateField for type=date', () => {
    renderBar({ value: { status: '', from: '2026-01-15', q: '' }, onChange: () => {} });
    const date = screen.getByLabelText('Từ ngày');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveValue('2026-01-15');
  });

  it('controlled onChange for date', () => {
    const onChange = vi.fn();
    renderBar({ value: { status: '', from: '', q: '' }, onChange });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-08-06' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-08-06' }),
    );
  });
});
