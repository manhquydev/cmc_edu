/**
 * Design Lab — Xia sources browser
 * Research + extract from official design systems / local DESIGN.md.
 * Principle (ak-xia): adapt patterns, do not transplant brand/stack.
 */
import { useMemo, useState } from 'react';
import {
  DESIGN_STYLES,
  StyleTheme,
  type StyleId,
} from './design-lab-styles.js';
import './design-lab-xia.css';

export interface XiaSource {
  id: string;
  rank: number;
  name: string;
  kind: 'enterprise' | 'product' | 'local-extract' | 'impl';
  urls: { label: string; href: string }[];
  local?: string;
  styleId?: StyleId;
  erpFit: 'high' | 'medium' | 'low';
  agentSurface: string;
  steal: string[];
  skip: string[];
  patterns: string[];
  summary: string;
  credibility: string;
}

/** Ranked sources from live research + local extracts (xia recon). */
export const XIA_SOURCES: XiaSource[] = [
  {
    id: 'carbon',
    rank: 1,
    name: 'IBM Carbon',
    kind: 'enterprise',
    urls: [
      { label: 'llms.txt', href: 'https://carbondesignsystem.com/llms.txt' },
      { label: 'Site', href: 'https://carbondesignsystem.com/' },
      { label: 'GitHub monorepo', href: 'https://github.com/carbon-design-system/carbon' },
    ],
    styleId: 'carbon',
    erpFit: 'high',
    agentSurface: 'Real /llms.txt index · components + patterns + foundations',
    steal: [
      'Data Table + Filtering + Pagination grammar',
      'UI Shell (header / side nav / content)',
      'Side Panel for record detail without full page jump',
      'Empty states · Status indicators · Forms density',
      '2x Grid + spacing tokens (not IBM gray brand)',
    ],
    skip: ['IBM blue #0f62fe as CMC brand', 'Radius 0 as default product skin', 'Carbon React package lock-in'],
    patterns: ['Filtering', 'Forms', 'Empty states', 'Status', 'Dialogs', 'Loading', 'UI Shell'],
    summary:
      'Best enterprise pattern index for dense ops admin. Steal interaction grammar; re-skin with CMC tokens.',
    credibility: 'Official IBM product DS · live markdown index verified',
  },
  {
    id: 'ant',
    rank: 2,
    name: 'Ant Design',
    kind: 'enterprise',
    urls: [
      { label: 'design.md', href: 'https://ant.design/design.md' },
      { label: 'llms.txt', href: 'https://ant.design/llms.txt' },
      { label: 'for-agents', href: 'https://ant.design/docs/react/for-agents' },
    ],
    styleId: 'ant',
    erpFit: 'high',
    agentSurface: 'design.md machine tokens · MCP/CLI · for-agents docs',
    steal: [
      'Three-layer surface: layout #F5F5F5 · container white · elevated shadow',
      'Control height 32 · radius 6 control / 8 card',
      'List → filter → detail admin archetypes',
      'One primary CTA per decision surface',
      'Table header surface-container · hover rows (no default zebra)',
    ],
    skip: ['Default “Chinese admin SaaS” chrome as identity', 'Hard-code #1677FF as CMC brand', 'Full antd dependency'],
    patterns: ['Data list', 'Data entry', 'Detail page', 'Navigation', 'Feedback', 'Layout'],
    summary:
      'Strongest agent-readable enterprise language. Use as IA + density grammar; restyle seeds only.',
    credibility: 'Official Ant Group · design.md alpha tokens (v6 light)',
  },
  {
    id: 'atlassian',
    rank: 3,
    name: 'Atlassian Design (ADS)',
    kind: 'enterprise',
    urls: [
      { label: 'llms.txt', href: 'https://atlassian.design/llms.txt' },
      { label: 'Tokens dump', href: 'https://atlassian.design/llms-tokens.txt' },
      { label: 'ADS MCP', href: 'https://mcp.atlassian.com/v1/ads/public/mcp' },
    ],
    styleId: 'slate-enterprise',
    erpFit: 'high',
    agentSurface: 'llms.txt + split dumps + public ADS MCP',
    steal: [
      'Token taxonomy: bg / text / border / elevation',
      'Table · Tree · Flag/Toast · Modal/Drawer stack',
      'WCAG 2.1 AA patterns for staff tools',
      'Workflow / issue density → enrollment cases, leave, grading queues',
    ],
    skip: ['@atlaskit/* monorepo lock-in', 'Full Jira visual identity'],
    patterns: ['Tokens', 'Primitives Box/Stack', 'Data display', 'A11y', 'Content'],
    summary:
      'Reference for token discipline + a11y + work-management density — not full Atlaskit install.',
    credibility: 'Official ADS · published MCP + markdown dumps',
  },
  {
    id: 'primer',
    rank: 4,
    name: 'GitHub Primer',
    kind: 'local-extract',
    urls: [
      { label: 'Primer product', href: 'https://primer.style/product' },
      { label: 'Data table', href: 'https://primer.style/product/components/data-table' },
    ],
    local: '~/Downloads/design/github.com-DESIGN.md + design-tokens-GitHub.json',
    styleId: 'primer',
    erpFit: 'medium',
    agentSurface: 'No native llms.txt — use local DESIGN.md + primitives CSS',
    steal: [
      'Information density: labels, counters, state badges',
      'Semantic status (open/merged/closed → enrollment stages)',
      'Resting hairline elevation · compact rows 36px',
      'MetaRow · CountBadge · ActivityTimeline patterns',
    ],
    skip: ['3–6px sharp radius as global default', 'Mona Sans / GitHub green brand'],
    patterns: ['Tables', 'Blankslate', 'Labels', 'Counters', 'Timeline meta'],
    summary:
      'Dense product UI for engineer-native tools. Local extract is the agent source of truth.',
    credibility: 'Official GitHub DS · local token JSON in repo workspace',
  },
  {
    id: 'polaris',
    rank: 5,
    name: 'Shopify Polaris',
    kind: 'local-extract',
    urls: [{ label: 'Polaris', href: 'https://polaris.shopify.com/' }],
    local: '~/Downloads/design/shopify.com-DESIGN.md + design-tokens-Shopify.json',
    styleId: 'polaris',
    erpFit: 'high',
    agentSurface: 'Site often blocks AI crawl — local DESIGN.md is primary',
    steal: [
      'Merchant admin: settings sections, card hairline, 8px grid',
      'Callout / banner highlight patterns',
      'Filter + index table density',
      'Primary solid / secondary outline button hierarchy',
    ],
    skip: ['Forest green #008060 dual brand', 'Radius 4 controls if CMC soft-ops stays 12'],
    patterns: ['Settings', 'Index table', 'Callout', 'Cards', 'Forms'],
    summary:
      'Commerce admin trust language. Port layout patterns; recolor green → CMC blue when adopting.',
    credibility: 'Local DESIGN.md extract · Polaris merchant admin',
  },
  {
    id: 'cal',
    rank: 6,
    name: 'Cal.com',
    kind: 'local-extract',
    urls: [{ label: 'Cal.com', href: 'https://cal.com/' }],
    local: '~/Downloads/design/cal.com-DESIGN.md + design-tokens-Cal.com.json',
    styleId: 'cal-clean',
    erpFit: 'medium',
    agentSurface: 'Local DESIGN.md (scheduling product)',
    steal: [
      'Booking form clarity · duration pills · short forms',
      'A11y-first focus states',
      'Airy whitespace for schedule/parent meeting flows',
    ],
    skip: ['Orange accent #FF7A45 as ERP primary', 'Consumer sparsity on dense lists'],
    patterns: ['Booking', 'Forms', 'Duration chips', 'Empty booking states'],
    summary: 'Best for lịch dạy / parent meeting — not for finance tables.',
    credibility: 'Local DESIGN.md + token JSON',
  },
  {
    id: 'airbnb',
    rank: 7,
    name: 'Airbnb DLS',
    kind: 'local-extract',
    urls: [{ label: 'Airbnb design', href: 'https://airbnb.design/' }],
    local: '~/Downloads/design/airbnb.com-DESIGN.md + design-tokens-Airbnb.json',
    styleId: 'airbnb',
    erpFit: 'low',
    agentSurface: 'Local DESIGN.md (consumer hospitality)',
    steal: [
      'Avatar trust ring · warm identity',
      'Pill chrome for search/filter chips',
      'Hospitality tone for parent/LMS surfaces',
    ],
    skip: ['Rausch coral brand', 'Photography-first sparsity', 'Marketing card grids in ERP'],
    patterns: ['Identity', 'Trust badges', 'Pill search', 'Cards'],
    summary: 'Consumer warmth — port identity only; do not drive ops list density.',
    credibility: 'Local DESIGN.md + token JSON',
  },
  {
    id: 'shadcn',
    rank: 8,
    name: 'shadcn/ui',
    kind: 'impl',
    urls: [
      { label: 'llms.txt', href: 'https://ui.shadcn.com/llms.txt' },
      { label: 'MCP docs', href: 'https://ui.shadcn.com/docs/mcp' },
    ],
    erpFit: 'medium',
    agentSurface: 'llms.txt + MCP + Skills — implementation vehicle',
    steal: ['Accessible Radix patterns', 'Composable dialog/select recipes (conceptually)'],
    skip: [
      'Installing Tailwind+shadcn as second DS in CMC monorepo',
      'components.json / registry as product authority',
    ],
    patterns: ['Dialog', 'Select', 'Command', 'Form fields (pattern only)'],
    summary:
      'AI-ready component distribution — NOT design authority for CMC. Map via STYLING-BRIDGE only.',
    credibility: 'Official shadcn docs · project rejects dual stack',
  },
];

