#!/usr/bin/env node
/**
 * Frame adoption audit for CMC admin pages.
 * Exit 0 always when only reporting; use --strict to fail dual-title / bulk gates.
 *
 * Usage: node scripts/check-ui-frames.mjs [--json] [--strict]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesRoot = path.join(root, 'apps/admin/src/pages');
const strict = process.argv.includes('--strict');
const asJson = process.argv.includes('--json');

const EXEMPT = new Set([
  'login.tsx',
  'change-password.tsx',
  'coming-soon.tsx',
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.tsx') && !ent.name.includes('.test.')) out.push(p);
  }
  return out;
}

const files = walk(pagesRoot).filter((f) => !EXEMPT.has(path.basename(f)));

const frames = [
  'ListPage',
  'DetailPage',
  'FormPage',
  'DashboardPage',
  'BulkActionBar',
  'ListPagination',
  'EntityHeader',
  'SettingsShell',
  'FilterBar',
  'HighlightStrip',
  'WorkflowStatusbar',
];

const counts = Object.fromEntries(frames.map((f) => [f, 0]));
const bulkFiles = [];
const dualRisk = [];
const filterBarFiles = [];
const listPaginationFiles = [];
const entityHeaderFiles = [];
const detailPageFiles = [];
const detailTiers = { full: [], standard: [], settings: [], thin: [] };

/**
 * Classify DetailPage product files into recipe tiers (PAGE-FRAMES §C).
 * settings > full > standard > thin (SettingsShell wins over EntityHeader).
 */
function classifyDetailTier(src) {
  if (!src.includes('DetailPage')) return null;
  if (src.includes('SettingsShell')) return 'settings';
  if (src.includes('EntityHeader') && src.includes('WorkflowStatusbar')) return 'full';
  if (src.includes('EntityHeader')) return 'standard';
  return 'thin';
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  for (const f of frames) {
    if (src.includes(f)) counts[f] += 1;
  }
  if (src.includes('BulkActionBar') && src.includes('selectedIds')) {
    bulkFiles.push(rel);
  }
  if (src.includes('FilterBar')) filterBarFiles.push(rel);
  if (src.includes('ListPagination')) listPaginationFiles.push(rel);
  if (src.includes('EntityHeader')) entityHeaderFiles.push(rel);
  if (src.includes('DetailPage')) {
    detailPageFiles.push(rel);
    const tier = classifyDetailTier(src);
    if (tier) detailTiers[tier].push(rel);
  }
  // Dual title: PageHeader itself has a title= prop (not EntityHeader's title).
  // Scan each <PageHeader …> open tag / short block only.
  if (src.includes('EntityHeader')) {
    let i = 0;
    let flagged = false;
    while (!flagged && (i = src.indexOf('<PageHeader', i)) !== -1) {
      const slice = src.slice(i, i + 600);
      const endSelf = slice.indexOf('/>');
      const endOpen = slice.indexOf('>');
      const end =
        endSelf !== -1 && (endOpen === -1 || endSelf <= endOpen)
          ? endSelf
          : endOpen !== -1
            ? endOpen
            : slice.length;
      const openTag = slice.slice(0, end + 1);
      // Multiline props: include until first /> after open if no title in open line
      let block = openTag;
      if (!/\btitle\s*=/.test(openTag) && endSelf === -1) {
        const close = slice.indexOf('/>');
        block = close === -1 ? slice : slice.slice(0, close);
        // Don't leak into EntityHeader
        const eh = block.indexOf('EntityHeader');
        if (eh !== -1) block = block.slice(0, eh);
      }
      if (/\btitle\s*=/.test(block)) {
        dualRisk.push(rel);
        flagged = true;
      }
      i += 11;
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  pageCount: files.length,
  counts,
  bulkEnabledFiles: bulkFiles,
  bulkCount: bulkFiles.length,
  filterBarFiles,
  filterBarCount: filterBarFiles.length,
  listPaginationFiles,
  listPaginationCount: listPaginationFiles.length,
  entityHeaderFiles,
  entityHeaderCount: entityHeaderFiles.length,
  detailPageFiles,
  detailPageCount: detailPageFiles.length,
  detailTiers,
  dualTitleReview: dualRisk,
  metrics: {
    bulkListsTarget: 5,
    bulkListsOk: bulkFiles.length >= 5,
    // Report-only depth signals (not strict gates)
    filterBarCount: filterBarFiles.length,
    listPaginationCount: listPaginationFiles.length,
    entityHeaderCount: entityHeaderFiles.length,
    detailFullCount: detailTiers.full.length,
    detailStandardCount: detailTiers.standard.length,
    detailSettingsCount: detailTiers.settings.length,
    detailThinCount: detailTiers.thin.length,
  },
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('UI frame adoption (admin pages, excl design-lab/tests)\n');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)} ${v}`);
  console.log(`\nBulk-enabled lists: ${bulkFiles.length}`);
  for (const f of bulkFiles) console.log(`  - ${f}`);
  console.log(`\nFilterBar lists: ${filterBarFiles.length}`);
  for (const f of filterBarFiles) console.log(`  - ${f}`);
  console.log(`\nListPagination: ${listPaginationFiles.length}`);
  for (const f of listPaginationFiles) console.log(`  - ${f}`);
  console.log(`\nEntityHeader: ${entityHeaderFiles.length}`);
  for (const f of entityHeaderFiles) console.log(`  - ${f}`);
  console.log('\nDetail tiers (PAGE-FRAMES §C):');
  for (const tier of ['full', 'standard', 'settings', 'thin']) {
    const list = detailTiers[tier];
    console.log(`  ${tier.padEnd(10)} ${list.length}`);
    for (const f of list) console.log(`    - ${f}`);
  }
  console.log(`\nEntityHeader files with PageHeader title= (review): ${dualRisk.length}`);
  for (const f of dualRisk) console.log(`  - ${f}`);
  console.log(`\nbulkListsOk (≥5): ${report.metrics.bulkListsOk}`);
}

if (strict) {
  let fail = false;
  if (!report.metrics.bulkListsOk) {
    console.error('STRICT FAIL: bulkListsOk requires ≥5 BulkActionBar+selectedIds lists');
    fail = true;
  }
  if (dualRisk.length > 0) {
    console.error(`STRICT FAIL: dual-title PageHeader title= on EntityHeader pages (${dualRisk.length})`);
    fail = true;
  }
  if (fail) process.exit(1);
}
process.exit(0);
