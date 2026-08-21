// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { render } from '@testing-library/react';
import type { Role } from '@cmc/auth';

const sessionState = vi.hoisted(() => ({
  me: null as null | {
    userId: string;
    roles: readonly Role[];
    facilityId: string;
    config: { approvalSecondEyeThreshold: number };
    mustChangePassword: boolean;
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

import { RequireAuth } from './index.js';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

function signedIn(mustChangePassword: boolean) {
  return {
    userId: 'u1',
    roles: ['sale'] as const,
    facilityId: 'f1',
    config: { approvalSecondEyeThreshold: 20_000_000 },
    mustChangePassword,
  };
}

function renderGate(route: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <LocationProbe />
            <Outlet />
          </>
        ),
        children: [
          { path: 'login', element: <div>login-page</div> },
          {
            path: 'change-password',
            element: (
              <RequireAuth>
                <div>change-password-page</div>
              </RequireAuth>
            ),
          },
          {
            path: 'cockpit',
            element: (
              <RequireAuth>
                <div>cockpit-page</div>
              </RequireAuth>
            ),
          },
          {
            path: 'crm/opportunities/:id',
            element: (
              <RequireAuth>
                <div>crm-page</div>
              </RequireAuth>
            ),
          },
        ],
      },
    ],
    { initialEntries: [route] },
  );
  return render(<RouterProvider router={router} />);
}

describe('RequireAuth', () => {
  beforeEach(() => {
    sessionState.me = null;
    sessionState.isLoading = false;
    sessionState.canDo = () => true;
  });

  it('sends an anonymous user to login with returnTo', () => {
    renderGate('/cockpit');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/login?returnTo=%2Fcockpit');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('forces /change-password when mustChangePassword even if the address bar is edited', () => {
    sessionState.me = signedIn(true);
    renderGate('/cockpit');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/change-password?returnTo=%2Fcockpit',
    );
    expect(screen.getByText('change-password-page')).toBeInTheDocument();
    expect(screen.queryByText('cockpit-page')).not.toBeInTheDocument();
  });

  it('carries returnTo including search when forcing rotation', () => {
    sessionState.me = signedIn(true);
    renderGate('/crm/opportunities/abc?page=2');
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/change-password?returnTo=%2Fcrm%2Fopportunities%2Fabc%3Fpage%3D2',
    );
  });

  it('lets a forced-rotation user stay on /change-password', () => {
    sessionState.me = signedIn(true);
    renderGate('/change-password');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/change-password');
    expect(screen.getByText('change-password-page')).toBeInTheDocument();
  });

  it('lets a current-password user into product routes', () => {
    sessionState.me = signedIn(false);
    renderGate('/cockpit');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/cockpit');
    expect(screen.getByText('cockpit-page')).toBeInTheDocument();
  });
});
