import { useNavigate } from 'react-router-dom';
import { formatRoles } from '@cmc/auth';
import { classifyDueLevel } from '@cmc/domain-time';
import {
  Button,
  DashboardPage,
  HStack,
  MetricCard,
  ShortcutChip,
  StageFunnel,
  WorkInbox,
  dueLevelClassName,
  dueLevelTone,
  type TaskRowProps,
  type Tone,
} from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';
import { formatContactPhone } from '../lib/format-contact-phone.js';

export function countPendingApproval(receipts: { status: string }[]): number {
  return receipts.filter((r) => r.status === 'draft').length;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function PendingReceiptsCard() {
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({ status: 'draft', pageSize: 1 });
  const pending = data?.total ?? 0;
  return (
    <MetricCard
      label="Phiếu thu chờ duyệt"
      icon="receipt"
      href="/finance?status=draft"
      attention={pending > 0 ? 'danger' : undefined}
      loading={isLoading}
      value={error ? '—' : pending}
      context={error ? 'Không tải được' : 'Xem danh sách'}
    />
  );
}

function OverThresholdCard() {
  const { me } = useSession();
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({ status: 'draft', pageSize: 100 });
  const threshold = me?.config.approvalSecondEyeThreshold ?? 20_000_000;
  const count = (data?.items ?? []).filter((r) => r.netAmount > threshold).length;
  return (
    <MetricCard
      label="Vượt ngưỡng duyệt"
      icon="alert"
      href="/finance?status=draft"
      attention={count > 0 ? 'warning' : undefined}
      loading={isLoading}
      value={error ? '—' : count}
      context={error ? 'Không tải được' : 'Cần GĐĐT/SA'}
    />
  );
}

function UngradedSubmissionsCard() {
  const { data, isLoading, error } = trpc.submission.listForGrading.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const count = (data?.items ?? []).filter((s) => s.status === 'submitted').length;
  return (
    <MetricCard
      label="Bài chờ chấm"
      icon="edit"
      href="/teaching/grading"
      attention={count > 0 ? 'warning' : undefined}
      loading={isLoading}
      value={error ? '—' : count}
      context={error ? 'Không tải được' : 'Chấm bài'}
    />
  );
}

function O4OpportunitiesCard() {
  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 100, lost: 'exclude' },
    { refetchOnWindowFocus: false },
  );
  const count = (data?.items ?? []).filter((o) => !o.closedAt).length;
  return (
    <MetricCard
      label="Sẵn sàng ghi danh"
      icon="target"
      href="/crm?stage=O4_TESTED"
      attention={count > 0 ? 'success' : undefined}
      loading={isLoading}
      value={error ? '—' : count}
      context={error ? 'Không tải được' : 'Cơ hội O4'}
    />
  );
}

// ---------------------------------------------------------------------------
// Work inboxes (role queues)
// ---------------------------------------------------------------------------

function DirectorInbox() {
  const navigate = useNavigate();
  const { me } = useSession();
  const { data, isLoading } = trpc.finance.receiptList.useQuery({ status: 'draft', pageSize: 20 });
  const threshold = me?.config.approvalSecondEyeThreshold ?? 20_000_000;
  const drafts = [...(data?.items ?? [])].sort((a, b) => b.netAmount - a.netAmount);

  const urgent: TaskRowProps[] = [];
  const normal: TaskRowProps[] = [];
  for (const r of drafts.slice(0, 12)) {
    const over = r.netAmount > threshold;
    const row: TaskRowProps = {
      title: `Duyệt ${r.code} — ${r.studentName}`,
      meta: `${r.netAmount.toLocaleString('vi-VN')} đ`,
      href: `/finance/${r.id}`,
      tone: over ? 'warning' : 'brand',
      tag: over ? 'Vượt ngưỡng' : undefined,
    };
    if (over) urgent.push(row);
    else normal.push(row);
  }

  const sections =
    urgent.length > 0
      ? [
          { id: 'urgent', label: 'Khẩn — vượt ngưỡng', items: urgent },
          ...(normal.length ? [{ id: 'normal', label: 'Khác', items: normal }] : []),
        ]
      : undefined;

  return (
    <WorkInbox
      title="Việc cần bạn xử lý"
      count={drafts.length}
      viewAllHref="/finance?status=draft"
      items={sections ? undefined : normal}
      sections={sections}
      loading={isLoading}
      emptyTitle="Không có phiếu chờ duyệt"
      emptyDescription="Phiếu thu nháp cần duyệt sẽ xuất hiện tại đây."
      emptyAction={
        <Button label="Xem phiếu thu" variant="secondary" size="sm" onClick={() => navigate('/finance')} />
      }
    />
  );
}

