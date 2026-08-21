import { Card, Stack, Text } from '@cmc/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import { safeReturnTo } from '../lib/safe-return-to.js';
import './login.css';

// Same-origin by default so Vite /auth proxy works (API has no CORS).
// Absolute VITE_API_URL only when intentionally set (rare).
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();

// Production serves the LMS portal same-origin under /lms/ (nginx). Local dev
// can point VITE_LMS_URL at the LMS dev server (admin + lms both default to
// Vite :5173, so they cannot share the port).
const LMS_URL = ((import.meta.env.VITE_LMS_URL as string | undefined) ?? '').trim() || '/lms/';

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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.5l5 5 10-11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8.5v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.8" r="1.1" fill="currentColor" />
      <path
        d="M10.3 3.9 2.7 17a1.9 1.9 0 0 0 1.7 2.9h15.2a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 2h9.5v9.5H2z" />
      <path d="M12.5 2H22v9.5h-9.5z" />
      <path d="M2 12.5h9.5V22H2z" />
      <path d="M12.5 12.5H22V22h-9.5z" />
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
        // The API returns one generic message for every failure reason
        // (unknown email, wrong password, locked account, ...) by design —
        // no-leak, chống dò email/tài khoản. Never surface `body.error` raw:
        // it comes back in English and would defeat the point of showing a
        // single message by making it distinguishable per status/wording.
        setError('Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại.');
        return;
      }
      // The staff cookie is set — refetch the session before entering the app.
      await utils.session.me.invalidate();
      const dest = safeReturnTo(searchParams.get('returnTo'));
      if (body.mustChangePassword) {
        // Carry returnTo through forced rotation so the user still lands on
        // the original deep link after change-password. RequireAuth also
        // enforces this from session.me.mustChangePassword.
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
      <main className="login-page__main">
        {/* Brand column — the pre-auth front door keeps product identity and
            capability signals on the left, the task (log in) on the right. */}
        <section className="login-page__brand" aria-label="Giới thiệu CMC EDU">
          <div className="login-page__brand-lockup">
            <span className="login-page__wordmark">CMC EDU</span>
            <Text type="supporting" size="sm" className="login-page__brand-tagline">
              Hệ thống quản trị nội bộ
            </Text>
          </div>
          <ul className="login-page__brand-features">
            <li>
              <CheckIcon /> Ghi danh &amp; thu học phí một luồng
            </li>
            <li>
              <CheckIcon /> Điểm danh, chấm bài, nhận xét
            </li>
            <li>
              <CheckIcon /> Chấm công, lương &amp; KPI tự động
            </li>
            <li>
              <CheckIcon /> Quà tặng &amp; họp phụ huynh
            </li>
          </ul>
        </section>

        {/* Login frame — heading, dedicated notice slot, form, actions. */}
        <section className="login-page__form" aria-label="Đăng nhập">
          <Card padding={6} className="login-page__card">
            <Stack gap={5}>
              <header className="login-page__card-header">
                <h1 className="login-page__card-title">Đăng nhập</h1>
                <Text type="supporting" size="sm">
                  Nhập thông tin tài khoản nội bộ của bạn để tiếp tục.
                </Text>
              </header>

              {/* Notification slot — fixed position between heading and form;
                  every auth failure lands here as a single live-region alert. */}
              {error && (
                <div className="login-page__notice login-page__notice--error" role="alert">
                  <AlertIcon />
                  <span>{error}</span>
                </div>
              )}

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
                        placeholder="ten@example.com"
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
                        placeholder="••••••••"
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
                  <button type="submit" className="login-page__submit" disabled={!canSubmit}>
                    {pending && <span className="login-page__spinner" aria-hidden="true" />}
                    Đăng nhập
                  </button>
                  {import.meta.env.VITE_SSO_ENABLED === 'true' && (
                    <>
                      <div className="login-page__divider" aria-hidden="true">
                        <span>hoặc</span>
                      </div>
                      <button
                        type="button"
                        className="login-page__secondary"
                        onClick={() => window.location.assign(ssoUrl)}
                      >
                        <MicrosoftIcon />
                        Đăng nhập Microsoft (Entra SSO)
                      </button>
                    </>
                  )}
                </Stack>
              </form>
            </Stack>
          </Card>
          <p className="login-page__helper">
            Quên mật khẩu? Liên hệ quản trị viên hệ thống để được cấp lại.
          </p>
        </section>
      </main>

      <footer className="login-page__footer">
        <span>© {new Date().getFullYear()} CMC EDU — Hệ thống quản trị nội bộ</span>
        <span className="login-page__footer-dot" aria-hidden="true">
          ·
        </span>
        <a className="login-page__footer-link" href={LMS_URL}>
          Cổng phụ huynh &amp; học sinh
        </a>
      </footer>
    </div>
  );
}
