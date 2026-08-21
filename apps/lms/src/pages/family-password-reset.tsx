// Public family password reset. Token lives in the URL hash and is stripped
// immediately so it does not linger in history/server referrers.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banner, Button, Heading, PasswordInput, Stack, Text, TextField } from '@cmc/ui';
import { trpc } from '../lib/trpc.js';

const fullWidth = { width: '100%' } as const;

export default function FamilyPasswordResetPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith('#token=')
      ? window.location.hash.slice('#token='.length)
      : '';
    if (hash) {
      setToken(hash);
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const resetMut = trpc.lmsAuth.familyResetPasswordWithToken.useMutation({
    onSuccess() {
      navigate('/login', { replace: true });
    },
    onError() {
      setError('Liên kết không hợp lệ hoặc đã hết hạn. Yêu cầu lại bên dưới.');
    },
  });

  const forgotMut = trpc.lmsAuth.familyForgotPassword.useMutation({
    onSuccess() {
      setResent(true);
      setError('');
    },
    onError() {
      setError('Không thể gửi lại liên kết. Thử lại sau.');
    },
  });

  return (
    <div className="lms-shell" style={{ padding: '1.5rem 1rem' }}>
      <Stack gap={3}>
        <Heading level={2} style={{ color: 'var(--cmc-brand)' }}>
          Đặt lại mật khẩu gia đình
        </Heading>
        <Text type="supporting">
          Mật khẩu tối thiểu 12 ký tự. Sau khi đổi, đăng nhập lại bằng SĐT + mật khẩu.
        </Text>
        {error && <Banner status="error" title={error} />}
        {resent && (
          <Banner
            status="success"
            title="Nếu số điện thoại có email, bạn sẽ nhận được thư đặt lại mật khẩu."
          />
        )}
        {token ? (
          <>
            <PasswordInput
              label="Mật khẩu mới"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <Button
              style={fullWidth}
              label="Đặt lại mật khẩu"
              isLoading={resetMut.isPending}
              isDisabled={password.length < 12}
              onClick={() => {
                setError('');
                resetMut.mutate({ token, newPassword: password });
              }}
            />
          </>
        ) : (
          <Text type="supporting">Thiếu vé đặt lại. Gửi lại liên kết bằng số điện thoại.</Text>
        )}
        <TextField
          label="Số điện thoại gia đình"
          value={phone}
          onChange={setPhone}
          inputMode="tel"
          autoComplete="tel"
        />
        <Button
          variant="secondary"
          style={fullWidth}
          label="Gửi lại liên kết"
          isLoading={forgotMut.isPending}
          isDisabled={!phone}
          onClick={() => {
            setResent(false);
            forgotMut.mutate({ phone });
          }}
        />
        <Link to="/login">← Về đăng nhập</Link>
      </Stack>
    </div>
  );
}
