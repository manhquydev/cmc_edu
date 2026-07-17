// Self-contained HTML shell: 2 tabs (Nghiệm thu / Builder), inline CSS/JS,
// zero framework, zero network asset (D5). Design tokens copied by value
// from packages/ui/src/tokens.css (TL12) — not imported at runtime, since
// this file has no build step and must open by double-click.

const TOKENS_CSS = `
  --cmc-brand: #0071e3;
  --cmc-brand-hover: #0055c6;
  --cmc-brand-muted: #e8f1fc;
  --cmc-text: #1d1d1f;
  --cmc-text-2: #3c3c43;
  --cmc-text-muted: #6e6e73;
  --cmc-text-faint: #aeaeb2;
  --cmc-surface: #ffffff;
  --cmc-surface-2: #f5f5f7;
  --cmc-border: #d2d2d7;
  --cmc-success: #2e7d32;
  --cmc-warning: #b26a00;
  --cmc-danger: #c62828;
  --cmc-radius-xs: 4px;
  --cmc-radius-md: 12px;
  --cmc-space-1: 4px;
  --cmc-space-2: 8px;
  --cmc-space-3: 16px;
  --cmc-space-4: 24px;
  --cmc-font-sans: "Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --cmc-canvas: #f7f6f3;
  --cmc-border-subtle: #ebeced;
  --cmc-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
`;

const BASE_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: var(--cmc-font-sans);
    color: var(--cmc-text);
    background: var(--cmc-canvas);
    font-size: 14px;
    line-height: 1.5;
  }
  header.page {
    padding: var(--cmc-space-4) var(--cmc-space-4) var(--cmc-space-3);
    background: var(--cmc-surface);
    border-bottom: 1px solid var(--cmc-border-subtle);
  }
  header.page h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
  header.page .meta { color: var(--cmc-text-muted); font-size: 13px; }
  nav.tabs {
    display: flex;
    gap: var(--cmc-space-2);
    padding: 0 var(--cmc-space-4);
    background: var(--cmc-surface);
    border-bottom: 1px solid var(--cmc-border-subtle);
  }
  nav.tabs button {
    appearance: none;
    border: none;
    background: none;
    padding: var(--cmc-space-3) var(--cmc-space-2);
    font: inherit;
    font-weight: 500;
    color: var(--cmc-text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  nav.tabs button.active { color: var(--cmc-brand); border-bottom-color: var(--cmc-brand); }
  main { padding: var(--cmc-space-4); max-width: 1100px; margin: 0 auto; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  table { width: 100%; border-collapse: collapse; background: var(--cmc-surface); border-radius: var(--cmc-radius-md); overflow: hidden; box-shadow: var(--cmc-shadow-sm); }
  th, td { text-align: left; padding: var(--cmc-space-2) var(--cmc-space-3); border-bottom: 1px solid var(--cmc-border-subtle); font-size: 13px; }
  th { color: var(--cmc-text-muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: var(--cmc-radius-xs); font-size: 12px; font-weight: 500; }
  .badge-built { background: #e6f4ea; color: var(--cmc-success); }
  .badge-partial { background: #fff3e0; color: var(--cmc-warning); }
  .badge-missing { background: #fdecea; color: var(--cmc-danger); }
  details { background: var(--cmc-surface); border-radius: var(--cmc-radius-md); margin-bottom: var(--cmc-space-2); box-shadow: var(--cmc-shadow-sm); }
  details summary { padding: var(--cmc-space-2) var(--cmc-space-3); cursor: pointer; font-weight: 500; list-style: none; }
  details summary::-webkit-details-marker { display: none; }
  details .body { padding: 0 var(--cmc-space-3) var(--cmc-space-3); color: var(--cmc-text-2); }
  .summary-band { display: flex; gap: var(--cmc-space-4); margin-bottom: var(--cmc-space-4); }
  .stat { background: var(--cmc-surface); border-radius: var(--cmc-radius-md); padding: var(--cmc-space-3); flex: 1; box-shadow: var(--cmc-shadow-sm); }
  .stat .value { font-size: 24px; font-weight: 600; }
  .stat .label { color: var(--cmc-text-muted); font-size: 12px; }
  code { background: var(--cmc-surface-2); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  .missing-list code { color: var(--cmc-danger); }
  section h2 { font-size: 16px; font-weight: 600; margin: var(--cmc-space-4) 0 var(--cmc-space-2); }
`;

const TAB_SCRIPT = `
  function showTab(name) {
    document.querySelectorAll('.tab-panel').forEach((el) => el.classList.toggle('active', el.dataset.tab === name));
    document.querySelectorAll('nav.tabs button').forEach((el) => el.classList.toggle('active', el.dataset.tab === name));
  }
  document.querySelectorAll('nav.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
`;

export interface LayoutOptions {
  generatedAt: string;
  commit: string;
  acceptanceTabHtml: string;
  builderTabHtml: string;
}

export function renderLayout(opts: LayoutOptions): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sổ Nghiệm Thu Sống — CMC EDU</title>
<style>
  :root { ${TOKENS_CSS} }
  ${BASE_CSS}
</style>
</head>
<body>
<header class="page">
  <h1>Sổ Nghiệm Thu Sống</h1>
  <div class="meta">Tạo lúc ${escapeHtml(opts.generatedAt)} · phiên bản mã ${escapeHtml(opts.commit)}</div>
</header>
<nav class="tabs">
  <button data-tab="acceptance" class="active">Nghiệm thu</button>
  <button data-tab="builder">Builder</button>
</nav>
<main>
  <section class="tab-panel active" data-tab="acceptance">${opts.acceptanceTabHtml}</section>
  <section class="tab-panel" data-tab="builder">${opts.builderTabHtml}</section>
</main>
<script>${TAB_SCRIPT}</script>
</body>
</html>`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
