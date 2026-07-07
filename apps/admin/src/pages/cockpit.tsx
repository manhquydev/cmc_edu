/**
 * Cockpit — role-aware dashboard.
 *
 * Shows task counts and deep-links for actions the current user has permission
 * to take. Queries are gated by `canDo()` so a user without a given permission
 * never fires a request that would 403.
 *
 * Mounted as the teaching section index (`/teaching`).
 */

import { Link } from 'react-router-dom';
import { StatCard, PageHeader } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';

// ---------------------------------------------------------------------------
// Pending-receipts stat card (finance.receiptList gated)
// ---------------------------------------------------------------------------

function PendingReceiptsCard() {
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({});
  const pending = (data?.items ?? []).filter(
    (r: { status: string }) => r.status === 'pending',
  ).length;

  return (
    <Link to="/finance" style={{ textDecoration: 'none' }}>
      <StatCard
        label="Phiếu thu chờ duyệt"
        value={isLoading ? '…' : error ? 'Lỗi' : pending}
        trend={error ? error.message : 'Xem danh sách →'}
        color={pending > 0 ? '#e03131' : undefined}
        loading={isLoading}
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Ungraded submissions stat card (submission.grade gated)
// ---------------------------------------------------------------------------

function UngradedSubmissionsCard() {
  const { data, isLoading, error } = trpc.submission.listForGrading.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const count = data?.items.length ?? 0;

  return (
    <Link to="/teaching/grading" style={{ textDecoration: 'none' }}>
      <StatCard
        label="Bài chờ chấm"
        value={isLoading ? '…' : error ? 'Lỗi' : count}
        trend={error ? error.message : 'Chấm bài →'}
        color={count > 0 ? '#e67700' : undefined}
        loading={isLoading}
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Today's classes widget (classBatch.list gated on class.create permission,
// which all teaching roles carry)
// ---------------------------------------------------------------------------

function TodayClassesWidget() {
  const { data, isLoading, error } = trpc.classBatch.list.useQuery(
    { page: 1, pageSize: 20 },
    { refetchOnWindowFocus: false },
  );

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Show batches that are currently active (startDate ≤ today ≤ endDate)
  const now = new Date();
  const todayBatches = (data?.items ?? []).filter((b) => {
    // tRPC transmits dates as strings over JSON; cast through unknown.
    const start = new Date(b.startDate as unknown as string);
    const end = new Date(b.endDate as unknown as string);
    return start <= now && now <= end && b.status !== 'cancelled';
  });

  return (
    <Box>
      <Group mb="sm" justify="space-between">
        <Text fz="sm" fw={600}>
          Lịch dạy hôm nay
        </Text>
        <Text fz="xs" c="dimmed">
          {today}
        </Text>
      </Group>

      {error && (
        <Alert color="red" fz="xs" p="xs" mb="sm">
          {error.message}
        </Alert>
      )}

      {isLoading ? (
        <Stack gap="xs">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={52} radius="xs" />
          ))}
        </Stack>
      ) : todayBatches.length === 0 ? (
        <Box
          p="md"
          style={{
            border: '1px dashed var(--cmc-border)',
            borderRadius: 4,
            textAlign: 'center',
          }}
        >
          <Text fz="sm" c="dimmed">
            Không có lớp học nào hôm nay.
          </Text>
        </Box>
      ) : (
        <Stack gap="xs">
          {todayBatches.map((batch) => (
            <Card
              key={batch.id}
              padding="sm"
              radius="xs"
              withBorder
              component={Link}
              to={`/teaching/attendance?class=${batch.id}`}
              style={{
                borderColor: 'var(--cmc-border)',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text fz="sm" fw={600}>
                    {batch.code}
                  </Text>
                  <Text fz="xs" c="dimmed">
                    {batch.program}
                  </Text>
                </Stack>
                <Badge color="green" size="xs" radius="xs">
                  Đang dạy
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {!isLoading && !error && (
        <Box mt="xs">
          <Link to="/teaching/schedule" style={{ fontSize: 12, color: 'var(--cmc-accent, #228be6)' }}>
            Xem lịch dạy đầy đủ →
          </Link>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CockpitPage() {
  const { me, isLoading: sessionLoading, canDo } = useSession();

  const canViewReceipts = canDo('finance', 'receiptList');
  const canGrade = canDo('submission', 'grade');
  const canViewSchedule = canDo('class', 'create');

  if (sessionLoading) {
    return (
      <>
        <PageHeader
          title="Tổng quan"
          breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Tổng quan' }]}
        />
        <Box p="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="xl">
            <Skeleton height={80} radius="xs" />
            <Skeleton height={80} radius="xs" />
            <Skeleton height={80} radius="xs" />
          </SimpleGrid>
          <Skeleton height={200} radius="xs" />
        </Box>
      </>
    );
  }

  const hasAnyStatCard = canViewReceipts || canGrade;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle={
          me
            ? `Xin chào · ${me.roles.join(', ')}`
            : 'Dashboard giảng dạy'
        }
        breadcrumbs={[{ label: 'Giảng dạy' }, { label: 'Tổng quan' }]}
      />

      <Box p="md">
        {/* Stat cards — gated per permission */}
        {hasAnyStatCard && (
          <SimpleGrid
            cols={{ base: 1, sm: 2, md: 3 }}
            spacing="md"
            mb="xl"
          >
            {canViewReceipts && <PendingReceiptsCard />}
            {canGrade && <UngradedSubmissionsCard />}
          </SimpleGrid>
        )}

        {!hasAnyStatCard && (
          <Box
            mb="xl"
            p="md"
            style={{
              border: '1px dashed var(--cmc-border)',
              borderRadius: 4,
              background: 'var(--cmc-surface-2)',
            }}
          >
            <Text fz="sm" c="dimmed" ta="center">
              Không có nhiệm vụ nào chờ xử lý cho vai trò này.
            </Text>
          </Box>
        )}

        {/* Today's teaching progress */}
        {canViewSchedule && (
          <Box
            p="md"
            style={{
              border: '1px solid var(--cmc-border)',
              borderRadius: 4,
              background: 'var(--cmc-surface)',
            }}
          >
            <TodayClassesWidget />
          </Box>
        )}
      </Box>
    </>
  );
}
