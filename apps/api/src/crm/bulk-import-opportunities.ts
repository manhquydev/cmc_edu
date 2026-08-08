// Bulk lead import (P3) — paste text/CSV, preview, then confirm.
//
// Open-opportunity dedup is NEW logic (findOrCreateContact only dedups Contact).
// Confirm re-checks open opps per phone to reduce TOCTOU vs preview.

import type { Prisma } from '@cmc/db';
import { normalizeContactPhone } from './normalize-contact-phone.js';
import { findOrCreateContact } from './find-or-create-contact.js';

export const BULK_IMPORT_MAX_ROWS = 500;

const SOURCE_VALUES = new Set([
  'referral',
  'walkin',
  'fanpage',
  'hotline',
  'event',
  'other',
]);

export type BulkRowStatus =
  | 'create'
  | 'skip_open_opportunity'
  | 'skip_duplicate_in_file'
  | 'error';

export interface ParsedBulkRow {
  line: number;
  name: string;
  phoneRaw: string;
  email?: string;
  source?: string;
}

export interface BulkPreviewRow {
  line: number;
  name: string;
  phone: string;
  email?: string;
  source?: string | null;
  normalizedPhone: string | null;
  status: BulkRowStatus;
  reason?: string;
}

export interface BulkImportResultRow {
  line: number;
  status: 'created' | 'skipped' | 'error';
  opportunityId?: string;
  reason?: string;
  name?: string;
  phone?: string;
}

/** Split a CSV line on commas, respecting simple double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Parse paste text into rows. Accepts:
 * - header optional: name,phone[,email[,source]]
 * - tab or comma separators
 * - blank lines ignored
 */
export function parseBulkText(text: string): ParsedBulkRow[] {
  const lines = text.split(/\r?\n/);
  const rows: ParsedBulkRow[] = [];
  let start = 0;

  // Detect header
  if (lines.length > 0) {
    const firstCells = splitCells(lines[0]);
    const h0 = (firstCells[0] ?? '').toLowerCase();
    const h1 = (firstCells[1] ?? '').toLowerCase();
    if (
      (h0 === 'name' || h0 === 'họ tên' || h0 === 'ho ten' || h0 === 'tên' || h0 === 'ten') &&
      (h1.includes('phone') || h1.includes('sđt') || h1.includes('sdt') || h1.includes('điện'))
    ) {
      start = 1;
    }
  }

  for (let i = start; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const cells = splitCells(raw);
    const name = (cells[0] ?? '').trim();
    const phoneRaw = (cells[1] ?? '').trim();
    let email: string | undefined;
    let source: string | undefined;
    if (cells.length >= 4) {
      email = (cells[2] ?? '').trim() || undefined;
      source = (cells[3] ?? '').trim() || undefined;
    } else if (cells.length === 3) {
      const third = (cells[2] ?? '').trim();
      if (!third) {
        // name,phone, empty
      } else if (SOURCE_VALUES.has(third) || third.includes('@')) {
        if (third.includes('@')) email = third;
        else source = third;
      } else {
        // Treat unknown third column as source (will error at classify if invalid).
        source = third;
      }
    }
    rows.push({
      line: i + 1, // 1-based in original text
      name,
      phoneRaw,
      email,
      source,
    });
  }
  return rows;
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  return splitCsvLine(line);
}

export function classifyBulkRows(
  parsed: ParsedBulkRow[],
  openPhones: Set<string>,
  defaultSource?: string | null,
): BulkPreviewRow[] {
  const seenInFile = new Set<string>();
  const out: BulkPreviewRow[] = [];

  for (const row of parsed) {
    const sourceRaw = row.source ?? defaultSource ?? null;
    const source =
      sourceRaw && sourceRaw.length > 0
        ? SOURCE_VALUES.has(sourceRaw)
          ? sourceRaw
          : null
        : null;

    if (!row.name) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source,
        normalizedPhone: null,
        status: 'error',
        reason: 'Thiếu họ tên',
      });
      continue;
    }
    if (!row.phoneRaw) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source,
        normalizedPhone: null,
        status: 'error',
        reason: 'Thiếu số điện thoại',
      });
      continue;
    }
    if (row.source && !SOURCE_VALUES.has(row.source) && !defaultSource) {
      // invalid per-row source only errors if no default and value present
    }
    if (row.source && !SOURCE_VALUES.has(row.source)) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source: row.source,
        normalizedPhone: null,
        status: 'error',
        reason: `Nguồn không hợp lệ: ${row.source}`,
      });
      continue;
    }
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source,
        normalizedPhone: null,
        status: 'error',
        reason: 'Email không hợp lệ',
      });
      continue;
    }

    const normalizedPhone = normalizeContactPhone(row.phoneRaw);
    if (!normalizedPhone || !/\d/.test(normalizedPhone)) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source,
        normalizedPhone: null,
        status: 'error',
        reason: 'Số điện thoại không hợp lệ',
      });
      continue;
    }

    if (seenInFile.has(normalizedPhone)) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source,
        normalizedPhone,
        status: 'skip_duplicate_in_file',
        reason: 'Trùng số trong danh sách',
      });
      continue;
    }
    seenInFile.add(normalizedPhone);

    if (openPhones.has(normalizedPhone)) {
      out.push({
        line: row.line,
        name: row.name,
        phone: row.phoneRaw,
        email: row.email,
        source,
        normalizedPhone,
        status: 'skip_open_opportunity',
        reason: 'Đã có cơ hội đang mở với SĐT này',
      });
      continue;
    }

    out.push({
      line: row.line,
      name: row.name,
      phone: row.phoneRaw,
      email: row.email,
      source,
      normalizedPhone,
      status: 'create',
    });
  }
  return out;
}

