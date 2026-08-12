/**
 * Proves check-doc-authority.mjs fails on a forbidden fixture and passes on
 * a clean HEAD. Run: node --test scripts/check-doc-authority.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repoRoot, 'scripts/check-doc-authority.mjs');

const ALLOWLIST = [
  'docs/README.md',
  'docs/12-design-system-ui.md',
  'design-system/cmc-edu/STRUCTURE.md',
  'design-system/cmc-edu/PAGE-FRAMES.md',
  'design-system/cmc-edu/MASTER.md',
  'packages/ui/llms.txt',
  'packages/ui/src/index.ts',
];

function run(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

function copyAllowlist(dest) {
  for (const rel of ALLOWLIST) {
    const from = path.join(repoRoot, rel);
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

describe('check-doc-authority.mjs', () => {
  it('fails when a forbidden string is injected into a fixture', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-authority-'));
    try {
      copyAllowlist(tmp);
      const dirty = path.join(tmp, 'docs/12-design-system-ui.md');
      fs.appendFileSync(dirty, '\nAppFrame leftover instruction\n');
      const r = run(['--json', '--root', tmp]);
      assert.equal(r.status, 1, r.stderr || r.stdout);
      const report = JSON.parse(r.stdout);
      assert.equal(report.ok, false);
      const tl12 = report.results.find((x) => x.file === 'docs/12-design-system-ui.md');
      assert.ok(tl12 && tl12.hits.some((h) => h.needle === 'AppFrame'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('passes on a clean HEAD', () => {
    const r = run(['--json']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.failCount, 0);
    assert.ok(report.checkCount >= 7);
  });
});
