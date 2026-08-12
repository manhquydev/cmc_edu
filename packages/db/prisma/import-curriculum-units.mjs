// Import CurriculumUnit catalog from prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv.
//
// One CSV row = one topic. Multiple topics share (program, order_global) and
// collapse to one unit: 240 rows → 96 units (UCREA 36, BRIGHT_IG 18, BLACK_HOLE 42).
//
// Rules (phase-01 / owner brief):
//   - Map CSV program labels → Program enum
//   - Keep order_global and level verbatim (no gap-compaction)
//   - monthIndex = 1-based sequence within (program, level), derived at import
//   - unitType from unit_type; title from unit_code + joined chu_de
//   - Idempotent upsert on (program, orderGlobal)
//
// Pure ESM — no build step. Safe to import from seed.mjs or run as CLI:
//   node prisma/import-curriculum-units.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Default path: packages/db/prisma/data/CMC_EDU_Khung_Chuong_Trinh.csv */
export const DEFAULT_CSV_PATH = join(__dirname, 'data', 'CMC_EDU_Khung_Chuong_Trinh.csv');

/** CSV program label → Prisma Program enum */
export const PROGRAM_BY_CSV = Object.freeze({
  UCREA: 'UCREA',
  'Bright I.G': 'BRIGHT_IG',
  'Black Hole': 'BLACK_HOLE',
});

export const EXPECTED_COUNTS = Object.freeze({
  UCREA: 36,
  BRIGHT_IG: 18,
  BLACK_HOLE: 42,
  TOTAL: 96,
});

/**
 * Minimal CSV parser with quoted-field support (commas inside bai_hoc etc.).
 * Same shape as cmc-lms seed-curriculum parseCsv.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/**
 * @param {string} [csvPath]
 * @returns {Record<string, string>[]}
 */
export function readCurriculumCsv(csvPath = DEFAULT_CSV_PATH) {
  const text = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error(`Curriculum CSV empty: ${csvPath}`);
  return body.map((cells) => {
    /** @type {Record<string, string>} */
    const r = {};
    header.forEach((h, i) => {
      r[h.trim()] = (cells[i] ?? '').trim();
    });
    return r;
  });
}

/**
 * Group CSV topic rows into CurriculumUnit payloads.
 * Key = (mapped program, order_global). monthIndex assigned per (program, level).
 *
 * @param {Record<string, string>[]} rows
 * @returns {{
 *   units: Array<{
 *     program: string,
 *     level: string,
 *     monthIndex: number,
 *     unitType: 'LESSON' | 'REVIEW',
 *     title: string,
 *     orderGlobal: number,
 *     unitCode: string,
 *   }>,
 *   counts: { UCREA: number, BRIGHT_IG: number, BLACK_HOLE: number, TOTAL: number },
 *   sourceRowCount: number,
 * }}
 */
export function groupCurriculumUnits(rows) {
  /** @type {Map<string, {
   *   program: string,
   *   level: string,
   *   unitType: 'LESSON' | 'REVIEW',
   *   orderGlobal: number,
   *   unitCode: string,
   *   themes: string[],
   * }>} */
  const byKey = new Map();

  for (const row of rows) {
    const program = PROGRAM_BY_CSV[row.program];
    if (!program) {
      throw new Error(`Unknown CSV program label: "${row.program}"`);
    }
    const orderGlobal = Number(row.order_global);
    if (!Number.isFinite(orderGlobal)) {
      throw new Error(`Invalid order_global for unit_code=${row.unit_code}: "${row.order_global}"`);
    }
    const key = `${program}\0${orderGlobal}`;
    let unit = byKey.get(key);
    if (!unit) {
      const unitType = row.unit_type === 'REVIEW' ? 'REVIEW' : 'LESSON';
      unit = {
        program,
        level: row.level,
        unitType,
        orderGlobal,
        unitCode: row.unit_code,
        themes: [],
      };
      byKey.set(key, unit);
    } else {
      // Same unit: level / unitType must stay consistent across topics.
      if (unit.level !== row.level) {
        throw new Error(
          `level mismatch for ${program} order_global=${orderGlobal}: ${unit.level} vs ${row.level}`,
        );
      }
      if ((row.unit_type === 'REVIEW' ? 'REVIEW' : 'LESSON') !== unit.unitType) {
        throw new Error(
          `unit_type mismatch for ${program} order_global=${orderGlobal}`,
        );
      }
    }
    const theme = row.chu_de;
    if (theme && !unit.themes.includes(theme)) {
      unit.themes.push(theme);
    }
  }

  const units = [...byKey.values()].map((u) => {
    const themePart = u.themes.join(' · ');
    const title = themePart
      ? u.unitCode
        ? `${u.unitCode} — ${themePart}`
        : themePart
      : u.unitCode || `${u.program} #${u.orderGlobal}`;
    return {
      program: u.program,
      level: u.level,
      monthIndex: 0, // filled below
      unitType: u.unitType,
      title,
      orderGlobal: u.orderGlobal,
      unitCode: u.unitCode,
    };
  });

  // monthIndex: 1-based sequence within (program, level), ordered by orderGlobal.
  /** @type {Map<string, typeof units>} */
  const byProgramLevel = new Map();
  for (const u of units) {
    const k = `${u.program}\0${u.level}`;
    const list = byProgramLevel.get(k) ?? [];
    list.push(u);
    byProgramLevel.set(k, list);
  }
  for (const list of byProgramLevel.values()) {
    list.sort((a, b) => a.orderGlobal - b.orderGlobal);
    list.forEach((u, i) => {
      u.monthIndex = i + 1;
    });
  }

  units.sort((a, b) => {
    if (a.program !== b.program) return a.program.localeCompare(b.program);
    return a.orderGlobal - b.orderGlobal;
  });

  /** @type {{ UCREA: number, BRIGHT_IG: number, BLACK_HOLE: number, TOTAL: number }} */
  const counts = { UCREA: 0, BRIGHT_IG: 0, BLACK_HOLE: 0, TOTAL: units.length };
  for (const u of units) {
    if (u.program === 'UCREA') counts.UCREA += 1;
    else if (u.program === 'BRIGHT_IG') counts.BRIGHT_IG += 1;
    else if (u.program === 'BLACK_HOLE') counts.BLACK_HOLE += 1;
  }

  return { units, counts, sourceRowCount: rows.length };
}

