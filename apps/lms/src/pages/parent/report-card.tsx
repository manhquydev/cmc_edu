// Report card page — parent view.
//
// Calls reportCard.getForChild (confirmed assessments + final grade +
// attendance rate for a specific period). Defaults to the current month.
//
// Kind gate: reachable under ParentLayout only.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Loader,
  Progress,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { trpc } from '../../lib/trpc.js';
import { useSession } from '../../lib/session-context.js';

function currentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Last 12 months as { value, label } for the period selector. */
function recentPeriods(): Array<{ value: string; label: string }> {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' });
    result.push({ value, label });
  }
  return result;
}

export default function ReportCardPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const [period, setPeriod] = useState(currentPeriod());

  // Defense-in-depth: route-level ParentOnly guard is the primary gate.
  if (!session || session.kind !== 'parent') return null;

  const { data, isLoading, error } = trpc.reportCard.getForChild.useQuery(
    { studentId: studentId!, period },
    { enabled: !!studentId && !!period },
  );

  return (
    <Box className="lms-shell">
      <Box className="lms-topbar">
        <Anchor size="sm" onClick={() => navigate('/parent/home')}>← Trang chủ</Anchor>
        <Text className="lms-topbar__brand">Học bạ</Text>
        <Box w={60} />
      </Box>

      <Box className="lms-page">
        <Title order={4} className="lms-page__title">Kết quả học tập</Title>

        <Select
          label="Kỳ học"
          data={recentPeriods()}
          value={period}
          onChange={(v) => v && setPeriod(v)}
          mb="lg"
        />

        {isLoading && <Group justify="center"><Loader /></Group>}

        {error && (
          <Alert color="red" variant="light" title="Lỗi">
            {error.message}
          </Alert>
        )}

        {data && (
          <Stack gap="lg">
            {/* Attendance rate */}
            <Box
              p="md"
              style={{ border: '1px solid var(--cmc-border)', borderRadius: 'var(--cmc-radius-xs)' }}
            >
              <Text fw={600} mb="xs">Tỷ lệ chuyên cần</Text>
              <Progress
                value={data.attendanceRate * 100}
                color={data.attendanceRate >= 0.8 ? 'green' : 'orange'}
                mb={4}
              />
              <Text size="sm" c="dimmed">
                {(data.attendanceRate * 100).toFixed(1)}%
              </Text>
            </Box>

            {/* Final grade */}
            {data.finalGrade ? (
              <Box
                p="md"
                style={{ border: '1px solid var(--cmc-border)', borderRadius: 'var(--cmc-radius-xs)' }}
              >
                <Text fw={600} mb="xs">Điểm tổng kết</Text>
                <Text size="2rem" fw={700} style={{ color: 'var(--cmc-brand)' }}>
                  {data.finalGrade.score.toFixed(1)}
                </Text>
              </Box>
            ) : (
              <Alert color="gray" variant="light">Chưa có điểm tổng kết trong kỳ này.</Alert>
            )}

            {/* Confirmed assessments */}
            <Box>
              <Text fw={600} mb="xs">Nhận xét đã xác nhận</Text>
              {data.assessments.length === 0 ? (
                <Text size="sm" c="dimmed">Chưa có nhận xét nào.</Text>
              ) : (
                <Stack gap="xs">
                  {data.assessments.map((a) => (
                    <Box
                      key={a.id}
                      p="sm"
                      style={{
                        border: '1px solid var(--cmc-border)',
                        borderRadius: 'var(--cmc-radius-xs)',
                        background: 'var(--cmc-surface-2)',
                      }}
                    >
                      <Text size="xs" c="dimmed" mb={4}>
                        {a.confirmedAt
                          ? new Date(a.confirmedAt).toLocaleDateString('vi-VN')
                          : '—'}
                      </Text>
                      <Text size="sm">{a.content}</Text>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        )}

        <Button variant="subtle" mt="lg" onClick={() => navigate('/parent/home')}>
          ← Quay lại
        </Button>
      </Box>
    </Box>
  );
}
