/**
 * Design Lab — living visual inventory of CMC EDU design system.
 * Route: /design (auth). Not a product module; review tokens + cohesion.
 *
 * Cohesion pass: demos driven by CSS vars; raised family matches production.
 */
import { useState } from 'react';
import {
  ActivityTimeline,
  Avatar,
  Banner,
  BulkActionBar,
  Button,
  Callout,
  CmcTabs,
  ConfirmDialog,
  CountBadge,
  DataTable,
  DetailPage,
  EmptyState,
  EntityHeader,
  FilterBar,
  HighlightStrip,
  CommandPalette,
  SettingsShell,
  FocusCard,
  FormPage,
  FunnelBar,
  Heading,
  InsightMetric,
  KeyValueList,
  LineIcon,
  ListPage,
  ListPagination,
  MetaItem,
  MetaRow,
  MetricCard,
  PageHeader,
  Panel,
  PasswordInput,
  ProgressBar,
  ProgressSteps,
  ResultPanel,
  SectionBlock,
  SettingsRow,
  SettingsSection,
  ScheduleMonth,
  SessionCard,
  ShortcutChip,
  Skeleton,
  Spinner,
  StageFunnel,
  StatusBadge,
  TaskRow,
  Text,
  TextArea,
  TextField,
  TextInput,
  WeekSchedule,
  WorkInbox,
  useToast,
  type IconName,
  type TableColumn,
  type WeekDayColumn,
} from '@cmc/ui';
import './design-lab.css';
import { LayoutKnowledgePanel } from './design-lab-layout-knowledge.js';
import { RedTeamPanel } from './design-lab-redteam.js';
import { StyleExplorer } from './design-lab-styles.js';
import { UpgradeRoadmapPanel } from './design-lab-upgrade.js';
import { WireframeExplorer } from './design-lab-wireframes.js';
import { XiaSourcesExplorer } from './design-lab-xia.js';

const COLOR_SWATCHES: { name: string; token: string; hex: string }[] = [
  { name: 'Brand', token: '--cmc-brand', hex: '#0071E3' },
  { name: 'Brand hover', token: '--cmc-brand-hover', hex: '#0055C6' },
  { name: 'Brand muted', token: '--cmc-brand-muted', hex: '#E8F1FC' },
  { name: 'Brand ink', token: '--cmc-brand-ink', hex: '#003D99' },
  { name: 'Text', token: '--cmc-text', hex: '#1D1D1F' },
  { name: 'Text 2', token: '--cmc-text-2', hex: '#3C3C43' },
  { name: 'Text muted', token: '--cmc-text-muted', hex: '#6E6E73' },
  { name: 'Text faint', token: '--cmc-text-faint', hex: '#A39E96' },
  { name: 'Canvas', token: '--cmc-canvas', hex: '#F5F3EE' },
  { name: 'Surface raised', token: '--cmc-surface-raised', hex: '#FFFFFF' },
  { name: 'Surface 2', token: '--cmc-surface-2', hex: '#F0EDE7' },
  { name: 'Surface sunken', token: '--cmc-surface-sunken', hex: '#EBE8E2' },
  { name: 'Border', token: '--cmc-border', hex: '#E0DDD5' },
  { name: 'Border subtle', token: '--cmc-border-subtle', hex: '#EFECE6' },
  { name: 'Success soft', token: '--cmc-success-soft', hex: '#E6F2E9' },
  { name: 'Warning soft', token: '--cmc-warning-soft', hex: '#FAF0DF' },
  { name: 'Danger soft', token: '--cmc-danger-soft', hex: '#FCE8E8' },
  { name: 'Success', token: '--cmc-success', hex: '#2E7D32' },
  { name: 'Warning', token: '--cmc-warning', hex: '#B26A00' },
  { name: 'Danger', token: '--cmc-danger', hex: '#C62828' },
];

const ICONS: IconName[] = [
  'grid', 'book', 'users', 'card', 'shield', 'calendar', 'check-circle', 'edit',
  'camera', 'clipboard', 'receipt', 'dollar', 'search', 'user', 'building', 'layers',
  'target', 'alert', 'filter', 'plus', 'logout', 'globe', 'clock', 'trophy', 'gift', 'star',
];

const TOC = [
  { id: 'upgrade', label: '★ Nâng cấp' },
  { id: 'redteam', label: '★ Red team' },
  { id: 'layout-knowledge', label: '★ Layout OS' },
  { id: 'wireframes', label: '★ Wireframes' },
  { id: 'styles', label: '★ Phong cách' },
  { id: 'system', label: 'System' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'xia', label: '★ Xia DS' },
  { id: 'why', label: 'Cohesion' },
  { id: 'color', label: 'Màu' },
  { id: 'type', label: 'Chữ' },
  { id: 'space', label: 'Space · radius' },
  { id: 'hover', label: 'Hover' },
  { id: 'icon', label: 'Icon' },
  { id: 'button', label: 'Button' },
  { id: 'status', label: 'Status' },
  { id: 'form', label: 'Form' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'primitives', label: 'Primitives' },
  { id: 'identity', label: 'Identity' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'schedule', label: 'Lịch dạy' },
  { id: 'cohesion', label: 'Đồng nhất' },
  { id: 'listops', label: 'List ops' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'composite', label: 'Composite' },
  { id: 'detail', label: 'Detail' },
  { id: 'settings', label: 'Settings' },
  { id: 'cmdk', label: '⌘K palette' },
  { id: 'wizard', label: 'Wizard' },
  { id: 'table', label: 'Table' },
  { id: 'frames', label: 'Page frames' },
  { id: 'auth', label: 'Auth' },
  { id: 'live', label: 'Live' },
  { id: 'sources', label: 'Nguồn DS' },
  { id: 'next', label: 'Hướng đi' },
];

/** ERP completeness matrix — audit 2026-08-02 + research synthesis. */
const INVENTORY: { area: string; items: string; status: 'ok' | 'partial' | 'miss'; note: string }[] = [
  { area: 'Tokens / type / color', items: 'tokens.css · Inter · brand blue', status: 'ok', note: 'Soft-ops complete' },
  { area: 'Shell', items: 'AppFrame · SideNav · topbar', status: 'ok', note: 'Live in app chrome' },
  { area: 'Page frames', items: 'Dashboard · List · Detail · Form', status: 'ok', note: 'PAGE-FRAMES.md' },
  { area: 'Metrics', items: 'MetricCard · InsightMetric · FocusCard', status: 'ok', note: '3 KPI dialects' },
  { area: 'Pipeline', items: 'FunnelBar · StageFunnel stack/rail/split', status: 'ok', note: 'Upgraded 2026' },
  { area: 'Work queue', items: 'WorkInbox · TaskRow · Panel', status: 'ok', note: 'Cockpit primary' },
  { area: 'List ops', items: 'ControlBar · FilterBar · DataTable · pagination · bulk', status: 'ok', note: 'ControlBar sticky · FilterBar on receipts·schedule·rewards·students·aftersale·post-sale-meeting (2026-08-04)' },
  { area: 'Detail', items: 'DetailPage · EntityHeader · HighlightStrip · Tabs', status: 'partial', note: 'Tiers: full(receipt·opp) · standard(student·class) · settings×3 · thin(payroll·my-hr) — PAGE-FRAMES §C 2026-08-04' },
  { area: 'Form / wizard', items: 'FormPage · SectionBlock · ProgressSteps · Result', status: 'ok', note: 'P1 pack added' },
  { area: 'Settings', items: 'SettingsSection · SettingsRow', status: 'ok', note: 'P1 pack added' },
  { area: 'Feedback', items: 'Toast · Banner · Callout · Confirm · Empty', status: 'ok', note: 'Callout = soft tip' },
  { area: 'Identity', items: 'Avatar · EntityHeader · MetaRow · CountBadge', status: 'ok', note: 'Xia port pack' },
  { area: 'Activity', items: 'ActivityTimeline', status: 'ok', note: 'CRM / aftersale trail' },
  { area: 'Lịch dạy', items: 'WeekSchedule · SessionCard · ScheduleMonth', status: 'ok', note: 'Edu calendar pack' },
  { area: 'Auth inputs', items: 'TextField · PasswordInput', status: 'ok', note: 'LMS login path' },
  { area: 'Status chips', items: 'StatusBadge soft (default) · solid opt', status: 'ok', note: 'Polaris dense tables' },
  { area: 'Table selection/sort', items: 'row select · column sort', status: 'partial', note: 'Component ok · depth/sort limits' },
  { area: 'Filter date / multi', items: 'date type · multi-select', status: 'partial', note: 'date type exists · multi + range thin' },
  { area: 'Bulk rollout', items: 'BulkActionBar on lists', status: 'partial', note: '≥8 lists have selection; mostly clipboard copy — gifts multi-hide is only domain bulk (honest 2026-08-04)' },
  { area: 'SettingsShell adoption', items: 'rail settings screens', status: 'ok', note: 'shift-config · network-ip · salary-tiers (2026-08-04)' },
  { area: 'Charts / BI', items: 'time series · pie', status: 'miss', note: 'YAGNI — not ERP core' },
  { area: 'Command palette', items: '⌘K global search', status: 'ok', note: 'Shell wired 2026-08 (was stale miss)' },
  { area: 'Dark mode / mobile admin', items: 'theme · responsive shell', status: 'miss', note: 'Desktop-first ops' },
];

