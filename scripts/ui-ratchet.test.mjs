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
  it('passes against the committed baseline (admin at 0; LMS grandfathered)', () => {
    const r = run(['--json']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.ok(report.pageCount > 20);
    assert.equal(report.increased.length, 0);
    const baseline = JSON.parse(
      fs.readFileSync(path.join(root, 'scripts/ratchet-baseline.json'), 'utf8'),
    ).baseline;
    for (const file of Object.keys(report.perFile ?? {})) {
      assert.ok(file.startsWith('apps/lms/'), `admin must stay at 0, got ${file}`);
    }
    for (const file of Object.keys(baseline)) {
      assert.ok(file.startsWith('apps/lms/'), `baseline should only grandfather LMS, got ${file}`);
    }
    assert.equal(report.totalViolations, Object.values(baseline).reduce((s, n) => s + n, 0));
  });

  it('applies scripts/ratchet-exemptions.json entries by exact (file, property, value) match', () => {
    const exemptions = JSON.parse(
      fs.readFileSync(path.join(root, 'scripts/ratchet-exemptions.json'), 'utf8'),
    ).exemptions;
    assert.ok(exemptions.length >= 15, 'expected the Phase 8 exemption list to be populated');
    // teaching/schedule.tsx's gap:12 is one of the listed exemptions — confirm it stays excluded.
    const schedule = exemptions.find(
      (e) => e.file === 'apps/admin/src/pages/teaching/schedule.tsx' && e.property === 'gap',
    );
    assert.ok(schedule, 'expected a gap exemption for teaching/schedule.tsx');
    assert.equal(schedule.value, '12');
    const r = run(['--json']);
    const report = JSON.parse(r.stdout);
    assert.equal(
      report.perFile['apps/admin/src/pages/teaching/schedule.tsx'],
      undefined,
      'exempted file should not appear in perFile at all (count is 0)',
    );
  });

  it('only counts literal values in tokenizable properties, exempting layout/typography/var()/%', () => {
    const original = fs.readFileSync(targetFile, 'utf8');
    try {
      fs.writeFileSync(
        targetFile,
        // display/flex/width: layout+size exempt; borderRadius:'var(...)' already tokenized.
        // padding:8 and fontSize:13 ARE literals with real token equivalents elsewhere in the
        // codebase, but the script counts raw literals regardless of whether a token exists for
        // that value — fixing vs. exempting is a human judgment made after the fact, not
        // something the script infers. Neither has an exemption entry for THIS file, so both
        // count (proves exemption matching is per file+property+value, not by value alone).
        `const __ratchetTestSynthetic = (
          <div style={{ display: 'flex', width: 320, borderRadius: 'var(--cmc-radius-card)', padding: 8, fontSize: 13, background: '#ff0000' }} />
        );\n${original}`,
      );
      const r = run(['--json']);
      const report = JSON.parse(r.stdout);
      const counts = report.perFile[path.relative(root, targetFile)];
      assert.ok(counts, 'synthetic injected style block should be counted');
      assert.equal(counts.total, 3);
      assert.equal(counts.spacing, 1); // padding:8 (no exemption entry for this file/property)
      assert.equal(counts.typography, 1); // fontSize:13
      assert.equal(counts.radius, 0); // var() — already tokenized
      assert.equal(counts.color, 1); // background:'#ff0000' — literal, not only backgroundColor
    } finally {
      fs.writeFileSync(targetFile, original);
    }
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
