/**
 * Design Lab — multi-agent layout research synthesis
 * 5 agents (ERP shell, cockpit, frames, density, edu) → CMC layout OS.
 */
import { useState } from 'react';
import './design-lab-layout-knowledge.css';

type AgentId = 'a1' | 'a2' | 'a3' | 'a4' | 'a5';

const AGENTS: {
  id: AgentId;
  name: string;
  focus: string;
  finding: string;
  rules: string[];
  steal: string;
  skip: string;
}[] = [
  {
    id: 'a1',
    name: 'Agent 1 · ERP shell',
    focus: 'Carbon · Ant · Odoo → admin shell / list / detail',
    finding:
      'CMC đã khớp genre ERP: SideNav ~248 · topbar ~60 · pad ops 18×22. Steal grammar Carbon/Ant; không steal chrome brand.',
    rules: [
      'One shell + exactly 4 page frames',
      'List ControlBar sticky = title → filters → pager/bulk',
      'Detail: EntityHeader = single h1',
      '1 primary CTA / context',
      'Density 48 default / 40 compact / touch ≥44',
      'Keyline-x 20 + raised family — no magic pad',
      'Skip second DS, dual brand, consumer air on ops',
    ],
    steal: 'Table/filter/empty patterns · list→detail IA',
    skip: 'IBM gray · Ant ProLayout look · Odoo purple/OWL',
  },
  {
    id: 'a2',
    name: 'Agent 2 · Cockpit',
    focus: 'Multi-role operational dashboard',
    finding:
      'Một DashboardPage cho mọi role. Hierarchy cố định; chỉ data trong slot thay đổi. Không fork layout sale/GV.',
    rules: [
      'Order: greeting → shortcuts → metrics → primary | secondary',
      'Body grid 1.4fr | 1fr ≥1040px',
      'Shortcuts 3–5 · metrics 0–4',
      'Primary = job queue (WorkInbox)',
      'Secondary = pipeline / lịch / context',
      'Empty = title + desc + next-step CTA',
      'Anti: widget soup · dual primary · BI home',
    ],
    steal: 'Role-filled slots, not role-forked frames',
    skip: 'Portal-of-links · full-bleed single metric · UUID titles',
  },
  {
    id: 'a3',
    name: 'Agent 3 · Frames',
    focus: 'List · Detail · Form + VIEW-GRAMMAR',
    finding:
      'Odoo view map: list→ListPage, form read→DetailPage, form edit→FormPage, calendar→ListPage+WeekSchedule, settings→SettingsShell/Form.',
    rules: [
      'FilterBar only inside ListPage',
      'ControlBar sticky top z-index quiet raised',
      'Detail order locked: header→entity→summary→tabs→body',
      'Form actions sticky bottom float surface',
      'Kanban deferred — FunnelBar in list body until 2+ boards',
      'Sheet = SectionBlock + KeyValueList',
      'Notebook = CmcTabs · chatter = ActivityTimeline tab',
    ],
    steal: 'Odoo concepts (not XML/OWL)',
    skip: 'Per-entity custom full-page chrome',
  },
  {
    id: 'a4',
    name: 'Agent 4 · Density / grid',
    focus: 'Spacing · radius · elevation · keyline',
    finding:
      'Closed token system. Density = mode (heights), not style fork. Reject Carbon 32px default; reject consumer 48–64 section air on lists.',
    rules: [
      'Space scale only: 4 / 8 / 16 / 24 + named pads',
      'Row heights only 48 | 40',
      'Radius nest: control 12 ≤ card 16 ≤ dialog 20',
      'Keyline-x = 20 on every composite',
      'Elevation: sticky xs · raised sm · float md · modal lg',
      'Rows never cast shadow (sunken hover)',
      'No orphan radius 8/18 or pad 13/22',
    ],
    steal: 'Ant 8-grid rhythm (map to CMC tokens)',
    skip: 'Magic px invent · cool-gray blocks on warm canvas',
  },
  {
    id: 'a5',
    name: 'Agent 5 · Education',
    focus: 'Schedule · attendance · LMS vs admin',
    finding:
      'Grain = ClassSession for teaching work. Agenda-first for GV; week for conflict. Attendance touch ≥44; finance stays compact table.',
    rules: [
      'List-ops for entities; agenda for session work',
      'WeekSchedule = toggle for planning, not GV default',
      'SessionCard P0: time · title · status · CTA',
      'P3 detail → tooltip only',
      'Touch floor ≠ new visual density language',
      'Share tokens; split shells (admin dense / LMS mobile)',
      'Deeplink session → attendance (?session=)',
    ],
    steal: 'Session hierarchy + shared StatusBadge semantics',
    skip: 'Month-first for GV · photo cards · marketing sparsity on ops',
  },
];

