import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SideNav } from './side-nav.js';
import type { NavModule } from './nav-types.js';

const modules: NavModule[] = [
  { id: 'cockpit', label: 'Tổng quan', icon: 'grid', path: '/cockpit' },
  {
    id: 'finance-ops',
    label: 'Tài chính',
    icon: 'dollar',
    path: '/finance',
    children: [
      { id: 'receipts', label: 'Phiếu thu', path: '/finance', icon: 'receipt' },
      { id: 'recon', label: 'Đối soát', path: '/ops/recon', icon: 'search', permission: { module: 'reconciliation', action: 'review' } },
    ],
  },
];

describe('SideNav', () => {
  it('marks the active module with is-active and renders one LineIcon per entry', () => {
    const { container, getByText } = render(
      <SideNav modules={modules} activeId="finance-ops" activePath="/finance" onNavigate={vi.fn()} />,
    );
    const financeButton = getByText('Tài chính').closest('button')!;
    expect(financeButton.className).toContain('is-active');
    const cockpitButton = getByText('Tổng quan').closest('button')!;
    expect(cockpitButton.className).not.toContain('is-active');
    // 2 top-level modules + 2 visible children (finance-ops active) = 4 icons.
    expect(container.querySelectorAll('.sh-item-icon svg, .sh-subitem svg')).toHaveLength(4);
  });

  it('hides a child when isChildVisible returns false for it (permission parity)', () => {
    const { queryByText } = render(
      <SideNav
        modules={modules}
        activeId="finance-ops"
        activePath="/finance"
        onNavigate={vi.fn()}
        isChildVisible={(c) => c.id !== 'recon'}
      />,
    );
    expect(queryByText('Phiếu thu')).toBeInTheDocument();
    expect(queryByText('Đối soát')).not.toBeInTheDocument();
  });

  it('does not render children for an inactive module even if it has them', () => {
    const { queryByText } = render(
      <SideNav modules={modules} activeId="cockpit" activePath="/cockpit" onNavigate={vi.fn()} />,
    );
    expect(queryByText('Phiếu thu')).not.toBeInTheDocument();
  });

  it('highlights the active child independently via activePath', () => {
    const { getByText } = render(
      <SideNav modules={modules} activeId="finance-ops" activePath="/ops/recon" onNavigate={vi.fn()} />,
    );
    expect(getByText('Đối soát').closest('button')!.className).toContain('is-active');
    expect(getByText('Phiếu thu').closest('button')!.className).not.toContain('is-active');
  });

  it('fires onNavigate with the module path on module click, and the child path on child click', () => {
    const onNavigate = vi.fn();
    const { getByText } = render(
      <SideNav modules={modules} activeId="finance-ops" activePath="/finance" onNavigate={onNavigate} />,
    );
    fireEvent.click(getByText('Tổng quan'));
    expect(onNavigate).toHaveBeenCalledWith('/cockpit');
    fireEvent.click(getByText('Đối soát'));
    expect(onNavigate).toHaveBeenCalledWith('/ops/recon');
  });

  it('renders the brand slot inside .sh-brand when provided, and omits it otherwise', () => {
    const { container, rerender } = render(
      <SideNav modules={modules} activeId={null} activePath="/" onNavigate={vi.fn()} brand={<span>CMC EDU</span>} />,
    );
    expect(container.querySelector('.sh-brand')).toBeInTheDocument();
    rerender(<SideNav modules={modules} activeId={null} activePath="/" onNavigate={vi.fn()} />);
    expect(container.querySelector('.sh-brand')).not.toBeInTheDocument();
  });
});
