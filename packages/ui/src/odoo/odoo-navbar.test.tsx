import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OdooNavbar } from './odoo-navbar.js';
import type { NavModule } from '../components/nav-types.js';

const apps: NavModule[] = [
  { id: 'cockpit', label: 'Tổng quan', icon: 'grid', path: '/cockpit' },
  {
    id: 'finance-ops',
    label: 'Tài chính',
    icon: 'dollar',
    path: '/finance',
    children: [
      { id: 'receipts', label: 'Phiếu thu', path: '/finance', icon: 'receipt' },
      {
        id: 'recon',
        label: 'Đối soát',
        path: '/ops/recon',
        icon: 'search',
        permission: { module: 'reconciliation', action: 'review' },
      },
    ],
  },
];

describe('OdooNavbar', () => {
  it('renders brand and app-switcher toggle', () => {
    const { getByLabelText, getByText } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="finance-ops"
        isChildVisible={() => true}
        onNavigate={vi.fn()}
      />,
    );
    expect(getByLabelText('Mở app switcher')).toBeInTheDocument();
    expect(getByText('Tài chính')).toBeInTheDocument();
  });

  it('hides gated children from the section menu (required isChildVisible)', () => {
    const { queryByText, getByText } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="finance-ops"
        isChildVisible={(c) => c.id !== 'recon'}
        onNavigate={vi.fn()}
      />,
    );
    expect(getByText('Phiếu thu')).toBeInTheDocument();
    expect(queryByText('Đối soát')).not.toBeInTheDocument();
  });

  it('does not render any section menu children when the gate rejects all of them', () => {
    const { queryByText } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="finance-ops"
        isChildVisible={() => false}
        onNavigate={vi.fn()}
      />,
    );
    expect(queryByText('Phiếu thu')).not.toBeInTheDocument();
    expect(queryByText('Đối soát')).not.toBeInTheDocument();
  });

  it('lists apps in the switcher and navigates on tile click', () => {
    const onNavigate = vi.fn();
    const { getByLabelText, getByRole, queryByRole } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="cockpit"
        isChildVisible={() => true}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(getByLabelText('Mở app switcher'));
    fireEvent.click(getByRole('menuitem', { name: /Tài chính/ }));
    expect(onNavigate).toHaveBeenCalledWith('/finance');
    expect(queryByRole('menu', { name: 'App switcher' })).not.toBeInTheDocument();
  });

  it('closes the app switcher on Escape and returns focus to the toggle', () => {
    const { getByLabelText, getByRole, queryByRole } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="cockpit"
        isChildVisible={() => true}
        onNavigate={vi.fn()}
      />,
    );
    const toggle = getByLabelText('Mở app switcher');
    fireEvent.click(toggle);
    expect(getByRole('menu', { name: 'App switcher' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByRole('menu', { name: 'App switcher' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('closes the app switcher on outside pointerdown', () => {
    const { getByLabelText, getByRole, queryByRole } = render(
      <div>
        <button type="button">Outside</button>
        <OdooNavbar
          apps={apps}
          activeAppId="cockpit"
          isChildVisible={() => true}
          onNavigate={vi.fn()}
        />
      </div>,
    );
    fireEvent.click(getByLabelText('Mở app switcher'));
    expect(getByRole('menu', { name: 'App switcher' })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(queryByRole('menu', { name: 'App switcher' })).not.toBeInTheDocument();
  });

  it('navigates when a visible section menu item is clicked', () => {
    const onNavigate = vi.fn();
    const { getByText } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="finance-ops"
        isChildVisible={() => true}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(getByText('Đối soát'));
    expect(onNavigate).toHaveBeenCalledWith('/ops/recon');
  });

  it('renders the systray slot when provided', () => {
    const { getByText } = render(
      <OdooNavbar
        apps={apps}
        activeAppId="cockpit"
        isChildVisible={() => true}
        onNavigate={vi.fn()}
        systray={<span>SYSTRAY</span>}
      />,
    );
    expect(getByText('SYSTRAY')).toBeInTheDocument();
  });
});
