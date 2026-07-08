import { Link } from 'react-router-dom';
import { StatCard, PageHeader } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';
import {
  Badge,
  Box,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';

export function countPendingApproval(receipts: { status: string }[]): number {
  return receipts.filter((r) => r.status === 'draft').length;
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

function PendingReceiptsCard() {
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery(
    { status: 'draft', pageSize: 1 },
  );
  const pending = data?.total ?? 0;

  return (
    <Link to="/finance?status=draft" style={{ textDecoration: 'none' }}>
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

function OverThresholdCard() {
  const { me } = useSession();
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery(
    { status: 'draft', pageSize: 100 },
  );
  const threshold = me?.config.approvalSecondEyeThreshold ?? 20_000_000;
  const count = (data?.items ?? []).filter(
    (r) => r.netAmount > threshold,
  ).length;

  return (
    <Link to="/finance?status=draft" style={{ textDecoration: 'none' }}>
      <StatCard
        label="Vượt ngưỡng duyệt"
        value={isLoading ? '…' : error ? 'Lỗi' : count}
        trend={error ? error.message : 'Cần GĐĐT/SA →'}
        color={count > 0 ? '#e67700' : undefined}
        loading={isLoading}
      />
    </Link>
  );
}

function UngradedSubmissionsCard() {
  const { data, isLoading, error } = trpc.submission.listForGrading.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const count = (data?.items ?? []).filter(
    (s) => s.status === 'submitted',
  ).length;

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

function O4OpportunitiesCard() {
  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 100 },
    { refetchOnWindowFocus: false },
  );
  const count = (data?.items ?? []).filter(
    (o) => !o.closedAt,
  ).length;

  return (
    <Link to="/crm" style={{ textDecoration: 'none' }}>
      <StatCard
        label="Sẵn sàng ghi danh"
        value={isLoading ? '…' : error ? 'Lỗi' : count}
        trend={error ? error.message : 'Cơ hội O4 →'}
        color={count > 0 ? '#2f9e44' : undefined}
        loading={isLoading}
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Task queue — "Việc cần bạn xử lý"
// ---------------------------------------------------------------------------

interface TaskItem {
  title: string;
  meta: string;
  href: string;
}

function TaskQueue({ items, loading }: { items: TaskItem[]; loading: boolean }) {
  if (loading) {
    return (
      <Stack gap="xs">
        {[1, 2, 3].map((i) => <Skeleton key={i} height={48} radius="xs" />)}
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <Box
        p="md"
        style={{
          border: '1px dashed var(--cmc-border)',
          borderRadius: 4,
          textAlign: 'center',
        }}
      >
        <Text fz="sm" c="dimmed">
          Không có nhiệm vụ nào chờ xử lý cho vai trò này.
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap="xs">
      {items.map((item, i) => (
        <Card
          key={i}
          padding="sm"
          radius="xs"
          withBorder
          component={Link}
          to={item.href}
          style={{ borderColor: 'var(--cmc-border)', textDecoration: 'none', cursor: 'pointer' }}
        >
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fz="sm" fw={600}>{item.title}</Text>
              <Text fz="xs" c="dimmed">{item.meta}</Text>
            </Stack>
            <Text fz="xs" c="blue">Xem →</Text>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

function DirectorTaskQueue() {
  const { me } = useSession();
  const { data, isLoading } = trpc.finance.receiptList.useQuery(
    { status: 'draft', pageSize: 10 },
  );
  const threshold = me?.config.approvalSecondEyeThreshold ?? 20_000_000;
  const items: TaskItem[] = (data?.items ?? []).slice(0, 10).map((r) => ({
    title: `Duyệt ${r.code} — ${r.studentName}`,
    meta: `${r.netAmount.toLocaleString('vi-VN')} đ${r.netAmount > threshold ? ' ⚠️ vượt ngưỡng' : ''}`,
    href: `/finance/${r.id}`,
  }));

  return <TaskQueue items={items} loading={isLoading} />;
}

function SaleTaskQueue() {
  const { data, isLoading } = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 50 },
    { refetchOnWindowFocus: false },
  );
  const items: TaskItem[] = (data?.items ?? [])
    .filter((o) => !o.closedAt)
    .slice(0, 10)
    .map((o) => ({
      title: `Ghi danh — ${o.contact.name}`,
      meta: o.contact.phone,
      href: `/finance/new?opportunityId=${o.id}`,
    }));

  return <TaskQueue items={items} loading={isLoading} />;
}

function TeacherTaskQueue() {
  const { data, isLoading } = trpc.submission.listForGrading.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const pending = (data?.items ?? []).filter(
    (s) => s.status === 'submitted',
  );
  const items: TaskItem[] = pending.slice(0, 10).map(
    (s) => ({
      title: `Chấm bài — ${s.studentId.slice(0, 8)}`,
      meta: `Bài tập ${s.exerciseId.slice(0, 8)}`,
      href: '/teaching/grading',
    }),
  );

  return <TaskQueue items={items} loading={isLoading} />;
}

// ---------------------------------------------------------------------------
// Pipeline side panel — O1→O5 funnel
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch KT',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
};

function PipelineFunnel() {
  const { data, isLoading } = trpc.crm.opportunityList.useQuery(
    { pageSize: 100 },
    { refetchOnWindowFocus: false },
  );

  const counts: Record<string, number> = {};
  for (const opp of data?.items ?? []) {
    counts[opp.stage] = (counts[opp.stage] ?? 0) + 1;
  }

  if (isLoading) return <Skeleton height={120} radius="xs" />;

  return (
    <Box
      p="md"
      style={{
        border: '1px solid var(--cmc-border)',
        borderRadius: 4,
        background: 'var(--cmc-surface)',
      }}
    >
      <Text fz="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.04em' }}>
        Pipeline O1 → O5
      </Text>
      <Stack gap="xs">
        {Object.entries(STAGE_LABELS).map(([key, label]) => (
          <Group key={key} justify="space-between">
            <Text fz="sm">{label}</Text>
            <Badge
              size="sm"
              variant="light"
              color={(counts[key] ?? 0) > 0 ? 'blue' : 'gray'}
            >
              {counts[key] ?? 0}
            </Badge>
          </Group>
        ))}
      </Stack>
    </Box>
  );
}

function TodaySchedulePanel() {
  const { data, isLoading } = trpc.classBatch.list.useQuery(
    { page: 1, pageSize: 20 },
    { refetchOnWindowFocus: false },
  );

  const now = new Date();
  const todayBatches = (data?.items ?? []).filter((b) => {
    const start = new Date(b.startDate);
    const end = new Date(b.endDate);
    return start <= now && now <= end && b.status !== 'cancelled';
  });

  if (isLoading) return <Skeleton height={120} radius="xs" />;

  return (
    <Box
      p="md"
      style={{
        border: '1px solid var(--cmc-border)',
        borderRadius: 4,
        background: 'var(--cmc-surface)',
      }}
    >
      <Text fz="xs" fw={600} c="dimmed" tt="uppercase" mb="sm" style={{ letterSpacing: '0.04em' }}>
        Lịch dạy hôm nay
      </Text>
      {todayBatches.length === 0 ? (
        <Text fz="sm" c="dimmed">Không có lớp hôm nay.</Text>
      ) : (
        <Stack gap="xs">
          {todayBatches.map((b) => (
            <Group key={b.id} justify="space-between">
              <Text fz="sm">{b.code}</Text>
              <Badge size="xs" color="green">Đang dạy</Badge>
            </Group>
          ))}
        </Stack>
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
  const canViewCrm = canDo('crm', 'opportunityList');
  const canViewSchedule = canDo('class', 'create');

  const isDirector = me?.roles.some((r) =>
    r === 'giam_doc_kinh_doanh' || r === 'giam_doc_dao_tao' || r === 'super_admin',
  );
  const isSale = me?.roles.includes('sale');
  const isTeacher = me?.roles.includes('giao_vien');

  if (sessionLoading) {
    return (
      <>
        <PageHeader
          title="Tổng quan"
          breadcrumbs={[{ label: 'Tổng quan' }]}
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

  const hasAnyStatCard = canViewReceipts || canGrade || canViewCrm;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        subtitle={me ? `Xin chào · ${me.roles.join(', ')}` : 'Dashboard'}
        breadcrumbs={[{ label: 'Tổng quan' }]}
      />

      <Box p="md">
        {hasAnyStatCard && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
            {canViewReceipts && <PendingReceiptsCard />}
            {canViewReceipts && isDirector && <OverThresholdCard />}
            {canViewCrm && isSale && <O4OpportunitiesCard />}
            {canGrade && <UngradedSubmissionsCard />}
          </SimpleGrid>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Box>
            <Title order={6} mb="sm">Việc cần bạn xử lý</Title>
            {isDirector && canViewReceipts && <DirectorTaskQueue />}
            {isSale && canViewCrm && !isDirector && <SaleTaskQueue />}
            {isTeacher && canGrade && !isDirector && !isSale && <TeacherTaskQueue />}
            {!isDirector && !isSale && !isTeacher && (
              <Box
                p="md"
                style={{
                  border: '1px dashed var(--cmc-border)',
                  borderRadius: 4,
                  textAlign: 'center',
                }}
              >
                <Text fz="sm" c="dimmed">
                  Không có nhiệm vụ nào chờ xử lý cho vai trò này.
                </Text>
              </Box>
            )}
          </Box>

          <Box>
            {(isSale || isDirector) && canViewCrm && <PipelineFunnel />}
            {isTeacher && canViewSchedule && <TodaySchedulePanel />}
            {!isSale && !isDirector && !isTeacher && canViewSchedule && <TodaySchedulePanel />}
          </Box>
        </SimpleGrid>
      </Box>
    </>
  );
}
