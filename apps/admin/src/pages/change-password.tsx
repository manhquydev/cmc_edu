// Staff password rotation screen. Reached two ways:
//   - forced: login answered mustChangePassword=true (admin provisioned a
//     temporary password via user.resetPassword);
//   - voluntary: the user navigates here directly.
// On success the server clears mustChangePassword and the user proceeds in.

import { Button, Card, Divider, Heading, PasswordInput, Stack, Text } from '@cmc/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import { safeReturnTo } from '../lib/safe-return-to.js';

const PASSWORD_MIN_LENGTH = 8;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const changeMut = trpc.user.changeOwnPassword.useMutation({
    onSuccess: () => {
      // Restore the deep link that login carried through ?returnTo=.
      void navigate(safeReturnTo(searchParams.get('returnTo')), { replace: true });
    },
  });

  function handleSubmit() {
    setLocalError(null);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setLocalError(`Mật khẩu mới phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Xác nhận mật khẩu không khớp.');
      return;
    }
    changeMut.mutate({ currentPassword, newPassword });
  }

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !changeMut.isPending;
  const errorMessage = localError ?? changeMut.error?.message ?? null;

  return (
    <div style={{ maxWidth: 400, margin: '80px auto 0', paddingInline: 'var(--cmc-space-3)' }}>
      <Card padding={5}>
        <Stack gap={2}>
          <Heading level={2} style={{ color: 'var(--cmc-brand)' }}>
            Đổi mật khẩu
          </Heading>
          <Text type="supporting" size="sm">
            Vui lòng đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống.
          </Text>
          <Divider />
          <PasswordInput
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            isRequired
          />
          <PasswordInput
            label="Mật khẩu mới"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            isRequired
          />
          <PasswordInput
            label="Xác nhận mật khẩu mới"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            isRequired
          />
          {errorMessage && (
            // Text color enum has no error/danger slot — plain <span> with CSS
            // var, same convention as the admin form modals.
            <span style={{ fontSize: 'var(--cmc-font-size-data)', color: 'var(--cmc-danger)' }}>{errorMessage}</span>
          )}
          <Button
            label="Đổi mật khẩu"
            variant="primary"
            onClick={handleSubmit}
            isLoading={changeMut.isPending}
            isDisabled={!canSubmit}
          />
        </Stack>
      </Card>
    </div>
  );
}
