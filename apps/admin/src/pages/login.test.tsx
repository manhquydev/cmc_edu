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

/** Exposes pathname + search so returnTo carry is assertable, not only path. */
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
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

  it('navigates to safe returnTo after a successful login', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { ok: true, mustChangePassword: false }));
    renderWithProviders(
      <>
        <LoginPage />
        <LocationProbe />
      </>,
      { route: '/login?returnTo=%2Fcrm%2Fopportunities%2Fabc' },
    );

    fillAndSubmit('staff@cmc.test', 'secret-password-1');

    await waitFor(() =>
      expect(screen.getByTestId('location-probe')).toHaveTextContent(
        '/crm/opportunities/abc',
      ),
    );
  });

  it('carries returnTo onto change-password when rotation is forced', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { ok: true, mustChangePassword: true }));
    renderWithProviders(
      <>
        <LoginPage />
        <LocationProbe />
      </>,
      { route: '/login?returnTo=%2Ffinance%3Fpage%3D2' },
    );

    fillAndSubmit('staff@cmc.test', 'temporary-pass-1');

    await waitFor(() => {
      const probe = screen.getByTestId('location-probe').textContent ?? '';
      expect(probe).toBe('/change-password?returnTo=%2Ffinance%3Fpage%3D2');
    });
  });

  it('shows a Vietnamese generic message on rejected credentials, never the raw server string', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'Invalid credentials.' }));
    renderWithProviders(<LoginPage />);

    fillAndSubmit('staff@cmc.test', 'wrong-password-1');

    expect(
      await screen.findByText('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Invalid credentials.')).not.toBeInTheDocument();
  });

  it('shows the same generic message regardless of the server-reported error reason', async () => {
    // The API intentionally collapses every failure (unknown email, locked
    // account, ...) into one message — the UI must not become distinguishable
    // by echoing whatever string the server happens to send back.
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'Account locked.' }));
    renderWithProviders(<LoginPage />);

    fillAndSubmit('staff@cmc.test', 'wrong-password-1');

    expect(
      await screen.findByText('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại.'),
    ).toBeInTheDocument();
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
