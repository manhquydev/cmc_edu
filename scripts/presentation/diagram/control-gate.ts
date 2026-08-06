// L3 — Control gate: approve / reject / return / escalate.

import { escapeHtml } from '../load-flow-data.js';
import type { ControlGateOption } from '../types.js';

const KIND_LABEL: Record<ControlGateOption['kind'], string> = {
  approve: 'Duyệt',
  reject: 'Từ chối',
  return: 'Trả lại',
  escalate: 'Chuyển lên',
};

const KIND_CLASS: Record<ControlGateOption['kind'], string> = {
  approve: 'gate-approve',
  reject: 'gate-reject',
  return: 'gate-return',
  escalate: 'gate-escalate',
};

export function renderControlGate(
  options: ControlGateOption[],
  title = 'Cổng kiểm soát',
): string {
  if (options.length === 0) {
    return `<div class="diagram control-gate empty">Chưa có nhánh</div>`;
  }

  const cards = options
    .map((o, i) => {
      const note = o.note ? `<div class="gate-note">${escapeHtml(o.note)}</div>` : '';
      return `<div class="gate-card ${KIND_CLASS[o.kind]} fragment" data-fragment-index="${i + 1}">
        <div class="gate-kind">${escapeHtml(KIND_LABEL[o.kind])}</div>
        <div class="gate-label">${escapeHtml(o.label)}</div>
        ${note}
      </div>`;
    })
    .join('');

  return `<div class="diagram control-gate" role="img" aria-label="Cổng kiểm soát">
    <div class="diagram-title">${escapeHtml(title)}</div>
    <div class="gate-funnel">
      <div class="gate-in">Yêu cầu vào</div>
      <div class="gate-arrow">↓</div>
      <div class="gate-options">${cards}</div>
    </div>
  </div>`;
}