function SaleInbox() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 50, lost: 'exclude' },
    { refetchOnWindowFocus: false },
  );
  const dueQ = trpc.crm.opportunityDueFollowUps.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const open = (data?.items ?? []).filter((o) => !o.closedAt).slice(0, 12);
  const enrollItems: TaskRowProps[] = open.map((o) => ({
    title: `Ghi danh — ${o.contact.name}`,
    meta: formatContactPhone(o.contact.phone),
    href: `/finance/new?opportunityId=${o.id}`,
    tone: 'success' as Tone,
    tag: 'O4',
  }));
  const dueItems: TaskRowProps[] = (dueQ.data?.items ?? []).map((o) => {
    const level = o.nextActionAt
      ? classifyDueLevel(new Date(o.nextActionAt), new Date())
      : 'today';
    return {
      title: o.nextActionNote ?? `Nhắc việc — ${o.contact.name}`,
      meta: o.nextActionAt
        ? `${o.contact.name} · hạn ${new Date(o.nextActionAt).toLocaleDateString('vi-VN')}`
        : o.contact.name,
      href: `/crm/opportunities/${o.id}`,
      tone: dueLevelTone(level),
      tag: 'Nhắc',
    };
  });
  const dueCounts = dueQ.data?.counts ?? { late: 0, today: 0, future: 0 };

  const sections =
    dueItems.length > 0
      ? [
          { id: 'due', label: 'Nhắc việc đến hạn', items: dueItems },
          ...(enrollItems.length
            ? [{ id: 'enroll', label: 'Sẵn sàng ghi danh (O4)', items: enrollItems }]
            : []),
        ]
      : undefined;

  const total = dueItems.length + open.length;

  return (
    <div data-testid="crm-due-followups">
      <HStack gap={2} wrap="wrap" style={{ marginBottom: 'var(--cmc-space-3)' }}>
        {(
          [
            ['late', 'Quá hạn', dueCounts.late],
            ['today', 'Hôm nay', dueCounts.today],
            ['future', 'Sắp tới', dueCounts.future],
          ] as const
        ).map(([level, label, count]) => (
          <button
            key={level}
            type="button"
            className={`${dueLevelClassName(level)} cmc-due-chip`}
            data-testid={`crm-due-count-${level}`}
            onClick={() => navigate(`/crm?due=${level}`)}
          >
            {label} {count}
          </button>
        ))}
      </HStack>
      <WorkInbox
        title="Việc cần bạn xử lý"
        count={total}
        viewAllHref="/crm"
        items={sections ? undefined : enrollItems}
        sections={sections}
        loading={isLoading || dueQ.isLoading}
        emptyTitle="Không có việc chờ xử lý"
        emptyDescription="Nhắc việc đến hạn và cơ hội O4 sẵn sàng ghi danh sẽ hiện ở đây."
        emptyAction={<Button label="Mở CRM" variant="secondary" size="sm" onClick={() => navigate('/crm')} />}
      />
    </div>
  );
}