const LAWS: { group: string; items: string[] }[] = [
  {
    group: 'Product OS',
    items: [
      'One shell + one of four frames (Dashboard · List · Detail · Form)',
      'Modules swap data / permissions / tabs only',
      'One primary CTA per chrome context',
    ],
  },
  {
    group: 'Structure',
    items: [
      'Raised recipe + keyline-x 20 on all composites',
      'Nested radius 12 ≤ 16 ≤ 20',
      'Row heights: 48 default · 40 ops · touch hit ≥44',
      'No magic px outside tokens.css',
    ],
  },
  {
    group: 'List',
    items: [
      'ControlBar sticky = header · filters · pager/bulk',
      'FilterBar only inside ListPage',
      'EmptyState = title + description + action',
    ],
  },
  {
    group: 'Detail / Form',
    items: [
      'EntityHeader owns entity h1 — no dual title',
      'Detail order: header → entity → summary? → tabs? → body',
      'Form actions sticky bottom',
    ],
  },
  {
    group: 'Cockpit',
    items: [
      'Fixed slot order for every role',
      '≤4 metrics · 3–5 shortcuts',
      'Empty queue teaches next step',
    ],
  },
  {
    group: 'Education',
    items: [
      'Grain matches job (session vs entity list)',
      'Agenda does work; week shows conflict',
      'SessionCard P0 always visible',
    ],
  },
  {
    group: 'Feedback',
    items: [
      'Commit → toast · irreversible → ConfirmDialog',
      'Status never color-only · Vietnamese labels',
    ],
  },
];

const CHECKLIST = [
  'Named frame ∈ {Dashboard, List, Detail, Form}',
  'No dual title / no second design system',
  'Density tier declared (default vs ops)',
  'Exactly one primary CTA in chrome',
  'Empty + loading + error states placed',
  'Tokens only (keyline, radius, row-h, pad)',
  'Role/permission changes content, not layout tree',
];

const DENSITY_ROWS = [
  { tier: 'Comfortable / default', row: '48', pad: '24 · keyline 20', use: 'Cockpit · detail · forms' },
  { tier: 'Ops compact', row: '40', pad: '18×22 wrap · cell tight', use: 'Lists · tables · week cells' },
  { tier: 'Touch floor', row: '≥44 hit', pad: 'same visual tier', use: 'Attendance punch only' },
];

const FRAME_MAP = [
  { odoo: 'list', cmc: 'ListPage + ControlBar', note: 'Ops tables, queues' },
  { odoo: 'form (read)', cmc: 'DetailPage', note: 'Entity identity recipe' },
  { odoo: 'form (edit)', cmc: 'FormPage', note: 'Sticky Save/Discard' },
  { odoo: 'kanban', cmc: 'List body / FunnelBar', note: 'No generic KanbanBoard yet' },
  { odoo: 'calendar', cmc: 'ListPage + WeekSchedule', note: 'Teaching schedule' },
  { odoo: 'settings', cmc: 'SettingsShell / FormPage', note: 'Rail when multi-domain' },
  { odoo: 'graph', cmc: 'Dashboard / report panels', note: 'Not BI home' },
];

