// Ambient types for import-curriculum-units.mjs (plain ESM, run by Node).
// Consumers: packages/db/prisma/seed.mjs (runtime) and scripts/ensure-curriculum-units.ts (typecheck).
// TypeScript NodeNext resolves `*.mjs` → sibling `*.d.mts`.

import type { PrismaClient } from '@prisma/client';

export const DEFAULT_CSV_PATH: string;

export const PROGRAM_BY_CSV: Readonly<{
  UCREA: 'UCREA';
  'Bright I.G': 'BRIGHT_IG';
  'Black Hole': 'BLACK_HOLE';
}>;

export const EXPECTED_COUNTS: Readonly<{
  UCREA: 36;
  BRIGHT_IG: 18;
  BLACK_HOLE: 42;
  TOTAL: 96;
}>;

export interface CurriculumUnitImportRow {
  program: string;
  level: string;
  monthIndex: number;
  unitType: 'LESSON' | 'REVIEW';
  title: string;
  orderGlobal: number;
  unitCode: string;
}

export interface CurriculumUnitCounts {
  UCREA: number;
  BRIGHT_IG: number;
  BLACK_HOLE: number;
  TOTAL: number;
}

export interface GroupCurriculumUnitsResult {
  units: CurriculumUnitImportRow[];
  counts: CurriculumUnitCounts;
  sourceRowCount: number;
}

export interface ImportCurriculumUnitsResult {
  created: number;
  updated: number;
  total: number;
  counts: CurriculumUnitCounts;
}

export function parseCsv(text: string): string[][];

export function readCurriculumCsv(csvPath?: string): Record<string, string>[];

export function groupCurriculumUnits(
  rows: Record<string, string>[],
): GroupCurriculumUnitsResult;

export function loadCurriculumUnitsFromCsv(csvPath?: string): GroupCurriculumUnitsResult;

export function importCurriculumUnits(
  db: PrismaClient,
  csvPath?: string,
): Promise<ImportCurriculumUnitsResult>;
