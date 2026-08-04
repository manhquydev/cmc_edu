// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './command-palette.js';

const ITEMS = [
  { id: '1', label: 'Phiếu thu', group: 'Tài chính', href: '/finance' },
  { id: '2', label: 'Pipeline CRM', group: 'CRM', href: '/crm' },
];

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette open={false} onOpenChange={vi.fn()} items={ITEMS} />,
    );
    expect(container.querySelector('.ck-cmd')).toBeNull();
  });

  it('filters items and navigates on click', () => {
    const onNavigate = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={onOpenChange}
        items={ITEMS}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Tìm màn hình/), {
      target: { value: 'phiếu' },
    });
    expect(screen.getByText('Phiếu thu')).toBeInTheDocument();
    expect(screen.queryByText('Pipeline CRM')).toBeNull();
    fireEvent.click(screen.getByText('Phiếu thu'));
    expect(onNavigate).toHaveBeenCalledWith('/finance');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
