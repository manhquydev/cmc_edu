import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@cmc/ui';
import { useSession } from '../lib/session-context.js';
import { trpc } from '../lib/trpc.js';
import { LineIcon, type IconName } from '../lib/line-icons.js';

export function countPendingApproval(receipts: { status: string }[]): number {
  return receipts.filter((r) => r.status === 'draft').length;
}

// ---------------------------------------------------------------------------
// Premium design language, v2 (cockpit pilot, 2026-07-10).
// Grounded in the Apple + Notion deconstructions (D:/Downloads/design):
// premium = RESTRAINT + WHITESPACE + TYPOGRAPHY + SURFACE CONTRAST, not
// decoration. White cards on a warm canvas (separation by contrast, not
// borders/shadows), near-black numerals (one interactive colour only),
// monochrome Feather line icons, generous spacing. Tokens: tokens.css.
// Patterns here are page-local; promoted to @cmc/ui in the build-out.
// ---------------------------------------------------------------------------

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
const TONE_FG: Record<Tone, string> = {
  brand: 'var(--cmc-brand)',
  success: 'var(--cmc-success)',
  warning: 'var(--cmc-warning)',
  danger: 'var(--cmc-danger)',
  neutral: 'var(--cmc-text-faint)',
};

// Icons come from the shared monochrome outline set (lib/line-icons) — same
// icon language as the shell nav, no emoji, no colour.

const styles = `
.ck-wrap { background: var(--cmc-canvas); min-height: 100%; padding: 32px 34px; }
.ck-head { margin-bottom: 28px; }
.ck-h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; color: var(--cmc-text); margin: 0; line-height: 1.1; }
.ck-sub { font-size: 14px; color: var(--cmc-text-muted); margin: 5px 0 0; }
.ck-grid { display: grid; gap: 20px; }
.ck-metrics { grid-template-columns: repeat(auto-fit, minmax(236px, 1fr)); margin-bottom: 32px; }
.ck-body { grid-template-columns: 1fr; align-items: start; }
@media (min-width: 1040px) { .ck-body { grid-template-columns: 1.4fr 1fr; } }

/* Metric card — white on warm canvas, separation by SURFACE CONTRAST.
   No border, no resting shadow; a whisper of lift on hover only. */
.ck-mc { display: block; text-decoration: none; color: inherit;
  background: var(--cmc-surface-raised); border-radius: var(--cmc-radius-md);
  padding: 24px 26px; transition: box-shadow var(--cmc-transition); }
.ck-mc:hover { box-shadow: var(--cmc-shadow-sm); }
.ck-mc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.ck-mc-label { display: flex; align-items: center; gap: 7px;
  font-size: var(--cmc-fs-label); font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--cmc-text-muted); }
.ck-mc-icon { color: var(--cmc-text-faint); }
.ck-mc-value { font-size: var(--cmc-fs-metric); font-weight: 600; line-height: 1;
  letter-spacing: -0.03em; color: var(--cmc-text); font-variant-numeric: tabular-nums; }
.ck-mc-ctx { margin-top: 11px; display: flex; align-items: center; gap: 3px;
  font-size: 13px; color: var(--cmc-text-muted); transition: color var(--cmc-transition); }
.ck-mc:hover .ck-mc-ctx { color: var(--cmc-brand); }
.ck-attn { width: 6px; height: 6px; border-radius: 999px; }

/* Panel — flat white, hairline header divider only */
.ck-pnl { background: var(--cmc-surface-raised); border-radius: var(--cmc-radius-md); overflow: hidden; }
.ck-pnl-head { display: flex; align-items: center; justify-content: space-between;
  padding: 16px 22px 14px; }
.ck-pnl-title { font-size: 14px; font-weight: 600; color: var(--cmc-text); letter-spacing: -0.01em; }
.ck-pnl-icon { color: var(--cmc-text-faint); }

/* Rows — spacing + warm hover separate them, minimal hairline */
.ck-row { display: flex; align-items: center; gap: 13px; padding: 13px 22px;
  text-decoration: none; color: inherit; transition: background var(--cmc-transition); }
.ck-row + .ck-row { border-top: 1px solid var(--cmc-border-subtle); }
.ck-row:hover { background: var(--cmc-canvas); }
.ck-dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
.ck-row-title { font-size: 14px; font-weight: 500; color: var(--cmc-text); }
.ck-row-meta { font-size: 12.5px; color: var(--cmc-text-muted); font-variant-numeric: tabular-nums; margin-top: 1px; }
.ck-chev { color: #c7c7cc; flex-shrink: 0; }

/* Funnel — thin pill bars, one solid accent, generous rows */
.ck-fn { padding: 8px 22px 20px; display: flex; flex-direction: column; gap: 16px; }
.ck-fn-row { display: flex; align-items: center; gap: 14px; }
.ck-fn-label { width: 96px; flex-shrink: 0; font-size: 13px; color: var(--cmc-text-2); }
.ck-fn-track { flex: 1; height: 8px; display: block; background: var(--cmc-surface-sunken); border-radius: 999px; overflow: hidden; }
.ck-fn-fill { display: block; height: 100%; background: var(--cmc-brand); border-radius: 999px; transition: width 520ms var(--cmc-ease); }
.ck-fn-count { width: 24px; text-align: right; font-size: 13px; font-weight: 600; color: var(--cmc-text); font-variant-numeric: tabular-nums; }

.ck-empty { padding: 34px 22px; text-align: center; color: var(--cmc-text-muted);
  font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ck-empty-icon { color: var(--cmc-text-faint); }
`;