function TeacherInbox() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.submission.listForGrading.useQuery(
    {},
    { refetchOnWindowFocus: false },
  );
  const pending = (data?.items ?? []).filter((s) => s.status === 'submitted');
  const items: TaskRowProps[] = pending.slice(0, 12).map((s) => ({
    title: `Chấm bài — ${s.studentFullName ?? s.studentId.slice(0, 8)}`,
    meta: s.submittedAt
      ? `Nộp ${new Date(s.submittedAt).toLocaleDateString('vi-VN')}`
      : `Bài tập ${s.exerciseId.slice(0, 8)}`,
    href: '/teaching/grading',
    tone: 'warning' as Tone,
  }));

  return (
    <WorkInbox
      title="Việc cần bạn xử lý"
      count={pending.length}
      viewAllHref="/teaching/grading"
      items={items}
      loading={isLoading}
      emptyTitle="Không có bài chờ chấm"
      emptyDescription="Khi học sinh nộp bài, danh sách sẽ hiện tại đây."
      emptyAction={
        <Button label="Mở chấm bài" variant="secondary" size="sm" onClick={() => navigate('/teaching/grading')} />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Pipeline + schedule side panels
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  { key: 'O1_LEAD', label: 'Tiếp cận' },
  { key: 'O2_CONTACTED', label: 'Đã liên hệ' },
  { key: 'O3_TEST_SCHEDULED', label: 'Đặt lịch KT' },
  { key: 'O4_TESTED', label: 'Đã kiểm tra', emphasize: true },
  { key: 'O5_ENROLLED', label: 'Đã ghi danh' },
] as const;

function PipelinePanel() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.crm.opportunityList.useQuery(
    { pageSize: 100, lost: 'exclude' },
    { refetchOnWindowFocus: false },
  );
  // Prefer server stageCounts when present; fall back to client tally.
  const stageCounts = data?.stageCounts ?? {};
  const counts: Record<string, number> = { ...stageCounts };
  if (!data?.stageCounts) {
    for (const opp of data?.items ?? []) {
      if (!opp.closedAt) counts[opp.stage] = (counts[opp.stage] ?? 0) + 1;
    }
  }
  const o4 = counts['O4_TESTED'] ?? 0;

  return (
    <StageFunnel
      title="Pipeline O1 → O5"
      layout="rail"
      loading={isLoading}
      viewAllHref="/crm"
      stages={PIPELINE_STAGES.map((s) => ({
        key: s.key,
        label: s.label,
        value: counts[s.key] ?? 0,
        href: `/crm?stage=${s.key}`,
        emphasize: 'emphasize' in s && s.emphasize,
      }))}
      footer={
        o4 > 0
          ? { label: 'Sẵn sàng ghi danh', href: '/crm?stage=O4_TESTED', count: o4 }
          : undefined
      }
      emptyAction={
        <Button label="Mở CRM" variant="secondary" size="sm" onClick={() => navigate('/crm')} />
      }
    />
  );
}

