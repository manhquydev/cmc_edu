// Staff password rotation screen. Reached two ways:
//   - forced: login answered mustChangePassword=true (admin provisioned a
//     temporary password via user.resetPassword);
//   - voluntary: the user navigates here directly.
// On success the server clears mustChangePassword and the user proceeds in.

import { Button, Card, Divider, PasswordInput, Stack, Text } from '@cmc/ui';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';
import { safeReturnTo } from '../lib/safe-return-to.js';
import './change-password.css';

const PASSWORD_MIN_LENGTH = 8;

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8.5v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.8" r="1.1" fill="currentColor" />
      <path
        d="M10.3 3.9 2.7 17a1.9 1.9 0 0 0 1.7 2.9h15.2a1.9 1.9 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 2-2 2m-1.5 1.5L16 7m-1.5 1.5L13 10m-3.5 3.5a5 5 0 1 1 7-7l3.5 3.5-3.5 3.5-3.5-3.5" />
      <circle cx="7.5" cy="16.5" r="4.5" />
    </svg>
  );
}

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

  const isMinLengthMet = newPassword.length >= PASSWORD_MIN_LENGTH;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="change-password-page">
      <main className="change-password-page__main">
        <header className="change-password-page__header">
          <div className="change-password-page__badge-icon" aria-hidden="true">
            <KeyIcon />
          </div>
          <h1 className="change-password-page__title">Đổi mật khẩu</h1>
          <p className="change-password-page__subtitle">
            Vui lòng đặt mật khẩu mới để bảo vệ tài khoản trước khi tiếp tục.
          </p>
        </header>

        <Card padding={6} className="change-password-page__card">
          <Stack gap={4}>
            {errorMessage && (
              <div className="change-password-page__notice change-password-page__notice--error" role="alert">
                <AlertIcon />
                <span>{errorMessage}</span>
              </div>
            )}

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

            <div className="change-password-page__rules">
              <div className="change-password-page__rule-item">
                <span
                  className={`change-password-page__rule-dot ${isMinLengthMet ? 'change-password-page__rule-dot--valid' : ''}`}
                  aria-hidden="true"
                />
                <Text size="sm" type={isMinLengthMet ? 'body' : 'supporting'}>
                  Tối thiểu 8 ký tự
                </Text>
              </div>
              <div className="change-password-page__rule-item">
                <span
                  className={`change-password-page__rule-dot ${isMatching ? 'change-password-page__rule-dot--valid' : ''}`}
                  aria-hidden="true"
                />
                <Text size="sm" type={isMatching ? 'body' : 'supporting'}>
                  Mật khẩu xác nhận trùng khớp
                </Text>
              </div>
            </div>

            <Divider />

            <div className="change-password-page__actions">
              <Button
                label="Đổi mật khẩu"
                variant="primary"
                onClick={handleSubmit}
                isLoading={changeMut.isPending}
                isDisabled={!canSubmit}
                style={{ width: '100%' }}
              />
            </div>
          </Stack>
        </Card>
      </main>

      <footer className="change-password-page__footer">
        <span>© 2026 CMC EDU. Hệ thống quản trị nội bộ.</span>
      </footer>
    </div>
  );
}
