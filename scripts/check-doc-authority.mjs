#!/usr/bin/env node
/**
 * Live-instruction drift check for design-system authority docs.
 *
 * Scans a hard allowlist only (never plans/ or changelogs). Exit 1 if a
 * retired chrome token is still taught as current, or if the frontend
 * entry path no longer names design-system-console.
 *
 * Usage:
 *   node scripts/check-doc-authority.mjs [--json] [--root <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const rootFlag = process.argv.indexOf('--root');
const root = rootFlag !== -1 && process.argv[rootFlag + 1]
  ? path.resolve(process.argv[rootFlag + 1])
  : defaultRoot;

const RULES = [
  {
    file: 'docs/README.md',
    require: 'design-system-console',
  },
  {
    file: 'docs/12-design-system-ui.md',
    forbid: ['AppFrame', '.premium-', '--sh-'],
  },
  {
    file: 'design-system/cmc-edu/STRUCTURE.md',
    forbid: ['AppFrame', '.ck-surface', '.sh-', 'tpl-wrap'],
  },
  {
    file: 'design-system/cmc-edu/PAGE-FRAMES.md',
    forbid: ['AppFrame', '.ck-surface', '.sh-', 'tpl-wrap'],
  },
  {
    file: 'design-system/cmc-edu/MASTER.md',
    forbid: ['AppFrame', '.ck-surface', '.sh-', 'tpl-wrap'],
  },
  {
    file: 'packages/ui/llms.txt',
    forbid: ['premium.css'],
  },
  {
    file: 'packages/ui/src/index.ts',
    forbid: ['.sh-'],
  },
];

function checkFile(rule) {
  const abs = path.join(root, rule.file);
  const hits = [];
  if (!fs.existsSync(abs)) {
    hits.push({ line: 0, needle: '<file missing>' });
    return hits;
  }
  const text = fs.readFileSync(abs, 'utf8');
  if (rule.require && !text.includes(rule.require)) {
    hits.push({ line: 0, needle: `missing required: ${rule.require}` });
  }
  if (rule.forbid) {
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      for (const needle of rule.forbid) {
        if (line.includes(needle)) hits.push({ line: idx + 1, needle });
      }
    });
  }
  return hits;
}

const results = RULES.map((rule) => {
  const hits = checkFile(rule);
  return { file: rule.file, ok: hits.length === 0, hits };
});

const failed = results.filter((r) => !r.ok);
const report = {
  ok: failed.length === 0,
  checkCount: RULES.length,
  failCount: failed.length,
  results,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  for (const r of results) {
    if (r.ok) {
      console.log(`ok  ${r.file}`);
    } else {
      console.log(`FAIL ${r.file}`);
      for (const h of r.hits) {
        const loc = h.line > 0 ? `${r.file}:${h.line}` : r.file;
        console.log(`     ${loc}  ${h.needle}`);
      }
    }
  }
  console.log(
    failed.length === 0
      ? `\n${RULES.length} files clean.`
      : `\n${failed.length}/${RULES.length} files failed.`,
  );
}

process.exit(failed.length === 0 ? 0 : 1);
