// Shared RecordEvent persistence/cursor seam (resource-depth Phase 4A).
//
// Append-only business-history storage primitives shared by every domain
// (CRM Opportunity, HR AppUser, …): row append, newest-first composite-cursor
// pagination, and cursor (de)serialization. Kind vocabularies, payload
// allowlists, labels and history epochs stay in each domain's record-event
// module — this file knows nothing about any entity.
//
// Security invariants (unchanged from the CRM original):
// - `entity` is fixed server-side by the calling domain; it never crosses a
//   client boundary, so a client cannot read another entity's events.
// - The caller MUST scope `facilityId` and authorize the parent record before
//   listing; this seam performs no authorization of its own.

import type { Prisma } from '@cmc/db';
import { badRequest } from '../errors.js';

/** Newest-first composite cursor: `createdAt.toISOString()|id`. */
export function encodeRecordEventCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function parseRecordEventCursor(cursor: string): {
  createdAt: Date;
  id: string;
} {
  const sep = cursor.indexOf('|');
  if (sep <= 0 || sep === cursor.length - 1) {
    throw badRequest('Invalid timeline cursor.');
  }
  const createdAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (!id || Number.isNaN(createdAt.getTime())) {
    throw badRequest('Invalid timeline cursor.');
  }
  return { createdAt, id };
}

/** Append one event row inside the caller's transaction — the event commits
 *  or rolls back together with the domain mutation it describes. */
export async function appendRecordEvent(
  tx: Prisma.TransactionClient,
  args: {
    facilityId: string;
    entity: string;
    entityId: string;
    kind: string;
    actor: string;
    payload?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.recordEvent.create({
    data: {
      facilityId: args.facilityId,
      entity: args.entity,
      entityId: args.entityId,
      kind: args.kind,
      actor: args.actor,
      ...(args.payload !== undefined ? { payload: args.payload } : {}),
    },
  });
}

/** One newest-first page of events for a fixed server-side entity row.
 *  Returns `take` rows plus the cursor for the next page, or null at the end.
 *  Rows are raw; the calling domain maps kinds/labels/payload policy. */
export async function listRecordEventPage(
  tx: Prisma.TransactionClient,
  where: { facilityId: string; entity: string; entityId: string },
  cursor: string | null,
  take: number,
): Promise<{ rows: Array<{ id: string; kind: string; actor: string; payload: unknown; createdAt: Date }>; nextCursor: string | null }> {
  const parsed = cursor ? parseRecordEventCursor(cursor) : null;
  const rows = await tx.recordEvent.findMany({
    where: {
      ...where,
      ...(parsed
        ? {
            OR: [
              { createdAt: { lt: parsed.createdAt } },
              { AND: [{ createdAt: parsed.createdAt }, { id: { lt: parsed.id } }] },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    select: { id: true, kind: true, actor: true, payload: true, createdAt: true },
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeRecordEventCursor(last.createdAt, last.id) : null,
  };
}
