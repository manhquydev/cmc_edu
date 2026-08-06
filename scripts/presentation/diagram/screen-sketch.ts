// SVG layout sketch of a UI screen — replaces real screenshots.
// Frames, columns, buttons, tables, Vietnamese labels only. No real data.

import { escapeHtml } from '../load-flow-data.js';
import type { ScreenSketchRegion } from '../types.js';

const FILL: Record<NonNullable<ScreenSketchRegion['kind']>, string> = {
  header: '#e8f1fc',
  nav: '#f5f5f7',
  table: '#ffffff',
  button: '#0071e3',
  card: '#ffffff',
  text: '#f5f5f7',
};

const STROKE: Record<NonNullable<ScreenSketchRegion['kind']>, string> = {
  header: '#0071e3',
  nav: '#d2d2d7',
  table: '#d2d2d7',
  button: '#0055c6',
  card: '#d2d2d7',
  text: '#d2d2d7',
};

export function renderScreenSketch(
  title: string,
  regions: ScreenSketchRegion[],
): string {
  const W = 640;
  const H = 360;
  const chrome = 28;

  const rects = regions
    .map((r) => {
      const kind = r.kind ?? 'card';
      const x = (r.x / 100) * W;
      const y = chrome + (r.y / 100) * (H - chrome);
      const w = (r.w / 100) * W;
      const h = (r.h / 100) * (H - chrome);
      const fill = FILL[kind];
      const stroke = STROKE[kind];
      const textFill = kind === 'button' ? '#ffffff' : '#1d1d1f';
      const fontSize = kind === 'button' ? 11 : 12;
      const labelY = y + h / 2 + 4;
      return `<g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
          rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <text x="${(x + w / 2).toFixed(1)}" y="${labelY.toFixed(1)}"
          text-anchor="middle" font-size="${fontSize}" fill="${textFill}"
          font-family="system-ui, sans-serif">${escapeXml(r.label)}</text>
      </g>`;
    })
    .join('');

  return `<div class="diagram screen-sketch" role="img" aria-label="Phác hoạ màn hình: ${escapeHtml(title)}">
    <div class="diagram-title">${escapeHtml(title)}</div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="#ffffff" stroke="#d2d2d7" stroke-width="2"/>
      <rect x="0" y="0" width="${W}" height="${chrome}" rx="10" fill="#f5f5f7"/>
      <circle cx="14" cy="14" r="5" fill="#ff5f57"/>
      <circle cx="32" cy="14" r="5" fill="#febc2e"/>
      <circle cx="50" cy="14" r="5" fill="#28c840"/>
      <text x="${W / 2}" y="18" text-anchor="middle" font-size="11" fill="#6e6e73"
        font-family="system-ui, sans-serif">${escapeXml(title)}</text>
      ${rects}
    </svg>
  </div>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
