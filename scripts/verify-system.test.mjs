/**
 * Proves verify-system classifies @cmc/ui coupling and never treats
 * verification.json.commit as journeys evidence.
 * Run: node --test scripts/verify-system.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyUiSource, journeysProof } from './verify-system.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/verify-system.mjs');

describe('classifyUiSource', () => {
  it('labels Astryx + console class as HYBRID', () => {
    assert.equal(
      classifyUiSource(`import { Badge } from '@astryxdesign/core';\n<div className="console-badge-soft" />`),
      'HYBRID',
    );
  });
  it('labels console-only as CONSOLE-ONLY', () => {
    assert.equal(classifyUiSource(`<div className="console-mc" />`), 'CONSOLE-ONLY');
  });
});

describe('journeysProof', () => {
  it('is unmeasured when the Playwright file is missing', () => {
    const r = journeysProof(path.join(root, 'does-not-exist.json'), 'abc');
    assert.equal(r.proofClass, 'unmeasured');
    assert.equal(r.status, 'unmeasured');
    assert.match(r.detail, /Không gọi --strict|không gọi --strict/i);
  });

  it('matches full SHA from config.metadata.gitSha, not a short commit', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'verify-system-'));
    const file = path.join(dir, 'journeys.json');
    const sha = 'a'.repeat(40);
    writeFileSync(file, JSON.stringify({ config: { metadata: { gitSha: sha } } }));
    const ok = journeysProof(file, sha);
    assert.equal(ok.match, true);
    assert.equal(ok.proofClass, 'ci-artifact');
    const stale = journeysProof(file, 'b'.repeat(40));
    assert.equal(stale.match, false);
    assert.equal(stale.proofClass, 'unmeasured');
    assert.match(stale.detail, /Không --strict/);
  });
});

describe('verify-system.mjs --skip-slow', () => {
  it('exits 0, writes SHA, never mentions business:verify --strict as invoked', () => {
    const r = spawnSync(process.execPath, [script, '--json', '--skip-slow'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.equal(typeof report.sha, 'string');
    assert.equal(report.sha.length, 40);
    assert.ok(report.never.includes('business:verify --strict'));
    assert.ok(report.never.includes('verification.json.commit as evidence'));
    const l4 = report.layers.find((l) => l.id === 'L4');
    assert.equal(l4.proofClass, 'unmeasured');
    assert.equal(l4.status, 'unmeasured');
    assert.ok(!report.proofClassesAllowed.includes('docs'));
    assert.ok(report.inventory['CONSOLE-ONLY'] > 0);
    assert.ok(report.inventory.HYBRID > 0);
  });
});