/**
 * Load + group CSV. Throws if counts are not the expected 36/18/42.
 * @param {string} [csvPath]
 */
export function loadCurriculumUnitsFromCsv(csvPath = DEFAULT_CSV_PATH) {
  const rows = readCurriculumCsv(csvPath);
  const result = groupCurriculumUnits(rows);
  const { counts } = result;
  if (
    counts.UCREA !== EXPECTED_COUNTS.UCREA ||
    counts.BRIGHT_IG !== EXPECTED_COUNTS.BRIGHT_IG ||
    counts.BLACK_HOLE !== EXPECTED_COUNTS.BLACK_HOLE
  ) {
    throw new Error(
      `Curriculum unit counts mismatch: got UCREA=${counts.UCREA} BRIGHT_IG=${counts.BRIGHT_IG} BLACK_HOLE=${counts.BLACK_HOLE} (expected 36/18/42)`,
    );
  }
  return result;
}

/**
 * Upsert all units. Idempotent on (program, orderGlobal).
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} [csvPath]
 * @returns {Promise<{ created: number, updated: number, total: number, counts: typeof EXPECTED_COUNTS }>}
 */
export async function importCurriculumUnits(db, csvPath = DEFAULT_CSV_PATH) {
  const { units, counts } = loadCurriculumUnitsFromCsv(csvPath);
  let created = 0;
  let updated = 0;

  for (const unit of units) {
    const data = {
      program: unit.program,
      level: unit.level,
      monthIndex: unit.monthIndex,
      unitType: unit.unitType,
      title: unit.title,
      orderGlobal: unit.orderGlobal,
    };
    const existing = await db.curriculumUnit.findUnique({
      where: {
        program_orderGlobal: {
          program: unit.program,
          orderGlobal: unit.orderGlobal,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await db.curriculumUnit.update({
        where: { id: existing.id },
        data: {
          level: data.level,
          monthIndex: data.monthIndex,
          unitType: data.unitType,
          title: data.title,
        },
      });
      updated += 1;
    } else {
      await db.curriculumUnit.create({ data });
      created += 1;
    }
  }

  return {
    created,
    updated,
    total: units.length,
    counts: { ...counts, TOTAL: counts.TOTAL },
  };
}

// CLI entry: `node prisma/import-curriculum-units.mjs`
const entryScript = process.argv[1];
if (entryScript && import.meta.url === pathToFileURL(entryScript).href) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('import-curriculum-units: DATABASE_URL is not set.');
    process.exitCode = 1;
  } else {
    const adapter = new PrismaPg({ connectionString });
    const db = new PrismaClient({ adapter });
    importCurriculumUnits(db)
      .then((r) => {
        console.log(
          `CurriculumUnit import: created=${r.created} updated=${r.updated} total=${r.total} ` +
            `(UCREA=${r.counts.UCREA} BRIGHT_IG=${r.counts.BRIGHT_IG} BLACK_HOLE=${r.counts.BLACK_HOLE})`,
        );
      })
      .catch((err) => {
        console.error('CurriculumUnit import failed:', err);
        process.exitCode = 1;
      })
      .finally(() => db.$disconnect());
  }
}
