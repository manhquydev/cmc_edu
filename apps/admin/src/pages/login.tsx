import { Button, Card, Divider, Heading, PasswordInput, Stack, Text, TextField } from '@cmc/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import { safeReturnTo } from '../lib/safe-return-to.js';

// Same-origin by default so Vite /auth proxy works (API has no CORS).
// Absolute VITE_API_URL only when intentionally set (rare).
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div style={{ maxWidth: 400, margin: '80px auto 0', paddingInline: 'var(--cmc-space-3)' }}>
      <Card padding={5}>
        <Stack gap={2}>
          <Heading level={2} style={{ color: 'var(--cmc-brand)' }}>
            CMC EDU
          </Heading>
          <Text type="supporting" size="sm">
            Hệ thống quản trị nội bộ
          </Text>
          <Divider />
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            isRequired
          />
          <PasswordInput
            label="Mật khẩu"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            isRequired
          />
          {error && (
            // Text color enum has no error/danger slot — plain <span> with CSS
            // var, same convention as the admin form modals.
            <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>{error}</span>
          )}
          <Button
            label="Đăng nhập"
            variant="primary"
            onClick={() => void loginWithPassword()}
            isLoading={pending}
            isDisabled={!canSubmit}
          />
          {import.meta.env.VITE_SSO_ENABLED === 'true' && (
            <Button
              label="Đăng nhập Microsoft (Entra SSO)"
              variant="secondary"
              onClick={() => window.location.assign(ssoUrl)}
            />
          )}
        </Stack>
      </Card>
    </div>
  );
}
