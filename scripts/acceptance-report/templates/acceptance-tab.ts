// Nghiệm thu tab — ban giám đốc CMC, non-dev. Zero jargon: hiển thị 100% từ
// displayName/clusterLabel trong manifest, KHÔNG bao giờ in raw tRPC
// procedure/route/model — kể cả statusReason.detail (chứa lệnh grep + tên
// procedure), thứ chỉ được hiện ở tab Builder nội bộ.
//
// ⬤ "đã chứng minh chạy" đến từ ingestion kết quả Playwright thật: spec của
// luồng phải chạy, phải xanh, ở đúng commit HEAD, và luồng phải đã xây đủ.
// Không có đường nào khác lên ⬤.

import type { AcceptanceState, Cluster, EvidenceBadge, FlowVerification, VerificationResult } from '../types.js';
import { escapeHtml } from './layout.js';

const CLUSTER_LABELS: Record<Cluster, string> = {
  P1: 'Tuyển sinh & ghi danh',
  P2: 'Vận hành lớp học',
  P3: 'Nhân sự & lương',
  P4: 'Đổi quà & chăm sóc phụ huynh',
  ADMIN: 'Quản trị hệ thống',
};

// Trạng thái đến từ ingestion kết quả Playwright thật (composeFlowEvidence),
// KHÔNG phải từ suy luận tĩnh: ⬤ chỉ sáng khi spec của luồng đó thực sự chạy
// và thực sự xanh ở đúng commit HEAD.
function acceptanceState(fv: FlowVerification): AcceptanceState {
  return fv.evidence.state;
}

function stateBadge(state: AcceptanceState): string {
  if (state === 'proven') return '<span class="accept-badge accept-proven">⬤ Đã chứng minh chạy</span>';
  if (state === 'built-unproven') return '<span class="accept-badge accept-built">◐ Đã xây, chưa chứng minh</span>';
  return '<span class="accept-badge accept-notyet">○ Đang xây dựng</span>';
}

/** Plain-language reason a flow is not ⬤, for a non-technical reader.
 *
 *  Deliberately does NOT print `statusReason.detail`: those details carry grep
 *  commands and procedure names, and this tab is the one that leaves the
 *  building. The verbatim evidence stays in the internal Builder tab. */
const BADGE_LABELS: Record<EvidenceBadge, string | null> = {
  proven: null,
  'no-results': 'Chưa nạp kết quả chạy',
  stale: 'Kết quả từ bản mã cũ',
  partial: 'Lần chạy vừa rồi không chạy bài kiểm này',
  'red-fixme': 'Đang lỗi — đã xác định nguyên nhân',
  'red-untriaged': 'ĐỎ CHƯA TRIAGE',
  vacuous: 'Bài kiểm bị tạm tắt — không có phép thử nào chạy',
  'no-journey': 'Chưa có bài kiểm tự động',
  'no-ui-path': 'Chưa có đường thao tác trên giao diện',
  'h2-mismatch': 'Bài kiểm gắn sai luồng — kết quả không tính',
  'passed-not-built': 'Bài kiểm xanh nhưng luồng chưa xây đủ',
};

function reasonBadge(fv: FlowVerification): string {
  const label = BADGE_LABELS[fv.evidence.badge];
  if (!label) return '';
  // Untriaged red is the one case that must be impossible to skim past: a red
  // flow nobody has looked at is worse news than a red flow with a known cause.
  const loud = fv.evidence.badge === 'red-untriaged' ? ' accept-loud' : '';
  return `<span class="accept-badge accept-journey${loud}">${escapeHtml(label)}</span>`;
}

/** Provenance strip: which run backs every ⬤ on this page. Without it a reader
 *  cannot tell a full verified run from a single spec someone ran locally. */
