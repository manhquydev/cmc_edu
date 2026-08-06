// Entry: pnpm deck:build [--release]
// Vendors reveal.js UMD + CSS + notes; writes presentation-deck/.

import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { flows as manifestFlows } from '../acceptance-report/flow-manifest.js';
import { checkFlowCopy, checkHtmlVisible, checkSpineBeat } from './check-copy.js';
import { assertAllFlowCopies } from './content/flow-copy-schema.js';
import { allFlowCopies } from './content/flows/index.js';
import { spineBeats } from './content/spine.js';
import { loadFlowData, REPO_ROOT } from './load-flow-data.js';
import { countFlowSections, renderAllSlides } from './render-slides.js';
import { renderDeckShell } from './templates/deck-shell.js';

const OUT_DIR = path.join(REPO_ROOT, 'presentation-deck');
const STAGING_DIR = path.join(REPO_ROOT, '.presentation-deck-staging');
const REVEAL_ROOT = path.join(REPO_ROOT, 'node_modules/reveal.js');

const VENDOR_FILES: Array<{ from: string; to: string }> = [
  { from: 'dist/reveal.js', to: 'reveal.js' },
  { from: 'dist/reveal.css', to: 'reveal.css' },
  { from: 'dist/theme/white.css', to: 'theme-white.css' },
  { from: 'plugin/notes/notes.js', to: 'notes.js' },
  // notes plugin loads speaker-view.html at runtime for secondary display
  { from: 'plugin/notes/speaker-view.html', to: 'speaker-view.html' },
];

function parseArgs(argv: string[]): { release: boolean } {
  return { release: argv.includes('--release') };
}

/** Vendor reveal into `<deckRoot>/vendor/`. Throws if reveal.js missing. */
function vendorReveal(deckRoot: string): void {
  if (!existsSync(REVEAL_ROOT)) {
    throw new Error('Thiếu reveal.js — chạy pnpm install (devDependency reveal.js@5.2.1)');
  }
  const vendorDir = path.join(deckRoot, 'vendor');
  mkdirSync(vendorDir, { recursive: true });
  for (const f of VENDOR_FILES) {
    const src = path.join(REVEAL_ROOT, f.from);
    const dest = path.join(vendorDir, f.to);
    if (!existsSync(src)) throw new Error(`Thiếu file vendor: ${f.from}`);
    cpSync(src, dest);
  }
  // Strip theme font @import — plan D6: system fonts only; @font-face fails on file://
  const themePath = path.join(vendorDir, 'theme-white.css');
  let theme = readFileSync(themePath, 'utf8');
  theme = theme.replace(/@import\s+url\([^)]+\);\s*/g, '');
  theme =
    `/* system fonts only — no remote/local @font-face */\n` +
    `.reveal { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }\n` +
    theme;
  writeFileSync(themePath, theme, 'utf8');
  const total = VENDOR_FILES.reduce(
    (sum, f) => sum + readFileSync(path.join(vendorDir, f.to)).byteLength,
    0,
  );
  const kb = total / 1024;
  if (kb > 400) {
    console.warn(`⚠ Vendor ${kb.toFixed(0)}KB > 400KB mục tiêu`);
  } else {
    console.log(`vendor: ${kb.toFixed(0)}KB (< 400KB)`);
  }
}

function headSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function buildDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function readmeText(release: boolean): string {
  return [
    'Bộ trình bày offline CMC EDU v2',
    '',
    'Mở index.html bằng trình duyệt (file:// được hỗ trợ — UMD).',
    'Phím: mũi tên đi slide · H về bản đồ nhà · S màn ghi chú thuyết minh · O tổng quan.',
    '',
    'PDF dự phòng: mở index.html → In → Lưu PDF.',
    'Đã tắt tách fragment thành từng trang; ghi chú thuyết minh KHÔNG nằm trong bản in.',
    '',
    release
      ? 'Bản --release (không banner nháp).'
      : 'BẢN NHÁP — build lại với --release trước khi trình bày chính thức.',
    '',
  ].join('\n');
}

export function buildDeck(options: { release?: boolean } = {}): string {
  const release = options.release === true;
  const data = loadFlowData({ release });

  // Schema: every manifest id has copy
  assertAllFlowCopies(
    allFlowCopies,
    manifestFlows.map((f) => f.id),
  );

  // Copy gates
  const violations = [
    ...spineBeats.flatMap(checkSpineBeat),
    ...allFlowCopies.flatMap(checkFlowCopy),
  ];
  if (violations.length > 0) {
    const lines = violations.map((v) => `  [${v.kind}] ${v.where}: ${v.detail}`);
    throw new Error(`check-copy fail (${violations.length}):\n${lines.join('\n')}`);
  }

  const slidesHtml = renderAllSlides(data);
  const flowCount = countFlowSections(slidesHtml);
  if (flowCount !== manifestFlows.length) {
    throw new Error(
      `Deck phủ ${flowCount} luồng nhưng manifest có ${manifestFlows.length}`,
    );
  }

  const html = renderDeckShell({
    title: 'Vận hành CMC EDU v2',
    slidesHtml,
    data,
    version: '1.0.0',
    buildSha: headSha(),
    buildDate: buildDate(),
    assetPaths: {
      revealCss: 'vendor/reveal.css',
      themeCss: 'vendor/theme-white.css',
      revealJs: 'vendor/reveal.js',
      notesJs: 'vendor/notes.js',
    },
  });

  const htmlViolations = checkHtmlVisible(html);
  if (htmlViolations.length > 0) {
    const lines = htmlViolations.map((v) => `  [${v.kind}] ${v.where}: ${v.detail}`);
    throw new Error(`HTML visible check fail:\n${lines.join('\n')}`);
  }

  // Stage fully before replacing OUT_DIR so a failed vendor never wipes last good deck.
  if (existsSync(STAGING_DIR)) rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });
  try {
    vendorReveal(STAGING_DIR);
    writeFileSync(path.join(STAGING_DIR, 'index.html'), html, 'utf8');
    writeFileSync(path.join(STAGING_DIR, 'README.txt'), readmeText(release), 'utf8');

    if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
    try {
      renameSync(STAGING_DIR, OUT_DIR);
    } catch {
      cpSync(STAGING_DIR, OUT_DIR, { recursive: true });
      rmSync(STAGING_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    if (existsSync(STAGING_DIR)) rmSync(STAGING_DIR, { recursive: true, force: true });
    throw e;
  }

  const outFile = path.join(OUT_DIR, 'index.html');
  console.log(`deck: wrote ${path.relative(REPO_ROOT, outFile)}`);
  console.log(
    `  flows=${flowCount} proven=${data.counts.proven} verified-correct=${data.counts.verifiedCorrect} draft=${data.warnings.draftBanner}`,
  );
  if (data.warnings.stale) {
    console.log(
      `  ⚠ stale: measured=${data.warnings.measuredCommit} head=${data.warnings.headCommit}`,
    );
  }
  return outFile;
}

function main(): void {
  const { release } = parseArgs(process.argv.slice(2));
  try {
    buildDeck({ release });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
