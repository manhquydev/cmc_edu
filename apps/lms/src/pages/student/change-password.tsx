// Forced password change screen — shown when mustChangePassword=true.
//
// Parent-mediated student passwords are the official design (ADR-E(a),
// docs/16 — students are children; a parent manages their password via
// lmsAuth.resetChildPassword). There is deliberately no student self-service
// password change procedure. This screen informs the student to ask their
// parent to set a new password, then logs out.

import { Navigate, useNavigate } from 'react-router-dom';
import { Banner, Button, Heading, Stack, Text } from '@cmc/ui';
import { useSession } from '../../lib/session-context.js';

export default function ChangePasswordPage() {
  const { logout, session } = useSession();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  // If a student who does NOT need a password change somehow lands here, send
  // them home. Guard on `=== false` (explicit), NOT `!mustChangePassword`: the
  // field is optional (StoredLmsSession), so `!undefined` would be true and
  // could bounce a session that simply lacks the flag. Use `<Navigate>` rather
  // than a navigate() call in the render body (side-effect-in-render is what
  // caused the P1-07 clobber on the login page).
  if (session?.mustChangePassword === false) {
    return <Navigate to="/student/home" replace />;
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
