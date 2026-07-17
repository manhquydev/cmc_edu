// Nghiệm thu tab — ban giám đốc CMC, non-dev. Zero jargon: hiển thị 100% từ
// displayName/clusterLabel trong manifest, KHÔNG bao giờ in raw tRPC
// procedure/route/model. v1 không có evidence (Phase 4 gated) nên trạng thái
// tối đa là ◐ "đã xây, chưa chứng minh" — trung thực, không giả ⬤ (D7).

import type { Cluster, FlowVerification, VerificationResult } from '../types.js';
import { escapeHtml } from './layout.js';

const CLUSTER_LABELS: Record<Cluster, string> = {
  P1: 'Tuyển sinh & ghi danh',
  P2: 'Vận hành lớp học',
  P3: 'Nhân sự & lương',
  P4: 'Đổi quà & chăm sóc phụ huynh',
  ADMIN: 'Quản trị hệ thống',
};

type AcceptanceState = 'proven' | 'built-unproven' | 'not-yet';

function acceptanceState(fv: FlowVerification): AcceptanceState {
  // v1: không có evidence source — mọi luồng "built" dừng ở "đã xây, chưa
  // chứng minh". Khi Phase 4 mở, hàm này nhận thêm EvidenceIndex và áp mapping
  // đầy đủ theo D7 (evidence.commit === HEAD mới lên ⬤).
  return fv.status === 'built' ? 'built-unproven' : 'not-yet';
}

function stateBadge(state: AcceptanceState): string {
  if (state === 'proven') return '<span class="accept-badge accept-proven">⬤ Đã chứng minh chạy</span>';
  if (state === 'built-unproven') return '<span class="accept-badge accept-built">◐ Đã xây, chưa chứng minh</span>';
  return '<span class="accept-badge accept-notyet">○ Đang xây dựng</span>';
}

export function renderAcceptanceTab(result: VerificationResult): string {
  const byCluster = groupByCluster(result.flows);
  const provenCount = result.flows.filter((f) => acceptanceState(f) === 'proven').length;
  const builtCount = result.flows.filter((f) => acceptanceState(f) === 'built-unproven').length;
  const notYetCount = result.flows.filter((f) => acceptanceState(f) === 'not-yet').length;

  const clusterSections = (Object.keys(CLUSTER_LABELS) as Cluster[])
    .filter((c) => byCluster[c]?.length)
    .map((cluster) => {
      const cards = byCluster[cluster]!
        .map((fv) => {
          const state = acceptanceState(fv);
          return `
          <div class="flow-card">
            <div class="flow-card-top">
              ${stateBadge(state)}
            </div>
            <div class="flow-card-title">${escapeHtml(fv.flow.displayName)}</div>
            <div class="flow-card-note">${state === 'not-yet' ? 'Đang xây dựng — chưa dùng được đầy đủ.' : 'Đã xây xong theo thiết kế. Bằng chứng vận hành thật sẽ bổ sung ở đợt sau.'}</div>
          </div>`;
        })
        .join('');
      return `
        <section class="cluster-section">
          <h2>${escapeHtml(CLUSTER_LABELS[cluster])}</h2>
          <div class="flow-card-grid">${cards}</div>
        </section>`;
    })
    .join('');

  return `
    <style>
      .accept-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
      .accept-proven { background: #e6f4ea; color: var(--cmc-success); }
      .accept-built { background: var(--cmc-brand-muted); color: var(--cmc-brand-hover); }
      .accept-notyet { background: var(--cmc-surface-2); color: var(--cmc-text-muted); }
      .summary-row { display: flex; gap: var(--cmc-space-3); margin-bottom: var(--cmc-space-4); }
      .summary-row .pill { background: var(--cmc-surface); border-radius: var(--cmc-radius-md); padding: var(--cmc-space-3); flex: 1; box-shadow: var(--cmc-shadow-sm); text-align: center; }
      .summary-row .pill .n { font-size: 28px; font-weight: 600; display: block; }
      .summary-row .pill .l { font-size: 12px; color: var(--cmc-text-muted); }
      .cluster-section h2 { font-size: 16px; font-weight: 600; margin: var(--cmc-space-4) 0 var(--cmc-space-2); }
      .flow-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--cmc-space-3); }
      .flow-card { background: var(--cmc-surface); border-radius: var(--cmc-radius-md); padding: var(--cmc-space-3); box-shadow: var(--cmc-shadow-sm); }
      .flow-card-title { font-weight: 500; margin: var(--cmc-space-2) 0 4px; }
      .flow-card-note { font-size: 12px; color: var(--cmc-text-muted); }
    </style>
    <div class="summary-row">
      <div class="pill"><span class="n">${provenCount}</span><span class="l">⬤ Đã chứng minh chạy</span></div>
      <div class="pill"><span class="n">${builtCount}</span><span class="l">◐ Đã xây, chưa chứng minh</span></div>
      <div class="pill"><span class="n">${notYetCount}</span><span class="l">○ Đang xây dựng</span></div>
    </div>
    ${clusterSections}
  `;
}

function groupByCluster(flows: FlowVerification[]): Partial<Record<Cluster, FlowVerification[]>> {
  const grouped: Partial<Record<Cluster, FlowVerification[]>> = {};
  for (const fv of flows) {
    (grouped[fv.flow.cluster] ??= []).push(fv);
  }
  return grouped;
}
