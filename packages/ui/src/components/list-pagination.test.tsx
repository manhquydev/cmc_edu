import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPagination } from './list-pagination.js';

describe('ListPagination', () => {
  it('renders range and navigates pages', () => {
    const onPageChange = vi.fn();
    render(
      <ListPagination page={2} pageSize={10} total={48} onPageChange={onPageChange} />,
    );
    expect(screen.getByText(/11–20/)).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Trang sau'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('hides when zero total shows empty copy', () => {
    render(<ListPagination page={1} pageSize={10} total={0} onPageChange={() => undefined} />);
    expect(screen.getByText('Không có dòng')).toBeInTheDocument();
  });
});