/** Phones that already have an open opportunity (closedAt IS NULL) in facility. */
export async function loadOpenOpportunityPhones(
  tx: Prisma.TransactionClient,
  facilityId: string,
  phones: string[],
): Promise<Set<string>> {
  if (phones.length === 0) return new Set();
  const unique = [...new Set(phones)];
  const contacts = await tx.contact.findMany({
    where: { facilityId, phone: { in: unique } },
    select: { id: true, phone: true },
  });
  if (contacts.length === 0) return new Set();
  const byId = new Map(contacts.map((c) => [c.id, c.phone]));
  const open = await tx.opportunity.findMany({
    where: {
      facilityId,
      closedAt: null,
      contactId: { in: contacts.map((c) => c.id) },
    },
    select: { contactId: true },
  });
  const phonesOpen = new Set<string>();
  for (const o of open) {
    const phone = byId.get(o.contactId);
    if (phone) phonesOpen.add(phone);
  }
  return phonesOpen;
}

export async function previewBulkImport(
  tx: Prisma.TransactionClient,
  facilityId: string,
  text: string,
  defaultSource?: string | null,
): Promise<{
  rows: BulkPreviewRow[];
  summary: { total: number; create: number; skip: number; error: number };
  overLimit: boolean;
}> {
  const parsed = parseBulkText(text);
  const overLimit = parsed.length > BULK_IMPORT_MAX_ROWS;
  const limited = overLimit ? parsed.slice(0, BULK_IMPORT_MAX_ROWS) : parsed;

  const phones = limited
    .map((r) => normalizeContactPhone(r.phoneRaw))
    .filter((p): p is string => Boolean(p && /\d/.test(p)));
  const openPhones = await loadOpenOpportunityPhones(tx, facilityId, phones);
  const rows = classifyBulkRows(limited, openPhones, defaultSource);

  if (overLimit) {
    // Mark overflow as errors on synthetic lines after cap.
    for (let i = BULK_IMPORT_MAX_ROWS; i < parsed.length; i += 1) {
      rows.push({
        line: parsed[i].line,
        name: parsed[i].name,
        phone: parsed[i].phoneRaw,
        email: parsed[i].email,
        source: parsed[i].source ?? defaultSource ?? null,
        normalizedPhone: null,
        status: 'error',
        reason: `Vượt giới hạn ${BULK_IMPORT_MAX_ROWS} dòng/lần`,
      });
    }
  }

  const summary = {
    total: rows.length,
    create: rows.filter((r) => r.status === 'create').length,
    skip: rows.filter(
      (r) => r.status === 'skip_open_opportunity' || r.status === 'skip_duplicate_in_file',
    ).length,
    error: rows.filter((r) => r.status === 'error').length,
  };
  return { rows, summary, overLimit };
}

export async function confirmBulkImport(
  tx: Prisma.TransactionClient,
  opts: {
    facilityId: string;
    text: string;
    defaultSource?: string | null;
    assignedToId: string | null;
  },
): Promise<{
  results: BulkImportResultRow[];
  summary: { created: number; skipped: number; error: number };
}> {
  const preview = await previewBulkImport(tx, opts.facilityId, opts.text, opts.defaultSource);
  const results: BulkImportResultRow[] = [];
  let created = 0;
  let skipped = 0;
  let error = 0;

  for (const row of preview.rows) {
    if (row.status !== 'create' || !row.normalizedPhone) {
      const isSkip =
        row.status === 'skip_open_opportunity' || row.status === 'skip_duplicate_in_file';
      if (isSkip) skipped += 1;
      else error += 1;
      results.push({
        line: row.line,
        status: isSkip ? 'skipped' : 'error',
        reason: row.reason,
        name: row.name,
        phone: row.phone,
      });
      continue;
    }

    // Commit-time re-check (TOCTOU reduction).
    const stillOpen = await loadOpenOpportunityPhones(tx, opts.facilityId, [
      row.normalizedPhone,
    ]);
    if (stillOpen.has(row.normalizedPhone)) {
      skipped += 1;
      results.push({
        line: row.line,
        status: 'skipped',
        reason: 'Đã có cơ hội đang mở với SĐT này (re-check lúc ghi)',
        name: row.name,
        phone: row.phone,
      });
      continue;
    }

    try {
      const contact = await findOrCreateContact(tx, {
        facilityId: opts.facilityId,
        name: row.name,
        phone: row.normalizedPhone,
        email: row.email,
      });
      const opportunity = await tx.opportunity.create({
        data: {
          facilityId: opts.facilityId,
          contactId: contact.id,
          stage: 'O1_LEAD',
          assignedToId: opts.assignedToId,
          source: row.source ?? opts.defaultSource ?? null,
        },
      });
      created += 1;
      results.push({
        line: row.line,
        status: 'created',
        opportunityId: opportunity.id,
        name: row.name,
        phone: row.phone,
      });
    } catch (e) {
      error += 1;
      results.push({
        line: row.line,
        status: 'error',
        reason: e instanceof Error ? e.message : 'Lỗi không xác định khi tạo',
        name: row.name,
        phone: row.phone,
      });
    }
  }

  return { results, summary: { created, skipped, error } };
}
