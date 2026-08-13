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

describe('DataTable row keyboard', () => {
  const columns = [{ key: 'name', label: 'Tên' }];

  it('exposes one role=button tabIndex=0 entry per row when onRowClick is set', () => {
    render(<DataTable columns={columns} data={ROWS} onRowClick={() => undefined} />);

    const entries = screen.getAllByRole('button', { name: /Mở dòng/ });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveAttribute('tabindex', '0');
    expect(entries[1]).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Mở dòng Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở dòng Beta' })).toBeInTheDocument();
  });

  it('calls onRowClick with the row on Enter', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={ROWS} onRowClick={onRowClick} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Mở dòng Alpha' }), {
      key: 'Enter',
    });
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it('calls onRowClick with the row on Space', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={ROWS} onRowClick={onRowClick} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Mở dòng Beta' }), {
      key: ' ',
    });
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it('does not call onRowClick when click or Enter hits a child button', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[
          {
            key: 'name',
            label: 'Tên',
            render: (_value, row) => (
              <>
                {String(row['name'])}
                <button type="button">Hành động</button>
              </>
            ),
          },
        ]}
        data={ROWS}
        onRowClick={onRowClick}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Hành động' })[0]!);
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'Hành động' })[0]!, {
      key: 'Enter',
    });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('does not expose a keyboard entry without onRowClick', () => {
    render(<DataTable columns={columns} data={ROWS} />);
    expect(screen.queryByRole('button', { name: /Mở dòng/ })).toBeNull();
  });

  it('labels the entry from rendered first-cell text, not String(object)', () => {
    render(
      <DataTable
        columns={[
          {
            key: 'appUser',
            label: 'Nhân viên',
            render: (_value, row) =>
              (row['appUser'] as { fullName: string }).fullName,
          },
          { key: 'id', label: 'Mã' },
        ]}
        data={[{ id: 'a', appUser: { fullName: 'Nguyễn Văn A' } }]}
        onRowClick={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mở dòng Nguyễn Văn A' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.queryByRole('button', { name: /object Object/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Mở dòng/ })).toHaveLength(1);
    expect(screen.getByText('a').closest('[role="button"]')).toBeNull();
  });

  it('still opens the row on mouse click of the entry or another cell', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Tên' },
          { key: 'id', label: 'Mã' },
        ]}
        data={ROWS}
        onRowClick={onRowClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở dòng Alpha' }));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);

    fireEvent.click(screen.getByText('b'));
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1]);
  });
});

describe('DataTable empty', () => {
  it('uses ops EmptyState density', () => {
    render(<DataTable columns={[{ key: 'name', label: 'Tên' }]} data={[]} />);
    expect(screen.getByText('Không có dữ liệu')).toBeTruthy();
    expect(document.querySelector('.console-empty-ops')).not.toBeNull();
  });
});
