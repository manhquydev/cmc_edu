// Interactive home map — one overview screen, clickable blocks.

import { escapeHtml } from '../load-flow-data.js';
import type { HomeMapBlock } from '../types.js';

export function renderHomeMap(blocks: HomeMapBlock[], title = 'Bản đồ nhà'): string {
  const byKind = (kind: HomeMapBlock['kind']) =>
    blocks
      .filter((b) => b.kind === kind)
      .map(
        (b) =>
          `<a class="map-block map-${b.kind}" href="#/${escapeHtml(b.href)}" data-slide-id="${escapeHtml(b.href)}">
            <span class="map-label">${escapeHtml(b.label)}</span>
          </a>`,
      )
      .join('');

  return `<div class="diagram home-map" role="navigation" aria-label="${escapeHtml(title)}">
    <div class="diagram-title">${escapeHtml(title)}</div>
    <div class="map-row">
      <div class="map-group">
        <div class="map-group-title">Vai trò</div>
        <div class="map-blocks">${byKind('role')}</div>
      </div>
      <div class="map-group">
        <div class="map-group-title">Tự động</div>
        <div class="map-blocks">${byKind('system')}${byKind('ai')}</div>
      </div>
    </div>
    <div class="map-row">
      <div class="map-group map-group-wide">
        <div class="map-group-title">Cụm nghiệp vụ</div>
        <div class="map-blocks">${byKind('cluster')}</div>
      </div>
    </div>
    <div class="map-row">
      <div class="map-group map-group-wide">
        <div class="map-group-title">Cổng kiểm soát</div>
        <div class="map-blocks">${byKind('gate')}</div>
      </div>
    </div>
    <p class="map-hint">Bấm một khối để nhảy · phím H để về đây</p>
  </div>`;
}
