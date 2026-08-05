// Assemble all reveal.js sections from spine + flows + home map.

import { renderBeforeAfter } from './diagram/before-after.js';
import { renderControlGate } from './diagram/control-gate.js';
import { renderHomeMap } from './diagram/home-map.js';
import { renderJourney } from './diagram/journey.js';
import { renderScreenSketch } from './diagram/screen-sketch.js';
import { renderSwimlane } from './diagram/swimlane.js';
import { escapeHtml, roleLabelVi } from './load-flow-data.js';
import { homeMapBlocks } from './content/home-map-data.js';
import { spineBeats } from './content/spine.js';
import { allFlowCopies } from './content/flows/index.js';
import { globalPresenterNotes } from './content/presenter-notes.js';
import type { DeckFlowData, FlowCopy, FlowTierLabel, SpineBeat } from './types.js';

function notesHtml(lines: string[] | undefined): string {
  if (!lines || lines.length === 0) return '';
  const items = lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  return `<aside class="notes"><ul>${items}</ul></aside>`;
}

function statusBadge(label: FlowTierLabel): string {
  const cls =
    label.correctness === 'verified-correct'
      ? 'status-verified'
      : label.correctness === 'reachable-only' || label.reachability === 'proven'
        ? 'status-reachable'
        : label.correctness === 'unmeasured' || label.reachability === 'unmeasured'
          ? 'status-unmeasured'
          : 'status-not-proven';
  const hint = label.audienceHint
    ? `<div class="status-hint">${escapeHtml(label.audienceHint)}</div>`
    : '';
  return `<div class="status-badge ${cls}">${escapeHtml(label.audienceLabel)}</div>${hint}`;
}

function renderDiagram(
  kind: string | undefined,
  src: Partial<FlowCopy> & Partial<SpineBeat>,
): string {
  switch (kind) {
    case 'swimlane':
      return renderSwimlane(src.steps ?? []);
    case 'journey':
      return renderJourney(src.milestones ?? []);
    case 'control-gate':
      return renderControlGate(src.gateOptions ?? []);
    case 'before-after':
      if (src.before && src.after) return renderBeforeAfter(src.before, src.after);
      return '';
    default:
      return '';
  }
}

function renderSpineSection(beat: SpineBeat): string {
  const lines = beat.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
  const bridge = beat.bridgeQuestion
    ? `<p class="bridge fragment">${escapeHtml(beat.bridgeQuestion)}</p>`
    : '';
  const diagram = renderDiagram(beat.diagram, beat);
  return `<section id="${escapeHtml(beat.id)}" data-beat="${escapeHtml(beat.id)}">
  <h2>${escapeHtml(beat.title)}</h2>
  <div class="spine-lines">${lines}</div>
  ${diagram}
  ${bridge}
  ${notesHtml(beat.notes)}
</section>`;
}

function renderFlowSection(copy: FlowCopy, label: FlowTierLabel | undefined): string {
  const badge = label ? statusBadge(label) : '';
  const diagram = renderDiagram(copy.diagram, copy);
  const sketch = copy.screenSketch
    ? renderScreenSketch(copy.screenSketch.title, copy.screenSketch.regions)
    : '';
  const rules =
    copy.rules && copy.rules.length > 0
      ? `<ul class="rules-list">${copy.rules.map((r) => `<li class="fragment">${escapeHtml(r)}</li>`).join('')}</ul>`
      : '';

  return `<section id="flow-${escapeHtml(copy.id)}" data-flow="${escapeHtml(copy.id)}">
  <span class="flow-id">${escapeHtml(copy.id)}</span>
  <h2>${escapeHtml(copy.title)}</h2>
  ${badge}
  <div class="q-grid">
    <div class="q-card"><div class="q-label">Ai bắt đầu?</div><div class="q-body">${escapeHtml(copy.whoStarts)}</div></div>
    <div class="q-card"><div class="q-label">Ai duyệt?</div><div class="q-body">${escapeHtml(copy.whoApproves)}</div></div>
    <div class="q-card"><div class="q-label">Hệ thống tự làm</div><div class="q-body">${escapeHtml(copy.systemDoes)}</div></div>
    <div class="q-card"><div class="q-label">Xem kết quả ở</div><div class="q-body">${escapeHtml(copy.resultScreen)}</div></div>
  </div>
  ${diagram}
  ${sketch}
  ${rules}
  ${notesHtml(copy.notes)}
</section>`;
}

function clusterTitle(cluster: string): string {
  const map: Record<string, string> = {
    P1: 'Tuyển sinh & ghi danh',
    P2: 'Vận hành lớp',
    P3: 'Nhân sự · ca · lương',
    P4: 'Đổi quà · họp · sau bán',
    ADMIN: 'Quản trị hệ thống',
  };
  return map[cluster] ?? cluster;
}

function renderClusterIndex(
  cluster: string,
  id: string,
  flows: FlowCopy[],
): string {
  const links = flows
    .map(
      (f) =>
        `<a href="#/flow-${escapeHtml(f.id)}">${escapeHtml(f.id)} · ${escapeHtml(f.title)}</a>`,
    )
    .join('');
  return `<section id="${escapeHtml(id)}">
  <h2>${escapeHtml(clusterTitle(cluster))}</h2>
  <p class="subtitle">${flows.length} luồng — bấm để xem chi tiết</p>
  <div class="cluster-index">${links}</div>
</section>`;
}

