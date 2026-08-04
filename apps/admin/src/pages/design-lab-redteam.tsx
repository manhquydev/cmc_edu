/**
 * Design Lab — red-team evaluation (rebased post Soft Ops cook + Odoo xia 2026-08-04).
 * Adversarial findings with evidence; not a celebration page.
 */
import { useState } from 'react';
import './design-lab-redteam.css';

type Sev = 'critical' | 'high' | 'medium' | 'low' | 'ok';

interface Finding {
  id: string;
  sev: Sev;
  title: string;
  evidence: string;
  impact: string;
  fix: string;
  status: 'open' | 'fixed' | 'partial' | 'deferred';
}

const SCORECARD: { dim: string; score: number; note: string }[] = [
  { dim: 'Shell', score: 4, note: 'AppFrame · SideNav · ⌘K · primary CTA' },
  { dim: 'List-ops depth', score: 4, note: '8 bulk; FilterBar ≥6 product lists; pager residual closed for cycle 3 cohort' },
  { dim: 'Detail recipe', score: 4, note: 'tiers full/standard/settings/thin documented; dual-title 0; depth report in check-ui-frames' },
  { dim: 'Settings', score: 4, note: 'SettingsShell ×3 (shift · IP · salary)' },
  { dim: 'Cockpit smart CTA', score: 4, note: 'role empties + checkin deeplink' },
  { dim: 'A11y baseline', score: 2.5, note: 'partial: A11Y-BASELINE + role smoke; not WCAG cert; no human keyboard pass log yet' },
  { dim: 'Lab honesty', score: 3.5, note: 'rebased 2026-08-04 · skins explore only' },
  { dim: 'Enforceability', score: 3.5, note: 'CI check:ui-frames · dual-title strict · a11y role smoke optional' },
  { dim: 'Odoo grammar wireframes', score: 4, note: 'CP + form-sheet + chatter wires' },
];