export function LayoutKnowledgePanel() {
  const [agent, setAgent] = useState<AgentId>('a1');
  const active = AGENTS.find((a) => a.id === agent)!;

  return (
    <div className="lk-root">
      <div className="lk-hero">
        <p className="lk-kicker">5-agent research · 2026-08-04</p>
        <h3 className="lk-title">Layout knowledge OS cho CMC EDU</h3>
        <p className="lk-lead">
          Năm agent research song song (ERP shell · cockpit · frames · density · education) → tổng
          hợp thành luật layout bắt buộc. Nguồn ngoài chỉ để <strong>học pattern</strong>; authority
          là <code>design-system/cmc-edu</code> + <code>@cmc/ui</code> tokens.
        </p>
        <div className="lk-os">
          <pre>{`AppFrame + SideNav (~248) + Topbar (~60)
  └── exactly one:
        DashboardPage | ListPage | DetailPage | FormPage
Modules change data · permissions · tabs — never full-page chrome.`}</pre>
        </div>
      </div>

      <div className="lk-agents" role="tablist" aria-label="Chọn agent research">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={agent === a.id}
            className="lk-agent-tab"
            data-active={agent === a.id ? 'true' : 'false'}
            onClick={() => setAgent(a.id)}
          >
            <strong>{a.name}</strong>
            <span>{a.focus}</span>
          </button>
        ))}
      </div>

      <div className="lk-agent-panel" role="tabpanel">
        <p className="lk-finding">
          <strong>Finding:</strong> {active.finding}
        </p>
        <div className="lk-agent-grid">
          <div className="lk-card">
            <h4>7 rules từ agent</h4>
            <ol>
              {active.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
          <div className="lk-card">
            <h4>Steal</h4>
            <p>{active.steal}</p>
            <h4 style={{ marginTop: 12 }}>Skip</h4>
            <p>{active.skip}</p>
          </div>
        </div>
      </div>

      <div className="lk-section">
        <h4>Density tiers (Agent 4 + A1)</h4>
        <table className="lk-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Row</th>
              <th>Pad</th>
              <th>Dùng cho</th>
            </tr>
          </thead>
          <tbody>
            {DENSITY_ROWS.map((r) => (
              <tr key={r.tier}>
                <td>
                  <strong>{r.tier}</strong>
                </td>
                <td>
                  <code>{r.row}</code>
                </td>
                <td>{r.pad}</td>
                <td>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lk-section">
        <h4>Odoo view → CMC frame (Agent 3)</h4>
        <table className="lk-table">
          <thead>
            <tr>
              <th>Odoo-ish</th>
              <th>CMC</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {FRAME_MAP.map((r) => (
              <tr key={r.odoo}>
                <td>
                  <code>{r.odoo}</code>
                </td>
                <td>{r.cmc}</td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lk-section">
        <h4>21 layout laws (merged)</h4>
        <div className="lk-laws">
          {LAWS.map((g) => (
            <div key={g.group} className="lk-law-group">
              <h5>{g.group}</h5>
              <ul>
                {g.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="lk-section lk-section--check">
        <h4>Checklist màn mới</h4>
        <ul className="lk-check">
          {CHECKLIST.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="lk-doc-links">
          Docs: <code>PAGE-FRAMES.md</code> · <code>VIEW-GRAMMAR.md</code> · <code>STRUCTURE.md</code>{' '}
          · Report:{' '}
          <code>plans/260804-layout-multi-agent-research/reports/layout-synthesis-5-agents-2026-08-04.md</code>
          · Xem thêm: <a href="#wireframes">Wireframes</a> · <a href="#styles">Phong cách</a>
        </p>
      </div>

      <div className="lk-cockpit-diagram">
        <h4>Cockpit hierarchy (Agent 2)</h4>
        <div className="lk-flow">
          <span>Greeting</span>
          <i>→</i>
          <span>Shortcuts 3–5</span>
          <i>→</i>
          <span>Metrics 0–4</span>
          <i>→</i>
          <span className="lk-flow-split">
            Primary queue <em>1.4fr</em>
            <b>|</b>
            Secondary <em>1fr</em>
          </span>
        </div>
        <p className="lk-muted">≥1040px split · &lt;1040px stack 1 cột. Role chỉ đổi nội dung slot.</p>
      </div>

      <div className="lk-detail-diagram">
        <h4>Detail recipe (Agent 3)</h4>
        <div className="lk-stack-boxes">
          <div>PageHeader · breadcrumbs only</div>
          <div data-hot="true">EntityHeader · single h1 · 1 CTA</div>
          <div>summary? · Highlight · Workflow · StatActions</div>
          <div>tabs? · CmcTabs</div>
          <div>body · stack | split + SectionBlock</div>
        </div>
      </div>
    </div>
  );
}

export default LayoutKnowledgePanel;
