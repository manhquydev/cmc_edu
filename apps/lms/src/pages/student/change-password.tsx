// Forced password change screen — shown when mustChangePassword=true.
//
// There is no student self-service password change procedure in the current
// backend (lmsAuth.resetChildPassword is parent-only). This screen informs
// the student to ask their parent to set a new password, then logs out.
//
// P0-debt: a student self-service changePassword procedure should be added
// to the lmsAuth router in a follow-up phase.

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

        <Text size="xs" c="dimmed">
          Tính năng tự đổi mật khẩu cho học sinh sẽ được bổ sung trong phiên bản tiếp theo
          (P0-debt: lmsAuth.changeStudentPassword).
        </Text>

        <Button fullWidth onClick={handleLogout}>
          Đăng xuất và quay lại đăng nhập
        </Button>
      </Stack>
    </Box>
  );
}