function renderRoleIndex(role: string, id: string, flows: FlowTierLabel[]): string {
  const links = flows
    .map(
      (f) =>
        `<a href="#/flow-${escapeHtml(f.id)}">${escapeHtml(f.id)} · ${escapeHtml(
          allFlowCopies.find((c) => c.id === f.id)?.title ?? f.displayName,
        )}</a>`,
    )
    .join('');
  return `<section id="${escapeHtml(id)}">
  <h2>${escapeHtml(roleLabelVi(role))}</h2>
  <p class="subtitle">Các luồng có vai trò này</p>
  <div class="cluster-index">${links || '<span class="subtitle">Không có luồng</span>'}</div>
</section>`;
}

export function renderAllSlides(data: DeckFlowData): string {
  const byId = new Map(data.flows.map((f) => [f.id, f]));
  const parts: string[] = [];

  // Title
  parts.push(`<section id="title">
  <h1>Vận hành CMC EDU</h1>
  <p class="subtitle">Toàn bộ cách hệ thống chạy ngoài đời — thuyết minh trực tiếp</p>
  <div class="counts-band">
    <div class="stat-chip"><div class="v">${data.counts.total}</div><div class="l">Luồng (từ manifest)</div></div>
    <div class="stat-chip"><div class="v">${data.counts.verifiedCorrect}</div><div class="l">Đã kiểm đúng nghiệp vụ</div></div>
    <div class="stat-chip"><div class="v">${data.counts.reachableOnly}</div><div class="l">Chạy được, chưa kiểm số</div></div>
    <div class="stat-chip"><div class="v">${data.counts.unmeasured > 0 ? data.counts.unmeasured : data.counts.notProven}</div><div class="l">Chưa chứng minh / chưa đo</div></div>
  </div>
  <p class="subtitle" style="margin-top:1em">Chạy thông ≠ đúng số học · UAT người thật chưa chạy</p>
  ${notesHtml(globalPresenterNotes.opening)}
</section>`);

  // Home map early
  parts.push(`<section id="home-map">
  ${renderHomeMap(homeMapBlocks)}
</section>`);

  // Evidence explainer
  parts.push(`<section id="evidence-tiers">
  <h2>Hai tầng nhãn trạng thái</h2>
  <div class="q-grid">
    <div class="q-card"><div class="q-label">Đã kiểm đúng nghiệp vụ</div><div class="q-body">Chạy được và đã kiểm số/trạng thái quan trọng</div></div>
    <div class="q-card"><div class="q-label">Đã chạy được, chưa kiểm số học</div><div class="q-body">Hành trình xanh — chưa khẳng định đúng số</div></div>
    <div class="q-card"><div class="q-label">Chưa chứng minh</div><div class="q-body">Chưa có bằng chứng chạy đủ trên bản này</div></div>
    <div class="q-card"><div class="q-label">Chưa đo</div><div class="q-body">Thiếu file số liệu trên máy build</div></div>
  </div>
  ${notesHtml(globalPresenterNotes.evidenceFaq)}
</section>`);

  // Spine
  parts.push(`<section id="spine-start">
  <h2>Mạch chính</h2>
  <p class="spine-lines">Một học sinh và những người chạm vào em ấy.</p>
</section>`);
  for (const beat of spineBeats) {
    parts.push(renderSpineSection(beat));
  }

  // Role indexes used by home map
  const roleMap: Array<{ role: string; id: string }> = [
    { role: 'sale', id: 'role-sale' },
    { role: 'giam_doc_kinh_doanh', id: 'role-gdkd' },
    { role: 'giam_doc_dao_tao', id: 'role-gddt' },
    { role: 'giao_vien', id: 'role-gv' },
    { role: 'phu_huynh', id: 'role-ph' },
    { role: 'hoc_vien', id: 'role-hv' },
    { role: 'he_thong', id: 'role-system' },
    { role: 'agent', id: 'role-ai' },
  ];
  for (const { role, id } of roleMap) {
    const flows = data.flows.filter((f) => f.actorRoles.includes(role));
    parts.push(renderRoleIndex(role, id, flows));
  }

  // Cluster indexes + flow slides
  const clusters: Array<{ cluster: string; id: string; prefix: string }> = [
    { cluster: 'P1', id: 'cluster-p1', prefix: 'P1' },
    { cluster: 'P2', id: 'cluster-p2', prefix: 'P2' },
    { cluster: 'P3', id: 'cluster-p3', prefix: 'P3' },
    { cluster: 'P4', id: 'cluster-p4', prefix: 'P4' },
    { cluster: 'ADMIN', id: 'cluster-admin', prefix: 'ADM' },
  ];

  for (const c of clusters) {
    const copies = allFlowCopies.filter((f) =>
      c.cluster === 'ADMIN' ? f.id.startsWith('ADM') : f.id.startsWith(c.prefix),
    );
    parts.push(renderClusterIndex(c.cluster, c.id, copies));
    for (const copy of copies) {
      parts.push(renderFlowSection(copy, byId.get(copy.id)));
    }
  }

  // Closing
  parts.push(`<section id="closing">
  <h2>Hỏi đáp</h2>
  <p class="spine-lines">Phím <strong>H</strong> — về bản đồ nhà.</p>
  <p class="subtitle">Mọi số liệu gắn commit trên góc màn hình.</p>
  ${notesHtml(globalPresenterNotes.closing)}
</section>`);

  return parts.join('\n');
}

/** Count customer-visible flow sections — must equal manifest size. */
export function countFlowSections(html: string): number {
  const matches = html.match(/data-flow="/g);
  return matches?.length ?? 0;
}
