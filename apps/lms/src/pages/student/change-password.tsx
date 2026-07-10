// Forced password change screen — shown when mustChangePassword=true.
//
// Parent-mediated student passwords are the official design (ADR-E(a),
// docs/16 — students are children; a parent manages their password via
// lmsAuth.resetChildPassword). There is deliberately no student self-service
// password change procedure. This screen informs the student to ask their
// parent to set a new password, then logs out.

import { useNavigate } from 'react-router-dom';
import { Banner, Button, Heading, Stack, Text } from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';

export default function ChangePasswordPage() {
  const { logout, session } = useSession();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  // If somehow reached without mustChangePassword, allow proceeding.
  // KNOWN PRE-EXISTING BUG (tracked separately as test.fixme): a session-context
  // timing issue can cause this guard to bounce a genuine mustChangePassword=true
  // session to /student/home. Left byte-for-byte identical across this UI
  // migration — do not "fix" this logic here.
  if (session && !session.mustChangePassword) {
    navigate('/student/home', { replace: true });
    return null;
  }

  return (
    <div className="lms-shell" style={{ padding: '1.5rem 1rem' }}>
      <Stack gap={3}>
        <Heading level={3} style={{ color: 'var(--cmc-brand)' }}>
          Cần đổi mật khẩu
        </Heading>

        <Banner
          status="warning"
          title="Mật khẩu mặc định chưa được thay đổi"
          description={
            <>
              Tài khoản của bạn đang dùng mật khẩu mặc định (<strong>Cmc2026@</strong>).
              Để bảo mật tài khoản, mật khẩu cần được thay đổi trước khi tiếp tục.
            </>
          }
        />

        <Banner
          status="info"
          title="Cách đổi mật khẩu"
          description={
            <Stack gap={1}>
              <Text type="body" size="sm">
                1. Nhờ phụ huynh đăng nhập vào ứng dụng bằng tài khoản phụ huynh.
              </Text>
              <Text type="body" size="sm">
                2. Chọn tên của bạn trong danh sách con em.
              </Text>
              <Text type="body" size="sm">
                3. Vào mục <strong>&quot;Đặt lại mật khẩu học sinh&quot;</strong> và nhập mật khẩu mới.
              </Text>
              <Text type="body" size="sm">
                4. Đăng nhập lại bằng mật khẩu mới.
              </Text>
            </Stack>
          }
        />

        <Button style={{ width: '100%' }} label="Đăng xuất và quay lại đăng nhập" onClick={handleLogout} />
      </Stack>
    </div>
  );
}
