// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from '../test/render-with-providers.js';

// Locks the staff email/password login contract: POST /auth/staff-login with
// credentials:'include', session refetch on success, and the
// mustChangePassword → /change-password redirect.

vi.mock('../lib/trpc.js', async () => {
  const { buildTrpcMock } = await import('../test/mock-trpc.js');
  return {
    trpc: buildTrpcMock(),
    makeQueryClient: () => ({}),
    makeTrpcClient: () => ({}),
    getDevUserHeader: () => null,
  };
});

import { LoginPage } from './login.js';

/** Exposes the router's current pathname so redirects are assertable. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('LoginPage — staff email/password form', () => {
  const fetchSpy = vi.fn<typeof fetch>();

  beforeEach(() => {
    localStorage.clear();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fillAndSubmit(email: string, password: string) {
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  }

  it('POSTs credentials to /auth/staff-login with credentials:include', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { ok: true, mustChangePassword: false }));
    renderWithProviders(
      <>
        <LoginPage />
        <LocationProbe />
      </>,
    );

    fillAndSubmit('  staff@cmc.test  ', 'secret-password-1');

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/auth\/staff-login$/);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'staff@cmc.test',
      password: 'secret-password-1',
    });
    await waitFor(() =>
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/'),
    );
  });

  it('redirects to /change-password when the server flags mustChangePassword', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { ok: true, mustChangePassword: true }));
    renderWithProviders(
      <>
        <LoginPage />
        <LocationProbe />
      </>,
    );

    fillAndSubmit('staff@cmc.test', 'temporary-pass-1');

    await waitFor(() =>
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/change-password'),
    );
  });

  it('shows the server error message on rejected credentials', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'Invalid credentials.' }));
    renderWithProviders(<LoginPage />);

    fillAndSubmit('staff@cmc.test', 'wrong-password-1');

    expect(await screen.findByText('Invalid credentials.')).toBeInTheDocument();
  });

  it('disables submit until both fields are filled', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'a@b.c' } });
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: 'x' } });
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });
});