function TodaySchedulePanel() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.classBatch.list.useQuery(
    { page: 1, pageSize: 20 },
    { refetchOnWindowFocus: false },
  );
  // Active-period batches (startDate ≤ now ≤ endDate), not calendar "today" sessions.
  const now = new Date();
  const activeBatches = (data?.items ?? []).filter((b) => {
    const start = new Date(b.startDate);
    const end = new Date(b.endDate);
    return start <= now && now <= end && b.status !== 'cancelled';
  });

  const items: TaskRowProps[] = activeBatches.slice(0, 8).map((b) => ({
    title: b.code,
    meta: `${b.program} · ${b.status}`,
    href: `/teaching/attendance?classBatch=${b.id}`,
    tone: 'success' as Tone,
    tag: 'Lớp',
  }));

  return (
    <WorkInbox
      title="Lớp đang trong kỳ"
      count={activeBatches.length}
      viewAllHref="/teaching/schedule"
      viewAllLabel="Lịch đầy đủ"
      items={items}
      loading={isLoading}
      emptyTitle="Không có lớp trong kỳ"
      emptyDescription="Lớp có khoảng thời gian đang hoạt động sẽ hiện tại đây."
      emptyAction={
        <Button
          label="Xem lịch dạy"
          variant="secondary"
          size="sm"
          onClick={() => navigate('/teaching/schedule')}
        />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Shortcuts with live badges
// ---------------------------------------------------------------------------

function RoleShortcuts({
  isDirector,
  isSale,
  isTeacher,
  draftReceipts,
  o4Count,
  ungraded,
}: {
  isDirector: boolean;
  isSale: boolean;
  isTeacher: boolean;
  draftReceipts?: number;
  o4Count?: number;
  ungraded?: number;
}) {
  if (isTeacher && !isDirector && !isSale) {
    return (
      <>
        <ShortcutChip label="Điểm danh" href="/teaching/attendance" icon="check-circle" />
        <ShortcutChip
          label="Chấm bài"
          href="/teaching/grading"
          icon="edit"
          badge={ungraded && ungraded > 0 ? ungraded : undefined}
        />
        <ShortcutChip label="Nhật ký buổi học" href="/teaching/session-evidence" icon="camera" />
        <ShortcutChip label="Chấm công" href="/hr/checkin" icon="clock" />
      </>
    );
  }
  if (isSale && !isDirector) {
    return (
      <>
        <ShortcutChip
          label="CRM"
          href="/crm"
          icon="target"
          badge={o4Count && o4Count > 0 ? o4Count : undefined}
        />
        <ShortcutChip label="Xếp lớp" href="/finance/class-placement" icon="layers" />
        <ShortcutChip label="Chấm công" href="/hr/checkin" icon="clock" />
        <ShortcutChip label="Đổi thưởng" href="/admin/engagement/rewards" icon="trophy" />
      </>
    );
  }
  if (isDirector) {
    return (
      <>
        <ShortcutChip
          label="Phiếu thu"
          href="/finance?status=draft"
          icon="receipt"
          badge={draftReceipts && draftReceipts > 0 ? draftReceipts : undefined}
        />
        <ShortcutChip label="CRM" href="/crm" icon="target" />
        <ShortcutChip label="Lớp học" href="/admin/classes" icon="layers" />
        <ShortcutChip label="Nhân sự" href="/hr" icon="users" />
      </>
    );
  }
  return (
    <>
      <ShortcutChip label="Chấm công" href="/hr/checkin" icon="clock" />
      <ShortcutChip label="Của tôi" href="/hr/my" icon="user" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CockpitPage() {
  const navigate = useNavigate();
  const { me, isLoading: sessionLoading, canDo } = useSession();

  const canViewReceipts = canDo('finance', 'receiptList');
  const canGrade = canDo('submission', 'grade');
  const canViewCrm = canDo('crm', 'opportunityList');
  const canViewSchedule = canDo('class', 'read');

  const isDirector =
    me?.roles.some(
      (r) => r === 'giam_doc_kinh_doanh' || r === 'giam_doc_dao_tao' || r === 'super_admin',
    ) ?? false;
  const isSale = me?.roles.includes('sale') ?? false;
  const isTeacher = me?.roles.includes('giao_vien') ?? false;

  const draftQ = trpc.finance.receiptList.useQuery(
    { status: 'draft', pageSize: 1 },
    { enabled: canViewReceipts },
  );
  const gradeQ = trpc.submission.listForGrading.useQuery(
    {},
    { enabled: canGrade, refetchOnWindowFocus: false },
  );
  const o4Q = trpc.crm.opportunityList.useQuery(
    { stage: 'O4_TESTED', pageSize: 100, lost: 'exclude' },
    { enabled: canViewCrm && isSale, refetchOnWindowFocus: false },
  );

  const draftTotal = draftQ.data?.total ?? 0;
  const ungraded = (gradeQ.data?.items ?? []).filter((s) => s.status === 'submitted').length;
  const o4Count = (o4Q.data?.items ?? []).filter((o) => !o.closedAt).length;

  const metrics = (
    <>
      {canViewReceipts && <PendingReceiptsCard />}
      {canViewReceipts && isDirector && <OverThresholdCard />}
      {canViewCrm && isSale && !isDirector && <O4OpportunitiesCard />}
      {canGrade && <UngradedSubmissionsCard />}
    </>
  );
  const hasMetrics = canViewReceipts || canGrade || (canViewCrm && isSale);

  const primary = (
    <>
      {isDirector && canViewReceipts && <DirectorInbox />}
      {isSale && canViewCrm && !isDirector && <SaleInbox />}
      {isTeacher && canGrade && !isDirector && !isSale && <TeacherInbox />}
      {!isDirector && !isSale && !isTeacher && (
        <WorkInbox
          title="Việc cần bạn xử lý"
          items={[]}
          emptyTitle="Không có nhiệm vụ chờ xử lý"
          emptyDescription="Vai trò hiện tại chưa có hàng đợi việc trên tổng quan. Dùng lối tắt hoặc menu để làm việc."
          emptyAction={
            <Button
              label="Mở chấm công"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/hr/checkin')}
            />
          }
        />
      )}
    </>
  );

  const secondary = (
    <>
      {(isSale || isDirector) && canViewCrm && <PipelinePanel />}
      {isTeacher && canViewSchedule && <TodaySchedulePanel />}
      {!isSale && !isDirector && !isTeacher && canViewSchedule && <TodaySchedulePanel />}
    </>
  );

  return (
    <DashboardPage
      title="Tổng quan"
      subtitle={me ? `Xin chào · ${formatRoles(me.roles)}` : undefined}
      loading={sessionLoading}
      shortcuts={
        <RoleShortcuts
          isDirector={isDirector}
          isSale={isSale}
          isTeacher={isTeacher}
          draftReceipts={draftTotal}
          o4Count={o4Count}
          ungraded={ungraded}
        />
      }
      metrics={hasMetrics ? metrics : undefined}
      primary={primary}
      secondary={secondary}
    />
  );
}