const FINDINGS: Finding[] = [
  {
    id: 'C1',
    sev: 'critical',
    status: 'fixed',
    title: 'Student detail chỉ dựa location.state (mất data khi refresh)',
    evidence: 'student-detail.tsx — đã thêm trpc.student.get by route id + state cache.',
    impact: 'Deep-link / F5 trống identity dù có Detail chrome.',
    fix: 'Done: student.get.useQuery({ id }).',
  },
  {
    id: 'C2',
    sev: 'critical',
    status: 'fixed',
    title: 'Gate dual-title chỉ báo cáo, bulk-only strict trước đây',
    evidence: 'strict: dual-title + bulk; report: FilterBar · ListPagination · detailTiers full|standard|settings|thin.',
    impact: 'Depth signals visible; dual-title cannot regress under CI.',
    fix: 'Done cycle 4a report matrix; strict stays dual-title+bulk only.',
  },
  {
    id: 'C3',
    sev: 'critical',
    status: 'fixed',
    title: 'Lab Red team panel stale (⌘K miss / no CI) so với product',
    evidence: 'Panel rebased this cycle; inventory + CI + SettingsShell reflected.',
    impact: 'Agent đọc ★ Red team re-open work đã xong.',
    fix: 'Rebase findings + scorecard 2026-08-04.',
  },
  {
    id: 'H1',
    sev: 'high',
    status: 'fixed',
    title: 'Bulk “smart” chủ yếu clipboard (7/8), gifts mới multi-mutate',
    evidence: 'Inventory Bulk rollout = partial (clipboard-only except gifts multi-hide). Domain bulk optional P2.',
    impact: 'Selection UI honesty restored — no oversell as domain multi-mutate.',
    fix: 'Done: lab inventory partial-honest (cycle 3c). Optional export/tag later.',
  },
  {
    id: 'H2',
    sev: 'high',
    status: 'partial',
    title: 'FilterBar chưa phải list OS — nhiều màn TextInput/Selector ad-hoc',
    evidence: 'FilterBar product: receipts·schedule·rewards·students·aftersale·post-sale-meeting. Residual ad-hoc on boards/wizards.',
    impact: 'High-traffic lists aligned; non-list surfaces exempt.',
    fix: 'Done for cycle 3a high-traffic; residual low-traffic deferred.',
  },
  {
    id: 'H3',
    sev: 'high',
    status: 'partial',
    title: 'ListPagination chỉ ~8 list bulk cohort',
    evidence: 'Added courses·rewards·post-sale-meeting ListPagination (server/client total honest). Exempt: pipeline board, schedule calendar, grading MD, class-placement.',
    impact: 'Cycle 3b traffic lists closed; residual medium-traffic optional.',
    fix: 'Done for B1/B2/B5; kpi/reconciliation optional later.',
  },
  {
    id: 'H4',
    sev: 'high',
    status: 'fixed',
    title: 'Cockpit generic empty CTA sai target (/hr/my vs checkin)',
    evidence: 'cockpit.tsx emptyAction → /hr/checkin (fixed).',
    impact: 'Next-step CTA sai.',
    fix: 'Done.',
  },
  {
    id: 'H6',
    sev: 'high',
    status: 'fixed',
    title: 'Detail recipe depth hai tầng (money/CRM full; khác mỏng)',
    evidence: 'PAGE-FRAMES tiers full|standard|settings|thin; check-ui-frames detailTiers; settings exempt EntityHeader; thin=payroll·my-hr residual.',
    impact: 'Agents no longer treat settings/thin as dual-title or EH failures.',
    fix: 'Done cycle 4a: document + measure. Optional promote payroll later.',
  },
  {
    id: 'W1',
    sev: 'medium',
    status: 'fixed',
    title: 'Wireframes thiếu Odoo ControlPanel / form sheet / chatter',
    evidence: 'Added odoo-control-panel · odoo-form-sheet · chatter-tab · list-bulk · master-detail.',
    impact: 'Lab không dạy grammar Odoo→CMC.',
    fix: 'Done via xia odoo 19.0 sources.',
  },
  {
    id: 'R2',
    sev: 'medium',
    status: 'partial',
    title: 'Explore skins vs Soft Ops SoT',
    evidence: 'Banner explore-only; still multi-skin gallery LOC.',
    impact: 'Authority confusion residual.',
    fix: 'Keep banners; no new skins; optional collapse default.',
  },
  {
    id: 'MS-3',
    sev: 'medium',
    status: 'partial',
    title: 'A11y baseline lite (no WCAG cert / no axe CI)',
    evidence:
      'design-system/cmc-edu/A11Y-BASELINE.md (paths + inventory + honest gaps) · scripts/check-ui-a11y-roles.mjs role smoke · MASTER/llms link only. SideNav still missing aria-label/aria-current.',
    impact: 'Agents have a re-runnable checklist; keyboard operability still unlogged.',
    fix: 'Baseline shipped partial. Do NOT mark fixed without human keyboard pass log. Full axe CI out of scope.',
  },
];

const NOT_ISSUES = [
  { claim: 'Phải re-skin Odoo purple / top nav', why: 'Non-goal; SideNav Soft Ops locked; grammar-only xia.' },
  { claim: 'Phải port OWL / XML arch', why: 'VIEW-GRAMMAR explicitly skips runtime.' },
  { claim: 'Kanban generic bắt buộc', why: 'Deferred; funnel+list is standard.' },
  { claim: 'Bulk clipboard = cook fail', why: 'WP1 accepted copy bulk; honesty is inventory label.' },
  { claim: '⌘K missing', why: 'Shell CommandPalette wired.' },
  { claim: 'SettingsShell 0', why: 'shift-config · network-ip · salary-tiers.' },
];

const REMEDIATION: { p: string; action: string }[] = [
  { p: 'P0', action: 'Student.get deep-link (done) · dual-title CI strict (done)' },
  { p: 'P0', action: 'Rebase lab red-team (this panel)' },
  { p: 'P1', action: 'FilterBar high-traffic lists (done cycle 3a)' },
  { p: 'P1', action: 'Pager residual courses/rewards/post-sale + bulk inventory honesty (done 3b/3c)' },
  { p: 'P1', action: 'Detail tiers documented + check-ui-frames depth report (done cycle 4a)' },
  { p: 'P1', action: 'A11y baseline lite + role smoke (partial; keyboard pass still open)' },
  { p: 'P2', action: 'Optional domain bulk mutation on receipts' },
  { p: 'P2', action: 'Do not expand style gallery' },
];