interface DemoRow extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
  amount: string;
}

const DEMO_ROWS: DemoRow[] = [
  { id: '1', name: 'Nguyễn A', status: 'draft', amount: '4.500.000' },
  { id: '2', name: 'Trần B', status: 'approved', amount: '6.200.000' },
  { id: '3', name: 'Lê C', status: 'pending', amount: '3.100.000' },
];

const TABLE_COLS: TableColumn<DemoRow>[] = [
  { key: 'name', label: 'Học viên', render: (_v, r) => r.name },
  {
    key: 'status',
    label: 'Trạng thái',
    render: (_v, r) => <StatusBadge status={r.status} />,
  },
  { key: 'amount', label: 'Số tiền', render: (_v, r) => r.amount },
];

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dl-section" id={id}>
      <div className="dl-section-head">
        <h2>{title}</h2>
        {lead ? <p>{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function DesignLabPage() {
  const { success, error, info } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoNote, setDemoNote] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedCount, setSelectedCount] = useState(2);
  const [stepIdx, setStepIdx] = useState(1);
  const [tab, setTab] = useState('info');
  const [notifOn, setNotifOn] = useState(true);
  const [settingsNav, setSettingsNav] = useState('groups');
  const [cmdDemoOpen, setCmdDemoOpen] = useState(false);

  return (
    <div className="dl-root">
      <header className="dl-hero">
        <p className="dl-hero-kicker">CMC EDU · Design system · living lab</p>
        <h1>Design Lab</h1>
        <p className="dl-hero-lead">
          <strong>★ Nâng cấp</strong> (brainstorm→research→advise) → Red team → Layout OS →
          Wireframes → Phong cách (explore only). Production Soft Ops + 4 frames. Phần dưới =
          inventory + <code>@cmc/ui</code>.
        </p>
      </header>

      <nav className="dl-toc" aria-label="Mục lục Design Lab">
        {TOC.map((t) => (
          <a key={t.id} href={`#${t.id}`}>
            {t.label}
          </a>
        ))}
      </nav>

      <div className="dl-body">
        <Section
          id="upgrade"
          title="Nâng cấp UI — thông minh · đồng bộ (Option B)"
          lead="Pipeline ak-brainstorm + ak-research + ak-advise 2026-08-04. Không re-skin: enforce frames + bulk/queue depth. Reports: plans/260804-ui-smart-cohesion-upgrade/."
        >
          <UpgradeRoadmapPanel />
        </Section>

        <Section
          id="redteam"
          title="Red team — đánh giá design system trên lab"
          lead="Adversarial review 2026-08-04: inventory honesty, explore vs authority, mock fidelity, enforcement, bloat. Verdict + findings + remediation."
        >
          <RedTeamPanel />
        </Section>

        <Section
          id="layout-knowledge"
          title="Layout OS — tổng hợp 5 agent research"
          lead="ERP shell · Cockpit · Frames · Density/grid · Education. 21 laws + checklist màn mới. Report: plans/260804-layout-multi-agent-research/reports/."
        >
          <LayoutKnowledgePanel />
        </Section>

        <Section
          id="wireframes"
          title="Wireframes — khung thiết kế trang"
          lead="Low-fi structure theo PAGE-FRAMES / VIEW-GRAMMAR: shell, dashboard, list, detail, form, settings, calendar, pipeline, cockpit role. Nhãn slot + rules + ASCII — xem thử trước khi skin."
        >
          <WireframeExplorer />
        </Section>

        <Section
          id="styles"
          title="Phong cách design — gallery thử nghiệm"
          lead="EXPLORATION ONLY — không phải production SoT. Soft Ops vẫn LOCKED trong tokens/MASTER cho đến khi pilot List+Detail+Dashboard thật. Mock CSS ≠ @cmc/ui composites."
        >
          <div className="dl-callout" style={{ marginBottom: 12 }}>
            <strong>Red team R2/R3:</strong> Chọn skin ở đây <em>không</em> đổi app. Production ={' '}
            <code>tokens.css</code> + 4 page frames. Mọi retoken cần pilot 3 màn thật.
          </div>
          <StyleExplorer />
        </Section>

        <Section
          id="system"
          title="System structure — một họ thành phần toàn dự án"
          lead="Structural tokens + raised recipe + keyline/row/chip/CTA đồng bộ. Tránh magic px từng màn → lệch lạc UI."
        >
          <div className="dl-callout" style={{ marginBottom: 12 }}>
            <strong>Công thức raised:</strong> surface-raised · border-subtle · shadow-sm · radius-md ·
            keyline-x 20. Dùng cho Metric · Panel · Table · Week · Settings · Insight · Focus.
            Docs: <code>design-system/cmc-edu/STRUCTURE.md</code>
          </div>
          <div className="dl-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div className="ck-surface" style={{ padding: 16 }}>
              <div className="ck-label-upper">Raised default</div>
              <div className="ck-title-1line" style={{ marginTop: 8 }}>
                Panel / Metric / Table
              </div>
              <div className="ck-meta-1line" style={{ marginTop: 4 }}>
                --cmc-raised-* · keyline-x
              </div>
            </div>
            <div className="ck-surface ck-surface--quiet" style={{ padding: 16 }}>
              <div className="ck-label-upper">Quiet sticky</div>
              <div className="ck-title-1line" style={{ marginTop: 8 }}>
                PageHeader
              </div>
              <div className="ck-meta-1line" style={{ marginTop: 4 }}>
                shadow-xs · head-h 48
              </div>
            </div>
            <div className="ck-surface ck-surface--float" style={{ padding: 16 }}>
              <div className="ck-label-upper">Float</div>
              <div className="ck-title-1line" style={{ marginTop: 8 }}>
                Toast · Dialog
              </div>
              <div className="ck-meta-1line" style={{ marginTop: 4 }}>
                radius-lg · shadow-md/lg
              </div>
            </div>
          </div>
          <div className="dl-card" style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
            <table className="ck-inv">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Token</th>
                  <th>Quy tắc</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Keyline X', '--cmc-keyline-x', 'Mọi head/row/footer cùng inset 20px'],
                  ['Row height', '--cmc-row-h 48', 'TaskRow · table body · filter strip'],
                  ['Head strip', '--cmc-head-h 48', 'Panel head · table thead'],
                  ['Title 1-line', '--cmc-line-title', 'Ellipsis · title attr full text'],
                  ['Meta 1-line', '--cmc-line-meta', 'Không wrap làm lệch sibling'],
                  ['Chip / CTA', 'chip-h-sm · cta-h', 'Badge 18 · pill CTA 34'],
                  ['Rail accent', '--cmc-rail-w 3', 'SessionCard · FocusCard only'],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td>
                      <strong>{r[0]}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: 11 }}>{r[1]}</code>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--cmc-text-2)' }}>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dl-stack-gap" style={{ marginTop: 12 }}>
            <Panel title="Đồng bộ Panel + TaskRow">
              <TaskRow
                title="Phiếu PT-1042 — tên rất dài để test ellipsis một dòng title"
                meta="4.500.000 · nháp · cập nhật vừa xong"
                href="/finance"
                tone="danger"
                tag="Duyệt"
              />
              <TaskRow title="Lead ngắn" meta="O4" href="/crm" tone="success" tag="O4" />
            </Panel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <MetricCard
                label="Metric ngắn"
                value={4}
                context="Cùng min-height 128"
                icon="receipt"
                href="/finance"
                attention="danger"
              />
              <MetricCard
                label="Metric nhãn dài hơn một chút"
                value={128}
                context="Vẫn một họ raised"
                icon="target"
                href="/crm"
              />
            </div>
          </div>
        </Section>

        <Section
          id="inventory"
          title="Inventory — ERP design system completeness"
          lead="Audit toàn diện: đã đủ lõi ops chưa? Ma trận dưới là checklist sản phẩm admin giáo dục (không Storybook)."
        >
          <div className="dl-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="ck-inv">
              <thead>
                <tr>
                  <th>Khu vực</th>
                  <th>Thành phần</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {INVENTORY.map((row) => (
                  <tr key={row.area}>
                    <td>
                      <strong>{row.area}</strong>
                    </td>
                    <td style={{ color: 'var(--cmc-text-2)', fontSize: 12.5 }}>{row.items}</td>
                    <td>
                      <span
                        className={
                          row.status === 'ok'
                            ? 'ck-inv-ok'
                            : row.status === 'partial'
                              ? 'ck-inv-partial'
                              : 'ck-inv-miss'
                        }
                      >
                        {row.status === 'ok' ? '● Có' : row.status === 'partial' ? '◐ Một phần' : '○ Thiếu'}
                      </span>
                    </td>
                    <td>
                      <span className="ck-inv-tag">{row.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dl-callout" style={{ marginTop: 12 }}>
            <strong>Kết luận audit:</strong> lõi soft-ops + frames + feedback + xia pack (avatar, callout,
            meta, timeline, soft status) đã đủ nhìn toàn diện cho ERP admin. Còn partial: sort/select
            table, filter date. Miss có chủ đích: BI charts, ⌘K.
          </div>
        </Section>

        <Section
          id="xia"
          title="Xia — học design system thật (research → live mockup)"
          lead="Recon: Carbon · Ant · Atlassian · Primer · Polaris · Cal · Airbnb · shadcn. Live preview so sánh Soft Ops. Adapt patterns — không transplant stack."
        >
          <XiaSourcesExplorer />
        </Section>

        <Section
          id="why"
          title="Cohesion pass (research → promote)"
          lead="ak-brainstorm + multi-agent research (ERP systems · token rhythm · composite rules) → token/premium deltas. Không đổi brand / Inter / stack."
        >
          <ul className="dl-diag">
            <li>
              <strong>Nested harmony:</strong> control 12 ≤ card 16 ≤ dialog 20 — mọi shell dùng
              cùng scale.
            </li>
            <li>
              <strong>Warm neutrals:</strong> surface-2 / text-faint / border không còn cool gray
              #f5f5f7 / #aeaeb2 trên canvas kem.
            </li>
            <li>
              <strong>Elevation roles:</strong> xs sticky · sm raised rest · md hover/float · lg
              modal/toast.
            </li>
            <li>
              <strong>One hover verb:</strong> row = sunken · metric = shadow · field = border ·
              action = underline.
            </li>
            <li>
              <strong>Giữ:</strong> #0071E3 · Inter · ops density · một primary CTA · status không
              recolor số.
            </li>
          </ul>
        </Section>

        <Section id="color" title="Bảng màu (tokens)" lead="Nguồn: packages/ui/src/tokens.css — một interactive blue + soft status pairs.">
          <div className="dl-grid dl-grid-swatch">
            {COLOR_SWATCHES.map((s) => (
              <div key={s.token} className="dl-swatch">
                <div className="dl-swatch-chip" style={{ background: `var(${s.token})` }} />
                <div className="dl-swatch-meta">
                  <strong>{s.name}</strong>
                  <span>{s.token}</span>
                  <span>{s.hex}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="type"
          title="Typography — Inter"
          lead="Roles: label 11 · meta 12 · data 13 · body 14 · title 16 · page 24 · metric 32. lh body 1.55."
        >
          <div className="dl-card">
            <div className="dl-type-row">
              <div className="dl-type-meta">Metric · 32 · 600</div>
              <div style={{ fontSize: 'var(--cmc-fs-metric)', fontWeight: 600, letterSpacing: '-0.03em' }}>
                12.480.000
              </div>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">Page · 24</div>
              <div style={{ fontSize: 'var(--cmc-fs-page)', fontWeight: 600, letterSpacing: '-0.03em' }}>
                Tổng quan vận hành
              </div>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">H3 · 18 · 600</div>
              <Heading level={4} color="primary">
                Việc cần bạn xử lý
              </Heading>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">Title · 16</div>
              <div style={{ fontSize: 'var(--cmc-fs-title)', fontWeight: 600 }}>Phiếu thu nháp</div>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">Body · 14 · lh 1.55</div>
              <Text type="body" size="sm">
                Phiếu thu nháp cần duyệt sẽ xuất hiện tại đây. Học viên được kích hoạt LMS sau khi
                duyệt.
              </Text>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">Meta · 12</div>
              <div style={{ fontSize: 'var(--cmc-fs-meta)', color: 'var(--cmc-text-muted)' }}>
                Xin chào · Giáo viên — formatRoles, không raw role key.
              </div>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">Label · 11 · uppercase</div>
              <div
                style={{
                  fontSize: 'var(--cmc-fs-label)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--cmc-text-muted)',
                }}
              >
                Phiếu thu chờ duyệt
              </div>
            </div>
            <div className="dl-type-row">
              <div className="dl-type-meta">Data · 13 tabular</div>
              <div style={{ fontSize: 'var(--cmc-font-size-data)', fontVariantNumeric: 'tabular-nums' }}>
                0930 773 703 · O4_TESTED · 1.250.000
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="space"
          title="Spacing · radius · shadow"
          lead="Scale 4/8/16/24 · pad-card 24 · gap-section 24 · radius control 12 / card 16 / dialog 20 · elevation roles."
        >
          <div className="dl-card">
            <Text type="supporting" size="sm">
              Spacing (token)
            </Text>
            <div className="dl-scale-row" style={{ marginTop: 12 }}>
              {[
                ['1', 4],
                ['2', 8],
                ['3', 16],
                ['4', 24],
                ['pad-card', 24],
                ['pad-x', 20],
                ['gap-section', 24],
              ].map(([k, px]) => (
                <div key={String(k)} className="dl-space-box">
                  <i style={{ width: Number(px) + 24, height: Number(px) }} />
                  <span>
                    {k} · {px}px
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="dl-card">
            <Text type="supporting" size="sm">
              Radius ladder (nested harmony)
            </Text>
            <div className="dl-radius-demo" style={{ marginTop: 12 }}>
              {[
                { name: 'control', r: 'var(--cmc-radius-control)', px: '12' },
                { name: 'card / md', r: 'var(--cmc-radius-md)', px: '16' },
                { name: 'dialog / lg', r: 'var(--cmc-radius-lg)', px: '20' },
                { name: 'pill', r: 'var(--cmc-radius-pill)', px: '∞' },
              ].map((item) => (
                <div key={item.name} className="dl-radius-item" style={{ borderRadius: item.r }}>
                  {item.name}
                  <span>{item.px}px</span>
                </div>
              ))}
            </div>
            <div className="dl-ladder" style={{ marginTop: 18 }}>
              <div className="dl-ladder-step">
                <div
                  className="dl-ladder-box"
                  style={{ width: 56, height: 40, borderRadius: 'var(--cmc-radius-control)' }}
                >
                  in
                </div>
                Control field
              </div>
              <div className="dl-ladder-step">
                <div
                  className="dl-ladder-box"
                  style={{
                    width: 88,
                    height: 64,
                    borderRadius: 'var(--cmc-radius-md)',
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 'var(--cmc-radius-control)',
                      background: 'var(--cmc-surface-sunken)',
                      border: '1px solid var(--cmc-border)',
                    }}
                  />
                </div>
                Card ≥ control
              </div>
              <div className="dl-ladder-step">
                <div
                  className="dl-ladder-box"
                  style={{
                    width: 110,
                    height: 80,
                    borderRadius: 'var(--cmc-radius-lg)',
                    boxShadow: 'var(--cmc-shadow-lg)',
                  }}
                >
                  dialog
                </div>
                Float ≥ card
              </div>
            </div>
          </div>
          <div className="dl-card">
            <Text type="supporting" size="sm">
              Shadow roles
            </Text>
            <div className="dl-scale-row" style={{ marginTop: 12, padding: 12, background: 'var(--cmc-canvas)', borderRadius: 12 }}>
              <div className="dl-shadow-item" style={{ boxShadow: 'none' }}>
                none
              </div>
              <div className="dl-shadow-item" style={{ boxShadow: 'var(--cmc-shadow-xs)' }}>
                xs sticky
              </div>
              <div className="dl-shadow-item" style={{ boxShadow: 'var(--cmc-shadow-sm)' }}>
                sm rest
              </div>
              <div className="dl-shadow-item" style={{ boxShadow: 'var(--cmc-shadow-md)' }}>
                md hover
              </div>
              <div className="dl-shadow-item" style={{ boxShadow: 'var(--cmc-shadow-lg)' }}>
                lg modal
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="hover"
          title="Hover language (một động từ / loại)"
          lead="Tránh hover zoo — mỗi surface một feedback, không bóng trên row."
        >
          <div className="dl-hover-grid">
            <div className="dl-hover-cell dl-hover-cell--row">
              <strong>Row / TaskRow</strong>
              <p>Hover → surface-sunken. Không shadow.</p>
            </div>
            <div className="dl-hover-cell dl-hover-cell--metric">
              <strong>Metric card</strong>
              <p>Hover → shadow-md + border accent-soft.</p>
            </div>
            <div className="dl-hover-cell dl-hover-cell--field">
              <strong>Field</strong>
              <p>Hover → border lift; focus → brand + halo.</p>
            </div>
            <div className="dl-hover-cell">
              <strong>Action link</strong>
              <p style={{ color: 'var(--cmc-brand)' }}>Hover → underline (panel action).</p>
            </div>
          </div>
        </Section>

        <Section id="icon" title="LineIcon" lead="Outline monochrome, currentColor — một ngôn ngữ icon toàn app.">
          <div className="dl-icon-grid">
            {ICONS.map((name) => (
              <div key={name} className="dl-icon-cell">
                <LineIcon name={name} size={20} />
                {name}
              </div>
            ))}
          </div>
        </Section>

        <Section id="button" title="Buttons & CTA shell" lead="Astryx Button radius-control 12 + shell .sh-cta hierarchy (pill primary only).">
          <div className="dl-card dl-stack-gap">
            <div className="dl-row-gap">
              <Button label="Primary" variant="primary" size="sm" />
              <Button label="Secondary" variant="secondary" size="sm" />
              <Button label="Destructive" variant="destructive" size="sm" />
              <Button label="Loading" variant="primary" size="sm" isLoading />
              <Button label="Disabled" variant="primary" size="sm" isDisabled />
            </div>
            <div className="dl-row-gap">
              <button type="button" className="sh-cta">
                <LineIcon name="plus" size={15} strokeWidth={2.25} /> Ghi danh
              </button>
              <button type="button" className="sh-cta sh-cta--secondary">
                Secondary shell
              </button>
              <button type="button" className="sh-cta sh-cta--ghost">
                <LineIcon name="logout" size={15} strokeWidth={2.25} /> Đăng xuất ghost
              </button>
            </div>
            <div className="dl-row-gap">
              <Button
                label="Toast success"
                variant="secondary"
                size="sm"
                onClick={() => success('Đã lưu — mẫu toast')}
              />
              <Button
                label="Toast error"
                variant="secondary"
                size="sm"
                onClick={() => error('Không lưu được — mẫu lỗi')}
              />
              <Button
                label="Toggle confirm demo"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmOpen((v) => !v)}
              />
              <span style={{ fontSize: 12, color: 'var(--cmc-text-muted)' }}>
                confirmOpen={String(confirmOpen)}
              </span>
            </div>
          </div>
        </Section>

        <Section
          id="status"
          title="Status · Callout · Banner"
          lead="StatusBadge soft = default (Polaris dense). Solid Astryx khi cần nhấn mạnh. Callout nhẹ hơn Banner."
        >
          <div className="dl-card dl-stack-gap">
            <Text type="supporting" size="sm">
              Soft (default)
            </Text>
            <div className="dl-row-gap">
              <StatusBadge status="draft" label="Nháp" />
              <StatusBadge status="pending" label="Chờ duyệt" />
              <StatusBadge status="approved" label="Đã duyệt" />
              <StatusBadge status="rejected" label="Từ chối" />
              <StatusBadge status="active" label="Active" />
              <StatusBadge status="warning" label="Cảnh báo" />
            </div>
            <Text type="supporting" size="sm">
              Solid (appearance=&quot;solid&quot;)
            </Text>
            <div className="dl-row-gap">
              <StatusBadge status="draft" label="Nháp" appearance="solid" />
              <StatusBadge status="pending" label="Chờ" appearance="solid" />
              <StatusBadge status="approved" label="Duyệt" appearance="solid" />
              <StatusBadge status="rejected" label="Từ chối" appearance="solid" />
            </div>
            <Callout tone="info" title="Callout info (Shopify Highlight)">
              Tip vận hành nhẹ — không thay toast commit, không thay Banner cảnh báo durable.
            </Callout>
            <Callout tone="warning" title="Callout warning">
              Cần second-eye trước khi duyệt phiếu vượt ngưỡng.
            </Callout>
            <Banner status="info" title="Banner" description="Banner Astryx — durable, có hierarchy icon mạnh hơn Callout." />
            <Banner status="error" title="Lỗi" description="Kèm recovery: thử lại / liên hệ." />
          </div>
        </Section>

        <Section
          id="form"
          title="Form controls"
          lead="TextInput: radius-control 12px, nền sunken, border ấm, focus --cmc-focus-halo."
        >
          <div className="dl-card" style={{ maxWidth: 420 }}>
            <div className="dl-stack-gap">
              <TextInput
                label="Email"
                placeholder="name@cmcvn.edu.vn"
                value={demoEmail}
                onChange={(v) => setDemoEmail(String(v ?? ''))}
              />
              <TextInput
                label="Ghi chú"
                placeholder="Tuỳ chọn"
                value={demoNote}
                onChange={(v) => setDemoNote(String(v ?? ''))}
              />
              <Text type="supporting" size="sm">
                Hover: border lift. Focus: viền brand + halo brand-muted (token).
              </Text>
            </div>
          </div>
        </Section>

        <Section
          id="cohesion"
          title="Tính đồng nhất khi ghép"
          lead="Cùng family radius + border + surface khi dùng chung trên một màn."
        >
          <div className="dl-card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, lineHeight: 1.45 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--cmc-text-muted)', fontSize: 11, letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px' }}>Nhóm</th>
                  <th style={{ padding: '8px 10px' }}>Thành phần</th>
                  <th style={{ padding: '8px 10px' }}>Radius / surface</th>
                  <th style={{ padding: '8px 10px' }}>Đồng nhất?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Control', 'TextInput, Button, nav item', '12 · sunken field · warm border', 'OK'],
                  ['Raised', 'Metric, Panel, Inbox, PageHeader, table shell', '16 · white + hairline + sm/xs', 'OK'],
                  ['Chrome', 'FilterBar, surface-2', '16 · warm surface-2 · no rest shadow', 'OK'],
                  ['Shell CTA', '.sh-cta primary', 'pill', 'OK — 1 primary'],
                  ['Float', 'Toast, ConfirmDialog', '20 · shadow-lg', 'OK'],
                  ['Lab card', '.dl-card inventory', '16 · same as raised', 'OK — lab = product'],
                ].map((row) => (
                  <tr key={row[0]} style={{ borderTop: '1px solid var(--cmc-border-subtle)' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{row[0]}</td>
                    <td style={{ padding: '10px', color: 'var(--cmc-text-2)' }}>{row[1]}</td>
                    <td style={{ padding: '10px', color: 'var(--cmc-text-muted)', fontSize: 12 }}>{row[2]}</td>
                    <td style={{ padding: '10px' }}>{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dl-callout" style={{ marginTop: 12 }}>
            <strong>Quy tắc:</strong> control ≤ card ≤ dialog · hairline ấm · status = badge/dot ·
            một brand blue · table flush trong shell (không double chrome).
          </div>
          <div className="dl-card dl-card--canvas" style={{ marginTop: 12 }}>
            <div className="dl-stack-gap">
              <PageHeader
                title="Mẫu ghép: header + form + panel"
                subtitle="Cùng raised language — không lẫn toolkit."
                actions={<Button label="Lưu" variant="primary" size="sm" />}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <TextInput
                  label="Tên"
                  placeholder="Nguyễn Văn A"
                  value={demoNote}
                  onChange={(v) => setDemoNote(String(v ?? ''))}
                />
                <TextInput
                  label="SĐT"
                  placeholder="09…"
                  value={demoEmail}
                  onChange={(v) => setDemoEmail(String(v ?? ''))}
                />
              </div>
              <Panel title="Kết quả gần đây">
                <TaskRow title="PT-1042 đã tạo" meta="Nháp · vừa xong" href="/finance" tone="warning" tag="Draft" />
                <TaskRow title="Lead O4" meta="Chờ ghi danh" href="/crm" tone="success" tag="O4" />
              </Panel>
            </div>
          </div>
        </Section>

        <Section
          id="listops"
          title="List ops composite (chứng minh gắn kết)"
          lead="ControlBar sticky (PageHeader + FilterBar + ListPagination) · ListPage density=ops."
        >
          <div className="dl-compose-list">
            <ListPage
              density="ops"
              controlFooter={
                <ListPagination page={1} pageSize={10} total={42} onPageChange={() => undefined} />
              }
              header={
                <PageHeader
                  title="Phiếu thu (demo)"
                  subtitle="ControlBar · Filter chrome surface-2 · table raised shell"
                  actions={<Button label="Tạo phiếu" variant="primary" size="sm" />}
                />
              }
              filters={
                <FilterBar
                  filters={[
                    { key: 'q', label: 'Tìm', type: 'text', placeholder: 'Mã / tên' },
                    {
                      key: 'status',
                      label: 'Trạng thái',
                      type: 'select',
                      options: [
                        { value: 'draft', label: 'Nháp' },
                        { value: 'approved', label: 'Đã duyệt' },
                      ],
                    },
                  ]}
                  value={{ q: '', status: '' }}
                  onChange={() => undefined}
                />
              }
            >
              <div className="ck-table-shell">
                <DataTable<DemoRow> columns={TABLE_COLS} data={DEMO_ROWS} empty="Không có dòng" />
              </div>
            </ListPage>
          </div>
        </Section>

        <Section
          id="funnel"
          title="FunnelBar + StageFunnel (nâng cấp)"
          lead="Không còn thanh xám mỏng 2018. Step chip · gradient fill · share % · 3 layout stack / rail / split."
        >
          <div className="dl-stack-gap">
            <div className="dl-card">
              <Text type="supporting" size="sm">
                FunnelBar atom — step · hint · share · emphasize
              </Text>
              <div className="ck-fn" style={{ marginTop: 8 }}>
                <FunnelBar
                  label="Đã kiểm tra"
                  value={3}
                  max={8}
                  step="O4"
                  showShare
                  emphasize
                  showChevron
                  hint="cần ghi danh"
                />
                <FunnelBar label="Đã liên hệ" value={2} max={8} step="O2" showShare />
                <FunnelBar label="Tiếp cận" value={0} max={8} step="O1" muted />
                <FunnelBar label="Compact sm" value={5} max={8} step={3} showShare size="sm" />
              </div>
            </div>

            <div className="dl-callout">
              <strong>StageFunnel layouts:</strong> <code>stack</code> (mặc định cockpit) ·{' '}
              <code>rail</code> (pipeline ngang) · <code>split</code> (conversion strip). Cùng data.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <StageFunnel
                title="Stack — bars hiện đại"
                layout="stack"
                viewAllHref="/crm"
                stages={[
                  { key: 'O1', label: 'Tiếp cận', value: 0, href: '/crm?stage=O1' },
                  { key: 'O2', label: 'Đã liên hệ', value: 2, href: '/crm?stage=O2' },
                  { key: 'O3', label: 'Đặt lịch KT', value: 1, href: '/crm?stage=O3' },
                  {
                    key: 'O4',
                    label: 'Đã kiểm tra',
                    value: 3,
                    href: '/crm?stage=O4_TESTED',
                    emphasize: true,
                    hint: 'ưu tiên',
                  },
                  { key: 'O5', label: 'Đã ghi danh', value: 5, href: '/crm?stage=O5_ENROLLED' },
                ]}
                footer={{ label: 'Sẵn sàng ghi danh', href: '/crm?stage=O4_TESTED', count: 3 }}
              />
              <StageFunnel
                title="Split — conversion strip"
                layout="split"
                viewAllHref="/crm"
                stages={[
                  { key: 'O1', label: 'Tiếp cận', value: 1, href: '/crm?stage=O1' },
                  { key: 'O2', label: 'Đã liên hệ', value: 2, href: '/crm?stage=O2' },
                  { key: 'O3', label: 'Đặt lịch', value: 1, href: '/crm?stage=O3' },
                  {
                    key: 'O4',
                    label: 'Đã kiểm tra',
                    value: 3,
                    href: '/crm?stage=O4_TESTED',
                    emphasize: true,
                  },
                  { key: 'O5', label: 'Ghi danh', value: 5, href: '/crm?stage=O5_ENROLLED' },
                ]}
              />
            </div>

            <StageFunnel
              title="Rail — pipeline ngang (CRM 2024+)"
              layout="rail"
              viewAllHref="/crm"
              viewAllLabel="Mở CRM"
              stages={[
                { key: 'O1', label: 'Tiếp cận', value: 0, href: '/crm?stage=O1' },
                { key: 'O2', label: 'Đã liên hệ', value: 2, href: '/crm?stage=O2' },
                { key: 'O3', label: 'Đặt lịch KT', value: 1, href: '/crm?stage=O3' },
                {
                  key: 'O4',
                  label: 'Đã kiểm tra',
                  value: 3,
                  href: '/crm?stage=O4_TESTED',
                  emphasize: true,
                },
                { key: 'O5', label: 'Đã ghi danh', value: 5, href: '/crm?stage=O5_ENROLLED' },
              ]}
              footer={{ label: 'Sẵn sàng ghi danh', href: '/crm?stage=O4_TESTED', count: 3 }}
            />
          </div>
        </Section>

        <Section
          id="composite"
          title="Composites @cmc/ui — đa dạng hiện đại"
          lead="Mix KPI cổ điển + InsightMetric (spark/delta) + FocusCard (next action) + inbox/panel — không một kiểu thẻ lặp lại."
        >
          <div className="dl-stack-gap">
            <div className="dl-row-gap">
              <ShortcutChip label="CRM" href="/crm" icon="target" badge={3} />
              <ShortcutChip label="Phiếu thu" href="/finance" icon="receipt" />
              <ShortcutChip label="Điểm danh" href="/teaching/attendance" icon="check-circle" />
            </div>

            <FocusCard
              kicker="Việc ưu tiên hôm nay"
              title="Duyệt 4 phiếu thu nháp — 18,2 triệu"
              description="Phiếu quá 24h cần second-eye trước khi kích hoạt LMS."
              href="/finance?status=draft"
              cta="Mở hàng đợi duyệt"
              meta="Cập nhật · vừa xong"
              tone="danger"
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <InsightMetric
                label="Lead 7 ngày"
                value={12}
                delta="+18%"
                deltaTone="up"
                spark={[0.25, 0.35, 0.3, 0.55, 0.7, 0.85, 1]}
                href="/crm"
                icon="target"
                context="So với tuần trước"
              />
              <InsightMetric
                label="Tỷ lệ O4→O5"
                value="42%"
                delta="−4pp"
                deltaTone="down"
                spark={[0.9, 0.75, 0.7, 0.55, 0.5, 0.45, 0.42]}
                href="/crm?stage=O4_TESTED"
                icon="layers"
                context="Cần follow-up"
              />
              <MetricCard
                label="Phiếu chờ duyệt"
                value={4}
                href="/finance?status=draft"
                icon="receipt"
                attention="danger"
                context="Cần xử lý"
              />
              <MetricCard
                label="Sẵn sàng ghi danh"
                value={1}
                href="/crm?stage=O4_TESTED"
                icon="target"
                context="Cơ hội O4"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12 }}>
              <WorkInbox
                title="Việc cần bạn xử lý"
                count={2}
                viewAllHref="/finance"
                items={[
                  {
                    title: 'Duyệt phiếu PT-1042',
                    meta: '4.500.000 · nháp',
                    href: '/finance',
                    tone: 'danger',
                    tag: 'Duyệt',
                  },
                  {
                    title: 'Ghi danh — Lead Timeline',
                    meta: '0930773703',
                    href: '/crm',
                    tone: 'success',
                    tag: 'O4',
                  },
                ]}
                emptyTitle="Không có việc"
                emptyDescription="Hàng đợi trống."
              />
              <StageFunnel
                title="Pipeline (rail)"
                layout="rail"
                viewAllHref="/crm"
                viewAllLabel="Mở CRM"
                stages={[
                  { key: 'O2', label: 'Liên hệ', value: 2, href: '/crm?stage=O2' },
                  { key: 'O3', label: 'Lịch KT', value: 1, href: '/crm?stage=O3' },
                  {
                    key: 'O4',
                    label: 'Đã KT',
                    value: 3,
                    href: '/crm?stage=O4_TESTED',
                    emphasize: true,
                  },
                  { key: 'O5', label: 'Ghi danh', value: 5, href: '/crm?stage=O5_ENROLLED' },
                ]}
              />
            </div>

            <Panel
              title="Panel + TaskRow"
              action={
                <a className="ck-pnl-action" href="/teaching/schedule">
                  Xem lịch ›
                </a>
              }
            >
              <TaskRow
                title="CMCDEVEL-UCREA-2026-002"
                meta="UCREA · active"
                href="/teaching/attendance"
                tone="success"
                tag="Lớp"
              />
              <TaskRow
                title="Buổi 12 · Chưa điểm danh"
                meta="Hôm nay 14:00"
                href="/teaching/attendance"
                tone="warning"
              />
            </Panel>

            <div className="dl-card">
              <EmptyState
                title="Không có phiếu chờ duyệt"
                description="EmptyState chuẩn: title + mô tả + CTA."
                action={<Button label="Xem phiếu thu" variant="secondary" size="sm" />}
              />
            </div>
          </div>
        </Section>

        <Section
          id="feedback"
          title="Feedback triad — toast · banner · confirm"
          lead="Mọi commit: loading → success toast / error + recovery. Confirm cho tiền & không hoàn tác."
        >
          <div className="dl-card dl-stack-gap">
            <div className="dl-row-gap">
              <Button label="Toast success" variant="secondary" size="sm" onClick={() => success('Đã lưu')} />
              <Button label="Toast error" variant="secondary" size="sm" onClick={() => error('Không lưu được')} />
              <Button label="Toast info" variant="secondary" size="sm" onClick={() => info('Thông tin ngắn')} />
              <Button label="Mở ConfirmDialog" variant="primary" size="sm" onClick={() => setConfirmOpen(true)} />
            </div>
            <Banner status="warning" title="Banner bền" description="Dùng khi cần second-eye, không thay toast commit ngắn." />
            <ConfirmDialog
              opened={confirmOpen}
              title="Duyệt phiếu thu?"
              message="Hành động kích hoạt LMS cho học viên. Không hoàn tác từ màn này."
              confirmLabel="Duyệt"
              confirmColor="red"
              onConfirm={() => {
                setConfirmOpen(false);
                success('Đã duyệt phiếu');
              }}
              onCancel={() => setConfirmOpen(false)}
            />
          </div>
        </Section>

        <Section
          id="primitives"
          title="Astryx primitives (one-door)"
          lead="Skeleton · Spinner · ProgressBar · TextArea · — import từ @cmc/ui, không @astryxdesign trực tiếp."
        >
          <div className="dl-card dl-stack-gap">
            <div className="dl-row-gap" style={{ alignItems: 'center' }}>
              <Spinner size="md" />
              <div style={{ flex: 1, maxWidth: 220 }}>
                <ProgressBar label="Tiến độ" value={0.62} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--cmc-text-muted)' }}>62%</span>
            </div>
            <div className="dl-stack-gap">
              <Skeleton height={14} width="40%" radius={1} />
              <Skeleton height={40} radius={1} />
              <Skeleton height={40} radius={1} />
            </div>
            <TextArea
              label="Ghi chú (TextArea)"
              placeholder="Mô tả thêm…"
              value={demoNote}
              onChange={(v) => setDemoNote(String(v ?? ''))}
            />
          </div>
        </Section>

        <Section
          id="identity"
          title="Identity · Meta · Count (Xia)"
          lead="Avatar (Airbnb/Cal trust) · MetaRow (GitHub dense) · CountBadge (tab counters)."
        >
          <div className="dl-card dl-stack-gap">
            <div className="dl-row-gap" style={{ alignItems: 'center' }}>
              <Avatar name="Nguyễn Văn A" size="sm" />
              <Avatar name="Nguyễn Văn A" size="md" ring />
              <Avatar name="Trần B" size="lg" ring />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Nguyễn Văn A</div>
                <MetaRow>
                  <MetaItem dot="var(--cmc-brand)">CRM</MetaItem>
                  <MetaItem dot="var(--cmc-success)">O4</MetaItem>
                  <MetaItem>0930 773 703</MetaItem>
                  <MetaItem>Cập nhật 09:12</MetaItem>
                </MetaRow>
              </div>
            </div>
            <div className="dl-row-gap" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Phiếu thu</span>
              <CountBadge count={4} emphasize />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Đã đọc</span>
              <CountBadge count={0} />
              <span style={{ fontSize: 12, color: 'var(--cmc-text-muted)' }}>(hideZero)</span>
              <CountBadge count={1280} hideZero={false} />
            </div>
          </div>
        </Section>

        <Section
          id="timeline"
          title="Activity timeline"
          lead="GitHub-ish dense trail — lịch sử lead, phiếu, điểm danh."
        >
          <div className="dl-card">
            <ActivityTimeline
              items={[
                {
                  id: '1',
                  title: 'Tạo lead từ Facebook Ads',
                  meta: 'CSKH Mai · cơ sở Cầu Giấy',
                  time: 'Hôm qua 16:40',
                  tone: 'brand',
                },
                {
                  id: '2',
                  title: 'Đặt lịch kiểm tra đầu vào',
                  meta: 'Buổi 10:00 · phòng 3',
                  time: 'Hôm nay 08:05',
                  tone: 'warning',
                },
                {
                  id: '3',
                  title: 'Chuyển O4 — sẵn sàng ghi danh',
                  meta: 'Điểm: 78 · gợi ý UCREA',
                  time: '09:12',
                  tone: 'success',
                  trailing: <StatusBadge status="pending" label="Chờ ghi danh" size="sm" />,
                },
              ]}
            />
          </div>
        </Section>

        <Section
          id="schedule"
          title="Lịch dạy — modern calendar"
          lead="Hierarchy field P0/P1/P2 (progressive disclosure) · fixed slots · mobile + desktop. Tham chiếu Cal.com clarity + Polaris density + NN/g progressive disclosure."
        >
          <div className="dl-stack-gap">
            <Callout tone="info" title="Trường nào hiện đầy / trường nào …">
              <strong>P0 luôn quét được:</strong> giờ (ngắn) · mã lớp · status · CTA điểm danh.
              <strong> P1:</strong> tên chương trình (ellipsis). <strong>P2:</strong> phòng · GV.
              <strong> Tooltip:</strong> khoảng kỳ đầy đủ, id dài. Compact tuần: 1 dòng secondary
              (program hoặc room theo footPriority). Production:{' '}
              <code>/teaching/schedule?view=week</code>
            </Callout>

            <div className="dl-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="ck-inv">
                <thead>
                  <tr>
                    <th>Trường</th>
                    <th>Vai trò GV/ops</th>
                    <th>Tuần (compact)</th>
                    <th>Tháng / list</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['timeLabel', 'Khi nào', 'P0 ngắn (MM/YY–MM/YY) hoặc giờ', 'P0 đầy đủ, ellipsis OK'],
                    ['title (mã lớp)', 'Lớp nào', 'P0 luôn', 'P0 luôn'],
                    ['status chip', 'Cần làm gì', 'P0 chấm + nhãn ngắn', 'P0'],
                    ['subtitle (CTĐT)', 'Chương trình', 'P1 1 dòng (hoặc nhường meta)', 'P1 dòng riêng'],
                    ['meta (phòng·GV)', 'Ở đâu / ai dạy', 'P2 ưu tiên nếu footPriority=actionable', 'P2 dòng riêng'],
                    ['detail', 'Đầy đủ khi hover', 'Tooltip only', 'Tooltip only'],
                    ['actionLabel', 'Hành động', 'P0 pill CTA', 'P0 pill CTA'],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td>
                        <strong>{row[0]}</strong>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--cmc-text-2)' }}>{row[1]}</td>
                      <td style={{ fontSize: 12, color: 'var(--cmc-text-muted)' }}>{row[2]}</td>
                      <td style={{ fontSize: 12, color: 'var(--cmc-text-muted)' }}>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Text type="supporting" size="sm">
              SessionCard states — cùng chiều cao dù text ngắn/dài
            </Text>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10,
              }}
            >
              <SessionCard
                title="ENG-A1"
                subtitle="English A1 — Intensive speaking"
                timeLabel="08:00–09:30"
                meta="P.301 · GV Mai"
                detail="Buổi 12 · 24 HS"
                status="live"
                href="/teaching/attendance"
                actionLabel="Điểm danh ngay"
              />
              <SessionCard
                title="UCREA-02"
                subtitle="Ucrea sáng tạo rất dài để test ellipsis chương trình"
                timeLabel="14:00–15:30"
                meta="P.102 · GV Nguyễn Văn Rất Dài"
                status="attention"
                href="/teaching/attendance"
                actionLabel="Điểm danh"
                footPriority="actionable"
              />
              <SessionCard
                title="MATH-B"
                subtitle="Toán tư duy"
                timeLabel="05/01/2026 – 30/06/2026"
                meta="Chưa gán GV"
                status="active"
                href="/teaching/attendance"
                actionLabel="Mở lớp"
                density="default"
              />
              <SessionCard
                title="ART-01"
                subtitle="Mỹ thuật"
                timeLabel="T9–T12"
                status="planned"
                density="compact"
              />
              <SessionCard title="OLD-9" subtitle="Khoá cũ" timeLabel="2025" status="done" density="compact" />
              <SessionCard title="X-0" subtitle="Huỷ" status="cancelled" density="compact" />
            </div>

            <Text type="supporting" size="sm">
              WeekSchedule modern board
            </Text>
            <WeekSchedule
              title="Tuần 03/08 – 09/08/2026"
              density="compact"
              days={
                [
                  {
                    key: 'mon',
                    weekday: 'T2',
                    dayNum: '3',
                    caption: '03/08',
                    sessions: [
                      {
                        title: 'ENG-A1',
                        subtitle: 'English',
                        timeLabel: '08:00–09:30',
                        meta: 'P.301',
                        status: 'active',
                        href: '/teaching/attendance',
                        actionLabel: 'Điểm danh',
                      },
                    ],
                  },
                  {
                    key: 'tue',
                    weekday: 'T3',
                    dayNum: '4',
                    caption: '04/08',
                    isToday: true,
                    sessions: [
                      {
                        title: 'ENG-A1',
                        subtitle: 'English',
                        timeLabel: '08:00–09:30',
                        meta: 'P.301 · GV Mai',
                        status: 'live',
                        href: '/teaching/attendance',
                        actionLabel: 'Điểm danh ngay',
                      },
                      {
                        title: 'UCREA',
                        subtitle: 'Sáng tạo',
                        timeLabel: '14:00–15:30',
                        meta: 'P.102',
                        status: 'attention',
                        href: '/teaching/attendance',
                        actionLabel: 'Điểm danh',
                      },
                    ],
                  },
                  {
                    key: 'wed',
                    weekday: 'T4',
                    dayNum: '5',
                    caption: '05/08',
                    sessions: [
                      {
                        title: 'MATH-B',
                        subtitle: 'Toán',
                        timeLabel: '09:00–10:30',
                        status: 'active',
                        href: '/teaching/attendance',
                        actionLabel: 'Điểm danh',
                      },
                    ],
                  },
                  { key: 'thu', weekday: 'T5', dayNum: '6', caption: '06/08', sessions: [] },
                  {
                    key: 'fri',
                    weekday: 'T6',
                    dayNum: '7',
                    caption: '07/08',
                    sessions: [
                      {
                        title: 'ART-01',
                        subtitle: 'Mỹ thuật',
                        timeLabel: '15:00–16:30',
                        status: 'planned',
                      },
                    ],
                  },
                  {
                    key: 'sat',
                    weekday: 'T7',
                    dayNum: '8',
                    caption: '08/08',
                    isWeekend: true,
                    sessions: [],
                  },
                  {
                    key: 'sun',
                    weekday: 'CN',
                    dayNum: '9',
                    caption: '09/08',
                    isWeekend: true,
                    sessions: [],
                  },
                ] satisfies WeekDayColumn[]
              }
            />

            <Text type="supporting" size="sm">
              ScheduleMonth (nhóm theo tháng bắt đầu)
            </Text>
            <ScheduleMonth
              groups={[
                {
                  key: 't1',
                  label: 'tháng 1, 2026',
                  items: [
                    {
                      title: 'ENG-A1',
                      subtitle: 'English',
                      timeLabel: '05/01 – 30/06',
                      status: 'active',
                      href: '/teaching/attendance',
                      actionLabel: 'Điểm danh',
                    },
                    {
                      title: 'UCREA-02',
                      subtitle: 'Ucrea',
                      timeLabel: '12/01 – 20/05',
                      status: 'attention',
                      href: '/teaching/attendance',
                      actionLabel: 'Điểm danh',
                    },
                  ],
                },
              ]}
            />

            <div className="dl-callout">
              <strong>Production:</strong> màn <code>/teaching/schedule</code> — tab{' '}
              <strong>Tuần</strong> (mới) · Theo tháng · Kanban · Danh sách. Data hiện là classBatch
              kỳ; session giờ thật có thể nối sau khi API buổi học sẵn.
            </div>
          </div>
        </Section>

        <Section
          id="detail"
          title="DetailPage — recipe toàn hệ thống"
          lead="Một khung cho lớp / học viên / phiếu / opportunity: header → entity → summary? → tabs? → body. Không invent layout từng màn."
        >
          <div className="dl-stack-gap">
            <div className="dl-frame-mock" style={{ whiteSpace: 'pre-wrap' }}>
              {`DetailPage (record page)
  header:   PageHeader breadcrumbs only (no dual title)
  entity:   EntityHeader = single h1
  summary:  HighlightStrip · WorkflowStatusbar · StatActions
  tabs?:    CmcTabs
  body?:    stack | split + SectionBlock`}
            </div>
            <DetailPage
              header={
                <PageHeader
                  breadcrumbs={[
                    { label: 'Design', href: '/design' },
                    { label: 'Pipeline' },
                    { label: 'Nguyễn Văn A' },
                  ]}
                />
              }
              entity={
                <EntityHeader
                  title="Nguyễn Văn A"
                  subtitle="Lead O4 · 0930 773 703"
                  initials="NA"
                  badges={
                    <>
                      <StatusBadge status="pending" label="Chờ ghi danh" />
                      <CountBadge count={3} emphasize />
                    </>
                  }
                  meta={
                    <MetaRow>
                      <MetaItem dot="var(--cmc-brand)">CSKH Mai</MetaItem>
                      <MetaItem>Cầu Giấy</MetaItem>
                      <MetaItem>Hôm nay 09:12</MetaItem>
                    </MetaRow>
                  }
                  actions={
                    <>
                      <Button label="Ghi danh" variant="primary" size="sm" />
                      <Button label="Gọi" variant="secondary" size="sm" />
                    </>
                  }
                />
              }
              summary={
                <HighlightStrip
                  items={[
                    { key: 'phone', label: 'SĐT', value: '0930 773 703' },
                    { key: 'stage', label: 'Giai đoạn', value: 'O4 — Chờ ghi danh' },
                    { key: 'owner', label: 'Phụ trách', value: 'CSKH Mai' },
                    { key: 'campus', label: 'Cơ sở', value: 'Cầu Giấy' },
                  ]}
                />
              }
              tabs={
                <CmcTabs
                  activeTab={tab}
                  onTabChange={setTab}
                  tabs={[
                    {
                      id: 'info',
                      label: 'Tổng quan',
                      content: (
                        <div className="tpl-detail-panel">
                          <div className="tpl-detail-stack">
                            <SectionBlock
                              title="Thông tin liên hệ"
                              description="Key-value grid — không dump bảng thô."
                            >
                              <KeyValueList
                                items={[
                                  { key: 'phone', label: 'SĐT', value: '0930 773 703' },
                                  { key: 'email', label: 'Email', value: 'a@example.com' },
                                  { key: 'campus', label: 'Cơ sở', value: 'Cầu Giấy' },
                                  { key: 'source', label: 'Nguồn', value: 'Facebook Ads' },
                                  {
                                    key: 'note',
                                    label: 'Ghi chú',
                                    value: 'Quan tâm UCREA buổi tối',
                                    fullWidth: true,
                                  },
                                ]}
                              />
                            </SectionBlock>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: 'pay',
                      label: 'Thanh toán',
                      content: (
                        <div className="tpl-detail-panel">
                          <Text type="body" size="sm">
                            Phiếu thu liên quan — cùng SectionBlock / KeyValueList.
                          </Text>
                        </div>
                      ),
                    },
                  ]}
                />
              }
            />
          </div>
        </Section>

        <Section
          id="settings"
          title="Settings layout"
          lead="Polaris-style settings: section title + rows label/description/control."
        >
          <SettingsSection
            title="Thông báo vận hành"
            description="Điều khiển email / in-app cho hàng đợi duyệt và điểm danh."
          >
            <SettingsRow
              label="Email khi có phiếu chờ duyệt"
              description="Gửi cho role kế toán của cơ sở."
              control={
                <Button
                  label={notifOn ? 'Bật' : 'Tắt'}
                  variant={notifOn ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setNotifOn((v) => !v)}
                />
              }
            />
            <SettingsRow
              label="Nhắc điểm danh sau 15 phút"
              description="Giáo viên nhận toast + badge shell."
              control={<StatusBadge status="active" label="Active" />}
            />
          </SettingsSection>
          <div style={{ marginTop: 16 }}>
            <Text type="supporting" size="sm" weight="semibold">
              SettingsShell (rail) — pilot production: /admin/shift-config
            </Text>
            <div style={{ marginTop: 10 }}>
              <SettingsShell
                title="Cấu hình"
                items={[
                  { id: 'groups', label: 'Nhóm ca', description: 'Templates & modes' },
                  { id: 'policy', label: 'Chính sách phạt', description: 'Muộn / về sớm' },
                ]}
                activeId={settingsNav}
                onSelect={setSettingsNav}
              >
                <SettingsSection
                  title={settingsNav === 'groups' ? 'Nhóm ca & mẫu ca' : 'Chính sách phạt'}
                  description="Demo rail — nội dung thật ở màn Ca làm việc."
                >
                  <SettingsRow
                    label="Panel đang mở"
                    description={settingsNav}
                    control={<StatusBadge status="active" label={settingsNav} />}
                  />
                </SettingsSection>
              </SettingsShell>
            </div>
          </div>
        </Section>

        <Section
          id="cmdk"
          title="Command palette ⌘K"
          lead="Điều hướng nhanh — production: nút Tìm trên topbar + Ctrl/⌘K trong shell."
        >
          <div className="dl-stack-gap">
            <Button
              label="Mở palette demo"
              variant="primary"
              size="sm"
              onClick={() => setCmdDemoOpen(true)}
            />
            <Text type="supporting" size="sm">
              Gõ để lọc · ↑↓ chọn · Enter mở · Esc đóng. Live app: mọi mục nav theo quyền session.
            </Text>
            <CommandPalette
              open={cmdDemoOpen}
              onOpenChange={setCmdDemoOpen}
              items={[
                { id: 'c1', label: 'Tổng quan', group: 'Module', href: '/cockpit' },
                { id: 'c2', label: 'Phiếu thu', group: 'Tài chính', href: '/finance' },
                { id: 'c3', label: 'Pipeline CRM', group: 'CRM', href: '/crm' },
                { id: 'c4', label: 'Lịch dạy', group: 'Giảng dạy', href: '/teaching/schedule' },
                { id: 'c5', label: 'Design Lab', group: 'Dev', href: '/design' },
              ]}
              onNavigate={() => setCmdDemoOpen(false)}
            />
          </div>
        </Section>

        <Section
          id="wizard"
          title="Wizard · FormPage · Result"
          lead="ProgressSteps + SectionBlock fields + sticky actions + ResultPanel."
        >
          <div className="dl-card dl-stack-gap">
            <ProgressSteps
              activeIndex={stepIdx}
              onStepClick={setStepIdx}
              steps={[
                { id: '1', label: 'Học viên' },
                { id: '2', label: 'Gói học' },
                { id: '3', label: 'Thanh toán' },
                { id: '4', label: 'Xác nhận' },
              ]}
            />
            <FormPage
              header={
                <PageHeader
                  title="Ghi danh — bước demo"
                  subtitle="FormPage archetype với sticky actions"
                />
              }
              actions={
                <>
                  <Button label="Quay lại" variant="secondary" size="sm" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} />
                  <button
                    type="button"
                    className="fp-action"
                    onClick={() => setStepIdx((i) => Math.min(3, i + 1))}
                  >
                    Tiếp tục
                  </button>
                </>
              }
              result={
                stepIdx === 3 ? (
                  <ResultPanel
                    status="success"
                    title="Sẵn sàng xác nhận"
                    message="Kiểm tra lại gói học và số tiền trước khi tạo phiếu."
                    actions={<Button label="Tạo phiếu thu" variant="primary" size="sm" />}
                  />
                ) : undefined
              }
            >
              <SectionBlock title="Thông tin bước" raised>
                <TextInput
                  label="Tên hiển thị"
                  value={demoNote}
                  onChange={(v) => setDemoNote(String(v ?? ''))}
                  placeholder="Nguyễn Văn A"
                />
              </SectionBlock>
            </FormPage>
          </div>
        </Section>

        <Section
          id="table"
          title="DataTable + bulk + pagination"
          lead="Shell raised · bulk bar khi chọn · footer phân trang (P1 completeness)."
        >
          <div className="dl-stack-gap">
            <BulkActionBar
              selectionCount={selectedCount}
              onClear={() => setSelectedCount(0)}
            >
              <Button label="Duyệt hàng loạt" variant="primary" size="sm" />
              <Button label="Xuất CSV" variant="secondary" size="sm" />
              <Button
                label="Giả lập chọn 2"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCount(2)}
              />
            </BulkActionBar>
            <div className="ck-table-shell">
              <DataTable<DemoRow>
                columns={TABLE_COLS}
                data={DEMO_ROWS}
                empty="Không có dòng"
                selectedIds={
                  selectedCount > 0
                    ? DEMO_ROWS.slice(0, selectedCount).map((r) => r.id)
                    : []
                }
                onSelectionChange={(ids) => setSelectedCount(ids.length)}
              />
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={48}
                onPageChange={setPage}
                pageSizeOptions={[10, 20, 50]}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </div>
            <div className="dl-card">
              <Text type="supporting" size="sm">
                States
              </Text>
              <div className="dl-stack-gap" style={{ marginTop: 10 }}>
                <div>
                  <Text type="supporting" size="sm">
                    Loading skeleton
                  </Text>
                  <Skeleton height={36} radius={0} />
                  <Skeleton height={36} radius={0} />
                </div>
                <DataTable<DemoRow> columns={TABLE_COLS} data={[]} empty="Empty — không có dòng" />
              </div>
            </div>
          </div>
        </Section>

        <Section id="frames" title="Page frames" lead="Bốn archetype — PAGE-FRAMES.md. Màn mới bắt buộc 1 trong 4.">
          <div className="dl-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="dl-frame-mock">{`DashboardPage
[ title + subtitle ]
[ Shortcut chips ]
[ metrics 0–4 · FocusCard ]
[ primary 1.4fr | secondary 1fr ]`}</div>
            <div className="dl-frame-mock">{`ListPage density=ops
[ ControlBar sticky ]
  PageHeader · FilterBar · pager footer
[ table shell · BulkActionBar ]`}</div>
            <div className="dl-frame-mock">{`DetailPage
[ PageHeader breadcrumbs ]
[ EntityHeader identity ]
[ summary? · CmcTabs? ]
[ stack | split · SectionBlock ]`}</div>
            <div className="dl-frame-mock">{`FormPage
[ ProgressSteps? ]
[ SectionBlock fields ]
[ sticky actions · ResultPanel ]`}</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <PageHeader
              title="PageHeader soft-card"
              subtitle="Sticky raised card · shadow-xs · không slab full-bleed."
              breadcrumbs={[{ label: 'Design' }, { label: 'Lab' }]}
              actions={<Button label="Action" variant="primary" size="sm" />}
            />
          </div>
        </Section>

        <Section
          id="auth"
          title="Auth inputs"
          lead="TextField · PasswordInput — LMS/staff login hardening (one-door)."
        >
          <div className="dl-card" style={{ maxWidth: 400 }}>
            <div className="dl-stack-gap">
              <TextField
                label="Email"
                type="email"
                placeholder="name@cmcvn.edu.vn"
                value={demoEmail}
                onChange={(v) => setDemoEmail(String(v ?? ''))}
              />
              <PasswordInput
                label="Mật khẩu"
                value={demoPassword}
                onChange={(v) => setDemoPassword(String(v ?? ''))}
              />
            </div>
          </div>
        </Section>

        <Section
          id="live"
          title="Live production sample"
          lead="Cùng tokens đã promote — không parallel theme."
        >
          <div className="dl-callout" style={{ marginBottom: 14 }}>
            <strong>Đang chạy:</strong> control 12 / card 16 / dialog 20 · warm neutrals · elevation
            roles · FilterBar · table shell · funnel rail · completeness pack. <strong>Giữ</strong>{' '}
            brand #0071E3, Inter, ops density.
          </div>
          <div className="dl-stack-gap" style={{ maxWidth: 480 }}>
            <FocusCard
              kicker="Next action"
              title="Duyệt phiếu PT-1042"
              href="/finance"
              cta="Mở phiếu"
              tone="danger"
            />
            <MetricCard label="Phiếu chờ" value={4} href="/finance" icon="receipt" attention="danger" context="Xem" />
            <Panel title="Hàng đợi">
              <TaskRow title="Duyệt phiếu PT-1042" meta="4.500.000" href="/finance" tone="danger" tag="Duyệt" />
              <TaskRow title="Lead O4" meta="0930…" href="/crm" tone="success" tag="O4" />
            </Panel>
          </div>
        </Section>

        <Section
          id="sources"
          title="Nguồn design docs cho AI agent"
          lead="Local DESIGN.md extracts + agent-readable remote docs. Closed tokens: packages/ui/llms.txt."
        >
          <div className="dl-card">
            <ul className="dl-diag" style={{ margin: 0, padding: 0 }}>
              <li>
                <strong>Local xia corpus</strong> —{' '}
                <code>~/Downloads/design/*-DESIGN.md</code> + token JSON (Shopify, GitHub, Cal, Airbnb).
              </li>
              <li>
                <strong>Shopify Polaris</strong> — settings, highlight callout, merchant density.
              </li>
              <li>
                <strong>GitHub Primer</strong> — dense meta, counters, status semantics.
              </li>
              <li>
                <strong>Atlassian Design / Carbon</strong> — elevation, tables, llms.txt when available.
              </li>
              <li>
                <strong>Radix / shadcn docs</strong> — a11y concepts only; map → Astryx (no second Tailwind).
              </li>
              <li>
                <strong>CMC agent brief</strong> — <code>packages/ui/llms.txt</code> · reports{' '}
                <code>plans/260803-xia-design-sources/</code> ·{' '}
                <code>plans/260802-design-lab-visual-system/reports/</code>
              </li>
            </ul>
          </div>
        </Section>

        <Section id="next" title="Anti-pattern & residual gaps" lead="Những thứ cố ý không làm — và partial còn lại.">
          <div className="dl-card dl-stack-gap">
            <ul className="dl-diag">
              <li className="dl-anti">
                <strong>Không:</strong> cool gray filter · double chrome · radius 4px lẫn 16px ·
                rainbow metrics · glass nặng · Storybook monorepo · shadcn/Tailwind thứ hai.
              </li>
              <li>
                <strong>Partial còn lại:</strong> FilterBar date/multi · DataTable row selection
                native · soft StatusBadge default override Astryx.
              </li>
              <li>
                <strong>Nice later:</strong> command palette · BI charts · dark mode.
              </li>
            </ul>
            <p className="dl-footer-note">
              Reports: plans/260802-design-lab-visual-system/reports/ · URL <code>/design</code>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
