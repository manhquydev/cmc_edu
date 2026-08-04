/**
 * Design Lab — Style Explorer
 * Gallery of alternate visual languages for CMC EDU ERP evaluation.
 * Themes are scoped CSS only; production tokens stay unchanged.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import './design-lab-styles.css';

export type StyleId =
  | 'soft-ops'
  | 'cool-saas'
  | 'dense-ops'
  | 'polaris'
  | 'primer'
  | 'cal-clean'
  | 'edu-warm'
  | 'ink-minimal'
  | 'night-ops'
  | 'slate-enterprise'
  | 'carbon'
  | 'ant'
  | 'airbnb';

export type StyleFamily =
  | 'current'
  | 'ops'
  | 'product'
  | 'edu'
  | 'dark'
  | 'minimal'
  | 'enterprise'
  | 'xia';

export interface DesignStyle {
  id: StyleId;
  name: string;
  family: StyleFamily;
  lead: string;
  density: 'airy' | 'balanced' | 'dense';
  mood: string[];
  erpFit: 'high' | 'medium' | 'explore';
  risks: string[];
  goodFor: string[];
  swatches: string[];
  source?: string;
}

const STORAGE_KEY = 'cmc-design-lab-preferred-style';

export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: 'soft-ops',
    name: 'Soft Ops (hiện tại)',
    family: 'current',
    lead: 'Warm paper, một brand blue, radius 12/16/20 — baseline CMC đang chạy.',
    density: 'balanced',
    mood: ['warm', 'premium', 'ops'],
    erpFit: 'high',
    risks: ['Có thể “mềm” quá so với ERP thuần bảng'],
    goodFor: ['ERP + LMS cùng brand', 'Cockpit role', 'Detail record'],
    swatches: ['#F5F3EE', '#FFFFFF', '#0071E3', '#1D1D1F', '#E0DDD5'],
    source: 'packages/ui tokens',
  },
  {
    id: 'cool-saas',
    name: 'Cool SaaS',
    family: 'product',
    lead: 'Xám lạnh, radius gọn 8/12, elevation mỏng — vibe Linear / modern product.',
    density: 'balanced',
    mood: ['cool', 'product', 'sharp'],
    erpFit: 'medium',
    risks: ['Lạnh hơn brand edu; dễ lệch “tool SaaS”'],
    goodFor: ['CRM pipeline', 'Sale cockpit', 'Command feel'],
    swatches: ['#F4F4F5', '#FFFFFF', '#0A84FF', '#0A0A0A', '#E4E4E7'],
    source: 'Linear / Vercel-inspired',
  },
  {
    id: 'dense-ops',
    name: 'Dense Ops',
    family: 'ops',
    lead: 'Bảng-first, radius 4, row 32px, border rõ — gần Odoo / ERP cổ điển.',
    density: 'dense',
    mood: ['dense', 'table', 'ops'],
    erpFit: 'high',
    risks: ['Ít premium; mobile/LMS sẽ cần skin riêng'],
    goodFor: ['List ops', 'Finance table', 'Power user'],
    swatches: ['#F8F9FA', '#FFFFFF', '#714B67', '#212529', '#CED4DA'],
    source: 'Odoo / classic ERP',
  },
  {
    id: 'polaris',
    name: 'Polaris Commerce',
    family: 'ops',
    lead: 'Shopify Polaris: green commerce, surface sạch, admin merchant trust.',
    density: 'balanced',
    mood: ['commerce', 'trust', 'clean'],
    erpFit: 'high',
    risks: ['Green brand ≠ CMC blue — cần đổi accent nếu adopt'],
    goodFor: ['Receipt / refund', 'Settings', 'List + filters'],
    swatches: ['#F6F6F7', '#FFFFFF', '#008060', '#202223', '#C9CCCF'],
    source: 'Shopify Polaris',
  },
  {
    id: 'primer',
    name: 'Primer DevOps',
    family: 'ops',
    lead: 'GitHub Primer: cool gray, blue link, table dense, engineer-native.',
    density: 'dense',
    mood: ['dev', 'cool', 'dense'],
    erpFit: 'medium',
    risks: ['Cảm giác “code tool” hơn “trường học”'],
    goodFor: ['Audit log', 'Admin config', 'Tech roles'],
    swatches: ['#F6F8FA', '#FFFFFF', '#0969DA', '#1F2328', '#D0D7DE'],
    source: 'GitHub Primer',
  },
  {
    id: 'cal-clean',
    name: 'Cal Clean',
    family: 'product',
    lead: 'Trắng nhiều, spacing rộng, accent cam — scheduling / booking clarity.',
    density: 'airy',
    mood: ['airy', 'schedule', 'friendly'],
    erpFit: 'medium',
    risks: ['Quá thưa cho list 50+ dòng; orange CTA đổi brand'],
    goodFor: ['Lịch dạy', 'Parent meeting', 'Booking flows'],
    swatches: ['#FFFFFF', '#F9FAFB', '#FF7A45', '#111827', '#E5E7EB'],
    source: 'Cal.com',
  },
  {
    id: 'edu-warm',
    name: 'Edu Warm',
    family: 'edu',
    lead: 'Kem đào, coral soft, radius lớn — gần LMS phụ huynh / giáo dục cảm xúc.',
    density: 'balanced',
    mood: ['edu', 'warm', 'friendly'],
    erpFit: 'medium',
    risks: ['Sale/finance có thể thấy “trẻ con”; cần tone-down ops screens'],
    goodFor: ['LMS parent', 'Student detail', 'Engagement gifts'],
    swatches: ['#FBF6F0', '#FFFDFB', '#E85D4C', '#2C2420', '#E8D9CB'],
    source: 'Education product direction',
  },
  {
    id: 'ink-minimal',
    name: 'Ink Minimal',
    family: 'minimal',
    lead: 'Đen–trắng, radius 0, ít shadow — editorial / high-contrast restraint.',
    density: 'balanced',
    mood: ['mono', 'editorial', 'sharp'],
    erpFit: 'explore',
    risks: ['Khó status color; lạnh với trẻ em / parent app'],
    goodFor: ['Reports print-ish', 'Executive brief', 'Design contrast check'],
    swatches: ['#FAFAFA', '#FFFFFF', '#111111', '#333333', '#DDDDDD'],
    source: 'Swiss / editorial',
  },
  {
    id: 'night-ops',
    name: 'Night Ops',
    family: 'dark',
    lead: 'Dark command center — ca tối, GV chấm bài, ops dashboard đêm.',
    density: 'balanced',
    mood: ['dark', 'focus', 'ops'],
    erpFit: 'explore',
    risks: ['Cần full token dark pass; status contrast QA'],
    goodFor: ['Night shift', 'Grading long session', 'Power cockpit'],
    swatches: ['#0B1220', '#111827', '#3B82F6', '#F1F5F9', '#334155'],
    source: 'Dark product systems',
  },
  {
    id: 'slate-enterprise',
    name: 'Slate Enterprise',
    family: 'ops',
    lead: 'Atlassian-ish: slate blue, radius 3, medium density enterprise suite.',
    density: 'dense',
    mood: ['enterprise', 'slate', 'suite'],
    erpFit: 'high',
    risks: ['Generic “Jira”; ít character edu'],
    goodFor: ['Multi-module suite', 'HR / KPI', 'Workflow tickets'],
    swatches: ['#F4F5F7', '#FFFFFF', '#0052CC', '#172B4D', '#DFE1E6'],
    source: 'Atlassian Design (ADS) · atlassian.design/llms.txt',
  },
  {
    id: 'carbon',
    name: 'IBM Carbon',
    family: 'enterprise',
    lead: 'Carbon G10: #0f62fe, gray canvas, radius 0, data-table / UI Shell first.',
    density: 'dense',
    mood: ['enterprise', 'ibm', 'dense'],
    erpFit: 'high',
    risks: ['Thẩm mỹ IBM vuông; brand blue ≠ CMC'],
    goodFor: ['Data table', 'Filtering patterns', 'Side panel detail'],
    swatches: ['#F4F4F4', '#FFFFFF', '#0F62FE', '#161616', '#E0E0E0'],
    source: 'carbondesignsystem.com/llms.txt · IBM Carbon',
  },
  {
    id: 'ant',
    name: 'Ant Design Admin',
    family: 'enterprise',
    lead: 'Ant v6 design.md: #1677FF, layout #F5F5F5, control 32px, radius 6/8.',
    density: 'dense',
    mood: ['admin', 'enterprise', 'flat'],
    erpFit: 'high',
    risks: ['Default “Chinese SaaS admin” look nếu không re-token'],
    goodFor: ['List→filter→detail', 'Form dense', 'ProTable ops'],
    swatches: ['#F5F5F5', '#FFFFFF', '#1677FF', '#1F1F1F', '#D9D9D9'],
    source: 'ant.design/design.md · for-agents',
  },
  {
    id: 'airbnb',
    name: 'Airbnb Warm',
    family: 'xia',
    lead: 'Rausch coral #FF5A5F, white canvas, pill search, hospitality trust.',
    density: 'airy',
    mood: ['warm', 'consumer', 'hospitality'],
    erpFit: 'explore',
    risks: ['Marketing sparsity — không fit bảng ERP dài'],
    goodFor: ['Avatar/trust', 'Parent-facing LMS', 'Highlight identity'],
    swatches: ['#FFFFFF', '#F7F7F7', '#FF5A5F', '#222222', '#DDDDDD'],
    source: '~/Downloads/design/airbnb.com-DESIGN.md',
  },
];

const FAMILY_FILTERS: { id: StyleFamily | 'all'; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'current', label: 'Hiện tại' },
  { id: 'enterprise', label: 'Enterprise DS' },
  { id: 'xia', label: 'Xia web' },
  { id: 'ops', label: 'Ops / ERP' },
  { id: 'product', label: 'Product SaaS' },
  { id: 'edu', label: 'Edu' },
  { id: 'dark', label: 'Dark' },
  { id: 'minimal', label: 'Minimal' },
];

type ViewMode = 'gallery' | 'stage' | 'compare';

function loadPreferred(): StyleId | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && DESIGN_STYLES.some((s) => s.id === v)) return v as StyleId;
  } catch {
    /* ignore */
  }
  return null;
}

