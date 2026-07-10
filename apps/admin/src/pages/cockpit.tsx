import { Link } from 'react-router-dom';
import { StatCard, PageHeader, Badge, Card, Grid, HStack, Skeleton, Stack, Text, Heading } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';

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
      <Stack gap={1}>
        {[1, 2, 3].map((i) => <Skeleton key={i} height={48} radius={1} />)}
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          border: '1px dashed var(--cmc-border)',
          borderRadius: 4,
          textAlign: 'center',
        }}
      >
        <Text type="supporting" size="sm">
          Không có nhiệm vụ nào chờ xử lý cho vai trò này.
        </Text>
      </div>
    );
  }

  return (
    <Stack gap={1}>
      {items.map((item, i) => (
        <Link
          key={i}
          to={item.href}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <Card padding={2} style={{ cursor: 'pointer' }}>
            <HStack justify="between">
              <Stack gap={0.5}>
                <Text size="sm" weight="semibold">{item.title}</Text>
                <Text type="supporting" size="xsm">{item.meta}</Text>
              </Stack>
              <Text size="xsm" color="accent">Xem →</Text>
            </HStack>
          </Card>
        </Link>
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

  if (isLoading) return <Skeleton height={120} radius={1} />;

  return (
    <div
      style={{
        padding: 16,
        border: '1px solid var(--cmc-border)',
        borderRadius: 4,
        background: 'var(--cmc-surface)',
      }}
    >
      <Text
        type="supporting"
        size="xsm"
        weight="semibold"
        style={{ textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}
      >
        Pipeline O1 → O5
      </Text>
      <Stack gap={2}>
        {Object.entries(STAGE_LABELS).map(([key, label]) => (
          <HStack key={key} justify="between">
            <Text size="sm">{label}</Text>
            <Badge
              label={String(counts[key] ?? 0)}
              variant={(counts[key] ?? 0) > 0 ? 'blue' : 'neutral'}
            />
          </HStack>
        ))}
      </Stack>
    </div>
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

  if (isLoading) return <Skeleton height={120} radius={1} />;

  return (
    <div
      style={{
        padding: 16,
        border: '1px solid var(--cmc-border)',
        borderRadius: 4,
        background: 'var(--cmc-surface)',
      }}
    >
      <Text
        type="supporting"
        size="xsm"
        weight="semibold"
        style={{ textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}
      >
        Lịch dạy hôm nay
      </Text>
      {todayBatches.length === 0 ? (
        <Text type="supporting" size="sm">Không có lớp hôm nay.</Text>
      ) : (
        <Stack gap={2}>
          {todayBatches.map((b) => (
            <HStack key={b.id} justify="between">
              <Text size="sm">{b.code}</Text>
              <Badge label="Đang dạy" variant="success" />
            </HStack>
          ))}
        </Stack>
      )}
    </div>
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
        <div style={{ padding: 16 }}>
          <Grid columns={{ minWidth: 220, max: 3 }} gap={4} style={{ marginBottom: 32 }}>
            <Skeleton height={80} radius={1} />
            <Skeleton height={80} radius={1} />
            <Skeleton height={80} radius={1} />
          </Grid>
          <Skeleton height={200} radius={1} />
        </div>
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

      <div style={{ padding: 16 }}>
        {hasAnyStatCard && (
          <Grid columns={{ minWidth: 200, max: 4 }} gap={4} style={{ marginBottom: 32 }}>
            {canViewReceipts && <PendingReceiptsCard />}
            {canViewReceipts && isDirector && <OverThresholdCard />}
            {canViewCrm && isSale && <O4OpportunitiesCard />}
            {canGrade && <UngradedSubmissionsCard />}
          </Grid>
        )}

        <Grid columns={{ minWidth: 320, max: 2 }} gap={4}>
          <div>
            <Heading level={6} style={{ marginBottom: 8 }}>Việc cần bạn xử lý</Heading>
            {isDirector && canViewReceipts && <DirectorTaskQueue />}
            {isSale && canViewCrm && !isDirector && <SaleTaskQueue />}
            {isTeacher && canGrade && !isDirector && !isSale && <TeacherTaskQueue />}
            {!isDirector && !isSale && !isTeacher && (
              <div
                style={{
                  padding: 16,
                  border: '1px dashed var(--cmc-border)',
                  borderRadius: 4,
                  textAlign: 'center',
                }}
              >
                <Text type="supporting" size="sm">
                  Không có nhiệm vụ nào chờ xử lý cho vai trò này.
                </Text>
              </div>
            )}
          </div>

          <div>
            {(isSale || isDirector) && canViewCrm && <PipelineFunnel />}
            {isTeacher && canViewSchedule && <TodaySchedulePanel />}
            {!isSale && !isDirector && !isTeacher && canViewSchedule && <TodaySchedulePanel />}
          </div>
        </Grid>
      </div>
    </>
  );
}
