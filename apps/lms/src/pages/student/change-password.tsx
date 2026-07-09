// Forced password change screen — shown when mustChangePassword=true.
//
// Parent-mediated student passwords are the official design (ADR-E(a),
// docs/16 — students are children; a parent manages their password via
// lmsAuth.resetChildPassword). There is deliberately no student self-service
// password change procedure. This screen informs the student to ask their
// parent to set a new password, then logs out.

import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useSession } from '../../lib/session-context.js';

export default function ChangePasswordPage() {
  const { logout, session } = useSession();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  // If somehow reached without mustChangePassword, allow proceeding.
  if (session && !session.mustChangePassword) {
    navigate('/student/home', { replace: true });
    return null;
  }

  return (
    <Box className="lms-shell" style={{ padding: '1.5rem 1rem' }}>
      <Stack gap="lg">
        <Title order={3} style={{ color: 'var(--cmc-brand)' }}>
          Cần đổi mật khẩu
        </Title>

        <Alert color="orange" variant="light" title="Mật khẩu mặc định chưa được thay đổi">
          Tài khoản của bạn đang dùng mật khẩu mặc định (<strong>Cmc2026@</strong>).
          Để bảo mật tài khoản, mật khẩu cần được thay đổi trước khi tiếp tục.
        </Alert>

        <Alert color="blue" variant="light" title="Cách đổi mật khẩu">
          <Stack gap="xs">
            <Text size="sm">
              1. Nhờ phụ huynh đăng nhập vào ứng dụng bằng tài khoản phụ huynh.
            </Text>
            <Text size="sm">
              2. Chọn tên của bạn trong danh sách con em.
            </Text>
            <Text size="sm">
              3. Vào mục <strong>"Đặt lại mật khẩu học sinh"</strong> và nhập mật khẩu mới.
            </Text>
            <Text size="sm">
              4. Đăng nhập lại bằng mật khẩu mới.
            </Text>
          </Stack>
        </Alert>

        <Button fullWidth onClick={handleLogout}>
          Đăng xuất và quay lại đăng nhập
        </Button>
      </Stack>
    </Box>
  );
}
