// Student home — star balance hero + exercise list (locked/unlocked).
//
// C5 invariants enforced here:
//   - No sibling list: student sees only their own data (studentId from session).
//   - No parent-only actions (consent toggle, reset-password, sibling links)
//     are rendered anywhere on this page.
//   - StudentLayout redirects to /student/change-password if mustChangePassword.
//
// exercise.openForStudent returns only exercises whose curriculumUnit is open
// for THIS student (ADR 0038 Tier A + B). Locked exercises are not returned by
// the backend; the UI shows only the open set.
//
// Star balance comes from gift.listForStudent (combined endpoint: gifts + balance).

import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

// Star balance hero — reads from gift.listForStudent (combined endpoint).
function StarBalanceHero() {
  const { data, isLoading } = trpc.gift.listForStudent.useQuery();
  const balance = data?.starBalance ?? 0;

  return (
    <Box className="lms-star-hero">
      {isLoading ? (
        <Loader color="white" size="sm" />
      ) : (
        <>
          <Text className="lms-star-hero__value">⭐ {balance}</Text>
          <Text className="lms-star-hero__label">Số sao hiện có</Text>
        </>
      )}
    </Box>
  );
}

// Exercise list — open-tier only (backend-gated, ADR 0038).
function ExerciseList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = trpc.exercise.openForStudent.useQuery();

  if (isLoading) return <Group justify="center"><Loader /></Group>;
  if (error) return <Alert color="red" variant="light">{error.message}</Alert>;

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Alert color="gray" variant="light">
        Chưa có bài tập nào mở. Bài tập sẽ xuất hiện sau khi hoàn thành buổi học.
      </Alert>
    );
  }

  return (
    <Stack gap="sm">
      {items.map((exercise) => (
        <Box
          key={exercise.id}
          p="md"
          style={{
            border: '1px solid var(--cmc-border)',
            borderRadius: 'var(--cmc-radius-xs)',
            background: 'var(--cmc-surface)',
            cursor: 'pointer',
          }}
          onClick={() => navigate(`/student/exercise/${exercise.id}`)}
        >
          <Group justify="space-between" mb={4}>
            <Text fw={600} size="sm">{exercise.type}</Text>
            <Badge size="sm" color="green" variant="light">
              Mở — {exercise.starReward} sao
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            Điểm tối đa: {exercise.maxScore} | Trạng thái: {exercise.status}
          </Text>
        </Box>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function StudentHomePage() {
  const { session, logout } = useSession();
  const navigate = useNavigate();

  // mustChangePassword gate — StudentLayout redirects, but guard here too.
  if (session?.mustChangePassword) {
    navigate('/student/change-password', { replace: true });
    return null;
  }

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Text className="lms-topbar__brand">CMC EDU — Học sinh</Text>
        <Group gap="xs">
          <Anchor size="xs" onClick={() => navigate('/student/gifts')}>Đổi quà</Anchor>
          <Button size="xs" variant="subtle" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
            Đăng xuất
          </Button>
        </Group>
      </Box>

      <Box className="lms-page">
        <StarBalanceHero />

        <Title order={4} className="lms-page__title">Bài tập của tôi</Title>
        <ExerciseList />
      </Box>
    </Box>
  );
}
