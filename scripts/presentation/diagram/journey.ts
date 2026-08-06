// L2 — Day-in-life / timed journey for a single actor.

import { escapeHtml } from '../load-flow-data.js';
import type { JourneyMilestone } from '../types.js';

export function renderJourney(milestones: JourneyMilestone[], title?: string): string {
  if (milestones.length === 0) {
    return `<div class="diagram journey empty">Chưa có mốc</div>`;
  }

  const nodes = milestones
    .map((m, i) => {
      const time = m.time
        ? `<div class="j-time">${escapeHtml(m.time)}</div>`
        : `<div class="j-time j-time-empty">${i + 1}</div>`;
      const detail = m.detail
        ? `<div class="j-detail">${escapeHtml(m.detail)}</div>`
        : '';
      return `<div class="j-node fragment" data-fragment-index="${i + 1}">
        ${time}
        <div class="j-dot"></div>
        <div class="j-body">
          <div class="j-title">${escapeHtml(m.title)}</div>
          ${detail}
        </div>
      </div>`;
    })
    .join('');

  const heading = title
    ? `<div class="diagram-title">${escapeHtml(title)}</div>`
    : '';

  return `<div class="diagram journey" role="img" aria-label="Hành trình theo thời gian">
    ${heading}
    <div class="j-track">${nodes}</div>
  </div>`;
}