function MetricCard(props: {
  label: string; value: ReactNode; context: string; icon: IconName;
  href: string; attention?: Tone; loading?: boolean;
}) {
  return (
    <Link to={props.href} className="ck-mc">
      <div className="ck-mc-top">
        <span className="ck-mc-label">
          {props.attention && <span className="ck-attn" style={{ background: TONE_FG[props.attention] }} />}
          {props.label}
        </span>
        <span className="ck-mc-icon"><LineIcon name={props.icon} size={19} /></span>
      </div>
      {props.loading
        ? <Skeleton height={32} width="46%" radius={0} />
        : <div className="ck-mc-value">{props.value}</div>}
      <div className="ck-mc-ctx">{props.context}<LineIcon name="chevron" size={13} /></div>
    </Link>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: IconName; children: ReactNode }) {
  return (
    <div className="ck-pnl">
      <div className="ck-pnl-head">
        <span className="ck-pnl-title">{title}</span>
        {icon && <span className="ck-pnl-icon"><LineIcon name={icon} size={17} /></span>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric cards (data logic unchanged; presentation restrained per references —
// value stays near-black, urgency is a small dot, not a recoloured number)
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
// Task queue — "Việc cần bạn xử lý"
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
        <Link key={i} to={item.href} className="ck-row">
          <span className="ck-dot" style={{ background: TONE_FG[item.tone] }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ck-row-title" style={{ display: 'block' }}>{item.title}</span>
            <span className="ck-row-meta" style={{ display: 'block' }}>{item.meta}</span>
          </span>
          <span className="ck-chev"><LineIcon name="chevron" size={16} /></span>
        </Link>
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
// Pipeline funnel — real O1→O5 counts, thin single-accent pill bars
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
          {Object.entries(STAGE_LABELS).map(([key, label]) => {
            const c = counts[key] ?? 0;
            return (
              <div key={key} className="ck-fn-row">
                <span className="ck-fn-label">{label}</span>
                <span className="ck-fn-track"><span className="ck-fn-fill" style={{ width: c === 0 ? '0%' : `${Math.max(5, (c / max) * 100)}%` }} /></span>
                <span className="ck-fn-count">{c}</span>
              </div>
            );
          })}
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
