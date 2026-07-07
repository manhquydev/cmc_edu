// Photo consent settings — parent-only (kind:'parent').
//
// C2 / docs/08 §7: toggles Guardian.photoConsent for the parent→child link.
// A student session MUST NOT reach this page — enforced by:
//   1. ParentLayout (route-level kind check → redirect)
//   2. Runtime guard inside this component (defence in depth)
//
// The current consent state is not readable from a separate GET procedure;
// the page lets the parent explicitly set it to enabled or disabled.
// After setting, a success message confirms the new state.

import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

export default function ConsentSettingsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Runtime kind gate (defence in depth — ParentLayout already redirects).
  if (!session || session.kind !== 'parent') return null;

  return <ConsentForm studentId={studentId!} onBack={() => navigate('/parent/home')} />;
}

function ConsentForm({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const navigate = useNavigate();
  const mutation = trpc.guardian.setPhotoConsent.useMutation();

  function set(consent: boolean) {
    mutation.mutate({ studentId, consent });
  }

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={onBack}>← Trang chủ</Anchor>
        <Text className="lms-topbar__brand">Đồng ý ảnh</Text>
        <Box w={60} />
      </Box>

      <Box className="lms-page">
        <Title order={4} className="lms-page__title">Cài đặt đồng ý ảnh</Title>

        <Alert color="blue" variant="light" mb="lg">
          Khi bật đồng ý, ảnh chụp trong các buổi học của con sẽ được hiển thị
          trong mục "Ảnh buổi học". Khi tắt, ảnh sẽ bị ẩn ngay lập tức.
        </Alert>

        {mutation.isSuccess && (
          <Alert color="green" variant="light" mb="md">
            {mutation.data.photoConsent
              ? 'Đã bật đồng ý chia sẻ ảnh. Ảnh buổi học sẽ hiển thị.'
              : 'Đã tắt đồng ý chia sẻ ảnh. Ảnh buổi học sẽ không hiển thị.'}
          </Alert>
        )}

        {mutation.isError && (
          <Alert color="red" variant="light" mb="md">
            {mutation.error.message}
          </Alert>
        )}

        <Stack gap="md">
          <Button
            fullWidth
            color="green"
            loading={mutation.isPending}
            onClick={() => set(true)}
          >
            Bật đồng ý chia sẻ ảnh
          </Button>
          <Button
            fullWidth
            color="red"
            variant="outline"
            loading={mutation.isPending}
            onClick={() => set(false)}
          >
            Tắt đồng ý chia sẻ ảnh
          </Button>
        </Stack>

        <Group mt="lg">
          <Anchor size="sm" onClick={() => navigate(`/parent/evidence/${studentId}`)}>
            Xem ảnh buổi học →
          </Anchor>
        </Group>

        <Button variant="subtle" mt="lg" onClick={onBack}>← Quay lại</Button>
      </Box>
    </Box>
  );
}
