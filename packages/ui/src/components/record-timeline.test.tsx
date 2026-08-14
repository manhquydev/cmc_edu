import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordTimeline } from './record-timeline.js';

describe('RecordTimeline', () => {
  it('renders labels, never raw JSON, and the unknown-kind fallback as given', () => {
    render(
      <RecordTimeline
        items={[
          {
            id: '1',
            kind: 'note',
            actor: 'sale-a',
            payload: { body: 'Gọi lại chiều nay' },
            createdAt: '2026-08-13T03:00:00.000Z',
            label: 'Ghi chú',
          },
          {
            id: '2',
            kind: 'mystery_future',
            actor: 'sale-a',
            payload: null,
            createdAt: '2026-08-13T02:00:00.000Z',
            label: 'Sự kiện không đọc được',
          },
        ]}
        nextCursor={null}
      />,
    );
    expect(screen.getByTestId('record-timeline')).toBeTruthy();
    expect(screen.getByText('Ghi chú')).toBeTruthy();
    expect(screen.getByText('Gọi lại chiều nay')).toBeTruthy();
    expect(screen.getByText('Sự kiện không đọc được')).toBeTruthy();
    expect(screen.queryByText(/mystery_future/)).toBeNull();
    expect(screen.queryByText(/"body"/)).toBeNull();
  });

  it('shows the history-since epoch marker and load-more / add-note controls', () => {
    const onLoadMore = vi.fn();
    const onAddNote = vi.fn();
    render(
      <RecordTimeline
        items={[]}
        nextCursor="cursor-1"
        onLoadMore={onLoadMore}
        onAddNote={onAddNote}
        historySince={new Date('2026-08-01T00:00:00.000Z')}
      />,
    );
    expect(screen.getByText(/Lịch sử ghi từ 01\/08\/2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    const textarea = screen.getByLabelText('Ghi chú');
    fireEvent.change(textarea, { target: { value: '  Ghi chú mới  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm ghi chú' }));
    expect(onAddNote).toHaveBeenCalledWith('Ghi chú mới');
  });
});
