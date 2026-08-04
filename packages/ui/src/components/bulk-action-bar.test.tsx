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
    expect(container.querySelector('.ck-bulk')).toBeNull();
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
});