const KIND_LABEL: Record<XiaSource['kind'], string> = {
  enterprise: 'Enterprise DS',
  product: 'Product',
  'local-extract': 'Local DESIGN.md',
  impl: 'Impl vehicle',
};

export function XiaSourcesExplorer() {
  const [activeId, setActiveId] = useState(XIA_SOURCES[0].id);
  const [showCompare, setShowCompare] = useState(true);

  const active = XIA_SOURCES.find((s) => s.id === activeId) ?? XIA_SOURCES[0];
  const previewStyle: StyleId | null = active.styleId ?? null;

  const linkedStyle = useMemo(
    () => (previewStyle ? DESIGN_STYLES.find((s) => s.id === previewStyle) : null),
    [previewStyle],
  );

  return (
    <div className="dl-xia">
      <div className="dl-xia-intro">
        <p>
          <strong>ak-xia recon (live + local):</strong> Carbon · Ant Design · Atlassian · Primer ·
          Polaris · Cal · Airbnb · shadcn. Steal <em>patterns</em>, re-token về CMC — không transplant
          package/brand. Gallery mockup bên dưới dùng CSS scoped (không đổi production).
        </p>
        <div className="dl-xia-intro-actions">
          <button
            type="button"
            className="dl-xia-toggle"
            aria-pressed={showCompare}
            onClick={() => setShowCompare((v) => !v)}
          >
            {showCompare ? 'Ẩn so sánh CMC Soft Ops' : 'Hiện so sánh vs Soft Ops'}
          </button>
          <a className="dl-xia-link" href="#styles">
            → Mở Style gallery đầy đủ
          </a>
        </div>
      </div>

      <div className="dl-xia-layout">
        <aside className="dl-xia-list" aria-label="Danh sách nguồn design">
          {XIA_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="dl-xia-item"
              data-active={activeId === s.id ? 'true' : 'false'}
              onClick={() => setActiveId(s.id)}
            >
              <span className="dl-xia-rank">#{s.rank}</span>
              <span className="dl-xia-item-body">
                <strong>{s.name}</strong>
                <span>
                  {KIND_LABEL[s.kind]} · ERP {s.erpFit}
                </span>
              </span>
            </button>
          ))}
        </aside>

        <div className="dl-xia-detail">
          <header className="dl-xia-detail-head">
            <div>
              <p className="dl-xia-kicker">
                Rank #{active.rank} · {KIND_LABEL[active.kind]} · ERP fit {active.erpFit}
              </p>
              <h3>{active.name}</h3>
              <p className="dl-xia-summary">{active.summary}</p>
            </div>
            <div className="dl-xia-swatch-row">
              {(linkedStyle?.swatches ?? ['#F5F5F5', '#FFF', '#1677FF', '#111', '#DDD']).map((c) => (
                <i key={c} style={{ background: c }} title={c} />
              ))}
            </div>
          </header>

          <div className="dl-xia-meta-grid">
            <div>
              <h4>Agent surface</h4>
              <p>{active.agentSurface}</p>
            </div>
            <div>
              <h4>Credibility</h4>
              <p>{active.credibility}</p>
            </div>
            {active.local ? (
              <div>
                <h4>Local extract</h4>
                <p>
                  <code>{active.local}</code>
                </p>
              </div>
            ) : null}
            <div>
              <h4>URLs</h4>
              <ul className="dl-xia-urls">
                {active.urls.map((u) => (
                  <li key={u.href}>
                    <a href={u.href} target="_blank" rel="noreferrer">
                      {u.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="dl-xia-cols">
            <div className="dl-xia-panel dl-xia-panel--port">
              <h4>Port / học hỏi</h4>
              <ul>
                {active.steal.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="dl-xia-panel dl-xia-panel--skip">
              <h4>Skip / không transplant</h4>
              <ul>
                {active.skip.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="dl-xia-patterns">
            {active.patterns.map((p) => (
              <span key={p} className="dl-xia-pill">
                {p}
              </span>
            ))}
          </div>

          {previewStyle ? (
            <div className={`dl-xia-previews ${showCompare ? 'dl-xia-previews--compare' : ''}`}>
              <div className="dl-xia-preview-card">
                <div className="dl-xia-preview-label">
                  <strong>{active.name}</strong>
                  <span>theme id: {previewStyle}</span>
                </div>
                <div className="dl-xia-preview-frame">
                  <StyleTheme styleId={previewStyle} />
                </div>
              </div>
              {showCompare ? (
                <div className="dl-xia-preview-card">
                  <div className="dl-xia-preview-label">
                    <strong>CMC Soft Ops (baseline)</strong>
                    <span>theme id: soft-ops</span>
                  </div>
                  <div className="dl-xia-preview-frame">
                    <StyleTheme styleId="soft-ops" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="dl-xia-no-preview">
              Nguồn này là implementation vehicle / docs — không skin mockup. Xem bridge:{' '}
              <code>design-system/cmc-edu/STYLING-BRIDGE.md</code>
            </div>
          )}

          <div className="dl-xia-decision">
            <h4>Decision matrix (xia challenge)</h4>
            <table>
              <thead>
                <tr>
                  <th>Aspect</th>
                  <th>Nguồn</th>
                  <th>CMC</th>
                  <th>Khuyến nghị</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Brand color</td>
                  <td>Theo DS (IBM/Ant/Shopify…)</td>
                  <td>#0071E3 một accent</td>
                  <td>Giữ CMC; chỉ mượn density</td>
                </tr>
                <tr>
                  <td>Stack</td>
                  <td>Carbon React / antd / Atlaskit…</td>
                  <td>Astryx + @cmc/ui + CSS tokens</td>
                  <td>Không cài second DS</td>
                </tr>
                <tr>
                  <td>Patterns</td>
                  <td>Table · filter · shell · empty</td>
                  <td>ListPage · ControlBar · DetailPage</td>
                  <td>Port grammar vào frames sẵn có</td>
                </tr>
                <tr>
                  <td>Radius / density</td>
                  <td>0–8px, row 32–48</td>
                  <td>12/16/20 soft ops</td>
                  <td>Thử Dense/Carbon trong lab; pilot nếu vote</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default XiaSourcesExplorer;
