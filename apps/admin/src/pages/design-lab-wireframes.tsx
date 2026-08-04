/**
 * Design Lab — Page frame wireframes
 * Low-fidelity structural diagrams of CMC PAGE-FRAMES / VIEW-GRAMMAR.
 * Not production chrome — labeled boxes for layout review.
 */
import { useMemo, useState } from 'react';
import './design-lab-wireframes.css';

export type WireId =
  | 'shell'
  | 'dashboard'
  | 'list'
  | 'list-bulk'
  | 'detail'
  | 'odoo-control-panel'
  | 'odoo-form-sheet'
  | 'chatter-tab'
  | 'form'
  | 'settings'
  | 'calendar'
  | 'pipeline'
  | 'master-detail'
  | 'cockpit-sale'
  | 'cockpit-gv';

export interface WireFrame {
  id: WireId;
  name: string;
  component: string;
  density: string;
  routes: string[];
  slots: { name: string; required: boolean; note: string }[];
  rules: string[];
  doc: string;
}

export const WIREFRAMES: WireFrame[] = [
  {
    id: 'shell',
    name: 'App shell',
    component: 'AppFrame + SideNav + Topbar',
    density: 'chrome toàn app',
    routes: ['* (mọi route sau login)'],
    slots: [
      { name: 'SideNav', required: true, note: 'Module tree · role-gated' },
      { name: 'Topbar', required: true, note: 'Brand · ⌘K · user · logout' },
      { name: 'Outlet', required: true, note: '1 page frame bên trong' },
    ],
    rules: [
      'Shell không chứa layout nghiệp vụ',
      'Chỉ 1 page frame trong outlet',
      'Nav label ổn định — không đổi theo style lab',
    ],
    doc: 'PAGE-FRAMES.md §1',
  },
  {
    id: 'dashboard',
    name: 'Dashboard / Cockpit',
    component: 'DashboardPage',
    density: 'balanced',
    routes: ['/cockpit'],
    slots: [
      { name: 'title + subtitle', required: true, note: 'Xin chào · role' },
      { name: 'shortcuts', required: false, note: '3–5 ShortcutChip' },
      { name: 'metrics', required: false, note: '0–4 MetricCard' },
      { name: 'primary', required: true, note: 'WorkInbox / TaskRow queue' },
      { name: 'secondary', required: false, note: 'Pipeline / lịch / gợi ý' },
    ],
    rules: [
      'Cùng frame mọi role — chỉ data khác',
      'Primary 1.4fr | Secondary 1fr ≥1040px',
      'Empty queue = EmptyState + action',
    ],
    doc: 'PAGE-FRAMES.md §2A · §3',
  },
  {
    id: 'list',
    name: 'List ops',
    component: 'ListPage + ControlBar',
    density: 'ops',
    routes: ['/finance', '/admin/classes', '/students', '…'],
    slots: [
      { name: 'header', required: true, note: 'PageHeader · 1 primary CTA (= ListPage.header)' },
      { name: 'filters?', required: false, note: 'FilterBar | ad-hoc → ControlBar.filters' },
      { name: 'controlFooter?', required: false, note: 'ListPagination ± BulkActionBar' },
      { name: 'body', required: true, note: 'DataTable | EmptyState' },
      { name: 'isEmpty/empty?', required: false, note: 'page-level empty' },
      { name: 'density', required: false, note: 'ops | default' },
    ],
    rules: [
      'Filter không nằm ngoài ListPage',
      'Pager trong controlFooter — không rải lung tung',
      'Selection ≠ universal — xem list-bulk',
      'Odoo CP subset: CMC implements search+pager+create; defers favorites/view-switcher',
    ],
    doc: 'PAGE-FRAMES §2B · VIEW-GRAMMAR §3 · odoo web.ControlPanel',
  },
  {
    id: 'list-bulk',
    name: 'List + bulk selection',
    component: 'ListPage + DataTable selectedIds + BulkActionBar',
    density: 'ops',
    routes: ['receipts · students · classes · users · facilities · aftersale · exercises · gifts'],
    slots: [
      { name: 'selectedIds', required: true, note: 'DataTable controlled selection' },
      { name: 'BulkActionBar', required: true, note: 'controlFooter · count · clear' },
      { name: 'actions', required: true, note: 'copy / domain bulk · ConfirmDialog if destructive' },
      { name: 'ListPagination', required: true, note: 'pager clears selection' },
    ],
    rules: [
      'Pilot: ≥8 lists (check-ui-frames bulkListsOk)',
      'Clipboard bulk is honest — not fake multi-mutate domain APIs',
      'Odoo: selection replaces search strip (control-panel-selection-actions)',
    ],
    doc: 'xia-odoo-layout · list_controller.xml selection',
  },
  {
    id: 'detail',
    name: 'Detail / Record',
    component: 'DetailPage',
    density: 'default | ops',
    routes: ['/classes/:id', '/students/:id', '/finance/:id', '…'],
    slots: [
      { name: 'header', required: true, note: 'PageHeader breadcrumbs only' },
      { name: 'entity?', required: false, note: 'Entity domain → EntityHeader required (single h1)' },
      { name: 'summary.highlight?', required: false, note: 'HighlightStrip' },
      { name: 'summary.workflow?', required: false, note: 'WorkflowStatusbar' },
      { name: 'summary.statActions?', required: false, note: 'StatActions = Odoo button_box' },
      { name: 'tabs?', required: false, note: 'CmcTabs ≥2 vùng' },
      { name: 'body?', required: false, note: 'stack | split + SectionBlock' },
    ],
    rules: [
      'Không dual title',
      '1 primary CTA ở EntityHeader',
      'Chatter tab optional — xem chatter-tab · odoo-form-sheet',
    ],
    doc: 'PAGE-FRAMES §2C · VIEW-GRAMMAR §4',
  },
  {
    id: 'odoo-control-panel',
    name: 'Odoo ControlPanel → CMC',
    component: 'ControlBar (grammar port)',
    density: 'ops',
    routes: ['xia map only — not a product route'],
    slots: [
      { name: 'CP left', required: true, note: 'Odoo: New + breadcrumbs · CMC: PageHeader' },
      { name: 'CP center', required: false, note: 'Odoo: SearchBar OR selection · CMC: FilterBar / bulk strip' },
      { name: 'CP right', required: false, note: 'Odoo: pager + view switch · CMC: ListPagination only' },
      { name: 'content', required: true, note: 'Odoo o_content scroll · CMC tpl-list-body' },
    ],
    rules: [
      'Port: sticky CP shrink-0 + scroll body',
      'Skip: OWL, favorites, searchpanel facets, multi view switcher icons',
      'Source: addons/web/static/src/search/control_panel/control_panel.xml',
    ],
    doc: 'xia-odoo-layout-grammar-2026-08-04.md',
  },
  {
    id: 'odoo-form-sheet',
    name: 'Odoo form sheet → Detail',
    component: 'DetailPage recipe depth',
    density: 'ops',
    routes: ['/finance/:id', '/crm/opportunities/:id'],
    slots: [
      { name: 'crumbs', required: true, note: 'PageHeader breadcrumbs only' },
      { name: 'oe_title', required: true, note: 'EntityHeader h1 + badges + 1 CTA' },
      { name: 'statusbar', required: false, note: 'WorkflowStatusbar (= Odoo statusbar)' },
      { name: 'button_box', required: false, note: 'StatActions' },
      { name: 'highlight', required: false, note: 'HighlightStrip' },
      { name: 'sheet groups', required: true, note: 'SectionBlock + KeyValueList' },
      { name: 'notebook', required: false, note: 'CmcTabs' },
    ],
    rules: [
      'Source form_controller + form sheet stack (Odoo 19)',
      'Skip side chatter product; use chatter-tab optional',
      'Reference: receipt-detail · opportunity-detail',
    ],
    doc: 'VIEW-GRAMMAR §4 · odoo form view',
  },
  {
    id: 'chatter-tab',
    name: 'Chatter → Activity tab',
    component: 'CmcTabs panel + ActivityTimeline',
    density: 'default',
    routes: ['CRM detail · aftersale trail (recipe)'],
    slots: [
      { name: 'tab Hoạt động', required: true, note: 'Optional notebook page' },
      { name: 'ActivityTimeline', required: true, note: 'events · empty state' },
    ],
    rules: [
      'Không vẽ chatter trên mọi Detail',
      'Skip mail.thread RPC — port layout only',
      'Odoo xxl side chatter → CMC tab (not side panel default)',
    ],
    doc: 'VIEW-GRAMMAR chatter map',
  },
  {
    id: 'form',
    name: 'Form / Wizard',
    component: 'FormPage',
    density: 'default',
    routes: ['ghi danh multi-step', 'create entity'],
    slots: [
      { name: 'header', required: true, note: 'PageHeader' },
      { name: 'composition:steps?', required: false, note: 'ProgressSteps as children — not FormPage prop' },
      { name: 'fields', required: true, note: 'SectionBlock + inputs' },
      { name: 'result?', required: false, note: 'ResultPanel' },
      { name: 'actions', required: true, note: 'sticky Cancel · Primary' },
    ],
    rules: [
      'Sticky actions không scroll mất',
      '1 primary submit',
      'Dialog creates vẫn OK (YAGNI) — không bắt FormPage mọi modal',
    ],
    doc: 'PAGE-FRAMES.md §2D',
  },
  {
    id: 'settings',
    name: 'Settings shell',
    component: 'DetailPage + SettingsShell (product recipe)',
    density: 'comfortable',
    routes: ['/admin/shift-config', '/admin/network-ip', '/hr/salary-tiers'],
    slots: [
      { name: 'outer DetailPage.header', required: true, note: 'PageHeader title OK (settings, not entity h1)' },
      { name: 'rail', required: true, note: 'SettingsShell items' },
      { name: 'main', required: true, note: 'SettingsSection stack' },
    ],
    rules: [
      'Rail sticky · content scroll (= Odoo settings_tab)',
      '≥3 product surfaces (shift · network-ip · salary-tiers)',
      'Không nhét settings vào ListPage thuần',
    ],
    doc: 'Odoo settings_form_view · SettingsShell',
  },
  {
    id: 'calendar',
    name: 'Schedule / Calendar',
    component: 'ListPage body · WeekSchedule · SessionCard',
    density: 'edu',
    routes: ['/teaching/schedule'],
    slots: [
      { name: 'ControlBar', required: true, note: 'Tuần / GV / phòng filters' },
      { name: 'WeekSchedule', required: true, note: 'Cột ngày · SessionCard' },
      { name: 'SessionCard', required: true, note: 'P0 time/title/status/CTA' },
      { name: 'Month?', required: false, note: 'ScheduleMonth overview' },
    ],
    rules: [
      'SessionCard hierarchy P0→P3',
      'Không calendar library nặng nếu WeekSchedule đủ',
      'Deeplink session → attendance',
    ],
    doc: 'VIEW-GRAMMAR calendar · SessionCard',
  },
  {
    id: 'pipeline',
    name: 'CRM Pipeline',
    component: 'ListPage + FunnelBar / StageFunnel',
    density: 'ops',
    routes: ['/crm'],
    slots: [
      { name: 'ControlBar', required: true, note: 'Title · lost filter' },
      { name: 'Funnel / Stage', required: true, note: 'O1–O5 visual' },
      { name: 'list body', required: true, note: 'Opportunity cards/rows — NOT generic board' },
    ],
    rules: [
      'Kanban generic deferred — funnel + list is standard',
      'Bulk selection deferred (card UI)',
      'Click → DetailPage opportunity',
    ],
    doc: 'VIEW-GRAMMAR kanban map',
  },
  {
    id: 'master-detail',
    name: 'Master–detail',
    component: 'ListPage body · MasterDetail (grading)',
    density: 'ops',
    routes: ['/teaching/grading'],
    slots: [
      { name: 'master list', required: true, note: 'queue of items' },
      { name: 'detail pane', required: true, note: 'selected record work surface' },
    ],
    rules: [
      'Still one page frame (ListPage/Detail hybrid body) — not invent full-page OS',
      'Use when queue+inspect is primary (grading)',
    ],
    doc: 'product grading.tsx',
  },
  {
    id: 'cockpit-sale',
    name: 'Cockpit · Sale',
    component: 'DashboardPage (role data)',
    density: 'balanced',
    routes: ['/cockpit (sale)'],
    slots: [
      { name: 'shortcuts', required: true, note: 'CRM · Xếp lớp · Chấm công…' },
      { name: 'metrics', required: true, note: 'Sẵn sàng ghi danh…' },
      { name: 'primary', required: true, note: 'Ghi danh O4 queue' },
      { name: 'secondary', required: true, note: 'Pipeline O1–O5' },
    ],
    rules: ['Cùng DashboardPage frame', 'Không custom full-page sale'],
    doc: 'PAGE-FRAMES.md §3 Sale',
  },
  {
    id: 'cockpit-gv',
    name: 'Cockpit · Giáo viên',
    component: 'DashboardPage (role data)',
    density: 'balanced',
    routes: ['/cockpit (giao_vien)'],
    slots: [
      { name: 'shortcuts', required: true, note: 'Điểm danh · Chấm bài · Nhật ký' },
      { name: 'metrics', required: true, note: 'Bài chờ chấm' },
      { name: 'primary', required: true, note: 'Hàng đợi chấm bài' },
      { name: 'secondary', required: true, note: 'Lịch dạy hôm nay' },
    ],
    rules: ['Secondary = WeekSchedule / SessionCard', 'Cùng frame GV / sale'],
    doc: 'PAGE-FRAMES.md §3 GV',
  },
];

