/**
 * Proves check-ui-frames.mjs scans real admin pages and reports bulk adoption.
 * Run: node --test scripts/check-ui-frames.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/check-ui-frames.mjs');

describe('check-ui-frames.mjs', () => {
  it('reports bulkListsOk when product lists ship BulkActionBar+selectedIds', () => {
    const r = spawnSync(process.execPath, [script, '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.ok(report.pageCount > 20);
    assert.ok(report.roots?.includes('apps/lms/src'), 'LMS must stay in the scan');
    assert.ok(typeof report.counts.ListPage === 'number');
    assert.ok(report.bulkCount >= 5, `expected ≥5 bulk lists, got ${report.bulkCount}`);
    assert.equal(report.metrics.bulkListsOk, true);
    assert.ok(
      report.bulkEnabledFiles.some((f) => f.includes('receipt-list')),
      'receipt-list should be bulk-enabled',
    );
  });

  it('reports depth metrics: FilterBar, ListPagination, detail tiers', () => {
    const r = spawnSync(process.execPath, [script, '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const report = JSON.parse(r.stdout);
    assert.ok(report.filterBarCount >= 5, `FilterBar count ${report.filterBarCount}`);
    assert.ok(report.listPaginationCount >= 8, `ListPagination ${report.listPaginationCount}`);
    assert.ok(report.detailTiers, 'detailTiers present');
    assert.ok(
      report.detailTiers.full.some((f) => f.includes('receipt-detail')),
      'receipt-detail is full tier',
    );
    assert.ok(
      report.detailTiers.full.some((f) => f.includes('opportunity-detail')),
      'opportunity-detail is full tier',
    );
    // Densify wave: student form gained WorkflowStatusbar → full tier (was standard).
    assert.ok(
      report.detailTiers.full.some((f) => f.includes('student-detail')),
      'student-detail is full tier after densify',
    );
    assert.ok(
      report.detailTiers.standard.some(
        (f) => f.includes('parent-detail') || f.includes('session-detail'),
      ),
      'standard tier still has parent or session form',
    );
    assert.ok(
      report.detailTiers.settings.some((f) => f.includes('shift-config')),
      'shift-config is settings tier',
    );
    assert.ok(
      report.detailTiers.thin.some((f) => f.includes('payroll') || f.includes('my-hr')),
      'thin residual includes payroll or my-hr',
    );
    assert.equal(typeof report.metrics.detailThinCount, 'number');
    assert.equal(report.dualTitleReview.length, 0);
  });

  it('--strict still passes dual-title + bulk gates', () => {
    const r = spawnSync(process.execPath, [script, '--strict'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
