// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewSwitcher } from './view-switcher.js';

const ITEMS = [
  { id: 'table' as const, label: 'Xem dạng danh sách', icon: 'list' as const },
  { id: 'kanban' as const, label: 'Xem dạng kanban', icon: 'kanban' as const },
];

describe('ViewSwitcher', () => {
  it('marks the current view pressed and calls onChange', () => {
    const onChange = vi.fn();
    render(<ViewSwitcher value="kanban" onChange={onChange} items={ITEMS} />);

    const listBtn = screen.getByLabelText('Xem dạng danh sách');
    const kanbanBtn = screen.getByLabelText('Xem dạng kanban');
    expect(kanbanBtn).toHaveAttribute('aria-pressed', 'true');
    expect(listBtn).toHaveAttribute('aria-pressed', 'false');
    expect(kanbanBtn.className).toMatch(/is-active/);
    expect(kanbanBtn.getAttribute('title')).toBe('Xem dạng kanban');

    fireEvent.click(listBtn);
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('exposes a toolbar with the given accessible name', () => {
    render(
      <ViewSwitcher
        value="table"
        onChange={() => undefined}
        items={ITEMS}
        aria-label="Chuyển chế độ xem pipeline"
      />,
    );
    expect(screen.getByRole('toolbar', { name: 'Chuyển chế độ xem pipeline' })).toBeTruthy();
  });
});
