// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './data-table.js';
import { BulkActionBar } from './bulk-action-bar.js';

const ROWS = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
];

const COLS = [{ key: 'name', label: 'Tên' }];

describe('empty table tells which of the three stories applies', () => {
  it('publishes the kind and the recovery action for a filtered list', () => {
    render(
      <DataTable
        columns={COLS}
        data={[]}
        empty={{
          kind: 'filtered',
          title: 'Không phiếu nào khớp bộ lọc này',
          description: 'Bỏ một điều kiện để thấy các phiếu còn lại.',
          action: <button type="button">Bỏ tất cả bộ lọc</button>,
        }}
      />,
    );
    expect(document.querySelector('[data-empty-kind="filtered"]')).not.toBeNull();
    expect(screen.getByText('Không phiếu nào khớp bộ lọc này')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bỏ tất cả bộ lọc' })).toBeTruthy();
  });

  it('distinguishes first-run from done', () => {
    const { rerender } = render(
      <DataTable columns={COLS} data={[]} empty={{ kind: 'first-run', title: 'Chưa có phiếu' }} />,
    );
    expect(document.querySelector('[data-empty-kind="first-run"]')).not.toBeNull();
    rerender(
      <DataTable columns={COLS} data={[]} empty={{ kind: 'done', title: 'Hết phiếu chờ bạn' }} />,
    );
    expect(document.querySelector('[data-empty-kind="done"]')).not.toBeNull();
  });

  it('claims no story when the caller passes only a string', () => {
    render(<DataTable columns={COLS} data={[]} empty="Không có dữ liệu" />);
    expect(document.querySelector('[data-empty-kind]')).toBeNull();
  });
});

describe('sortable columns publish aria-sort on the header cell', () => {
  it('marks a sortable-but-inactive column as none, not absent', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Tên', sortable: true },
          { key: 'other', label: 'Khác' },
        ]}
        data={ROWS}
        sort={{ key: 'other', direction: 'ascending' }}
        onSortChange={vi.fn()}
      />,
    );
    const sorted = [...document.querySelectorAll('th')].filter((th) =>
      th.hasAttribute('aria-sort'),
    );
    expect(sorted).toHaveLength(1);
    expect(sorted[0]?.getAttribute('aria-sort')).toBe('none');
  });

  it('reflects the active direction and toggles it', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={[{ key: 'name', label: 'Tên', sortable: true }]}
        data={ROWS}
        sort={{ key: 'name', direction: 'ascending' }}
        onSortChange={onSortChange}
      />,
    );
    expect(document.querySelector('th[aria-sort="ascending"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tên/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'descending' });
    rerender(
      <DataTable
        columns={[{ key: 'name', label: 'Tên', sortable: true }]}
        data={ROWS}
        sort={{ key: 'name', direction: 'descending' }}
        onSortChange={onSortChange}
      />,
    );
    expect(document.querySelector('th[aria-sort="descending"]')).not.toBeNull();
  });

  it('renders a plain header when the caller wires no sort handler', () => {
    render(
      <DataTable columns={[{ key: 'name', label: 'Tên', sortable: true }]} data={ROWS} />,
    );
    expect(screen.queryByRole('button', { name: /Tên/ })).toBeNull();
  });
});

describe('density remaps row measurement only', () => {
  it('leaves the contract row height alone by default', () => {
    render(<DataTable columns={COLS} data={ROWS} />);
    expect(document.querySelector('.console-list')?.getAttribute('data-density')).toBeNull();
  });

  it('marks compact and comfortable on the list wrapper', () => {
    const { rerender } = render(<DataTable columns={COLS} data={ROWS} density="compact" />);
    expect(document.querySelector('.console-list[data-density="compact"]')).not.toBeNull();
    rerender(<DataTable columns={COLS} data={ROWS} density="comfortable" />);
    expect(document.querySelector('.console-list[data-density="comfortable"]')).not.toBeNull();
  });
});

describe('bulk selection never overstates its scope', () => {
  it('offers the wider selection only when the page is full and more rows match', () => {
    const onSelectAllMatching = vi.fn();
    render(
      <BulkActionBar
        selectionCount={20}
        pageSize={20}
        totalMatching={312}
        onSelectAllMatching={onSelectAllMatching}
      >
        <button type="button">Xuất CSV</button>
      </BulkActionBar>,
    );
    expect(screen.getByText(/Chỉ các dòng của trang này/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Chọn tất cả 312 dòng khớp bộ lọc/ }));
    expect(onSelectAllMatching).toHaveBeenCalledOnce();
  });

  it('stays quiet on a partial selection', () => {
    render(
      <BulkActionBar
        selectionCount={3}
        pageSize={20}
        totalMatching={312}
        onSelectAllMatching={vi.fn()}
      >
        <button type="button">Xuất CSV</button>
      </BulkActionBar>,
    );
    expect(screen.queryByText(/khớp bộ lọc/)).toBeNull();
  });

  it('confirms the wider scope once everything matching is selected', () => {
    render(
      <BulkActionBar selectionCount={312} pageSize={312} totalMatching={312}>
        <button type="button">Xuất CSV</button>
      </BulkActionBar>,
    );
    expect(screen.getByText('Toàn bộ 312 dòng khớp bộ lọc.')).toBeTruthy();
  });
});
