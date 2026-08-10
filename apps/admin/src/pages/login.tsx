import { Card, Stack, Text } from '@cmc/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import { safeReturnTo } from '../lib/safe-return-to.js';
import './login.css';

// Same-origin by default so Vite /auth proxy works (API has no CORS).
// Absolute VITE_API_URL only when intentionally set (rare).
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();

function EyeIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {crossedOut && (
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A dev-login shortcut used to live here. It stored a dev user with a
  // placeholder facility, which `requireValidFacility` rejects, so every
  // session.me came back 401: the route guard bounced to /login, this page saw
  // the stored user and bounced back to /, and the screen flickered between
  // them until the entry was cleared by hand. Staff email/password login is
  // now the single way in for every environment; the role switcher in the app
  // shell still sets `cmc_dev_user` for impersonation once signed in.

  async function loginWithPassword() {
    setError(null);
    setPending(true);
    try {
      const resp = await fetch(`${API_URL}/auth/staff-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        error?: string;
        mustChangePassword?: boolean;
      };
      if (!resp.ok) {
        setError(body.error ?? 'Đăng nhập thất bại.');
        return;
      }
      // The staff cookie is set — refetch the session before entering the app.
      await utils.session.me.invalidate();
      const dest = safeReturnTo(searchParams.get('returnTo'));
      if (body.mustChangePassword) {
        // Carry returnTo through forced rotation so the user still lands on
        // the original deep link after change-password (client UX only —
        // mustChangePassword is still a client hint today).
        void navigate(`/change-password?returnTo=${encodeURIComponent(dest)}`, { replace: true });
      } else {
        void navigate(dest, { replace: true });
      }
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  // When Entra SSO is re-enabled, the server callback must accept returnTo
  // (RelayState / OAuth state) and apply the same safeReturnTo policy —
  // out of scope while SSO remains disabled.
  const ssoUrl = `${API_URL}/auth/login`;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending;

  return (
    <div className="login-page">
      <Card padding={6} className="login-page__card">
        <Stack gap={5}>
          <div className="login-page__header">
            <Stack gap={1}>
              <span className="login-page__wordmark">CMC EDU</span>
              <Text type="supporting" size="sm">
                Hệ thống quản trị nội bộ
              </Text>
            </Stack>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loginWithPassword();
            }}
          >
            <Stack gap={4}>
              <div className="login-page__field">
                <label className="login-page__label" htmlFor="login-email">
                  Email
                </label>
                <div className="login-page__input-shell">
                  <input
                    id="login-email"
                    className="login-page__input"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="login-page__field">
                <label className="login-page__label" htmlFor="login-password">
                  Mật khẩu
                </label>
                <div className="login-page__input-shell">
                  <input
                    id="login-password"
                    className="login-page__input login-page__input--with-toggle"
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="login-page__toggle"
                    aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setPasswordVisible((v) => !v)}
                  >
                    <EyeIcon crossedOut={passwordVisible} />
                  </button>
                </div>
              </div>
              {error && <span className="login-page__error">{error}</span>}
              <button type="submit" className="login-page__submit" disabled={!canSubmit}>
                {pending && <span className="login-page__spinner" aria-hidden="true" />}
                Đăng nhập
              </button>
              {import.meta.env.VITE_SSO_ENABLED === 'true' && (
                <button
                  type="button"
                  className="login-page__secondary"
                  onClick={() => window.location.assign(ssoUrl)}
                >
                  Đăng nhập Microsoft (Entra SSO)
                </button>
              )}
            </Stack>
          </form>
        </Stack>
      </Card>
    </div>
  );
}
