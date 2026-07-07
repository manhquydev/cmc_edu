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
import {
  Alert,
  Anchor,
  Box,
  Button,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
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
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={onBack}>← Trang chủ</Anchor>
        <Text className="lms-topbar__brand">Đặt lại mật khẩu</Text>
        <Box w={60} />
      </Box>

      <Box className="lms-page">
        <Title order={4} className="lms-page__title">Đặt lại mật khẩu học sinh</Title>

        <Alert color="blue" variant="light" mb="lg">
          Mật khẩu mới sẽ được áp dụng ngay. Học sinh sẽ cần đăng nhập lại
          bằng mật khẩu mới. Chỉ phụ huynh mới có thể thực hiện thao tác này.
        </Alert>

        {mutation.isSuccess && (
          <Alert color="green" variant="light" mb="md">
            Đặt lại mật khẩu thành công. Học sinh có thể đăng nhập bằng mật khẩu mới.
          </Alert>
        )}

        {(mutation.isError || validationErr) && (
          <Alert color="red" variant="light" mb="md">
            {validationErr || mutation.error?.message}
          </Alert>
        )}

        <Stack gap="md">
          <PasswordInput
            label="Mật khẩu mới"
            placeholder="Ít nhất 8 ký tự"
            value={newPassword}
            onChange={(e) => setNewPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <Button
            fullWidth
            loading={mutation.isPending}
            onClick={submit}
            disabled={!newPassword || !confirm}
          >
            Đặt lại mật khẩu
          </Button>
        </Stack>

        <Button variant="subtle" mt="lg" onClick={onBack}>← Quay lại</Button>
      </Box>
    </Box>
  );
}
