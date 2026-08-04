/**
 * Design Lab — Smart cohesion upgrade (brainstorm + research + advise)
 */
import './design-lab-upgrade.css';

const APPROACHES = [
  {
    id: 'A',
    name: 'Re-skin',
    rec: false,
    lead: 'Đổi language visual (Carbon/Ant/Cool SaaS) sang production.',
    pros: 'Nhìn “mới” với stakeholder',
    cons: 'Brand debt · mock ≠ @cmc/ui · red team R2/R3/R10',
  },
  {
    id: 'B',
    name: 'Cohesion + smart ops',
    rec: true,
    lead: 'Giữ Soft Ops. Đóng gap adoption. Bulk · pager · Detail recipe · cockpit queue.',
    pros: 'Đồng bộ thật · thông minh làm việc · YAGNI',
    cons: 'Ít “wow skin” · cần rollout kỷ luật',
  },
  {
    id: 'C',
    name: 'Smart widgets only',
    rec: false,
    lead: 'Thêm inbox/⌘K/AI chrome ad-hoc, không enforce frames.',
    pros: 'Demo nhanh',
    cons: 'Phân mảnh hơn — ngược đồng bộ',
  },
];

const COUNTS = [
  { k: 'ListPage', v: '24+', note: 'mạnh' },
  { k: 'DetailPage', v: '8', note: 'EntityHeader 4' },
  { k: 'FormPage', v: '7', note: 'mỏng' },
  { k: 'DashboardPage', v: '2', note: 'cockpit' },
  { k: 'BulkActionBar', v: '≥5', note: 'cook 2026-08-04' },
  { k: 'SettingsShell', v: '≥3', note: 'shift · IP · salary' },
];

const WEEKS = [
  {
    w: 'Tuần 1',
    items: ['SoT Soft Ops locked', 'Adoption matrix script + lab', 'Detail dual-title audit'],
  },
  {
    w: 'Tuần 2',
    items: ['Bulk + pager: receipts · students · classes · users · pipeline'],
  },
  {
    w: 'Tuần 3',
    items: ['Cockpit EmptyState + deeplink mọi role', 'SettingsShell ≥2 admin screens'],
  },
  {
    w: 'Tuần 4',
    items: ['Optional CI check-ui-frames', 'Chỉ khi cần: density pilot (không re-skin)'],
  },
];

const DO = [
  'Giữ tokens Soft Ops + 4 frames',
  'Bulk + ListPagination top lists',
  'DetailPage + EntityHeader 100% entity routes',
  'Cockpit queue next-step CTA',
  'Inventory honest + dated',
  '1 gate nhẹ (script/lint)',
];

const DONT = [
  'Retoken từ vote skin lab',
  'Thêm skin mới trước bulk xong',
  'Toolbar custom ngoài ControlBar',
  'Dual h1 PageHeader + EntityHeader',
  'Research theater không đo page',
];

const METRICS = [
  { m: 'Lists ListPage+pager', t: '≥5 named' },
  { m: 'Lists bulk selection', t: '≥5' },
  { m: 'Entity detail EntityHeader only', t: '100%' },
  { m: 'Cockpit roles empty CTA', t: 'all roles' },
  { m: 'Inventory false miss', t: '0' },
  { m: 'New skins until bulk done', t: '0' },
];

export function UpgradeRoadmapPanel() {
  return (
    <div className="up-root">
      <div className="up-hero">
        <p className="up-kicker">ak-brainstorm · ak-research · ak-advise · 2026-08-04</p>
        <h3>Nâng cấp UI: thông minh hơn · đồng bộ hơn</h3>
        <p>
          <strong>Verdict: Option B</strong> — không re-skin. “Đổi mới” = độ sâu ops (bulk, queue,
          recipe) trên <em>một</em> Soft Ops OS. Lab skins = explore only.
        </p>
      </div>

      <div className="up-counts">
        {COUNTS.map((c) => (
          <div key={c.k} className="up-count">
            <strong>{c.v}</strong>
            <span>{c.k}</span>
            <em>{c.note}</em>
          </div>
        ))}
      </div>
      <p className="up-muted">Đo apps/admin pages (excl design-lab/tests) · 2026-08-04</p>

      <h4 className="up-h">3 hướng (brainstorm)</h4>
      <div className="up-options">
        {APPROACHES.map((a) => (
          <div key={a.id} className="up-opt" data-rec={a.rec ? 'true' : 'false'}>
            <div className="up-opt-head">
              <span className="up-id">{a.id}</span>
              <strong>{a.name}</strong>
              {a.rec ? <span className="up-badge">Chọn</span> : null}
            </div>
            <p>{a.lead}</p>
            <ul>
              <li>
                <em>+</em> {a.pros}
              </li>
              <li>
                <em>−</em> {a.cons}
              </li>
            </ul>
          </div>
        ))}
      </div>

      <h4 className="up-h">Lộ trình (advise)</h4>
      <div className="up-weeks">
        {WEEKS.map((w) => (
          <div key={w.w} className="up-week">
            <strong>{w.w}</strong>
            <ul>
              {w.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="up-two">
        <div className="up-card up-card--do">
          <h4>Nên làm</h4>
          <ul>
            {DO.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="up-card up-card--dont">
          <h4>Không làm</h4>
          <ul>
            {DONT.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>

      <h4 className="up-h">Success metrics</h4>
      <table className="up-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((r) => (
            <tr key={r.m}>
              <td>{r.m}</td>
              <td>
                <code>{r.t}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="up-check">
        <h4>Work checklist (→ cook)</h4>
        <ul>
          <li>Adoption matrix trên lab + script</li>
          <li>Bulk+pager 5 lists ưu tiên</li>
          <li>Detail recipe pass</li>
          <li>Cockpit smart empty/deeplink</li>
          <li>SettingsShell rollout</li>
          <li>Optional CI frame check</li>
        </ul>
      </div>

      <p className="up-foot">
        Reports:{' '}
        <code>plans/260804-ui-smart-cohesion-upgrade/reports/</code>
        brainstorm · research · advise · <code>plan.md</code>. Related:{' '}
        <a href="#redteam">Red team</a> · <a href="#layout-knowledge">Layout OS</a> ·{' '}
        <a href="#wireframes">Wireframes</a>.
      </p>
    </div>
  );
}

export default UpgradeRoadmapPanel;