function WBox({
  label,
  sub,
  className,
  children,
  h,
}: {
  label: string;
  sub?: string;
  className?: string;
  children?: React.ReactNode;
  h?: number | string;
}) {
  return (
    <div
      className={['wf-box', className].filter(Boolean).join(' ')}
      style={h != null ? { minHeight: typeof h === 'number' ? `${h}px` : h } : undefined}
    >
      <div className="wf-box-label">
        <span>{label}</span>
        {sub ? <em>{sub}</em> : null}
      </div>
      {children}
    </div>
  );
}

function WireShell({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--shell ${compact ? 'wf-art--compact' : ''}`}>
      <div className="wf-shell">
        <WBox label="SideNav" sub="modules" className="wf-shell-nav" h={compact ? 120 : 220}>
          <div className="wf-lines">
            <i />
            <i data-on="true" />
            <i />
            <i />
            <i />
          </div>
        </WBox>
        <div className="wf-shell-main">
          <WBox label="Topbar" sub="brand · ⌘K · user" className="wf-shell-top" h={36} />
          <WBox label="Outlet" sub="→ 1 page frame" className="wf-shell-out" h={compact ? 80 : 160}>
            <div className="wf-ghost-grid">
              <span />
              <span />
              <span />
            </div>
          </WBox>
        </div>
      </div>
    </div>
  );
}

function WireDashboard({ compact, role }: { compact?: boolean; role?: 'sale' | 'gv' | 'base' }) {
  const r = role ?? 'base';
  return (
    <div className={`wf-art wf-art--dash ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="title + subtitle" sub={r === 'sale' ? 'Sale cockpit' : r === 'gv' ? 'GV cockpit' : 'DashboardPage'} h={44} />
      <div className="wf-row wf-row--chips">
        {(r === 'gv'
          ? ['Điểm danh', 'Chấm bài', 'Nhật ký', 'Chấm công']
          : r === 'sale'
            ? ['CRM', 'Xếp lớp', 'Chấm công', 'Đổi thưởng']
            : ['Chip', 'Chip', 'Chip']
        ).map((c) => (
          <span key={c} className="wf-chip">
            {c}
          </span>
        ))}
      </div>
      <div className="wf-row wf-row--metrics">
        <WBox label="Metric" h={compact ? 48 : 64} />
        <WBox label="Metric" h={compact ? 48 : 64} />
        <WBox label="Metric" h={compact ? 48 : 64} />
        {!compact ? <WBox label="Metric" h={64} /> : null}
      </div>
      <div className="wf-dash-split">
        <WBox
          label="primary 1.4fr"
          sub={r === 'gv' ? 'Chấm bài queue' : r === 'sale' ? 'Ghi danh O4' : 'WorkInbox'}
          h={compact ? 80 : 140}
        >
          <div className="wf-lines wf-lines--wide">
            <i />
            <i />
            <i />
          </div>
        </WBox>
        <WBox
          label="secondary 1fr"
          sub={r === 'gv' ? 'Lịch dạy' : r === 'sale' ? 'Pipeline' : 'Context'}
          h={compact ? 80 : 140}
        >
          <div className="wf-funnel-mini">
            <i style={{ width: '90%' }} />
            <i style={{ width: '70%' }} />
            <i style={{ width: '45%' }} />
          </div>
        </WBox>
      </div>
    </div>
  );
}

