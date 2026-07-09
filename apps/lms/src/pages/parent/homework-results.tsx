// Homework results page — parent view (gap-closure 260710-0005 Phase 2).
//
// Calls submission.listForChild — submitted/graded exercises for one child,
// with GV score + Exercise.starReward. Draft submissions never appear
// (backend excludes them). Kind gate: reachable under ParentLayout only.

import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Anchor, Badge, Box, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

export default function HomeworkResultsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  // Defense-in-depth: route-level ParentOnly guard is the primary gate.
  if (!session || session.kind !== 'parent') return null;

  const { data, isLoading, error } = trpc.submission.listForChild.useQuery(
    { studentId: studentId! },
    { enabled: !!studentId },
  );

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={() => navigate('/parent/home')}>← Trang chủ</Anchor>
        <Text className="lms-topbar__brand">Bài tập & điểm</Text>
        <Box w={60} />
      </Box>

      <Box className="lms-page">
        <Title order={4} className="lms-page__title">Bài tập & điểm</Title>

        {isLoading && <Group justify="center"><Loader /></Group>}

        {error && (
          <Alert color="red" variant="light" title="Lỗi tải dữ liệu">
            {error.message}
          </Alert>
        )}

        {data && data.items.length === 0 && (
          <Alert color="gray" variant="light">
            Con chưa nộp bài tập nào.
          </Alert>
        )}

        <Stack gap="sm">
          {data?.items.map((item) => (
            <Box
              key={item.id}
              p="md"
              style={{
                border: '1px solid var(--cmc-border)',
                borderRadius: 'var(--cmc-radius-xs)',
              }}
            >
              <Group justify="space-between" mb={4}>
                <Text fw={600}>{item.exerciseTitle}</Text>
                {item.status === 'graded' ? (
                  <Badge color="green">{item.score} điểm</Badge>
                ) : (
                  <Badge color="gray">Chờ chấm</Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {item.submittedAt
                  ? `Nộp ngày ${new Date(item.submittedAt).toLocaleDateString('vi-VN')}`
                  : 'Chưa nộp'}
                {item.status === 'graded' && item.gradedAt
                  ? ` · Chấm ngày ${new Date(item.gradedAt).toLocaleDateString('vi-VN')} · +${item.starReward} sao`
                  : ''}
              </Text>
            </Box>
          ))}
        </Stack>

        <Button variant="subtle" mt="lg" onClick={() => navigate('/parent/home')}>
          ← Quay lại
        </Button>
      </Box>
    </Box>
  );
}
