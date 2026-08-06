// Self-contained HTML shell for reveal.js offline deck.
// System font stack (no @font-face) — same approach as acceptance-report layout.

import type { DeckFlowData } from '../types.js';
import { renderWarningBanners } from '../load-flow-data.js';

/** CSS tokens + deck layout. No external font files. */
export const DECK_CSS = `
:root {
  --cmc-brand: #0071e3;
  --cmc-brand-hover: #0055c6;
  --cmc-brand-muted: #e8f1fc;
  --cmc-text: #1d1d1f;
  --cmc-text-2: #3c3c43;
  --cmc-text-muted: #6e6e73;
  --cmc-surface: #ffffff;
  --cmc-surface-2: #f5f5f7;
  --cmc-border: #d2d2d7;
  --cmc-success: #2e7d32;
  --cmc-warning: #b26a00;
  --cmc-danger: #c62828;
  --cmc-canvas: #f7f6f3;
  --cmc-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}
html, body {
  margin: 0;
  font-family: var(--cmc-font-sans);
  color: var(--cmc-text);
  background: var(--cmc-canvas);
}
.reveal {
  font-family: var(--cmc-font-sans);
  font-size: 28px;
  color: var(--cmc-text);
}
.reveal .slides section {
  text-align: left;
  padding: 24px 40px;
  box-sizing: border-box;
}
.reveal h1, .reveal h2, .reveal h3 {
  font-family: var(--cmc-font-sans);
  text-transform: none;
  color: var(--cmc-text);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.reveal h1 { font-size: 1.6em; }
.reveal h2 { font-size: 1.25em; margin-bottom: 0.6em; }
.reveal h3 { font-size: 1.05em; color: var(--cmc-text-2); }
.reveal p, .reveal li { color: var(--cmc-text-2); line-height: 1.45; }
.reveal .subtitle { color: var(--cmc-text-muted); font-size: 0.7em; margin-top: 0.3em; }
.reveal .flow-id {
  position: absolute; top: 12px; right: 20px;
  font-size: 0.45em; color: var(--cmc-text-muted);
  font-weight: 500; letter-spacing: 0.04em;
}
.reveal .status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.5em;
  font-weight: 600;
  margin-top: 0.5em;
}
.status-verified { background: #e6f4ea; color: var(--cmc-success); }
.status-reachable { background: #fff3e0; color: var(--cmc-warning); }
.status-not-proven { background: #fdecea; color: var(--cmc-danger); }
.status-unmeasured { background: #eceff1; color: var(--cmc-text-muted); }
.status-hint { font-size: 0.45em; color: var(--cmc-text-muted); margin-top: 0.35em; max-width: 40em; }

.deck-banner {
  position: fixed; left: 0; right: 0; z-index: 50;
  padding: 6px 16px; font-size: 12px; font-weight: 600;
  text-align: center; font-family: var(--cmc-font-sans);
}
.deck-banner-draft { top: 0; background: #5c6bc0; color: #fff; }
.deck-banner-warn { background: #fff3e0; color: #b26a00; border-bottom: 1px solid #ffe0b2; }
.deck-banner-stale { background: #fdecea; color: #c62828; border-bottom: 1px solid #ffcdd2; }
.deck-banner-critical { background: #fce4ec; color: #ad1457; border-bottom: 1px solid #f8bbd0; }
.banner-stack { position: fixed; top: 0; left: 0; right: 0; z-index: 50; }
.banner-stack .deck-banner { position: relative; }

.deck-meta {
  position: fixed; bottom: 8px; left: 12px; z-index: 40;
  font-size: 11px; color: var(--cmc-text-muted); font-family: var(--cmc-font-sans);
  opacity: 0.75;
}

/* Diagrams */
.diagram { margin-top: 0.6em; width: 100%; }
.diagram-title { font-size: 0.65em; font-weight: 600; color: var(--cmc-text-muted); margin-bottom: 0.5em; }
.swimlane .lanes { display: flex; flex-direction: column; gap: 8px; }
.lane { display: grid; grid-template-columns: 160px 1fr; gap: 8px; align-items: stretch; min-height: 48px; }
.lane-label {
  background: var(--cmc-brand-muted); color: var(--cmc-brand-hover);
  border-radius: 8px; padding: 8px 10px; font-size: 0.5em; font-weight: 600;
  display: flex; align-items: center;
}
.lane-system .lane-label { background: #eceff1; color: #455a64; }
.lane-steps { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.lane-step {
  background: var(--cmc-surface); border: 1px solid var(--cmc-border);
  border-radius: 8px; padding: 8px 12px; font-size: 0.5em;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.lane-action { color: var(--cmc-text); }

.journey .j-track { display: flex; flex-direction: column; gap: 0; position: relative; padding-left: 8px; }
.j-node { display: grid; grid-template-columns: 72px 16px 1fr; gap: 10px; align-items: start; padding: 8px 0; }
.j-time { font-size: 0.45em; color: var(--cmc-brand); font-weight: 600; text-align: right; padding-top: 2px; }
.j-time-empty { color: var(--cmc-text-muted); }
.j-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--cmc-brand); margin-top: 4px; box-shadow: 0 0 0 3px var(--cmc-brand-muted); }
.j-title { font-size: 0.55em; font-weight: 600; }
.j-detail { font-size: 0.45em; color: var(--cmc-text-muted); margin-top: 2px; }

.control-gate .gate-funnel { text-align: center; }
.gate-in { display: inline-block; background: var(--cmc-brand-muted); color: var(--cmc-brand); padding: 8px 16px; border-radius: 8px; font-size: 0.5em; font-weight: 600; }
.gate-arrow { font-size: 1em; color: var(--cmc-text-muted); margin: 4px 0; }
.gate-options { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 8px; }
.gate-card { min-width: 140px; max-width: 200px; border-radius: 10px; padding: 12px; border: 2px solid var(--cmc-border); background: var(--cmc-surface); text-align: left; }
.gate-approve { border-color: #81c784; }
.gate-reject { border-color: #e57373; }
.gate-return { border-color: #ffb74d; }
.gate-escalate { border-color: #64b5f6; }
.gate-kind { font-size: 0.4em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cmc-text-muted); }
.gate-label { font-size: 0.5em; font-weight: 600; margin-top: 4px; }
.gate-note { font-size: 0.4em; color: var(--cmc-text-muted); margin-top: 6px; }

.before-after { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: start; }
.ba-side { background: var(--cmc-surface); border-radius: 12px; padding: 14px; border: 1px solid var(--cmc-border); }
.ba-before { border-left: 4px solid #e57373; }
.ba-after { border-left: 4px solid #81c784; }
.ba-title { font-size: 0.55em; font-weight: 700; margin-bottom: 8px; }
.ba-list { margin: 0; padding-left: 1.1em; font-size: 0.48em; }
.ba-arrow { font-size: 1.4em; color: var(--cmc-brand); align-self: center; }

.screen-sketch svg { max-height: 320px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

.home-map .map-row { display: flex; gap: 16px; margin-bottom: 12px; }
.map-group { flex: 1; }
.map-group-wide { flex: 1 1 100%; }
.map-group-title { font-size: 0.45em; font-weight: 600; color: var(--cmc-text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.map-blocks { display: flex; flex-wrap: wrap; gap: 8px; }
.map-block {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 16px; border-radius: 10px; text-decoration: none !important;
  font-size: 0.5em; font-weight: 600; min-width: 100px; text-align: center;
  border: 2px solid transparent; transition: transform 0.12s ease;
}
.map-block:hover { transform: translateY(-2px); }
.map-role { background: var(--cmc-brand-muted); color: var(--cmc-brand-hover); border-color: #b3d4fc; }
.map-cluster { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
.map-gate { background: #fff3e0; color: #e65100; border-color: #ffcc80; }
.map-system { background: #eceff1; color: #37474f; border-color: #cfd8dc; }
.map-ai { background: #f3e5f5; color: #6a1b9a; border-color: #ce93d8; }
.map-hint { font-size: 0.4em; color: var(--cmc-text-muted); margin-top: 12px; }

.q-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 0.6em; }
.q-card {
  background: var(--cmc-surface); border: 1px solid var(--cmc-border);
  border-radius: 10px; padding: 12px 14px;
}
.q-label { font-size: 0.4em; font-weight: 700; color: var(--cmc-brand); text-transform: uppercase; letter-spacing: 0.03em; }
.q-body { font-size: 0.5em; margin-top: 4px; color: var(--cmc-text); line-height: 1.35; }

.spine-lines { font-size: 0.75em; line-height: 1.5; }
.spine-lines p { margin: 0.35em 0; }
.bridge { font-size: 0.55em; color: var(--cmc-brand); font-style: italic; margin-top: 1em; }

.cluster-index { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0.5em; }
.cluster-index a {
  font-size: 0.45em; padding: 8px 12px; background: var(--cmc-surface);
  border: 1px solid var(--cmc-border); border-radius: 8px; text-decoration: none !important;
  color: var(--cmc-text); font-weight: 500;
}
.cluster-index a:hover { border-color: var(--cmc-brand); color: var(--cmc-brand); }

.rules-list { font-size: 0.5em; margin-top: 0.6em; padding-left: 1.2em; color: var(--cmc-text-2); }
.counts-band { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 1em; }
.stat-chip {
  background: var(--cmc-surface); border-radius: 10px; padding: 12px 16px;
  border: 1px solid var(--cmc-border); min-width: 100px;
}
.stat-chip .v { font-size: 1.1em; font-weight: 700; color: var(--cmc-brand); }
.stat-chip .l { font-size: 0.4em; color: var(--cmc-text-muted); margin-top: 2px; }

/* Speaker notes: only visible in notes view / secondary display */
.reveal aside.notes { display: none; }

@media print {
  .deck-banner, .banner-stack, .deck-meta { display: none !important; }
}
`;

