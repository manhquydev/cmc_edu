/**
 * Proves the URL-structure CLI treats router+links as authority and stays
 * green on HEAD. Run: node --test scripts/check-url-structure.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/check-url-structure.ts');

function run(args) {
  return spawnSync('pnpm', ['exec', 'tsx', script, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('check-url-structure.ts', () => {
  it('exits 0 on HEAD and reports as-built families, not TL06 as the target', () => {
    const result = run(['--json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.authority, 'router+links+nav');
    assert.ok(report.familyCounts['admin-module'] >= 8, 'academic/loyalty under /admin');
    assert.ok(report.familyCounts['index-resource'] >= 4, 'finance/crm area-as-list');
    assert.ok(report.familyCounts['form-depth'] >= 8, 'list+:uuid recipe');
    const ids = report.mix.map((row) => row.id);
    assert.ok(ids.includes('students'));
    assert.ok(ids.includes('receipts'));
    const students = report.mix.find((row) => row.id === 'students');
    assert.equal(students.asBuilt, '/admin/students');
    assert.equal(students.family, 'admin-module');
    const receipts = report.mix.find((row) => row.id === 'receipts');
    assert.equal(receipts.asBuilt, '/finance');
    assert.equal(receipts.family, 'index-resource');
    assert.ok(Array.isArray(report.paperNotes));
    assert.ok(report.paperNotes.length > 0);
    assert.equal(report.findings.length, 0);
  });
});
