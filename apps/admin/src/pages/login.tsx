import { Button, Card, Divider, Heading, PasswordInput, Stack, Text, TextField } from '@cmc/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

// Same base-URL convention as lib/trpc.ts: empty VITE_API_URL (production
// behind nginx) keeps requests same-origin; unset falls back to the dev API.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export function LoginPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // In dev mode skip the login screen when a dev user is already stored.
  useEffect(() => {
    if (import.meta.env.DEV) {
      const devUser = localStorage.getItem('cmc_dev_user');
      if (devUser) {
        void navigate('/', { replace: true });
      }
    }
  }, [navigate]);

  function loginAsDev() {
    const defaultUser = {
      userId: 'u-dev-1',
      roles: ['giam_doc_dao_tao'],
      facilityId: 'PLACEHOLDER',
    };
    localStorage.setItem('cmc_dev_user', JSON.stringify(defaultUser));
    void navigate('/', { replace: true });
  }

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
      void navigate(body.mustChangePassword ? '/change-password' : '/', { replace: true });
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  const ssoUrl = `${API_URL}/auth/login`;
  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending;

  return (
    <div style={{ maxWidth: 400, margin: '80px auto 0', paddingInline: 16 }}>
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
            <span style={{ fontSize: 13, color: 'var(--cmc-danger)' }}>{error}</span>
          )}
          <Button
            label="Đăng nhập"
            variant="primary"
            onClick={() => void loginWithPassword()}
            isLoading={pending}
            isDisabled={!canSubmit}
          />
          {import.meta.env.DEV && (
            <Button label="Đăng nhập (Dev)" variant="secondary" onClick={loginAsDev} />
          )}
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
