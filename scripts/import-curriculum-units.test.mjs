// Proves CSV → CurriculumUnit grouping yields 36 / 18 / 42 (96 total).
// Run: node --test scripts/import-curriculum-units.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_CSV_PATH,
  EXPECTED_COUNTS,
  groupCurriculumUnits,
  loadCurriculumUnitsFromCsv,
  PROGRAM_BY_CSV,
  readCurriculumCsv,
} from '../packages/db/prisma/import-curriculum-units.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = join(
  repoRoot,
  'packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv',
);

describe('curriculum CSV import grouping', () => {
  it('points DEFAULT_CSV_PATH at packages/db/prisma/data CSV', () => {
    assert.equal(DEFAULT_CSV_PATH, csvPath);
  });

  it('reads 240 topic rows from the framework CSV', () => {
    const rows = readCurriculumCsv(csvPath);
    assert.equal(rows.length, 240);
  });

  it('maps CSV program labels to Program enum values', () => {
    assert.equal(PROGRAM_BY_CSV.UCREA, 'UCREA');
    assert.equal(PROGRAM_BY_CSV['Bright I.G'], 'BRIGHT_IG');
    assert.equal(PROGRAM_BY_CSV['Black Hole'], 'BLACK_HOLE');
  });

  it('groups to 36 UCREA + 18 BRIGHT_IG + 42 BLACK_HOLE = 96 units', () => {
    const { units, counts, sourceRowCount } = loadCurriculumUnitsFromCsv(csvPath);
    assert.equal(sourceRowCount, 240);
    assert.equal(counts.UCREA, 36);
    assert.equal(counts.BRIGHT_IG, 18);
    assert.equal(counts.BLACK_HOLE, 42);
    assert.equal(counts.TOTAL, 96);
    assert.equal(units.length, EXPECTED_COUNTS.TOTAL);
    assert.equal(units.filter((u) => u.program === 'UCREA').length, 36);
    assert.equal(units.filter((u) => u.program === 'BRIGHT_IG').length, 18);
    assert.equal(units.filter((u) => u.program === 'BLACK_HOLE').length, 42);
  });

  it('keeps order_global and level verbatim; monthIndex is 1-based per (program, level)', () => {
    const { units } = loadCurriculumUnitsFromCsv(csvPath);

    // UCREA order_global 1 stays 1 (not compacted); level is framework code string.
    const u1 = units.find((u) => u.program === 'UCREA' && u.orderGlobal === 1);
    assert.ok(u1);
    assert.equal(u1.level, 'U2');
    assert.equal(u1.monthIndex, 1);
    assert.equal(u1.unitType, 'LESSON');
    assert.match(u1.title, /U2\.1/);

    // Bright I.G multi-topic unit: 2 CSV rows → 1 unit, gap-preserved order_global.
    const bright = units.find((u) => u.program === 'BRIGHT_IG' && u.orderGlobal === 37);
    assert.ok(bright);
    assert.equal(bright.level, 'J');
    assert.equal(bright.monthIndex, 1);
    assert.match(bright.title, /Pooka Wooka/);
    assert.match(bright.title, /Làm quen với hình dạng/);

    // Black Hole multi-topic (4 topics) collapses to one unit.
    const bh = units.find((u) => u.program === 'BLACK_HOLE' && u.orderGlobal === 61);
    assert.ok(bh);
    assert.equal(bh.level, 'G');
    assert.equal(bh.monthIndex, 1);
    assert.match(bh.title, /Các khối thuộc tính/);

    // monthIndex restarts per level (UCREA U3 first unit is not U2's length+1 globally).
    const u3units = units
      .filter((u) => u.program === 'UCREA' && u.level === 'U3')
      .sort((a, b) => a.orderGlobal - b.orderGlobal);
    assert.ok(u3units.length > 0);
    assert.equal(u3units[0].monthIndex, 1);
  });

  it('is stable when grouping twice (pure function)', () => {
    const rows = readCurriculumCsv(csvPath);
    const a = groupCurriculumUnits(rows);
    const b = groupCurriculumUnits(rows);
    assert.deepEqual(
      a.units.map((u) => ({
        program: u.program,
        orderGlobal: u.orderGlobal,
        level: u.level,
        monthIndex: u.monthIndex,
        unitType: u.unitType,
        title: u.title,
      })),
      b.units.map((u) => ({
        program: u.program,
        orderGlobal: u.orderGlobal,
        level: u.level,
        monthIndex: u.monthIndex,
        unitType: u.unitType,
        title: u.title,
      })),
    );
  });

  it('includes 6 UCREA REVIEW units', () => {
    const { units } = loadCurriculumUnitsFromCsv(csvPath);
    const reviews = units.filter((u) => u.unitType === 'REVIEW');
    assert.equal(reviews.length, 6);
    assert.ok(reviews.every((u) => u.program === 'UCREA'));
  });
});