/** Layout archetype — structural differences, not only color tokens. */
export type MockLayout =
  | 'soft-cockpit'
  | 'saas-command'
  | 'odoo-list'
  | 'polaris-admin'
  | 'primer-issues'
  | 'cal-booking'
  | 'edu-cards'
  | 'ink-editorial'
  | 'night-dash'
  | 'jira-board'
  | 'carbon-shell'
  | 'ant-pro'
  | 'airbnb-browse';

export const STYLE_LAYOUT: Record<StyleId, MockLayout> = {
  'soft-ops': 'soft-cockpit',
  'cool-saas': 'saas-command',
  'dense-ops': 'odoo-list',
  polaris: 'polaris-admin',
  primer: 'primer-issues',
  'cal-clean': 'cal-booking',
  'edu-warm': 'edu-cards',
  'ink-minimal': 'ink-editorial',
  'night-ops': 'night-dash',
  'slate-enterprise': 'jira-board',
  carbon: 'carbon-shell',
  ant: 'ant-pro',
  airbnb: 'airbnb-browse',
};

const LAYOUT_FINGERPRINT: Record<MockLayout, string> = {
  'soft-cockpit': 'Warm cards · soft radius · metric strip + list',
  'saas-command': 'No side nav · top command · bento KPIs',
  'odoo-list': 'Breadcrumb · view tabs · dense checkbox table',
  'polaris-admin': 'Dark labeled rail · bulk bar · index table',
  'primer-issues': 'Repo header · issue rows · status dots',
  'cal-booking': 'Week strip + booking form (split)',
  'edu-cards': 'Student card grid · avatar trust',
  'ink-editorial': 'Huge type · hairline · monochrome',
  'night-dash': 'Dark canvas · glow KPIs · activity feed',
  'jira-board': 'Project rail · ticket keys · blue links',
  'carbon-shell': 'Black header+rail · 0 radius · structured table',
  'ant-pro': 'Blue menu · breadcrumb · ProTable admin',
  'airbnb-browse': 'Pill search · photo cards · hospitality',
};

