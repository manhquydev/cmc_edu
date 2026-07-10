import { Skeleton, LineIcon, MetricCard, Panel, TaskRow, FunnelBar, type Tone } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';

export function countPendingApproval(receipts: { status: string }[]): number {
  return receipts.filter((r) => r.status === 'draft').length;
}

// Cockpit — the premium dashboard. Presentation is now the shared @cmc/ui
// composites (MetricCard/Panel/TaskRow/FunnelBar, styled by @cmc/ui/premium.css);
// this file keeps the tRPC data wrappers + page layout only. Design language is
// LOCKED (see brainstorm report): restraint, warm canvas, monochrome icons,
// near-black numerals, one accent.

// Page-layout styles only; all composite styles live in @cmc/ui/premium.css.
const styles = `
.ck-wrap { background: var(--cmc-canvas); min-height: 100%; padding: 32px 34px; }
.ck-head { margin-bottom: 28px; }
.ck-h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; color: var(--cmc-text); margin: 0; line-height: 1.1; }
.ck-sub { font-size: 14px; color: var(--cmc-text-muted); margin: 5px 0 0; }
.ck-grid { display: grid; gap: 20px; }
.ck-metrics { grid-template-columns: repeat(auto-fit, minmax(236px, 1fr)); margin-bottom: 32px; }
.ck-body { grid-template-columns: 1fr; align-items: start; }
@media (min-width: 1040px) { .ck-body { grid-template-columns: 1.4fr 1fr; } }
`;

// ---------------------------------------------------------------------------
// Metric cards — tRPC data wrappers; presentation = @cmc/ui MetricCard
// ---------------------------------------------------------------------------

function PendingReceiptsCard() {
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({ status: 'draft', pageSize: 1 });
  const pending = data?.total ?? 0;
  return (
    <MetricCard label="Phiếu thu chờ duyệt" icon="receipt" href="/finance?status=draft"
      attention={pending > 0 ? 'danger' : undefined} loading={isLoading}
      value={error ? '—' : pending} context={error ? 'Không tải được' : 'Xem danh sách'} />
  );
}

function OverThresholdCard() {
  const { me } = useSession();
  const { data, isLoading, error } = trpc.finance.receiptList.useQuery({ status: 'draft', pageSize: 100 });
  const threshold = me?.config.approvalSecondEyeThreshold ?? 20_000_000;
  const count = (data?.items ?? []).filter((r) => r.netAmount > threshold).length;
  return (
    <MetricCard label="Vượt ngưỡng duyệt" icon="alert" href="/finance?status=draft"
      attention={count > 0 ? 'warning' : undefined} loading={isLoading}
      value={error ? '—' : count} context={error ? 'Không tải được' : 'Cần GĐĐT/SA'} />
  );
}

function UngradedSubmissionsCard() {
  const { data, isLoading, error } = trpc.submission.listForGrading.useQuery({}, { refetchOnWindowFocus: false });
  const count = (data?.items ?? []).filter((s) => s.status === 'submitted').length;
  return (
    <MetricCard label="Bài chờ chấm" icon="edit" href="/teaching/grading"
      attention={count > 0 ? 'warning' : undefined} loading={isLoading}
      value={error ? '—' : count} context={error ? 'Không tải được' : 'Chấm bài'} />
  );
}

function O4OpportunitiesCard() {
  const { data, isLoading, error } = trpc.crm.opportunityList.useQuery({ stage: 'O4_TESTED', pageSize: 100 }, { refetchOnWindowFocus: false });
  const count = (data?.items ?? []).filter((o) => !o.closedAt).length;
  return (
    <MetricCard label="Sẵn sàng ghi danh" icon="target" href="/crm"
      attention={count > 0 ? 'success' : undefined} loading={isLoading}
      value={error ? '—' : count} context={error ? 'Không tải được' : 'Cơ hội O4'} />
  );
}

// ---------------------------------------------------------------------------
// Task queue — "Việc cần bạn xử lý" (rows = @cmc/ui TaskRow)
// ---------------------------------------------------------------------------

interface TaskItem { title: string; meta: string; href: string; tone: Tone }

