// Word-count + forbidden-jargon gate for customer-facing deck copy.
// Main spine ≤ 25 words; lookup slides ≤ 60 words (diagram text counted separately).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FlowCopy, SpineBeat } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');

/** Forbidden jargon on customer-visible text (AC 6). KPI is allowed. */
export const FORBIDDEN_WORDS = [
  'tRPC',
  'procedure',
  'router',
  'enum',
  'RLS',
  'migration',
  'schema',
  'endpoint',
  'middleware',
  'geofence',
  'OR gate',
  'auto-score',
  'branch-scope',
  'HOTL',
  'idempotent',
  'O1→O5',
  'O1->O5',
] as const;

export const SPINE_WORD_LIMIT = 25;
export const LOOKUP_WORD_LIMIT = 60;
export const DIAGRAM_WORD_LIMIT = 80;

export interface CopyViolation {
  where: string;
  kind: 'word-limit' | 'forbidden' | 'missing-field';
  detail: string;
}

/** Count Vietnamese/English words — split on whitespace and punctuation. */
export function countWords(text: string): number {
  const cleaned = text
    .replace(/[⚙️🤖·→←↑↓—–•]/g, ' ')
    .replace(/[.,;:!?()[\]{}"'`/\\|#@&+=%*<>]/g, ' ')
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function findForbidden(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const w of FORBIDDEN_WORDS) {
    if (lower.includes(w.toLowerCase())) found.push(w);
  }
  return found;
}

export function checkSpineBeat(beat: SpineBeat): CopyViolation[] {
  const violations: CopyViolation[] = [];
  const body = [...beat.lines, beat.title, beat.bridgeQuestion ?? ''].join(' ');
  const words = countWords(body);
  if (words > SPINE_WORD_LIMIT) {
    violations.push({
      where: `spine:${beat.id}`,
      kind: 'word-limit',
      detail: `${words} từ (giới hạn ${SPINE_WORD_LIMIT})`,
    });
  }
  for (const w of findForbidden(body)) {
    violations.push({
      where: `spine:${beat.id}`,
      kind: 'forbidden',
      detail: `từ cấm: ${w}`,
    });
  }
  // Diagram text separate budget
  const diagramText = collectDiagramText(beat);
  if (diagramText) {
    const dw = countWords(diagramText);
    if (dw > DIAGRAM_WORD_LIMIT) {
      violations.push({
        where: `spine:${beat.id}:diagram`,
        kind: 'word-limit',
        detail: `chữ trong sơ đồ ${dw} từ (giới hạn ${DIAGRAM_WORD_LIMIT})`,
      });
    }
    for (const w of findForbidden(diagramText)) {
      violations.push({
        where: `spine:${beat.id}:diagram`,
        kind: 'forbidden',
        detail: `từ cấm: ${w}`,
      });
    }
  }
  return violations;
}

export function checkFlowCopy(copy: FlowCopy): CopyViolation[] {
  const violations: CopyViolation[] = [];
  const fields = [
    copy.title,
    copy.whoStarts,
    copy.whoApproves,
    copy.systemDoes,
    copy.resultScreen,
    ...(copy.rules ?? []),
  ].join(' ');
  const words = countWords(fields);
  if (words > LOOKUP_WORD_LIMIT) {
    violations.push({
      where: `flow:${copy.id}`,
      kind: 'word-limit',
      detail: `${words} từ (giới hạn ${LOOKUP_WORD_LIMIT})`,
    });
  }
  for (const w of findForbidden(fields)) {
    violations.push({
      where: `flow:${copy.id}`,
      kind: 'forbidden',
      detail: `từ cấm: ${w}`,
    });
  }
  const diagramText = collectDiagramText(copy);
  if (diagramText) {
    const dw = countWords(diagramText);
    if (dw > DIAGRAM_WORD_LIMIT) {
      violations.push({
        where: `flow:${copy.id}:diagram`,
        kind: 'word-limit',
        detail: `chữ trong sơ đồ ${dw} từ (giới hạn ${DIAGRAM_WORD_LIMIT})`,
      });
    }
    for (const w of findForbidden(diagramText)) {
      violations.push({
        where: `flow:${copy.id}:diagram`,
        kind: 'forbidden',
        detail: `từ cấm: ${w}`,
      });
    }
  }
  // Title must not be raw P-code only
  if (/^(P[1-4]|ADM)-\d+[a-z]?$/i.test(copy.title.trim())) {
    violations.push({
      where: `flow:${copy.id}`,
      kind: 'missing-field',
      detail: 'tiêu đề không được chỉ là mã luồng',
    });
  }
  return violations;
}

function collectDiagramText(
  src: Partial<FlowCopy> & Partial<SpineBeat>,
): string {
  const parts: string[] = [];
  for (const s of src.steps ?? []) {
    parts.push(s.action, s.actor);
  }
  for (const m of src.milestones ?? []) {
    parts.push(m.title, m.detail ?? '', m.time ?? '');
  }
  for (const g of src.gateOptions ?? []) {
    parts.push(g.label, g.note ?? '');
  }
  if (src.before) parts.push(src.before.title, ...src.before.items);
  if (src.after) parts.push(src.after.title, ...src.after.items);
  if (src.screenSketch) {
    parts.push(src.screenSketch.title, ...src.screenSketch.regions.map((r) => r.label));
  }
  return parts.join(' ');
}

export function checkHtmlVisible(html: string): CopyViolation[] {
  // Strip notes and script — customer never sees those
  const visible = html
    .replace(/<aside class="notes"[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const violations: CopyViolation[] = [];
  for (const w of findForbidden(visible)) {
    violations.push({
      where: 'html:visible',
      kind: 'forbidden',
      detail: `từ cấm trên nội dung người xem thấy: ${w}`,
    });
  }
  // No external network refs. Allow SVG xmlns only (not a network fetch).
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const networkRefs = withoutComments.match(/\bhttps?:\/\/[^\s"'<>]+/gi) ?? [];
  const realNetwork = networkRefs.filter(
    (u) => !/^https?:\/\/www\.w3\.org\//i.test(u),
  );
  if (realNetwork.length > 0) {
    violations.push({
      where: 'html:network',
      kind: 'forbidden',
      detail: `còn tham chiếu mạng trong output: ${realNetwork.slice(0, 3).join(', ')}`,
    });
  }
  return violations;
}

/** CLI: pnpm deck:check (optional) or invoked from build. */
export async function main(): Promise<void> {
  const { spineBeats } = await import('./content/spine.js');
  const { allFlowCopies } = await import('./content/flows/index.js');

  const violations: CopyViolation[] = [];
  for (const b of spineBeats) violations.push(...checkSpineBeat(b));
  for (const f of allFlowCopies) violations.push(...checkFlowCopy(f));

  const outHtml = path.join(REPO_ROOT, 'presentation-deck/index.html');
  if (existsSync(outHtml)) {
    violations.push(...checkHtmlVisible(readFileSync(outHtml, 'utf8')));
  }

  if (violations.length > 0) {
    console.error(`check-copy: ${violations.length} lỗi`);
    for (const v of violations) {
      console.error(`  [${v.kind}] ${v.where}: ${v.detail}`);
    }
    process.exit(1);
  }
  console.log('check-copy: OK');
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