function WireList({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--list ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="ControlBar (sticky)" className="wf-control" h={compact ? 90 : 120}>
        <div className="wf-control-stack">
          <div className="wf-control-head">
            <span className="wf-line wf-line--title" />
            <span className="wf-chip wf-chip--cta">+ Primary</span>
          </div>
          <div className="wf-control-filters">
            <span className="wf-field" />
            <span className="wf-field wf-field--sm" />
            <span className="wf-field wf-field--sm" />
          </div>
          {!compact ? (
            <div className="wf-control-foot">
              <span className="wf-line wf-line--sm" />
              <span className="wf-line wf-line--sm" />
            </div>
          ) : null}
        </div>
      </WBox>
      <WBox label="List body" sub="DataTable · selection · rows" h={compact ? 90 : 160}>
        <div className="wf-table">
          <div className="wf-table-head">
            <i className="wf-chk" />
            <span />
            <span />
            <span />
          </div>
          {[1, 2, 3, 4].slice(0, compact ? 2 : 4).map((n) => (
            <div key={n} className="wf-table-row">
              <i className="wf-chk" />
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </WBox>
    </div>
  );
}

function WireDetail({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--detail ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="PageHeader" sub="breadcrumbs only — no dual h1" h={36}>
        <div className="wf-crumbs">
          <span>Module</span>
          <span>/</span>
          <span>List</span>
          <span>/</span>
          <strong>Record</strong>
        </div>
      </WBox>
      <WBox label="EntityHeader" sub="avatar · h1 · badges · 1 CTA" h={compact ? 56 : 72}>
        <div className="wf-entity">
          <i className="wf-avatar" />
          <div className="wf-entity-text">
            <span className="wf-line wf-line--title" />
            <span className="wf-line wf-line--sm" />
          </div>
          <span className="wf-chip">badge</span>
          <span className="wf-chip wf-chip--cta">Action</span>
        </div>
      </WBox>
      <WBox label="summary?" sub="HighlightStrip · Workflow · StatActions" h={compact ? 40 : 56}>
        <div className="wf-row wf-row--metrics">
          <span className="wf-stat" />
          <span className="wf-stat" />
          <span className="wf-stat" />
          <span className="wf-stat" />
        </div>
      </WBox>
      <div className="wf-tabs">
        <span data-on="true">Chi tiết</span>
        <span>Liên quan</span>
        <span>Hoạt động</span>
      </div>
      <div className={`wf-detail-body ${compact ? '' : 'wf-detail-body--split'}`}>
        <WBox label="body stack | split" sub="SectionBlock + KeyValueList" h={compact ? 70 : 120}>
          <div className="wf-lines wf-lines--wide">
            <i />
            <i />
            <i />
          </div>
        </WBox>
        {!compact ? (
          <WBox label="related / timeline" h={120}>
            <div className="wf-lines">
              <i />
              <i />
              <i />
            </div>
          </WBox>
        ) : null}
      </div>
    </div>
  );
}

function WireForm({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--form ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="PageHeader" h={36} />
      <div className="wf-steps">
        {['1 Học viên', '2 Gói', '3 TT', '4 XN'].map((s, i) => (
          <span key={s} data-on={i === 1 ? 'true' : undefined}>
            {s}
          </span>
        ))}
      </div>
      <WBox label="fields · SectionBlock" h={compact ? 90 : 140}>
        <div className="wf-form-grid">
          <span className="wf-field" />
          <span className="wf-field" />
          <span className="wf-field wf-field--full" />
          <span className="wf-field" />
          <span className="wf-field" />
        </div>
      </WBox>
      <div className="wf-sticky-actions">
        <span className="wf-chip">Cancel</span>
        <span className="wf-chip wf-chip--cta">Lưu / Tiếp</span>
      </div>
    </div>
  );
}

function WireSettings({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--settings ${compact ? 'wf-art--compact' : ''}`}>
      <div className="wf-settings">
        <WBox label="rail" sub="nav" className="wf-settings-rail" h={compact ? 120 : 200}>
          <div className="wf-lines">
            <i data-on="true" />
            <i />
            <i />
            <i />
          </div>
        </WBox>
        <div className="wf-settings-main">
          <WBox label="title" h={36} />
          <WBox label="SettingsSection" h={compact ? 70 : 100}>
            <div className="wf-setting-row" />
            <div className="wf-setting-row" />
            <div className="wf-setting-row" />
          </WBox>
        </div>
      </div>
    </div>
  );
}

function WireCalendar({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--cal ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="ControlBar" sub="tuần · GV · phòng" h={44} />
      <div className="wf-cal-grid">
        {['T2', 'T3', 'T4', 'T5', 'T6'].map((d) => (
          <div key={d} className="wf-cal-col">
            <div className="wf-cal-day">{d}</div>
            <div className="wf-session" />
            <div className="wf-session wf-session--muted" />
            {!compact ? <div className="wf-session" /> : null}
          </div>
        ))}
      </div>
      <div className="wf-session-legend">
        SessionCard: time · title · status · CTA (P0)
      </div>
    </div>
  );
}

function WirePipeline({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--pipe ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="ControlBar" sub="CRM pipeline" h={40} />
      <WBox label="StageFunnel / FunnelBar" sub="O1 → O5" h={compact ? 48 : 64}>
        <div className="wf-funnel">
          <i style={{ flex: 5 }} />
          <i style={{ flex: 4 }} />
          <i style={{ flex: 3 }} />
          <i style={{ flex: 2 }} />
          <i style={{ flex: 1.2 }} />
        </div>
      </WBox>
      <WBox label="Opportunity table" h={compact ? 80 : 120}>
        <div className="wf-table">
          <div className="wf-table-head">
            <span />
            <span />
            <span />
          </div>
          {[1, 2, 3].map((n) => (
            <div key={n} className="wf-table-row">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </WBox>
    </div>
  );
}

function WireOdooControlPanel({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--odoo-cp ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="o_control_panel (sticky shrink-0)" sub="Odoo 19 · control_panel.xml" h={compact ? 72 : 100}>
        <div className="wf-odoo-cp">
          <div className="wf-odoo-cp-left">
            <span className="wf-chip wf-chip--cta">New</span>
            <span className="wf-crumbs">
              <span>App</span>
              <span>/</span>
              <strong>Model</strong>
            </span>
          </div>
          <div className="wf-odoo-cp-center">
            <span className="wf-field" style={{ minWidth: 120 }}>
              SearchBar
            </span>
          </div>
          <div className="wf-odoo-cp-right">
            <span className="wf-line wf-line--sm" style={{ width: 48 }} />
            <span className="wf-chip">view*</span>
          </div>
        </div>
      </WBox>
      <WBox label="o_content (scroll)" sub="list / kanban / calendar body" h={compact ? 90 : 140}>
        <div className="wf-table">
          <div className="wf-table-head">
            <i className="wf-chk" />
            <span />
            <span />
          </div>
          {[1, 2, 3].map((n) => (
            <div key={n} className="wf-table-row">
              <i className="wf-chk" />
              <span />
              <span />
            </div>
          ))}
        </div>
      </WBox>
      <div className="wf-session-legend">
        CMC maps: left→PageHeader · center→FilterBar · right→ListPagination · selection→BulkActionBar
      </div>
    </div>
  );
}

function WireOdooFormSheet({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--odoo-form ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="crumbs" sub="PageHeader only" h={32} />
      <WBox label="oe_title / EntityHeader" sub="h1 · badges · 1 CTA" h={compact ? 48 : 56}>
        <div className="wf-entity">
          <i className="wf-avatar" />
          <div className="wf-entity-text">
            <span className="wf-line wf-line--title" />
            <span className="wf-line wf-line--sm" />
          </div>
          <span className="wf-chip wf-chip--cta">Action</span>
        </div>
      </WBox>
      <WBox label="statusbar" sub="WorkflowStatusbar" h={28} />
      <WBox label="button_box" sub="StatActions" h={compact ? 36 : 44}>
        <div className="wf-row wf-row--metrics">
          <span className="wf-stat" />
          <span className="wf-stat" />
          <span className="wf-stat" />
          <span className="wf-stat" />
        </div>
      </WBox>
      {!compact ? <WBox label="highlight" sub="HighlightStrip" h={40} /> : null}
      <WBox label="sheet groups" sub="SectionBlock + KeyValueList" h={compact ? 56 : 80}>
        <div className="wf-lines wf-lines--wide">
          <i />
          <i />
        </div>
      </WBox>
      <div className="wf-tabs">
        <span data-on="true">Notebook</span>
        <span>Related</span>
        <span>Activity*</span>
      </div>
      <div className="wf-session-legend">*chatter = optional tab · not side panel default</div>
    </div>
  );
}

function WireListBulk({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art wf-art--list-bulk ${compact ? 'wf-art--compact' : ''}`}>
      <WBox label="ControlBar header" h={36} />
      <WBox label="BulkActionBar (selection > 0)" sub="count · clear · actions" h={36}>
        <div className="wf-control-head">
          <span className="wf-chip">3 đã chọn</span>
          <span className="wf-chip">Sao chép…</span>
        </div>
      </WBox>
      <WBox label="DataTable selectedIds" h={compact ? 80 : 120}>
        <div className="wf-table">
          <div className="wf-table-head">
            <i className="wf-chk" />
            <span />
            <span />
          </div>
          {[1, 2].map((n) => (
            <div key={n} className="wf-table-row">
              <i className="wf-chk" />
              <span />
              <span />
            </div>
          ))}
        </div>
      </WBox>
      <WBox label="ListPagination" h={28} />
    </div>
  );
}

function WireChatter({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art ${compact ? 'wf-art--compact' : ''}`}>
      <div className="wf-tabs">
        <span>Chi tiết</span>
        <span data-on="true">Hoạt động</span>
      </div>
      <WBox label="ActivityTimeline" sub="chatter port · empty OK" h={compact ? 100 : 160}>
        <div className="wf-lines wf-lines--wide">
          <i />
          <i />
          <i />
        </div>
      </WBox>
    </div>
  );
}

function WireMasterDetail({ compact }: { compact?: boolean }) {
  return (
    <div className={`wf-art ${compact ? 'wf-art--compact' : ''}`}>
      <div className="wf-detail-body wf-detail-body--split">
        <WBox label="master queue" h={compact ? 120 : 180}>
          <div className="wf-lines">
            <i data-on="true" />
            <i />
            <i />
          </div>
        </WBox>
        <WBox label="detail pane" h={compact ? 120 : 180}>
          <div className="wf-lines wf-lines--wide">
            <i />
            <i />
          </div>
        </WBox>
      </div>
    </div>
  );
}

function WireCanvas({ id, compact }: { id: WireId; compact?: boolean }) {
  switch (id) {
    case 'shell':
      return <WireShell compact={compact} />;
    case 'dashboard':
      return <WireDashboard compact={compact} />;
    case 'list':
      return <WireList compact={compact} />;
    case 'list-bulk':
      return <WireListBulk compact={compact} />;
    case 'detail':
      return <WireDetail compact={compact} />;
    case 'odoo-control-panel':
      return <WireOdooControlPanel compact={compact} />;
    case 'odoo-form-sheet':
      return <WireOdooFormSheet compact={compact} />;
    case 'chatter-tab':
      return <WireChatter compact={compact} />;
    case 'form':
      return <WireForm compact={compact} />;
    case 'settings':
      return <WireSettings compact={compact} />;
    case 'calendar':
      return <WireCalendar compact={compact} />;
    case 'pipeline':
      return <WirePipeline compact={compact} />;
    case 'master-detail':
      return <WireMasterDetail compact={compact} />;
    case 'cockpit-sale':
      return <WireDashboard compact={compact} role="sale" />;
    case 'cockpit-gv':
      return <WireDashboard compact={compact} role="gv" />;
    default:
      return null;
  }
}

export function WireframeExplorer() {
  const [active, setActive] = useState<WireId>('dashboard');
  const [compare, setCompare] = useState<WireId | null>('list');
  const [showLabels, setShowLabels] = useState(true);

  const meta = useMemo(() => WIREFRAMES.find((w) => w.id === active)!, [active]);
  const compareMeta = compare ? WIREFRAMES.find((w) => w.id === compare) : null;

  return (
    <div className="wf-explorer">
      <div className="wf-toolbar">
        <p className="wf-lead">
          <strong>Wireframe Soft Ops + Odoo grammar</strong> — low-fi theo PAGE-FRAMES / VIEW-GRAMMAR
          + xia Odoo 19 (<code>web.ControlPanel</code> · form sheet). Port layout slots only — không
          OWL/purple. So sánh: <code>list</code> vs <code>odoo-control-panel</code>,{' '}
          <code>detail</code> vs <code>odoo-form-sheet</code>.
        </p>
        <div className="wf-toolbar-actions">
          <button
            type="button"
            className="wf-toggle"
            aria-pressed={showLabels}
            onClick={() => setShowLabels((v) => !v)}
          >
            {showLabels ? 'Ẩn nhãn slot' : 'Hiện nhãn slot'}
          </button>
          <button
            type="button"
            className="wf-toggle"
            aria-pressed={compare != null}
            onClick={() => setCompare((c) => (c ? null : active === 'list' ? 'detail' : 'list'))}
          >
            {compare ? 'Tắt so sánh' : 'So sánh 2 khung'}
          </button>
        </div>
      </div>

      <div className="wf-picker" role="listbox" aria-label="Chọn khung wireframe">
        {WIREFRAMES.map((w) => (
          <button
            key={w.id}
            type="button"
            role="option"
            aria-selected={active === w.id}
            className="wf-pick"
            data-active={active === w.id ? 'true' : 'false'}
            data-compare={compare === w.id ? 'true' : 'false'}
            onClick={() => setActive(w.id)}
            onDoubleClick={() => setCompare(w.id === active ? null : w.id)}
          >
            <div className={`wf-pick-preview ${showLabels ? '' : 'wf-hide-labels'}`}>
              <WireCanvas id={w.id} compact />
            </div>
            <div className="wf-pick-meta">
              <strong>{w.name}</strong>
              <span>{w.component}</span>
            </div>
          </button>
        ))}
      </div>

      <div className={`wf-stage-wrap ${compare ? 'wf-stage-wrap--compare' : ''}`}>
        <div className="wf-stage">
          <div className="wf-stage-head">
            <div>
              <h3>{meta.name}</h3>
              <p>
                <code>{meta.component}</code> · {meta.density} · {meta.doc}
              </p>
            </div>
            <button
              type="button"
              className="wf-toggle"
              onClick={() => setCompare(meta.id === compare ? null : meta.id)}
            >
              {compare === meta.id ? 'Đang so sánh' : 'Làm cột so sánh'}
            </button>
          </div>
          <div className={`wf-stage-art ${showLabels ? '' : 'wf-hide-labels'}`}>
            <WireCanvas id={meta.id} />
          </div>
        </div>

        {compare && compareMeta ? (
          <div className="wf-stage">
            <div className="wf-stage-head">
              <div>
                <h3>{compareMeta.name}</h3>
                <p>
                  <code>{compareMeta.component}</code> · {compareMeta.doc}
                </p>
              </div>
              <div className="wf-compare-select">
                {WIREFRAMES.filter((w) => w.id !== active).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="wf-mini"
                    data-on={compare === w.id ? 'true' : 'false'}
                    onClick={() => setCompare(w.id)}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
            <div className={`wf-stage-art ${showLabels ? '' : 'wf-hide-labels'}`}>
              <WireCanvas id={compare} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="wf-spec">
        <div className="wf-spec-card">
          <h4>Slots</h4>
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Bắt buộc</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {meta.slots.map((s) => (
                <tr key={s.name}>
                  <td>
                    <code>{s.name}</code>
                  </td>
                  <td>{s.required ? 'Có' : 'Tuỳ'}</td>
                  <td>{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wf-spec-card">
          <h4>Rules</h4>
          <ul>
            {meta.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <h4 style={{ marginTop: 12 }}>Routes / ví dụ</h4>
          <ul>
            {meta.routes.map((r) => (
              <li key={r}>
                <code>{r}</code>
              </li>
            ))}
          </ul>
        </div>
        <div className="wf-spec-card">
          <h4>ASCII (docs)</h4>
          <pre className="wf-ascii">{asciiFor(meta.id)}</pre>
        </div>
      </div>
    </div>
  );
}

function asciiFor(id: WireId): string {
  switch (id) {
    case 'shell':
      return `┌ SideNav ┬ Topbar ────────────┐
│         ├ Outlet (1 frame)   │
│         │                    │
└─────────┴────────────────────┘`;
    case 'dashboard':
    case 'cockpit-sale':
    case 'cockpit-gv':
      return `[ Title + subtitle ]
[ Shortcut chips ]
[ Metrics 0–4 ]
[ Primary 1.4fr | Secondary 1fr ]`;
    case 'list':
      return `ControlBar
  header  PageHeader + CTA
  filters FilterBar?
  controlFooter  Pager · Bulk?
────────
List body: DataTable | Empty`;
    case 'list-bulk':
      return `header
BulkActionBar (n selected)
DataTable checkboxes
ListPagination`;
    case 'detail':
      return `PageHeader breadcrumbs
EntityHeader? (entity domain)
summary? highlight | workflow | stats
tabs?    CmcTabs
body?    stack | split`;
    case 'odoo-control-panel':
      return `o_control_panel sticky
  left: New + breadcrumbs
  center: Search OR selection
  right: pager + view*
o_content scroll → table
*CMC defers view switcher`;
    case 'odoo-form-sheet':
      return `crumbs
EntityHeader (oe_title)
WorkflowStatusbar
StatActions (button_box)
Highlight?
sheet SectionBlock
notebook CmcTabs`;
    case 'chatter-tab':
      return `CmcTabs [ … | Hoạt động ]
  ActivityTimeline
  EmptyState?`;
    case 'form':
      return `PageHeader
ProgressSteps? (children)
fields SectionBlock
ResultPanel?
──────── sticky actions`;
    case 'settings':
      return `DetailPage header
┌ SettingsShell rail ┬ main ──┐
│ nav                │ sections│
└────────────────────┴─────────┘`;
    case 'calendar':
      return `ControlBar (week filters)
┌ T2 ┬ T3 ┬ T4 ┬ … ┐
│ card│card│card│   │
└────┴────┴────┴───┘`;
    case 'pipeline':
      return `ControlBar
StageFunnel O1→O5
Opportunity list (not board)`;
    case 'master-detail':
      return `┌ master queue │ detail pane ┐
│ items        │ work surface│
└──────────────┴─────────────┘`;
    default:
      return '';
  }
}

export default WireframeExplorer;
