import { Button, Card, Divider, Heading, Stack, Text } from '@cmc/ui';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const navigate = useNavigate();

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

  const ssoUrl = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/auth/login`;

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
          {import.meta.env.DEV && (
            <Button label="Đăng nhập (Dev)" variant="primary" onClick={loginAsDev} />
          )}
          {import.meta.env.VITE_SSO_ENABLED === 'true' && (
            <Button
              label="Đăng nhập Microsoft (Entra SSO)"
              variant="secondary"
              onClick={() => window.location.assign(ssoUrl)}
            />
          )}
          {import.meta.env.VITE_SSO_ENABLED !== 'true' && (
            <Button label="Đăng nhập Microsoft (sắp có)" variant="secondary" isDisabled />
          )}
        </Stack>
      </Card>
    </div>
  );
}