function sevLabel(s: Sev) {
  if (s === 'critical') return 'Critical';
  if (s === 'high') return 'High';
  if (s === 'medium') return 'Medium';
  if (s === 'low') return 'Low';
  return 'OK';
}

function statusLabel(s: Finding['status']) {
  if (s === 'fixed') return 'FIXED';
  if (s === 'partial') return 'PARTIAL';
  if (s === 'deferred') return 'DEFER';
  return 'OPEN';
}

export function RedTeamPanel() {
  const [filter, setFilter] = useState<'all' | Sev | 'open'>('all');
  const [openId, setOpenId] = useState<string | null>('H1');

  const rows = FINDINGS.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'open') return f.status === 'open' || f.status === 'partial';
    return f.sev === filter;
  });
  const avg = SCORECARD.reduce((a, b) => a + b.score, 0) / SCORECARD.length;

  return (
    <div className="rt-root">
      <div className="rt-banner" role="status">
        <strong>Verdict (2026-08-04 cycle 4):</strong> Soft Ops frames + bulk/CI gates{' '}
        <strong>PASS</strong>. Overall ≈ <strong>{avg.toFixed(1)}/5</strong> — FilterBar + pager
        closed; detail tiers documented; bulk honesty <strong>partial</strong>; a11y baseline{' '}
        <strong>partial</strong> (role smoke, not WCAG). Odoo xia = layout grammar only.
      </div>

      <div className="rt-scorecard">
        {SCORECARD.map((s) => (
          <div key={s.dim} className="rt-score">
            <div className="rt-score-top">
              <span>{s.dim}</span>
              <strong data-band={s.score <= 2.5 ? 'bad' : s.score <= 3.5 ? 'mid' : 'ok'}>
                {s.score}/5
              </strong>
            </div>
            <div className="rt-bar">
              <i
                style={{ width: `${(s.score / 5) * 100}%` }}
                data-band={s.score <= 2.5 ? 'bad' : s.score <= 3.5 ? 'mid' : 'ok'}
              />
            </div>
            <p>{s.note}</p>
          </div>
        ))}
      </div>

      <div className="rt-filters">
        {(
          [
            ['all', `Tất cả (${FINDINGS.length})`],
            ['open', `Open/partial (${FINDINGS.filter((f) => f.status === 'open' || f.status === 'partial').length})`],
            ['critical', 'Critical'],
            ['high', 'High'],
            ['medium', 'Medium'],
          ] as const
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            className="rt-chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rt-list">
        {rows.map((f) => {
          const open = openId === f.id;
          return (
            <article key={f.id} className="rt-finding" data-sev={f.sev} data-status={f.status}>
              <button
                type="button"
                className="rt-finding-head"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : f.id)}
              >
                <span className="rt-sev">{sevLabel(f.sev)}</span>
                <span className="rt-status">{statusLabel(f.status)}</span>
                <strong>
                  {f.id} · {f.title}
                </strong>
                <span className="rt-chev">{open ? '▾' : '▸'}</span>
              </button>
              {open ? (
                <div className="rt-finding-body">
                  <p>
                    <em>Evidence:</em> {f.evidence}
                  </p>
                  <p>
                    <em>Impact:</em> {f.impact}
                  </p>
                  <p>
                    <em>Fix:</em> {f.fix}
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="rt-two">
        <div className="rt-card">
          <h4>Không phải vấn đề (reject)</h4>
          <ul>
            {NOT_ISSUES.map((n) => (
              <li key={n.claim}>
                <strong>{n.claim}</strong> — {n.why}
              </li>
            ))}
          </ul>
        </div>
        <div className="rt-card rt-card--fix">
          <h4>Remediation</h4>
          <ol>
            {REMEDIATION.map((r) => (
              <li key={r.action}>
                <span className="rt-p">{r.p}</span> {r.action}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="rt-foot">
        Subagents: code-reviewer (CMC UI) · researcher (Odoo xia) · explore (wireframe gaps). Wireframes:{' '}
        <a href="#wireframes">★ Wireframes</a> · Upgrade: <a href="#upgrade">★ Nâng cấp</a>.
      </p>
    </div>
  );
}

export default RedTeamPanel;
