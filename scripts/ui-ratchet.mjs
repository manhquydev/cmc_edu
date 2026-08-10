#!/usr/bin/env node
/**
 * Inline-style ratchet for CMC admin pages (`apps/admin/src/pages`).
 *
 * Counts raw literal values in `style={{ ... }}` objects for the property
 * families that actually have a token scale (spacing, fontSize, radius,
 * color) and compares the per-file count against a committed baseline.
 * Fails only when a file's count goes UP — existing debt is grandfathered,
 * new drift is not.
 *
 * Deliberately excludes (never counted, regardless of value):
 *  - layout semantics: display, flex*, align*, justify*, overflow*,
 *    position, cursor, top/right/bottom/left, zIndex
 *  - typography semantics: textTransform, fontWeight, fontVariantNumeric,
 *    letterSpacing, textAlign, textDecoration, whiteSpace, wordBreak,
 *    lineHeight, fontFamily, fontStyle
 *  - width/height (and min/max variants) — permanently exempt, no width
 *    token scale exists and none is being introduced (operator decision,
 *    plans/260809-2040-erp-ui-clean-sync-complete/plan.md)
 *  - any value containing var(), calc(), or % — already computed/token-driven
 *
 * Parsing note: walks `style={{` blocks by brace-depth (respecting string
 * literals), not single-line regex, so multi-line style objects are read
 * whole. Only bare numeric or plain-quoted-string values are classified as
 * literals; template-literal interpolations, identifiers, ternaries, and
 * function calls are skipped rather than guessed at — a false positive here
 * defeats the whole gate (see phase-06 Risk Assessment), so this errs
 * toward under-counting rather than over-counting.
 *
 * Usage:
 *   node scripts/ui-ratchet.mjs [--json] [--write-baseline]
 *
 * Exit code (without --write-baseline): 0 if no file exceeds its baseline
 * count, 1 otherwise. --write-baseline never fails; it (re)writes
 * scripts/ratchet-baseline.json from the current count and exits 0.
 *
 * Explicit exemptions (Phase 8 close-out): scripts/ratchet-exemptions.json
 * lists individually-justified (file, property, exact literal value) triples
 * that have no matching CMC token — each one reviewed and reasoned, not a
 * silent baseline number. These are subtracted before counting, so the
 * baseline is genuinely {} (every file at 0) and the existing "fails if a
 * file's count goes up" comparison becomes zero-tolerance for anything NOT
 * on that explicit list — no separate "hard forbid" mode needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesRoot = path.join(root, 'apps/admin/src/pages');
const baselinePath = path.join(root, 'scripts/ratchet-baseline.json');
const exemptionsPath = path.join(root, 'scripts/ratchet-exemptions.json');

const asJson = process.argv.includes('--json');
const writeBaseline = process.argv.includes('--write-baseline');

const exemptionsData = fs.existsSync(exemptionsPath)
  ? JSON.parse(fs.readFileSync(exemptionsPath, 'utf8'))
  : { exemptions: [] };
const EXEMPT_LITERALS = new Set(
  (exemptionsData.exemptions ?? []).map((e) => `${e.file}|${e.property}|${e.value}`),
);

const LAYOUT_EXEMPT = new Set([
  'display', 'flex', 'flexWrap', 'flexDirection', 'flexShrink', 'flexGrow', 'flexBasis',
  'alignItems', 'alignSelf', 'alignContent', 'justifyContent', 'justifyItems', 'justifySelf',
  'overflow', 'overflowX', 'overflowY', 'position', 'cursor',
  'top', 'right', 'bottom', 'left', 'zIndex',
]);

const TYPOGRAPHY_EXEMPT = new Set([
  'textTransform', 'fontWeight', 'fontVariantNumeric', 'letterSpacing', 'textAlign',
  'textDecoration', 'whiteSpace', 'wordBreak', 'lineHeight', 'fontFamily', 'fontStyle',
]);

const SIZE_EXEMPT = new Set(['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight']);

const EXEMPT = new Set([...LAYOUT_EXEMPT, ...TYPOGRAPHY_EXEMPT, ...SIZE_EXEMPT]);

const FAMILY = {
  spacing: new Set([
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginInline', 'marginBlock',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingInline', 'paddingBlock',
    'gap', 'rowGap', 'columnGap',
  ]),
  typography: new Set(['fontSize']),
  radius: new Set([
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomLeftRadius', 'borderBottomRightRadius',
  ]),
  color: new Set([
    'color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor',
    'borderBottomColor', 'borderLeftColor', 'outlineColor', 'fill', 'stroke',
  ]),
};

function familyOf(prop) {
  for (const [name, set] of Object.entries(FAMILY)) {
    if (set.has(prop)) return name;
  }
  return null;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.tsx') && !ent.name.includes('.test.')) out.push(p);
  }
  return out;
}

/** Find the matching close for an open brace at `openIdx`, respecting string literals. */
function findMatchingBrace(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  let inString = null; // "'" | '"' | '`'
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (inString) {
      if (c === '\\') { i += 1; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split a `{ ... }` object body into top-level `key: value` pairs. */
function splitTopLevelPairs(body) {
  const pairs = [];
  let depth = 0;
  let inString = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (inString) {
      if (c === '\\') { i += 1; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '{' || c === '(' || c === '[') depth += 1;
    else if (c === '}' || c === ')' || c === ']') depth -= 1;
    else if (c === ',' && depth === 0) {
      pairs.push(body.slice(start, i));
      start = i + 1;
    }
  }
  pairs.push(body.slice(start));

  const kv = [];
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    let colonDepth = 0;
    let colonIdx = -1;
    let inStr = null;
    for (let i = 0; i < trimmed.length; i += 1) {
      const c = trimmed[i];
      if (inStr) {
        if (c === '\\') { i += 1; continue; }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '{' || c === '(' || c === '[') colonDepth += 1;
      else if (c === '}' || c === ')' || c === ']') colonDepth -= 1;
      else if (c === ':' && colonDepth === 0) { colonIdx = i; break; }
    }
    if (colonIdx === -1) continue; // shorthand prop (e.g. `...spread`) — skip
    const rawKey = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();
    const key = rawKey.replace(/^['"]|['"]$/g, '');
    kv.push([key, rawValue]);
  }
  return kv;
}

/** Classify a raw value expression as a countable literal, or null if not confidently classifiable. */
function literalValue(rawValue) {
  if (/^-?\d+(\.\d+)?$/.test(rawValue)) return rawValue;
  const strMatch = rawValue.match(/^(['"])((?:\\.|(?!\1).)*)\1$/);
  if (strMatch) return strMatch[2];
  return null;
}

function isComputed(value) {
  return value.includes('var(') || value.includes('calc(') || value.includes('%');
}

function countFile(file, relPath) {
  const src = fs.readFileSync(file, 'utf8');
  const counts = { spacing: 0, typography: 0, radius: 0, color: 0 };
  let idx = 0;
  while ((idx = src.indexOf('style={{', idx)) !== -1) {
    const openBrace = idx + 'style='.length; // points at the outer `{` of `style={{`
    const close = findMatchingBrace(src, openBrace);
    if (close === -1) break;
    // `openBrace` is the outer `{`, `openBrace + 1` is the inner `{` (object literal
    // open); `close` is the outer `}`, `close - 1` is the inner `}`. Slice strictly
    // between the inner pair to get the object literal's own body.
    const body = src.slice(openBrace + 2, close - 1);
    for (const [key, rawValue] of splitTopLevelPairs(body)) {
      if (EXEMPT.has(key)) continue;
      const family = familyOf(key);
      if (!family) continue;
      const literal = literalValue(rawValue);
      if (literal === null) continue;
      if (isComputed(literal)) continue;
      if (EXEMPT_LITERALS.has(`${relPath}|${key}|${literal}`)) continue;
      counts[family] += 1;
    }
    idx = close + 1;
  }
  return counts;
}

const files = walk(pagesRoot);
const perFile = {};
let totalViolations = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  const counts = countFile(file, rel);
  const total = counts.spacing + counts.typography + counts.radius + counts.color;
  if (total > 0) perFile[rel] = { total, ...counts };
  totalViolations += total;
}

if (writeBaseline) {
  const baseline = Object.fromEntries(Object.entries(perFile).map(([f, c]) => [f, c.total]));
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        _comment:
          'Per-file count of raw literal values in tokenizable inline-style properties ' +
          '(spacing/fontSize/radius/color) under apps/admin/src/pages, as measured by ' +
          'scripts/ui-ratchet.mjs, AFTER excluding scripts/ratchet-exemptions.json entries. ' +
          'Phase 8 close-out reached 0 here (plans/260809-2040-erp-ui-clean-sync-complete/' +
          'phase-08-close-out.md) — this is now zero-tolerance: any unexempted literal in a ' +
          'tokenizable property fails CI immediately, there is no grandfathered allowance ' +
          'left to raise. Genuine debt with no matching token lives in ratchet-exemptions.json ' +
          'instead, one entry per literal with a stated reason — add there (not here) only ' +
          'after confirming no token fits; do not use this file to silence new violations.',
        baseline,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote baseline for ${Object.keys(baseline).length} file(s), ${totalViolations} total violation(s).`);
  process.exit(0);
}

let baselineData = { baseline: {} };
if (fs.existsSync(baselinePath)) {
  baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}
const baseline = baselineData.baseline ?? {};

const increased = [];
for (const [rel, counts] of Object.entries(perFile)) {
  const before = baseline[rel] ?? 0;
  if (counts.total > before) {
    increased.push({ file: rel, before, after: counts.total });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  pageCount: files.length,
  filesWithViolations: Object.keys(perFile).length,
  totalViolations,
  increased,
};

if (asJson) {
  console.log(JSON.stringify({ ...report, perFile }, null, 2));
} else {
  console.log('UI inline-style ratchet (apps/admin/src/pages)\n');
  console.log(`  Pages scanned:        ${files.length}`);
  console.log(`  Files with violations: ${Object.keys(perFile).length}`);
  console.log(`  Total violations:      ${totalViolations}`);
  if (increased.length > 0) {
    console.log(`\nFILES THAT REGRESSED (${increased.length}):`);
    for (const { file, before, after } of increased) {
      console.log(`  - ${file}: ${before} -> ${after}`);
    }
  } else {
    console.log('\nNo file exceeded its baseline count.');
  }
}

process.exit(increased.length > 0 ? 1 : 0);
