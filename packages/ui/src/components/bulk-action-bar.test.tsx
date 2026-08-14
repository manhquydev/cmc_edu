import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from './bulk-action-bar.js';

describe('BulkActionBar', () => {
  it('renders nothing when selection is 0', () => {
    const { container } = render(
      <BulkActionBar selectionCount={0}>
        <button type="button">X</button>
      </BulkActionBar>,
    );
    expect(container.querySelector('.console-bulk')).toBeNull();
  });

  it('shows count and clear', () => {
    const onClear = vi.fn();
    render(
      <BulkActionBar selectionCount={3} onClear={onClear}>
        <button type="button">Duyệt</button>
      </BulkActionBar>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Bỏ chọn'));
    expect(onClear).toHaveBeenCalled();
  });

  it('offers selecting every matching row after the current page is selected', () => {
    const onSelectAllMatching = vi.fn();
    render(
      <BulkActionBar
        selectionCount={20}
        pageSize={20}
        totalMatching={312}
        onSelectAllMatching={onSelectAllMatching}
      >
        <button type="button">Duyệt</button>
      </BulkActionBar>,
    );

    fireEvent.click(screen.getByText('Chọn tất cả 312 dòng khớp bộ lọc'));
    expect(onSelectAllMatching).toHaveBeenCalledTimes(1);
  });
});
