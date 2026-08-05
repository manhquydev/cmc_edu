// L4 — Before / After comparison (manual vs automated). Use sparingly.

import { escapeHtml } from '../load-flow-data.js';
import type { BeforeAfterSide } from '../types.js';

export function renderBeforeAfter(
  before: BeforeAfterSide,
  after: BeforeAfterSide,
): string {
  const side = (s: BeforeAfterSide, cls: string) => {
    const items = s.items
      .map((it) => `<li class="fragment">${escapeHtml(it)}</li>`)
      .join('');
    return `<div class="ba-side ${cls}">
      <div class="ba-title">${escapeHtml(s.title)}</div>
      <ul class="ba-list">${items}</ul>
    </div>`;
  };

  return `<div class="diagram before-after" role="img" aria-label="Trước và sau">
    ${side(before, 'ba-before')}
    <div class="ba-arrow" aria-hidden="true">→</div>
    ${side(after, 'ba-after')}
  </div>`;
}
