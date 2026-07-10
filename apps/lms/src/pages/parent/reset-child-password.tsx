// Reset child password — parent-only (kind:'parent').
//
// C5: only a parent session may invoke lmsAuth.resetChildPassword.
// A student session MUST NOT reach this page — enforced by:
//   1. ParentLayout (route-level kind check → redirect)
//   2. Runtime kind guard in this component (defence in depth)
//
// The component does NOT render for kind:'student' — it returns null.
// This means the action is hidden entirely, not just disabled.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Banner, Button, Heading, PasswordInput, Stack, Text } from '@cmc/ui';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

export default function ResetChildPasswordPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Runtime kind gate (defence in depth — ParentLayout already redirects).
  // Return null entirely so the action is not rendered for student sessions.
  if (!session || session.kind !== 'parent') return null;

  return <ResetForm studentId={studentId!} onBack={() => navigate('/parent/home')} />;
}

function ResetForm({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [validationErr, setValidationErr] = useState('');

  const mutation = trpc.lmsAuth.resetChildPassword.useMutation({
    onSuccess() {
      setNewPassword('');
      setConfirm('');
    },
  });

  function submit() {
    setValidationErr('');
    if (newPassword.length < 8) {
      setValidationErr('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirm) {
      setValidationErr('Mật khẩu xác nhận không khớp.');
      return;
    }
    mutation.mutate({ studentId, newPassword });
  }

  return (
    <div className="lms-shell">
      <div className="lms-topbar">
        <Button variant="ghost" size="sm" label="← Trang chủ" onClick={onBack} />
        <Text className="lms-topbar__brand">Đặt lại mật khẩu</Text>
        <div style={{ width: 60 }} />
      </div>

      <div className="lms-page">
        <Heading level={4} className="lms-page__title">Đặt lại mật khẩu học sinh</Heading>

        <Banner
          status="info"
          title="Mật khẩu mới sẽ được áp dụng ngay. Học sinh sẽ cần đăng nhập lại bằng mật khẩu mới. Chỉ phụ huynh mới có thể thực hiện thao tác này."
          style={{ marginBottom: 24 }}
        />

        {mutation.isSuccess && (
          <Banner
            status="success"
            title="Đặt lại mật khẩu thành công. Học sinh có thể đăng nhập bằng mật khẩu mới."
            style={{ marginBottom: 16 }}
          />
        )}

        {(mutation.isError || validationErr) && (
          <Banner
            status="error"
            title={validationErr || mutation.error?.message || ''}
            style={{ marginBottom: 16 }}
          />
        )}

        <Stack gap={2}>
          <PasswordInput
            label="Mật khẩu mới"
            placeholder="Ít nhất 8 ký tự"
            value={newPassword}
            onChange={(value) => setNewPassword(value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChange={(value) => setConfirm(value)}
            autoComplete="new-password"
          />
          <Button
            style={{ width: '100%' }}
            label="Đặt lại mật khẩu"
            isLoading={mutation.isPending}
            onClick={submit}
            isDisabled={!newPassword || !confirm}
          />
        </Stack>

        <Button
          variant="ghost"
          style={{ marginTop: 24 }}
          label="← Quay lại"
          onClick={onBack}
        />
      </div>
    </div>
  );
}
