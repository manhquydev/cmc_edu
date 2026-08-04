// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './data-table.js';

const ROWS = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
];

describe('DataTable selection', () => {
  it('does not render checkboxes without selection props', () => {
    render(
      <DataTable
        columns={[{ key: 'name', label: 'Tên' }]}
        data={ROWS}
      />,
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('toggles a row and select-all', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={[{ key: 'name', label: 'Tên' }]}
        data={ROWS}
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    const boxes = screen.getAllByRole('checkbox');
    // header + 2 rows
    expect(boxes.length).toBe(3);

    fireEvent.click(screen.getAllByLabelText('Chọn dòng')[0]!);
    expect(onSelectionChange).toHaveBeenCalledWith(['a']);

    rerender(
      <DataTable
        columns={[{ key: 'name', label: 'Tên' }]}
        data={ROWS}
        selectedIds={['a']}
        onSelectionChange={onSelectionChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Chọn tất cả trên trang'));
    expect(onSelectionChange).toHaveBeenCalledWith(['a', 'b']);
  });
});
