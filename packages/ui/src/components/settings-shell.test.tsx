import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsShell } from './settings-shell.js';

describe('SettingsShell', () => {
  it('renders rail items and calls onSelect', () => {
    const onSelect = vi.fn();
    render(
      <SettingsShell
        items={[
          { id: 'a', label: 'Nhóm ca' },
          { id: 'b', label: 'Chính sách' },
        ]}
        activeId="a"
        onSelect={onSelect}
      >
        <div>MAIN</div>
      </SettingsShell>,
    );
    expect(screen.getByText('MAIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nhóm ca/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    fireEvent.click(screen.getByRole('button', { name: /Chính sách/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