function MockApp({ styleId, compact }: { styleId: StyleId; compact?: boolean }) {
  const layout = STYLE_LAYOUT[styleId];
  const fp = LAYOUT_FINGERPRINT[layout];

  return (
    <div
      className={`dl-mock dl-mock--${layout}`}
      data-layout={layout}
      aria-hidden={compact ? true : undefined}
    >
      {!compact ? <div className="dl-mock-fp">{fp}</div> : null}

      {layout === 'soft-cockpit' ? <MockSoftCockpit /> : null}
      {layout === 'saas-command' ? <MockSaasCommand /> : null}
      {layout === 'odoo-list' ? <MockOdooList /> : null}
      {layout === 'polaris-admin' ? <MockPolarisAdmin /> : null}
      {layout === 'primer-issues' ? <MockPrimerIssues /> : null}
      {layout === 'cal-booking' ? <MockCalBooking /> : null}
      {layout === 'edu-cards' ? <MockEduCards /> : null}
      {layout === 'ink-editorial' ? <MockInkEditorial /> : null}
      {layout === 'night-dash' ? <MockNightDash /> : null}
      {layout === 'jira-board' ? <MockJiraBoard /> : null}
      {layout === 'carbon-shell' ? <MockCarbonShell /> : null}
      {layout === 'ant-pro' ? <MockAntPro /> : null}
      {layout === 'airbnb-browse' ? <MockAirbnbBrowse /> : null}
    </div>
  );
}

