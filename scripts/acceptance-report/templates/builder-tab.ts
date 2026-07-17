// Builder tab (self-audit): symbol thiếu, orphan procedures, scanner health.
// Local-only — never enters --inline output (D4, red-team #8).

import type { VerificationResult } from '../types.js';
import { escapeHtml } from './layout.js';

export function renderBuilderTab(result: VerificationResult): string {
  const built = result.flows.filter((f) => f.status === 'built').length;
  const partial = result.flows.filter((f) => f.status === 'partial').length;
  const missing = result.flows.filter((f) => f.status === 'missing').length;
  const pct = result.flows.length > 0 ? Math.round((built / result.flows.length) * 100) : 0;

  const rows = result.flows
    .map((fv) => {
      const missingList = [
        ...fv.missing.trpc.map((s) => `trpc: <code>${escapeHtml(s)}</code>`),
        ...fv.missing.uiRoutes.map((s) => `route: <code>${escapeHtml(s)}</code>`),
        ...fv.missing.models.map((s) => `model: <code>${escapeHtml(s)}</code>`),
      ];
      return `
      <details>
        <summary>
          <span class="badge badge-${fv.status}">${statusLabel(fv.status)}</span>
          ${escapeHtml(fv.flow.id)} — ${escapeHtml(fv.flow.displayName)}
          <span style="color: var(--cmc-text-muted); font-size: 12px;">(${escapeHtml(fv.flow.cluster)})</span>
        </summary>
        <div class="body">
          <div><strong>tRPC kỳ vọng:</strong> ${fv.flow.expected.trpc.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ') || '—'}</div>
          <div><strong>UI routes kỳ vọng:</strong> ${fv.flow.expected.uiRoutes.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ') || '—'}</div>
          <div><strong>Models kỳ vọng:</strong> ${fv.flow.expected.models.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ') || '—'}</div>
          ${missingList.length > 0 ? `<div class="missing-list"><strong>Thiếu:</strong> ${missingList.join(', ')}</div>` : ''}
        </div>
      </details>`;
    })
    .join('');

  const orphanRows = result.orphans.procedures
    .map((p) => `<tr><td><code>${escapeHtml(p)}</code></td></tr>`)
    .join('');

  const unresolvedWarning =
    result.scan.unresolvedNamespaces.length > 0
      ? `<div class="stat" style="border-left: 3px solid var(--cmc-danger);">
           <div class="label">Namespace chưa parse được</div>
           <div class="value" style="font-size: 14px;">${result.scan.unresolvedNamespaces.map(escapeHtml).join(', ')}</div>
         </div>`
      : '';

  return `
    <div class="summary-band">
      <div class="stat"><div class="value">${built}/${result.flows.length}</div><div class="label">Luồng đã xây (${pct}%)</div></div>
      <div class="stat"><div class="value">${partial}</div><div class="label">Luồng thiếu một phần</div></div>
      <div class="stat"><div class="value">${missing}</div><div class="label">Luồng chưa có</div></div>
      <div class="stat"><div class="value">${result.orphans.procedures.length}</div><div class="label">Procedure mồ côi</div></div>
      <div class="stat"><div class="value">${result.scan.trpcNamespaceCount}</div><div class="label">tRPC namespace quét được</div></div>
    </div>
    ${unresolvedWarning}
    <section>
      <h2>Luồng nghiệp vụ</h2>
      ${rows}
    </section>
    <section>
      <h2>Orphan procedures (không thuộc luồng nào trong manifest)</h2>
      ${orphanRows ? `<table><thead><tr><th>Procedure</th></tr></thead><tbody>${orphanRows}</tbody></table>` : '<p style="color: var(--cmc-text-muted);">Không có.</p>'}
    </section>
  `;
}

function statusLabel(status: string): string {
  if (status === 'built') return 'Đã xây';
  if (status === 'partial') return 'Thiếu 1 phần';
  return 'Chưa có';
}
