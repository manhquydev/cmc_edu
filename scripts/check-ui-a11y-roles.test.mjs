/**
 * Proves check-ui-a11y-roles.mjs finds required role/aria markers in composites.
 * Run: node --test scripts/check-ui-a11y-roles.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/check-ui-a11y-roles.mjs');

describe('check-ui-a11y-roles.mjs', () => {
  it('exits 0 and reports all composite checks ok', () => {
    const r = spawnSync(process.execPath, [script, '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.equal(report.ok, true);
    assert.ok(report.checkCount >= 7, `expected ≥7 checks, got ${report.checkCount}`);
    assert.equal(report.failCount, 0);
    const ids = report.results.map((x) => x.id);
    for (const need of [
      'FilterBar',
      'ListPagination',
      'BulkActionBar',
      'DataTableSelection',
      'CommandPalette',
      'Toast',
    ]) {
      assert.ok(ids.includes(need), `missing check id ${need}`);
    }
    assert.ok(report.results.every((x) => x.ok));
  });

  it('default (non-json) mode also exits 0', () => {
    const r = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /checks passed/);
  });
});
