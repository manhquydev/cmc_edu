// L1 — Role swimlane with a fixed "system does" lane.

import { escapeHtml, roleLabelVi } from '../load-flow-data.js';
import type { SwimlaneStep } from '../types.js';

export function renderSwimlane(steps: SwimlaneStep[], title?: string): string {
  if (steps.length === 0) {
    return `<div class="diagram swimlane empty">Chưa có bước</div>`;
  }

  // Group consecutive steps by actor into lanes order of first appearance
  const laneOrder: string[] = [];
  const byLane = new Map<string, SwimlaneStep[]>();
  for (const step of steps) {
    const key = step.system ? '__system__' : step.actor;
    if (!byLane.has(key)) {
      byLane.set(key, []);
      laneOrder.push(key);
    }
    byLane.get(key)!.push(step);
  }
  // Ensure system lane is last if present
  const systemIdx = laneOrder.indexOf('__system__');
  if (systemIdx >= 0 && systemIdx !== laneOrder.length - 1) {
    laneOrder.splice(systemIdx, 1);
    laneOrder.push('__system__');
  }

  const lanes = laneOrder
    .map((key) => {
      const items = byLane.get(key)!;
      const isSystem = key === '__system__';
      const label = isSystem ? '⚙️ Hệ thống tự làm' : roleLabelVi(key);
      const cells = items
        .map(
          (s, i) =>
            `<div class="lane-step fragment" data-fragment-index="${i + 1}"><span class="lane-action">${escapeHtml(s.action)}</span></div>`,
        )
        .join('');
      return `<div class="lane ${isSystem ? 'lane-system' : ''}">
        <div class="lane-label">${escapeHtml(label)}</div>
        <div class="lane-steps">${cells}</div>
      </div>`;
    })
    .join('');

  const heading = title
    ? `<div class="diagram-title">${escapeHtml(title)}</div>`
    : '';

  return `<div class="diagram swimlane" role="img" aria-label="Sơ đồ làn vai trò">
    ${heading}
    <div class="lanes">${lanes}</div>
  </div>`;
}