function TaskQueue({ items, loading }: { items: TaskItem[]; loading: boolean }) {
  if (loading) {
    return <div style={{ padding: '8px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map((i) => <Skeleton key={i} height={40} radius={1} />)}
    </div>;
  }
  if (items.length === 0) {
    return (
      <div className="ck-empty">
        <span className="ck-empty-icon"><LineIcon name="check-circle" size={22} /></span>
        Không có nhiệm vụ nào chờ xử lý cho vai trò này.
      </div>
    );
  }
  return (
    <div>
      {items.map((item, i) => (
        <TaskRow key={i} title={item.title} meta={item.meta} href={item.href} tone={item.tone} />
      ))}
    </div>
  );
}

function DirectorTaskQueue() {
  const { me } = useSession();
  const { data, isLoading } = trpc.finance.receiptList.useQuery({ status: 'draft', pageSize: 10 });
  const threshold = me?.config.approvalSecondEyeThreshold ?? 20_000_000;
  const items: TaskItem[] = (data?.items ?? []).slice(0, 10).map((r) => {
    const over = r.netAmount > threshold;
    return {
      title: `Duyệt ${r.code} — ${r.studentName}`,
      meta: `${r.netAmount.toLocaleString('vi-VN')} đ${over ? ' · vượt ngưỡng' : ''}`,
      href: `/finance/${r.id}`,
      tone: over ? 'warning' : 'brand',
    };
  });
  return <TaskQueue items={items} loading={isLoading} />;
}

function SaleTaskQueue() {
  const { data, isLoading } = trpc.crm.opportunityList.useQuery({ stage: 'O4_TESTED', pageSize: 50 }, { refetchOnWindowFocus: false });
  const items: TaskItem[] = (data?.items ?? []).filter((o) => !o.closedAt).slice(0, 10).map((o) => ({
    title: `Ghi danh — ${o.contact.name}`,
    meta: o.contact.phone,
    href: `/finance/new?opportunityId=${o.id}`,
    tone: 'success',
  }));
  return <TaskQueue items={items} loading={isLoading} />;
}

function TeacherTaskQueue() {
  const { data, isLoading } = trpc.submission.listForGrading.useQuery({}, { refetchOnWindowFocus: false });
  const pending = (data?.items ?? []).filter((s) => s.status === 'submitted');
  const items: TaskItem[] = pending.slice(0, 10).map((s) => ({
    title: `Chấm bài — ${s.studentId.slice(0, 8)}`,
    meta: `Bài tập ${s.exerciseId.slice(0, 8)}`,
    href: '/teaching/grading',
    tone: 'warning',
  }));
  return <TaskQueue items={items} loading={isLoading} />;
}

// ---------------------------------------------------------------------------
// Pipeline funnel — real O1→O5 counts (bars = @cmc/ui FunnelBar)
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  O1_LEAD: 'Tiếp cận',
  O2_CONTACTED: 'Đã liên hệ',
  O3_TEST_SCHEDULED: 'Đặt lịch KT',
  O4_TESTED: 'Đã kiểm tra',
  O5_ENROLLED: 'Đã ghi danh',
};

function PipelineFunnel() {
  const { data, isLoading } = trpc.crm.opportunityList.useQuery({ pageSize: 100 }, { refetchOnWindowFocus: false });
  const counts: Record<string, number> = {};
  for (const opp of data?.items ?? []) counts[opp.stage] = (counts[opp.stage] ?? 0) + 1;
  const max = Math.max(1, ...Object.keys(STAGE_LABELS).map((k) => counts[k] ?? 0));
  return (
    <Panel title="Pipeline O1 → O5" icon="filter">
      {isLoading ? <div style={{ padding: '0 22px 20px' }}><Skeleton height={120} radius={1} /></div> : (
        <div className="ck-fn">
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <FunnelBar key={key} label={label} value={counts[key] ?? 0} max={max} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function TodaySchedulePanel() {
  const { data, isLoading } = trpc.classBatch.list.useQuery({ page: 1, pageSize: 20 }, { refetchOnWindowFocus: false });
  const now = new Date();
  const todayBatches = (data?.items ?? []).filter((b) => {
    const start = new Date(b.startDate); const end = new Date(b.endDate);
    return start <= now && now <= end && b.status !== 'cancelled';
  });
  return (
    <Panel title="Lịch dạy hôm nay" icon="calendar">
      {isLoading ? (
        <div style={{ padding: '0 22px 20px' }}><Skeleton height={80} radius={1} /></div>
      ) : todayBatches.length === 0 ? (
        <div className="ck-empty"><span className="ck-empty-icon"><LineIcon name="calendar" size={22} /></span>Không có lớp hôm nay.</div>
      ) : (
        <div>
          {todayBatches.map((b) => (
            <div key={b.id} className="ck-row" style={{ cursor: 'default' }}>
              <span className="ck-dot" style={{ background: 'var(--cmc-success)' }} />
              <span style={{ flex: 1 }} className="ck-row-title">{b.code}</span>
              <span className="ck-row-meta" style={{ color: 'var(--cmc-success)', fontWeight: 600 }}>Đang dạy</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
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

  const isDirector = me?.roles.some((r) => r === 'giam_doc_kinh_doanh' || r === 'giam_doc_dao_tao' || r === 'super_admin');
  const isSale = me?.roles.includes('sale');
  const isTeacher = me?.roles.includes('giao_vien');

  if (sessionLoading) {
    return (
      <div className="ck-wrap">
        <style>{styles}</style>
        <div className="ck-grid ck-metrics">
          {[1, 2, 3].map((i) => <Skeleton key={i} height={116} radius={1} />)}
        </div>
        <Skeleton height={220} radius={1} />
      </div>
    );
  }

  const hasAnyStatCard = canViewReceipts || canGrade || canViewCrm;

  return (
    <div className="ck-wrap">
      <style>{styles}</style>
      <div className="ck-head">
        <h1 className="ck-h1">Tổng quan</h1>
        {me && <p className="ck-sub">Xin chào · {me.roles.join(', ')}</p>}
      </div>

      {hasAnyStatCard && (
        <div className="ck-grid ck-metrics">
          {canViewReceipts && <PendingReceiptsCard />}
          {canViewReceipts && isDirector && <OverThresholdCard />}
          {canViewCrm && isSale && <O4OpportunitiesCard />}
          {canGrade && <UngradedSubmissionsCard />}
        </div>
      )}

      <div className="ck-grid ck-body">
        <Panel title="Việc cần bạn xử lý">
          {isDirector && canViewReceipts && <DirectorTaskQueue />}
          {isSale && canViewCrm && !isDirector && <SaleTaskQueue />}
          {isTeacher && canGrade && !isDirector && !isSale && <TeacherTaskQueue />}
          {!isDirector && !isSale && !isTeacher && (
            <div className="ck-empty">
              <span className="ck-empty-icon"><LineIcon name="check-circle" size={22} /></span>
              Không có nhiệm vụ nào chờ xử lý cho vai trò này.
            </div>
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(isSale || isDirector) && canViewCrm && <PipelineFunnel />}
          {isTeacher && canViewSchedule && <TodaySchedulePanel />}
          {!isSale && !isDirector && !isTeacher && canViewSchedule && <TodaySchedulePanel />}
        </div>
      </div>
    </div>
  );
}
