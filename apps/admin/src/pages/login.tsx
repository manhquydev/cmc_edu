import { Button, Container, Divider, Paper, Stack, Text, Title } from '@mantine/core';
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

  return (
    <Container size={400} mt={80}>
      <Paper p="xl" withBorder radius="xs">
        <Stack>
          <Title order={2} style={{ color: 'var(--cmc-brand)' }}>
            CMC EDU
          </Title>
          <Text fz="sm" c="dimmed">
            Hệ thống quản trị nội bộ
          </Text>
          <Divider />
          {import.meta.env.DEV && (
            <Button onClick={loginAsDev} variant="filled" radius="xs">
              Đăng nhập (Dev)
            </Button>
          )}
          {import.meta.env.VITE_SSO_ENABLED === 'true' && (
            <Button
              component="a"
              href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/auth/login`}
              variant="outline"
              radius="xs"
            >
              Đăng nhập Microsoft (Entra SSO)
            </Button>
          )}
          {import.meta.env.VITE_SSO_ENABLED !== 'true' && (
            <Button disabled variant="outline" radius="xs">
              Đăng nhập Microsoft (sắp có)
            </Button>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