function provenanceBanner(result: VerificationResult): string {
  const run = result.evidenceRun;
  if (!run.present) {
    return `<p class="provenance provenance-warn">Trang này <strong>chưa nạp kết quả chạy nào</strong> —
      không luồng nào có thể ở trạng thái "đã chứng minh chạy". Cần chạy bộ bài kiểm giao diện rồi tạo lại báo cáo.</p>`;
  }
  if (run.sha !== run.headSha) {
    return `<p class="provenance provenance-warn">Kết quả chạy thuộc <strong>một bản mã khác</strong> với bản đang xem
      (kết quả: ${escapeHtml((run.sha ?? 'không ghi').slice(0, 7))}, bản đang xem: ${escapeHtml(run.headSha.slice(0, 7))}).
      Mọi luồng đã hạ về "chưa chứng minh".</p>`;
  }
  if (run.dirty) {
    return `<p class="provenance provenance-warn">Lần chạy này diễn ra trên <strong>bản mã đã bị sửa nhưng chưa lưu</strong>,
      nên kết quả không thuộc về đúng bản mã nào. Trang này <strong>chỉ dùng tham khảo nội bộ</strong>, không phải sổ nghiệm thu.</p>`;
  }
  if (run.runErrors > 0) {
    return `<p class="provenance provenance-warn">Lần chạy này <strong>gặp lỗi ở mức hệ thống</strong>
      (${run.runErrors} lỗi) nên chưa chạy hết — không dùng làm sổ nghiệm thu.</p>`;
  }
  if (run.unrunJourneys.length > 0) {
    return `<p class="provenance provenance-warn">Lần chạy này <strong>chỉ phủ một phần</strong>:
      ${run.unrunJourneys.length} bài kiểm đã khai nhưng không được chạy. Không dùng bản này làm sổ nghiệm thu chính thức.</p>`;
  }
  return `<p class="provenance">Trạng thái ⬤ trên trang này lấy từ một lần chạy bài kiểm thật, đúng bản mã
    ${escapeHtml(run.headSha.slice(0, 7))}, phủ đủ mọi bài kiểm đã khai.</p>`;
}

/** Says WHY a flow is not ready. A placeholder screen is the one case where
 *  every procedure and model exists, so without naming it the card looks
 *  unfinished for no visible reason. */
function flowNote(fv: FlowVerification, state: AcceptanceState): string {
  if (fv.placeholderRoutes.length > 0) {
    const paths = fv.placeholderRoutes.map((r) => escapeHtml(r.path)).join(', ');
    return `Màn hình chưa được xây — ${paths} hiện chỉ là trang giữ chỗ.`;
  }
  if (state === 'proven') {
    return 'Đã chạy thật qua giao diện và cho kết quả đúng ở lần kiểm gần nhất.';
  }
  return state === 'not-yet'
    ? 'Đang xây dựng — chưa dùng được đầy đủ.'
    : 'Đã xây xong theo thiết kế, nhưng chưa có lần chạy thật nào chứng minh.';
}

export function renderAcceptanceTab(result: VerificationResult): string {
  const byCluster = groupByCluster(result.flows);
  const provenCount = result.flows.filter((f) => acceptanceState(f) === 'proven').length;
  const builtCount = result.flows.filter((f) => acceptanceState(f) === 'built-unproven').length;
  const notYetCount = result.flows.filter((f) => acceptanceState(f) === 'not-yet').length;
  const journeyCount = result.flows.filter((f) => f.flow.journey).length;

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
              ${reasonBadge(fv)}
            </div>
            <div class="flow-card-title">${escapeHtml(fv.flow.displayName)}</div>
            <div class="flow-card-note">${flowNote(fv, state)}</div>
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
      .accept-journey { background: var(--cmc-surface-2); color: var(--cmc-text-muted); border: 1px dashed var(--cmc-border); margin-left: 6px; }
      .accept-loud { background: #fdecea; color: var(--cmc-danger); border: 1px solid var(--cmc-danger); font-weight: 600; }
      .provenance { font-size: 12px; color: var(--cmc-text-muted); margin: 0 0 var(--cmc-space-3); padding: var(--cmc-space-2) var(--cmc-space-3); background: var(--cmc-surface-2); border-radius: var(--cmc-radius-xs); }
      .provenance-warn { color: var(--cmc-danger); background: #fdecea; border: 1px solid var(--cmc-danger); }
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
      <div class="pill"><span class="n">${journeyCount}/${result.flows.length}</span><span class="l">▶ Luồng có bài kiểm UI</span></div>
    </div>
    ${provenanceBanner(result)}
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
