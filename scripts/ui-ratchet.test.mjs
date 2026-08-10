/**
 * Proves ui-ratchet.mjs counts inline-style violations correctly and fails
 * only when a file's count goes up relative to the committed baseline.
 * Run: node --test scripts/ui-ratchet.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/ui-ratchet.mjs');
const targetFile = path.join(root, 'apps/admin/src/pages/classes/index.tsx');

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

describe('ui-ratchet.mjs', () => {
  it('passes cleanly against the committed baseline', () => {
    const r = run(['--json']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.ok(report.pageCount > 20);
    assert.equal(report.increased.length, 0);
  });

  it('only counts literal values in tokenizable properties, exempting layout/typography/var()/%', () => {
    const r = run(['--json']);
    const report = JSON.parse(r.stdout);
    const attendance = report.perFile['apps/admin/src/pages/teaching/attendance.tsx'];
    assert.ok(attendance, 'teaching/attendance.tsx should have counted violations');
    // { background:'var(...)', border:'...', borderRadius:4 } -> only borderRadius counts (no
    // premium-scale token for 4px radius; that value belongs to the separate console.css scale)
    // { marginTop:2 } and { padding:32 } -> spacing, neither has an exact token match
    // { fontSize:'var(--cmc-fs-page)' } elsewhere in the file is already tokenized — exempt
    assert.equal(attendance.total, 3);
    assert.equal(attendance.spacing, 2); // marginTop:2 + padding:32
    assert.equal(attendance.typography, 0); // fontSize already var()-based
    assert.equal(attendance.radius, 1); // borderRadius:4, no exact token
    assert.equal(attendance.color, 0);
  });

  it('fails when a file gains a new violation vs baseline, and is silent when restored', () => {
    const original = fs.readFileSync(targetFile, 'utf8');
    try {
      fs.writeFileSync(
        targetFile,
        `const __ratchetTestInjected = <div style={{ padding: 7 }} />;\n${original}`,
      );
      const dirty = run([]);
      assert.equal(dirty.status, 1, dirty.stdout);
      assert.match(dirty.stdout, /apps\/admin\/src\/pages\/classes\/index\.tsx/);
    } finally {
      fs.writeFileSync(targetFile, original);
    }
    const clean = run([]);
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);
  });

  it('--write-baseline regenerates the baseline file without failing', () => {
    const before = fs.readFileSync(path.join(root, 'scripts/ratchet-baseline.json'), 'utf8');
    const r = run(['--write-baseline']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const after = fs.readFileSync(path.join(root, 'scripts/ratchet-baseline.json'), 'utf8');
    assert.deepEqual(JSON.parse(after).baseline, JSON.parse(before).baseline);
  });
});
