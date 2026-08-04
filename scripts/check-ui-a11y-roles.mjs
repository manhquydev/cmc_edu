#!/usr/bin/env node
/**
 * Role/aria substring smoke for @cmc/ui Soft Ops composites.
 * Asserts expected accessibility markers remain in source — not a WCAG audit.
 *
 * Usage: node scripts/check-ui-a11y-roles.mjs [--json]
 * Exit 0 = all checks pass; exit 1 = one or more required substrings missing.
 *
 * No axe dependency. Human keyboard paths stay in design-system/cmc-edu/A11Y-BASELINE.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const ui = (...parts) => path.join(root, 'packages/ui/src/components', ...parts);

/**
 * Each entry: composite source file + required substrings (literal, not regex).
 * Paths and markers mirror design-system/cmc-edu/A11Y-BASELINE.md inventory.
 */
const CHECKS = [
  {
    id: 'FilterBar',
    file: ui('filter-bar.tsx'),
    requires: ['role="search"', 'aria-label="Bộ lọc"'],
  },
  {
    id: 'ListPagination',
    file: ui('list-pagination.tsx'),
    requires: ['role="navigation"', 'aria-label="Phân trang"', 'aria-current="page"'],
  },
  {
    id: 'BulkActionBar',
    file: ui('bulk-action-bar.tsx'),
    requires: ['role="toolbar"', 'aria-label="Thao tác hàng loạt"'],
  },
  {
    id: 'DataTableSelection',
    file: ui('data-table.tsx'),
    requires: ['aria-label="Chọn tất cả trên trang"', 'aria-label="Chọn dòng"'],
  },
  {
    id: 'PageHeaderBreadcrumbs',
    file: ui('page-header.tsx'),
    requires: ['aria-label="Đường dẫn"', '<nav'],
  },
  {
    id: 'CommandPalette',
    file: ui('command-palette.tsx'),
    requires: ['role="dialog"', 'aria-modal="true"', 'role="listbox"', 'role="option"'],
  },
  {
    id: 'Toast',
    file: ui('toast.tsx'),
    requires: ['aria-live="polite"', "role={item.tone === 'error' ? 'alert' : 'status'}", 'aria-label="Đóng thông báo"'],
  },
  {
    id: 'SettingsShell',
    file: ui('settings-shell.tsx'),
    requires: ['aria-label={title}', "aria-current={active ? 'page' : undefined}"],
  },
];

function run() {
  const results = [];
  let failed = 0;

  for (const check of CHECKS) {
    const rel = path.relative(root, check.file);
    if (!fs.existsSync(check.file)) {
      failed += 1;
      results.push({
        id: check.id,
        file: rel,
        ok: false,
        missing: ['<file missing>'],
        present: [],
      });
      continue;
    }
    const src = fs.readFileSync(check.file, 'utf8');
    const present = [];
    const missing = [];
    for (const needle of check.requires) {
      if (src.includes(needle)) present.push(needle);
      else missing.push(needle);
    }
    const ok = missing.length === 0;
    if (!ok) failed += 1;
    results.push({ id: check.id, file: rel, ok, present, missing });
  }

  const report = {
    ok: failed === 0,
    checkCount: CHECKS.length,
    failCount: failed,
    results,
    note: 'Substring smoke only — not WCAG certification. See design-system/cmc-edu/A11Y-BASELINE.md',
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    for (const r of results) {
      if (r.ok) {
        console.log(`ok  ${r.id} (${r.file})`);
      } else {
        console.log(`FAIL ${r.id} (${r.file})`);
        for (const m of r.missing) console.log(`     missing: ${m}`);
      }
    }
    console.log(
      failed === 0
        ? `\n${CHECKS.length} checks passed (role smoke; baseline remains partial).`
        : `\n${failed}/${CHECKS.length} checks failed.`,
    );
  }

  process.exit(failed === 0 ? 0 : 1);
}

run();