function MockSoftCockpit() {
  return (
    <div className="dl-mock-fill dl-mock-shell">
      <aside className="dl-mock-nav dl-mock-nav--icon">
        <span className="dl-mock-nav-dot" data-active="true" />
        <span className="dl-mock-nav-dot" />
        <span className="dl-mock-nav-dot" />
        <span className="dl-mock-nav-dot" />
      </aside>
      <div className="dl-mock-main">
        <div className="dl-mock-topbar">
          <div>
            <div className="dl-mock-topbar-title">Tổng quan · Sale</div>
            <div className="dl-mock-topbar-meta">Warm paper · Soft Ops baseline</div>
          </div>
          <div className="dl-mock-actions">
            <span className="dl-mock-btn dl-mock-btn--ghost">Lọc</span>
            <span className="dl-mock-btn dl-mock-btn--primary">+ Cơ hội</span>
          </div>
        </div>
        <div className="dl-mock-body">
          <div className="dl-mock-metrics">
            <div className="dl-mock-metric">
              <div className="dl-mock-metric-label">Pipeline</div>
              <div className="dl-mock-metric-value">128</div>
              <div className="dl-mock-metric-hint">+12 tuần này</div>
            </div>
            <div className="dl-mock-metric">
              <div className="dl-mock-metric-label">Chờ test</div>
              <div className="dl-mock-metric-value">18</div>
              <div className="dl-mock-metric-hint">3 hôm nay</div>
            </div>
            <div className="dl-mock-metric">
              <div className="dl-mock-metric-label">Doanh thu</div>
              <div className="dl-mock-metric-value">42M</div>
              <div className="dl-mock-metric-hint">Tháng 8</div>
            </div>
          </div>
          <div className="dl-mock-panel">
            <div className="dl-mock-panel-head">
              <strong>Cơ hội mở</strong>
              <span className="dl-mock-badge dl-mock-badge--muted">24</span>
            </div>
            <div className="dl-mock-filters">
              <span className="dl-mock-input">Tìm học viên…</span>
              <span className="dl-mock-input" style={{ flex: '0 0 100px' }}>
                Stage
              </span>
              <span className="dl-mock-btn dl-mock-btn--ghost">Áp dụng</span>
            </div>
            <table className="dl-mock-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Stage</th>
                  <th>GV</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nguyễn Minh An</td>
                  <td>
                    <span className="dl-mock-badge dl-mock-badge--warn">Test</span>
                  </td>
                  <td>Cô Lan</td>
                </tr>
                <tr>
                  <td>Trần Bảo Châu</td>
                  <td>
                    <span className="dl-mock-badge dl-mock-badge--ok">Đóng phí</span>
                  </td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Lê Gia Hân</td>
                  <td>
                    <span className="dl-mock-badge dl-mock-badge--muted">Lead</span>
                  </td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockSaasCommand() {
  return (
    <div className="dl-mock-fill dl-mock-saas">
      <div className="dl-mock-saas-top">
        <span className="dl-mock-saas-logo">cmc</span>
        <span className="dl-mock-saas-search">⌘K Tìm mọi thứ…</span>
        <span className="dl-mock-saas-user">MQ</span>
      </div>
      <div className="dl-mock-body">
        <div className="dl-mock-saas-hero">
          <div>
            <div className="dl-mock-kicker">Workspace</div>
            <div className="dl-mock-topbar-title" style={{ fontSize: 22 }}>
              Pipeline hôm nay
            </div>
          </div>
          <span className="dl-mock-btn dl-mock-btn--primary">New deal</span>
        </div>
        <div className="dl-mock-bento">
          <div className="dl-mock-bento-main">
            <div className="dl-mock-metric-label">Open pipeline</div>
            <div className="dl-mock-metric-value">128</div>
            <div className="dl-mock-spark">
              <i style={{ height: '40%' }} />
              <i style={{ height: '65%' }} />
              <i style={{ height: '50%' }} />
              <i style={{ height: '90%' }} />
              <i style={{ height: '70%' }} />
            </div>
          </div>
          <div className="dl-mock-bento-side">
            <div className="dl-mock-bento-tile">
              <strong>18</strong>
              <span>Chờ test</span>
            </div>
            <div className="dl-mock-bento-tile">
              <strong>42M</strong>
              <span>Doanh thu</span>
            </div>
          </div>
        </div>
        <div className="dl-mock-panel dl-mock-panel--flat">
          <div className="dl-mock-row-item">
            <span className="dl-mock-dot dl-mock-dot--blue" />
            <span className="dl-mock-row-title">Nguyễn Minh An</span>
            <span className="dl-mock-row-meta">Test · 14:00</span>
          </div>
          <div className="dl-mock-row-item">
            <span className="dl-mock-dot dl-mock-dot--green" />
            <span className="dl-mock-row-title">Trần Bảo Châu</span>
            <span className="dl-mock-row-meta">Paid</span>
          </div>
          <div className="dl-mock-row-item">
            <span className="dl-mock-dot" />
            <span className="dl-mock-row-title">Lê Gia Hân</span>
            <span className="dl-mock-row-meta">Lead</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockOdooList() {
  return (
    <div className="dl-mock-fill dl-mock-odoo">
      <div className="dl-mock-odoo-bar">
        <span className="dl-mock-odoo-app">CRM</span>
        <span>Cơ hội</span>
        <span className="dl-mock-odoo-spacer" />
        <span className="dl-mock-btn dl-mock-btn--primary">New</span>
      </div>
      <div className="dl-mock-odoo-sub">
        <span className="dl-mock-crumb">CRM / Cơ hội / Mở</span>
        <div className="dl-mock-view-tabs">
          <span data-on="true">List</span>
          <span>Kanban</span>
          <span>Pivot</span>
        </div>
      </div>
      <div className="dl-mock-odoo-search">
        <span className="dl-mock-chk" />
        <span className="dl-mock-input dl-mock-input--grow">Search…</span>
        <span className="dl-mock-chip-filter">Stage: Test</span>
        <span className="dl-mock-chip-filter">+ Filters</span>
      </div>
      <table className="dl-mock-table dl-mock-table--dense">
        <thead>
          <tr>
            <th className="dl-mock-th-chk">
              <span className="dl-mock-chk" />
            </th>
            <th>Opportunity</th>
            <th>Expected</th>
            <th>Stage</th>
            <th>Salesperson</th>
          </tr>
        </thead>
        <tbody>
          <tr data-selected="true">
            <td>
              <span className="dl-mock-chk" data-on="true" />
            </td>
            <td>Nguyễn Minh An — IELTS 5.5</td>
            <td>4.500.000</td>
            <td>Test</td>
            <td>Sale A</td>
          </tr>
          <tr>
            <td>
              <span className="dl-mock-chk" />
            </td>
            <td>Trần Bảo Châu — TOEIC</td>
            <td>6.200.000</td>
            <td>Proposition</td>
            <td>Sale B</td>
          </tr>
          <tr>
            <td>
              <span className="dl-mock-chk" />
            </td>
            <td>Lê Gia Hân — Kids</td>
            <td>3.100.000</td>
            <td>New</td>
            <td>Sale A</td>
          </tr>
          <tr>
            <td>
              <span className="dl-mock-chk" />
            </td>
            <td>Phạm Quốc Huy</td>
            <td>5.000.000</td>
            <td>Qualified</td>
            <td>Sale C</td>
          </tr>
        </tbody>
      </table>
      <div className="dl-mock-odoo-pager">1-4 / 24 · ▸</div>
    </div>
  );
}

function MockPolarisAdmin() {
  return (
    <div className="dl-mock-fill dl-mock-shell">
      <aside className="dl-mock-nav dl-mock-nav--labeled dl-mock-nav--dark">
        <div className="dl-mock-nav-brand">Polaris·CMC</div>
        <span data-active="true">Home</span>
        <span>Orders</span>
        <span>Products</span>
        <span>Customers</span>
        <span>Analytics</span>
      </aside>
      <div className="dl-mock-main">
        <div className="dl-mock-topbar">
          <div className="dl-mock-topbar-title">Customers</div>
          <span className="dl-mock-btn dl-mock-btn--primary">Add customer</span>
        </div>
        <div className="dl-mock-body">
          <div className="dl-mock-bulk">
            <span>
              <strong>2 selected</strong> · Export · Add tags
            </span>
            <span className="dl-mock-btn dl-mock-btn--ghost">More actions</span>
          </div>
          <div className="dl-mock-panel">
            <div className="dl-mock-filters">
              <span className="dl-mock-input">Filter customers</span>
              <span className="dl-mock-btn dl-mock-btn--ghost">Sort</span>
            </div>
            <table className="dl-mock-table">
              <thead>
                <tr>
                  <th>
                    <span className="dl-mock-chk" data-on="true" />
                  </th>
                  <th>Customer name</th>
                  <th>Orders</th>
                  <th>Amount spent</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="dl-mock-chk" data-on="true" />
                  </td>
                  <td>
                    <strong>Nguyễn Minh An</strong>
                    <div className="dl-mock-sub">an@email.com</div>
                  </td>
                  <td>3</td>
                  <td>4.500.000₫</td>
                </tr>
                <tr>
                  <td>
                    <span className="dl-mock-chk" data-on="true" />
                  </td>
                  <td>
                    <strong>Trần Bảo Châu</strong>
                    <div className="dl-mock-sub">chau@email.com</div>
                  </td>
                  <td>1</td>
                  <td>6.200.000₫</td>
                </tr>
                <tr>
                  <td>
                    <span className="dl-mock-chk" />
                  </td>
                  <td>
                    <strong>Lê Gia Hân</strong>
                    <div className="dl-mock-sub">han@email.com</div>
                  </td>
                  <td>0</td>
                  <td>0₫</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPrimerIssues() {
  return (
    <div className="dl-mock-fill dl-mock-primer">
      <div className="dl-mock-primer-header">
        <div className="dl-mock-primer-repo">
          <span className="dl-mock-primer-owner">cmc-edu</span>
          <span>/</span>
          <strong>admin-app</strong>
          <span className="dl-mock-badge dl-mock-badge--muted">Public</span>
        </div>
        <div className="dl-mock-primer-tabs">
          <span>Code</span>
          <span data-on="true">
            Issues <em>24</em>
          </span>
          <span>
            Pull requests <em>3</em>
          </span>
        </div>
      </div>
      <div className="dl-mock-body">
        <div className="dl-mock-primer-toolbar">
          <span className="dl-mock-input">is:open is:issue</span>
          <span className="dl-mock-btn dl-mock-btn--primary">New issue</span>
        </div>
        <div className="dl-mock-panel dl-mock-panel--flat">
          <div className="dl-mock-issue">
            <span className="dl-mock-issue-icon dl-mock-issue-icon--open" />
            <div>
              <div className="dl-mock-issue-title">Học viên không hiện sau xếp lớp</div>
              <div className="dl-mock-issue-meta">
                #1842 · opened 2h ago by sale-a · <span className="dl-mock-label">bug</span>
              </div>
            </div>
            <span className="dl-mock-issue-comments">3</span>
          </div>
          <div className="dl-mock-issue">
            <span className="dl-mock-issue-icon dl-mock-issue-icon--open" />
            <div>
              <div className="dl-mock-issue-title">Receipt print layout lệch A5</div>
              <div className="dl-mock-issue-meta">
                #1839 · opened yesterday · <span className="dl-mock-label dl-mock-label--purple">finance</span>
              </div>
            </div>
            <span className="dl-mock-issue-comments">1</span>
          </div>
          <div className="dl-mock-issue">
            <span className="dl-mock-issue-icon dl-mock-issue-icon--closed" />
            <div>
              <div className="dl-mock-issue-title">Điểm danh deep-link session</div>
              <div className="dl-mock-issue-meta">#1820 · closed by gv-lan</div>
            </div>
            <span className="dl-mock-issue-comments">8</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCalBooking() {
  return (
    <div className="dl-mock-fill dl-mock-cal">
      <div className="dl-mock-cal-left">
        <div className="dl-mock-kicker">Lịch dạy</div>
        <div className="dl-mock-topbar-title">Cô Lan · Tuần 32</div>
        <div className="dl-mock-week">
          {['T2', 'T3', 'T4', 'T5', 'T6'].map((d, i) => (
            <div key={d} className="dl-mock-day" data-on={i === 2 ? 'true' : undefined}>
              <span>{d}</span>
              <strong>{4 + i}</strong>
            </div>
          ))}
        </div>
        <div className="dl-mock-slots">
          <div className="dl-mock-slot" data-busy="true">
            08:00–09:30 · Lớp A1
          </div>
          <div className="dl-mock-slot" data-on="true">
            10:00–11:30 · Trống
          </div>
          <div className="dl-mock-slot">14:00–15:30 · Trống</div>
          <div className="dl-mock-slot" data-busy="true">
            16:00–17:30 · Lớp B2
          </div>
        </div>
      </div>
      <div className="dl-mock-cal-right">
        <div className="dl-mock-cal-card">
          <div className="dl-mock-kicker">Đặt lịch test</div>
          <div className="dl-mock-topbar-title">30 phút · Phỏng vấn</div>
          <div className="dl-mock-field">
            <label>Học viên</label>
            <span className="dl-mock-input">Nguyễn Minh An</span>
          </div>
          <div className="dl-mock-field">
            <label>Thời lượng</label>
            <div className="dl-mock-pills">
              <span>15</span>
              <span data-on="true">30</span>
              <span>45</span>
            </div>
          </div>
          <span className="dl-mock-btn dl-mock-btn--primary dl-mock-btn--block">Confirm</span>
        </div>
      </div>
    </div>
  );
}

function MockEduCards() {
  return (
    <div className="dl-mock-fill dl-mock-edu">
      <div className="dl-mock-edu-head">
        <div>
          <div className="dl-mock-kicker">Lớp của bạn</div>
          <div className="dl-mock-topbar-title">IELTS 5.5 · CS1</div>
        </div>
        <span className="dl-mock-btn dl-mock-btn--primary">Điểm danh</span>
      </div>
      <div className="dl-mock-edu-grid">
        {[
          { n: 'Minh An', s: 'Có mặt', t: 'ok' },
          { n: 'Bảo Châu', s: 'Muộn', t: 'warn' },
          { n: 'Gia Hân', s: 'Vắng', t: 'bad' },
          { n: 'Quốc Huy', s: 'Có mặt', t: 'ok' },
        ].map((x) => (
          <div key={x.n} className="dl-mock-edu-card">
            <span className="dl-mock-avatar">{x.n.slice(0, 2)}</span>
            <strong>{x.n}</strong>
            <span className={`dl-mock-badge dl-mock-badge--${x.t === 'ok' ? 'ok' : x.t === 'warn' ? 'warn' : 'muted'}`}>
              {x.s}
            </span>
          </div>
        ))}
      </div>
      <div className="dl-mock-edu-note">
        <strong>Ghi chú buổi:</strong> Ôn Writing task 2 · bài về education.
      </div>
    </div>
  );
}

function MockInkEditorial() {
  return (
    <div className="dl-mock-fill dl-mock-ink">
      <div className="dl-mock-ink-hero">
        <div className="dl-mock-kicker">Report</div>
        <h2>Doanh thu tháng 8</h2>
        <p>42.180.000₫ · 18 phiếu · 3 cơ sở</p>
      </div>
      <div className="dl-mock-ink-rule" />
      <div className="dl-mock-ink-row">
        <span>01</span>
        <strong>Nguyễn Minh An</strong>
        <em>4.500.000</em>
      </div>
      <div className="dl-mock-ink-row">
        <span>02</span>
        <strong>Trần Bảo Châu</strong>
        <em>6.200.000</em>
      </div>
      <div className="dl-mock-ink-row">
        <span>03</span>
        <strong>Lê Gia Hân</strong>
        <em>3.100.000</em>
      </div>
      <div className="dl-mock-ink-rule" />
      <div className="dl-mock-ink-cta">Xem đầy đủ →</div>
    </div>
  );
}

function MockNightDash() {
  return (
    <div className="dl-mock-fill dl-mock-night">
      <div className="dl-mock-night-top">
        <strong>Night Ops</strong>
        <span>Live · 22:14</span>
      </div>
      <div className="dl-mock-night-kpis">
        <div>
          <span>Queue</span>
          <strong>12</strong>
          <i style={{ width: '70%' }} />
        </div>
        <div>
          <span>Grading</span>
          <strong>5</strong>
          <i style={{ width: '40%' }} />
        </div>
        <div>
          <span>SLA risk</span>
          <strong>2</strong>
          <i className="dl-mock-night-bar--warn" style={{ width: '25%' }} />
        </div>
      </div>
      <div className="dl-mock-night-feed">
        <div>
          <em>22:01</em> GV Lan nộp điểm lớp A1
        </div>
        <div>
          <em>21:48</em> Refund #R-204 chờ duyệt
        </div>
        <div>
          <em>21:30</em> 3 bài tập quá hạn
        </div>
      </div>
    </div>
  );
}

function MockJiraBoard() {
  return (
    <div className="dl-mock-fill dl-mock-shell">
      <aside className="dl-mock-nav dl-mock-nav--labeled dl-mock-nav--slate">
        <div className="dl-mock-nav-brand">CMC Board</div>
        <span data-active="true">Backlog</span>
        <span>Active sprints</span>
        <span>Reports</span>
        <span>Components</span>
      </aside>
      <div className="dl-mock-main">
        <div className="dl-mock-topbar">
          <div>
            <div className="dl-mock-kicker">Project · EDU</div>
            <div className="dl-mock-topbar-title">Enrollment backlog</div>
          </div>
          <span className="dl-mock-btn dl-mock-btn--primary">Create</span>
        </div>
        <div className="dl-mock-body">
          <div className="dl-mock-ticket">
            <span className="dl-mock-ticket-key">EDU-1842</span>
            <span className="dl-mock-ticket-title">Xếp lớp — overflow waitlist</span>
            <span className="dl-mock-badge dl-mock-badge--warn">In Progress</span>
          </div>
          <div className="dl-mock-ticket">
            <span className="dl-mock-ticket-key">EDU-1830</span>
            <span className="dl-mock-ticket-title">Phiếu thu thiếu VAT line</span>
            <span className="dl-mock-badge dl-mock-badge--muted">To Do</span>
          </div>
          <div className="dl-mock-ticket">
            <span className="dl-mock-ticket-key">EDU-1811</span>
            <span className="dl-mock-ticket-title">Parent meeting reschedule</span>
            <span className="dl-mock-badge dl-mock-badge--ok">Done</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCarbonShell() {
  return (
    <div className="dl-mock-fill dl-mock-carbon">
      <div className="dl-mock-carbon-header">
        <span className="dl-mock-carbon-logo">IBM·CMC</span>
        <span className="dl-mock-carbon-search">Search</span>
        <span className="dl-mock-carbon-util">Help · MQ</span>
      </div>
      <div className="dl-mock-shell" style={{ minHeight: 0, flex: 1 }}>
        <aside className="dl-mock-nav dl-mock-nav--labeled dl-mock-nav--carbon">
          <span data-active="true">Dashboard</span>
          <span>Data table</span>
          <span>Forms</span>
          <span>UI shell</span>
        </aside>
        <div className="dl-mock-main">
          <div className="dl-mock-carbon-pagehead">
            <div className="dl-mock-topbar-title">Opportunities</div>
            <div className="dl-mock-actions">
              <span className="dl-mock-btn dl-mock-btn--ghost">Cancel</span>
              <span className="dl-mock-btn dl-mock-btn--primary">Primary button</span>
            </div>
          </div>
          <div className="dl-mock-carbon-toolbar">
            <span className="dl-mock-input">Filter table</span>
            <span className="dl-mock-btn dl-mock-btn--ghost">Batch actions</span>
          </div>
          <table className="dl-mock-table dl-mock-table--carbon">
            <thead>
              <tr>
                <th>
                  <span className="dl-mock-chk" />
                </th>
                <th>Name</th>
                <th>Status</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              <tr data-selected="true">
                <td>
                  <span className="dl-mock-chk" data-on="true" />
                </td>
                <td>Nguyễn Minh An</td>
                <td>
                  <span className="dl-mock-carbon-tag">Test</span>
                </td>
                <td>2 hours ago</td>
              </tr>
              <tr>
                <td>
                  <span className="dl-mock-chk" />
                </td>
                <td>Trần Bảo Châu</td>
                <td>
                  <span className="dl-mock-carbon-tag dl-mock-carbon-tag--green">Active</span>
                </td>
                <td>Yesterday</td>
              </tr>
              <tr>
                <td>
                  <span className="dl-mock-chk" />
                </td>
                <td>Lê Gia Hân</td>
                <td>
                  <span className="dl-mock-carbon-tag">Lead</span>
                </td>
                <td>3 days ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MockAntPro() {
  return (
    <div className="dl-mock-fill dl-mock-shell">
      <aside className="dl-mock-nav dl-mock-nav--labeled dl-mock-nav--ant">
        <div className="dl-mock-nav-brand">CMC Ant Pro</div>
        <span data-active="true">仪表盘 Dashboard</span>
        <span>列表示例 List</span>
        <span>表单 Form</span>
        <span>详情 Detail</span>
      </aside>
      <div className="dl-mock-main">
        <div className="dl-mock-ant-bc">Home / CRM / Cơ hội</div>
        <div className="dl-mock-body">
          <div className="dl-mock-ant-stats">
            <div>
              <span>Pipeline</span>
              <strong>128</strong>
            </div>
            <div>
              <span>Chờ test</span>
              <strong>18</strong>
            </div>
            <div>
              <span>Doanh thu</span>
              <strong>42M</strong>
            </div>
            <div>
              <span>Tỷ lệ</span>
              <strong>32%</strong>
            </div>
          </div>
          <div className="dl-mock-panel">
            <div className="dl-mock-ant-query">
              <span className="dl-mock-field-inline">
                <label>Tên</label>
                <span className="dl-mock-input"> </span>
              </span>
              <span className="dl-mock-field-inline">
                <label>Stage</label>
                <span className="dl-mock-input">All</span>
              </span>
              <span className="dl-mock-btn dl-mock-btn--primary">Query</span>
              <span className="dl-mock-btn dl-mock-btn--ghost">Reset</span>
            </div>
            <table className="dl-mock-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Stage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nguyễn Minh An</td>
                  <td>
                    <span className="dl-mock-badge dl-mock-badge--warn">Test</span>
                  </td>
                  <td className="dl-mock-link">Edit · More</td>
                </tr>
                <tr>
                  <td>Trần Bảo Châu</td>
                  <td>
                    <span className="dl-mock-badge dl-mock-badge--ok">Paid</span>
                  </td>
                  <td className="dl-mock-link">Edit · More</td>
                </tr>
                <tr>
                  <td>Lê Gia Hân</td>
                  <td>
                    <span className="dl-mock-badge dl-mock-badge--muted">Lead</span>
                  </td>
                  <td className="dl-mock-link">Edit · More</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockAirbnbBrowse() {
  return (
    <div className="dl-mock-fill dl-mock-airbnb">
      <div className="dl-mock-airbnb-search">
        <span>
          <em>Where</em>
          Cơ sở 1
        </span>
        <span>
          <em>When</em>
          Tuần này
        </span>
        <span>
          <em>Who</em>
          1 học viên
        </span>
        <span className="dl-mock-airbnb-go">⌕</span>
      </div>
      <div className="dl-mock-airbnb-filters">
        <span data-on="true">All</span>
        <span>IELTS</span>
        <span>Kids</span>
        <span>TOEIC</span>
      </div>
      <div className="dl-mock-airbnb-grid">
        {[
          { t: 'IELTS 5.5 · Cô Lan', p: '4.5M · 12 buổi' },
          { t: 'Kids Starter · CS2', p: '3.1M · 16 buổi' },
          { t: 'TOEIC 650 · Tối', p: '6.2M · 20 buổi' },
        ].map((c) => (
          <div key={c.t} className="dl-mock-airbnb-card">
            <div className="dl-mock-airbnb-photo" />
            <strong>{c.t}</strong>
            <span>{c.p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StyleTheme({
  styleId,
  compact,
  className,
}: {
  styleId: StyleId;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={['dl-theme', className].filter(Boolean).join(' ')} data-style={styleId}>
      <MockApp styleId={styleId} compact={compact} />
    </div>
  );
}

function fitLabel(fit: DesignStyle['erpFit']) {
  if (fit === 'high') return 'ERP fit cao';
  if (fit === 'medium') return 'ERP fit TB';
  return 'Thử nghiệm';
}

export function StyleExplorer() {
  const [view, setView] = useState<ViewMode>('gallery');
  const [family, setFamily] = useState<StyleFamily | 'all'>('all');
  const [active, setActive] = useState<StyleId>('soft-ops');
  const [compare, setCompare] = useState<StyleId[]>(['soft-ops', 'dense-ops']);
  const [preferred, setPreferred] = useState<StyleId | null>(null);

  useEffect(() => {
    setPreferred(loadPreferred());
  }, []);

  const filtered = useMemo(
    () => DESIGN_STYLES.filter((s) => family === 'all' || s.family === family),
    [family],
  );

  const activeStyle = DESIGN_STYLES.find((s) => s.id === active) ?? DESIGN_STYLES[0];

  const pickPreferred = useCallback((id: StyleId) => {
    setPreferred(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const clearPreferred = useCallback(() => {
    setPreferred(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCompare = useCallback((id: StyleId) => {
    setCompare((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    setView('compare');
  }, []);

  const openStage = useCallback((id: StyleId) => {
    setActive(id);
    setView('stage');
  }, []);

  return (
    <div className="dl-style-explorer">
      <div className="dl-style-toolbar">
        <div className="dl-style-toolbar-left">
          <div className="dl-style-seg" role="group" aria-label="Chế độ xem">
            <button type="button" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}>
              Gallery
            </button>
            <button type="button" aria-pressed={view === 'stage'} onClick={() => setView('stage')}>
              Stage lớn
            </button>
            <button type="button" aria-pressed={view === 'compare'} onClick={() => setView('compare')}>
              So sánh
            </button>
          </div>
          <div className="dl-style-filter" role="group" aria-label="Nhóm phong cách">
            {FAMILY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="dl-style-chip"
                aria-pressed={family === f.id}
                onClick={() => setFamily(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="dl-style-toolbar-right">
          <span>{DESIGN_STYLES.length} phong cách · scoped preview (không đổi production)</span>
        </div>
      </div>

      {preferred ? (
        <div className="dl-style-pick-banner" role="status">
          <span>
            Bạn đang nghiêng về: <strong>{DESIGN_STYLES.find((s) => s.id === preferred)?.name}</strong>
            <span style={{ marginLeft: 8, color: 'var(--cmc-text-muted)' }}>
              (lưu localStorage — chỉ lab)
            </span>
          </span>
          <button type="button" onClick={clearPreferred}>
            Xóa lựa chọn
          </button>
        </div>
      ) : (
        <div className="dl-callout" style={{ margin: 0 }}>
          <strong>Cách duyệt:</strong> mỗi mẫu dùng <em>layout khác hẳn</em> (không chỉ đổi màu) —
          dải fingerprint trên mock cho biết khác gì. Bấm card → Stage lớn (khuyên dùng) hoặc So
          sánh 2 mẫu. Chọn hướng → localStorage lab.
        </div>
      )}

      {view === 'gallery' ? (
        <div className="dl-style-grid">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              className="dl-style-card"
              data-active={active === s.id || preferred === s.id ? 'true' : 'false'}
              data-compare={compare.includes(s.id) ? 'true' : 'false'}
              onClick={() => openStage(s.id)}
            >
              <div className="dl-style-card-preview">
                <StyleTheme styleId={s.id} compact />
              </div>
              <div className="dl-style-card-body">
                <div className="dl-style-card-top">
                  <h3 className="dl-style-card-title">{s.name}</h3>
                  <span className="dl-style-card-id">{s.id}</span>
                </div>
                <p className="dl-style-card-lead">{s.lead}</p>
                <div className="dl-style-tags">
                  <span className="dl-style-tag">{s.density}</span>
                  <span
                    className={
                      s.erpFit === 'high'
                        ? 'dl-style-tag dl-style-tag--fit'
                        : s.erpFit === 'explore'
                          ? 'dl-style-tag dl-style-tag--risk'
                          : 'dl-style-tag'
                    }
                  >
                    {fitLabel(s.erpFit)}
                  </span>
                  {s.mood.slice(0, 2).map((m) => (
                    <span key={m} className="dl-style-tag">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="dl-style-swatches" aria-hidden>
                  {s.swatches.map((c) => (
                    <i key={c} style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {view === 'stage' ? (
        <div className="dl-style-stage-wrap">
          <div className="dl-style-stage">
            <div className="dl-style-stage-meta">
              <h3>{activeStyle.name}</h3>
              <p>
                {activeStyle.lead} · Nguồn: {activeStyle.source ?? '—'} · Density:{' '}
                {activeStyle.density}
              </p>
              <div className="dl-style-stage-actions">
                <button type="button" onClick={() => toggleCompare(activeStyle.id)}>
                  {compare.includes(activeStyle.id) ? 'Đang so sánh' : 'Thêm so sánh'}
                </button>
                <button
                  type="button"
                  data-primary="true"
                  onClick={() => pickPreferred(activeStyle.id)}
                >
                  {preferred === activeStyle.id ? 'Đã chọn ✓' : 'Chọn hướng này'}
                </button>
              </div>
            </div>
            <div className="dl-style-stage-frame">
              <StyleTheme styleId={activeStyle.id} />
            </div>
          </div>

          <div className="dl-style-notes">
            <div className="dl-style-note">
              <h4>Hợp khi…</h4>
              <ul>
                {activeStyle.goodFor.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
            <div className="dl-style-note">
              <h4>Rủi ro / trade-off</h4>
              <ul>
                {activeStyle.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="dl-style-note">
              <h4>Đổi sang style khác</h4>
              <p style={{ marginBottom: 8 }}>Chọn nhanh từ danh sách đã lọc:</p>
              <div className="dl-style-filter">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="dl-style-chip"
                    aria-pressed={active === s.id}
                    onClick={() => setActive(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {view === 'compare' ? (
        <div className="dl-style-stage-wrap dl-style-stage-wrap--compare">
          {(compare.length ? compare : (['soft-ops', 'dense-ops'] as StyleId[])).map((id) => {
            const s = DESIGN_STYLES.find((x) => x.id === id)!;
            return (
              <div key={id} className="dl-style-stage">
                <div className="dl-style-stage-meta">
                  <h3>{s.name}</h3>
                  <p>
                    {s.density} · {fitLabel(s.erpFit)} · {s.mood.join(' · ')}
                  </p>
                  <div className="dl-style-stage-actions">
                    <button type="button" onClick={() => openStage(id)}>
                      Stage
                    </button>
                    <button type="button" data-primary="true" onClick={() => pickPreferred(id)}>
                      {preferred === id ? 'Đã chọn ✓' : 'Chọn'}
                    </button>
                  </div>
                </div>
                <div className="dl-style-stage-frame">
                  <StyleTheme styleId={id} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === 'compare' ? (
        <div className="dl-style-filter" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--cmc-text-muted)', marginRight: 6 }}>
            Chọn tối đa 2 để so sánh:
          </span>
          {DESIGN_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="dl-style-chip"
              aria-pressed={compare.includes(s.id)}
              onClick={() => toggleCompare(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="dl-style-notes">
        <div className="dl-style-note">
          <h4>Gợi ý chấm nhanh (độc lập brand cũ)</h4>
          <ul>
            <li>
              <strong>Power user ERP</strong> (bảng dài, finance): Dense Ops / Primer / Slate
            </li>
            <li>
              <strong>Sale + CRM</strong>: Cool SaaS / Soft Ops / Polaris
            </li>
            <li>
              <strong>Lịch + parent LMS</strong>: Cal Clean / Edu Warm
            </li>
            <li>
              <strong>Ca tối / focus</strong>: Night Ops (nên là theme phụ, không SoT duy nhất)
            </li>
          </ul>
        </div>
        <div className="dl-style-note">
          <h4>Sau khi chọn hướng</h4>
          <p>
            Ghi lại id style (vd. <code>dense-ops</code>). Bước tiếp: map token pack →{' '}
            <code>packages/ui/src/tokens.css</code> + premium surfaces, rồi pilot 1 cockpit + 1
            list ops — chưa đổi toàn app.
          </p>
        </div>
      </div>
    </div>
  );
}

export default StyleExplorer;
