// Forced / logged-in family password change. Current password required.
// Distinct from /dat-lai-mat-khau-gia-dinh (forgot-token, public).

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Banner, Button, Heading, PasswordInput, Stack } from '@cmc/ui';
import { isParentDoorKind } from '../lib/lms-kind.js';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';

export default function ChangeFamilyPasswordPage() {
  const { session, setSession, logout } = useSession();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const mut = trpc.lmsAuth.setFamilyPassword.useMutation({
    onSuccess(data) {
      if (!session) return;
      setSession({ ...session, sessionToken: data.sessionToken, mustChangePassword: false });
      navigate(session.kind === 'family' && (session.children?.length ?? 0) >= 2 ? '/select-profile' : '/parent/home', {
        replace: true,
      });
    },
    onError() {
      setError('Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại (tối thiểu 12 ký tự mật khẩu mới).');
    },
  });

  if (!session || !isParentDoorKind(session.kind)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="lms-shell">
      <div className="lms-page">
        <Stack gap={3}>
          <Heading level={4} className="lms-page__title">
            Đổi mật khẩu gia đình
          </Heading>
          {session.mustChangePassword === true ? (
            <Banner
              status="warning"
              title="Cần đổi mật khẩu mặc định"
              description="Tài khoản vừa tạo đang dùng mật khẩu mặc định. Đổi trước khi xem dữ liệu các con."
            />
          ) : null}
          {error ? <Banner status="error" title={error} /> : null}
          <PasswordInput
            label="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordInput
            label="Mật khẩu mới (tối thiểu 12 ký tự)"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <Button
            label="Lưu mật khẩu mới"
            isLoading={mut.isPending}
            isDisabled={currentPassword.length < 1 || newPassword.length < 12}
            onClick={() => mut.mutate({ currentPassword, newPassword })}
          />
          <Button
            variant="ghost"
            label="Đăng xuất"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          />
        </Stack>
      </div>
    </div>
  );
}
