/**
 * Proves the URL-literal scanner rejects paper/stale quoted paths and
 * stays green on HEAD. Run: node --test scripts/check-url-literals.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/check-url-literals.mjs');

function run(args, cwd = root) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

describe('check-url-literals.mjs', () => {
  it('fails quoted paper /finance/receipts and bare /students', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'url-literals-'));
    mkdirSync(path.join(dir, 'apps/api/src'), { recursive: true });
    writeFileSync(
      path.join(dir, 'apps/api/src/stale.ts'),
      [
        'const a = `/finance/receipts/${id}?flag=x`;',
        "const b = '/students';",
        "const ok = '/admin/students';",
      ].join('\n'),
    );
    const result = run(['--json', '--root', dir]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    const needles = report.results.flatMap((row) => row.hits.map((hit) => hit.needle));
    assert.ok(needles.includes('/finance/receipts'));
    assert.ok(needles.includes('/students'));
    assert.ok(!needles.includes('/admin/students'));
  });

  it('exits 0 on HEAD — as-built literals only', () => {
    const result = run(['--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.ok(report.fileCount > 50);
    assert.equal(report.failCount, 0);
  });
});