export interface DeckShellOptions {
  title: string;
  slidesHtml: string;
  data: DeckFlowData;
  version: string;
  buildSha: string;
  buildDate: string;
  /** Relative paths from index.html to vendor assets */
  assetPaths: {
    revealCss: string;
    themeCss: string;
    revealJs: string;
    notesJs: string;
  };
}

export function renderDeckShell(opts: DeckShellOptions): string {
  const banners = renderWarningBanners(opts.data.warnings, opts.data.counts);
  const meta = `v${opts.version} · ${opts.buildDate} · ${opts.buildSha.slice(0, 7)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeAttr(opts.title)}</title>
  <link rel="stylesheet" href="${escapeAttr(opts.assetPaths.revealCss)}" />
  <link rel="stylesheet" href="${escapeAttr(opts.assetPaths.themeCss)}" />
  <style>${DECK_CSS}</style>
</head>
<body>
  <div class="banner-stack">${banners}</div>
  <div class="deck-meta">${escapeAttr(meta)}</div>
  <div class="reveal">
    <div class="slides">
${opts.slidesHtml}
    </div>
  </div>
  <script src="${escapeAttr(opts.assetPaths.revealJs)}"></script>
  <script src="${escapeAttr(opts.assetPaths.notesJs)}"></script>
  <script>
    (function () {
      // UMD build: Reveal.initialize merges config onto the singleton (not \`new Reveal\`).
      Reveal.initialize({
        hash: true,
        slideNumber: 'c/t',
        showNotes: false,
        pdfSeparateFragments: false,
        fragmentInURL: true,
        transition: 'fade',
        backgroundTransition: 'none',
        width: 1280,
        height: 720,
        margin: 0.06,
        minScale: 0.2,
        maxScale: 1.5,
        plugins: [typeof RevealNotes !== 'undefined' ? RevealNotes : undefined].filter(Boolean),
        keyboard: {
          72: function () { // H — home map
            var el = document.getElementById('home-map');
            if (!el) return;
            var idx = Reveal.getIndices(el);
            Reveal.slide(idx.h, idx.v);
          }
        }
      });
    })();
  </script>
</body>
</html>
`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
