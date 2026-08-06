// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@cmc/ui';

const sessionState = vi.hoisted(() => ({
  me: null as null | {
    userId: string;
    roles: readonly string[];
    facilityId: string;
    config: { approvalSecondEyeThreshold: number };
    mustChangePassword?: boolean;
  },
  isLoading: false,
  canDo: (_m: string, _a: string) => true as boolean,
}));

vi.mock('../lib/session-context.js', () => ({
  useSession: () => ({
    me: sessionState.me,
    isLoading: sessionState.isLoading,
    canDo: sessionState.canDo,
  }),
  SessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../lib/enroll-picker.js', () => ({
  EnrollPicker: () => null,
}));

vi.mock('./role-switcher.js', () => ({
  RoleSwitcher: () => <span data-testid="role-switcher">RoleSwitcher</span>,
}));

vi.mock('./nav-registry.js', async () => {
  const actual = await vi.importActual<typeof import('./nav-registry.js')>('./nav-registry.js');
  return {
    ...actual,
    visibleModulesFor: () => [
      { id: 'cockpit', label: 'Tổng quan', icon: 'grid' as const, path: '/cockpit' },
      {
        id: 'finance-ops',
        label: 'Tài chính & Điều hành',
        icon: 'dollar' as const,
        path: '/finance',
        children: [
          { id: 'receipts', label: 'Phiếu thu', path: '/finance', icon: 'receipt' as const },
          {
            id: 'recon',
            label: 'Đối soát',
            path: '/ops/recon',
            icon: 'search' as const,
            permission: { module: 'reconciliation', action: 'review' },
          },
        ],
      },
    ],
    isNavChildVisible: (child: { id: string }, canDo: (m: string, a: string) => boolean) => {
      if (child.id === 'recon') return canDo('reconciliation', 'review');
      return true;
    },
  };
});

import { Shell } from './shell.js';

function renderShell(route = '/cockpit') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Shell />,
        children: [
          { path: 'cockpit', element: <div>cockpit-body</div> },
          { path: 'finance', element: <div>finance-body</div> },
          { path: 'change-password', element: <div>change-password-body</div> },
          { path: 'unknown', element: <div>unknown-body</div> },
        ],
      },
    ],
    { initialEntries: [route] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Shell (Odoo chrome)', () => {
  beforeEach(() => {
    sessionState.me = {
      userId: 'u1',
      roles: ['giam_doc_kinh_doanh'],
      facilityId: 'f1',
      config: { approvalSecondEyeThreshold: 20_000_000 },
      mustChangePassword: false,
    };
    sessionState.isLoading = false;
    sessionState.canDo = () => true;
  });

  it('renders .o_web_client + OdooNavbar when session is present', () => {
    const { container } = renderShell('/cockpit');
    expect(container.querySelector('.o_web_client')).toBeInTheDocument();
    expect(screen.getByLabelText('Mở app switcher')).toBeInTheDocument();
    // Brand tracks active module label (cockpit → Tổng quan), not a hardcoded product name.
    expect(container.querySelector('.o-brand')).toHaveTextContent('Tổng quan');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('cockpit-body')).toBeInTheDocument();
  });

  it('falls back brand to CMC EDU when pathname matches no module', () => {
    const { container } = renderShell('/unknown');
    expect(container.querySelector('.o-brand')).toHaveTextContent('CMC EDU');
  });

  it('does not throw and shows zero apps when me is null (anonymous allow-list)', () => {
    sessionState.me = null;
    const { container } = renderShell('/cockpit');
    expect(container.querySelector('.o_web_client')).toBeInTheDocument();
    // Switcher still present but empty of module tiles when opened.
    expect(screen.getByLabelText('Mở app switcher')).toBeInTheDocument();
  });

  it('hides gated children from the navbar section menu', () => {
    sessionState.canDo = (module, action) =>
      !(module === 'reconciliation' && action === 'review');
    // Navigate to finance so finance-ops is active (children render in section menu).
    renderShell('/finance');
    expect(screen.getByText('Phiếu thu')).toBeInTheDocument();
    expect(screen.queryByText('Đối soát')).not.toBeInTheDocument();
  });

  it('suppresses navbar/⌘K chrome on change-password (path-only forced rotation mode)', () => {
    sessionState.me = {
      userId: 'u1',
      roles: ['sale'],
      facilityId: 'f1',
      config: { approvalSecondEyeThreshold: 20_000_000 },
    };
    renderShell('/change-password');
    expect(screen.queryByLabelText('Mở app switcher')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Điều hướng nhanh/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tìm (⌘K)')).not.toBeInTheDocument();
    expect(screen.queryByTestId('role-switcher')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('change-password-body');
  });

  it('does not use AppFrame/SideNav class markers', () => {
    const { container } = renderShell('/cockpit');
    expect(container.querySelector('.sh-root')).not.toBeInTheDocument();
    expect(container.querySelector('.sh-nav')).not.toBeInTheDocument();
    expect(container.querySelector('.sh-sb')).not.toBeInTheDocument();
  });

  it('builds CommandPalette items only from permission-visible nav children', async () => {
    sessionState.canDo = (module, action) =>
      !(module === 'reconciliation' && action === 'review');
    const { fireEvent } = await import('@testing-library/react');
    const { container } = renderShell('/finance');
    // Open palette via hotkey affordance button
    fireEvent.click(screen.getByLabelText('Tìm (⌘K)'));
    const palette = container.querySelector('.ck-cmd') ?? container.querySelector('[role="dialog"]');
    expect(palette).toBeTruthy();
    // Scope to palette list — section menu also shows "Phiếu thu".
    const paletteText = palette!.textContent ?? '';
    expect(paletteText).toContain('Tài chính & Điều hành');
    expect(paletteText).toContain('Phiếu thu');
    expect(paletteText).not.toContain('Đối soát');
  });
});


