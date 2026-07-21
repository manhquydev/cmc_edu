// Shared Contact find-or-create (F8 / phase-08). The ONLY sanctioned writer of
// Contact rows — `crm.opportunityCreate` and the phase-05 walk-in auto-link
// both route through here so the `@@unique([facilityId, phone])` invariant and
// phone normalization are enforced in exactly one place.
//
// Phone is normalized to the canonical `84xxxxxxxxx` form so "0912...",
// "+84 912..." and "84912..." all resolve to one Contact. Implemented as an
// `upsert` on the `@@unique([facilityId, phone])` index: Prisma emits a native
// A native `INSERT ... ON CONFLICT` is used explicitly: Prisma can fall back
// to a read-then-insert emulation for an empty upsert update, which still emits
// P2002 under concurrent requests. The no-op phone assignment leaves an
// existing Contact's name/email untouched and returns the single winner row.

import type { Prisma } from '@cmc/db';
import { badRequest } from '../errors.js';
import { normalizeContactPhone } from './normalize-contact-phone.js';

export interface FindOrCreateContactInput {
  facilityId: string;
  name: string;
  phone: string;
  email?: string | null;
}

/**
 * Finds the Contact for `(facilityId, normalizedPhone)` or creates it. Must run
 * inside a `withFacility` transaction (Contact is RLS-protected). Returns the
 * existing or newly-created Contact.
 */
export async function findOrCreateContact(
  tx: Prisma.TransactionClient,
  input: FindOrCreateContactInput,
) {
  const phone = normalizeContactPhone(input.phone);
  if (!phone) {
    throw badRequest('Phone must contain at least one digit.');
  }

  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "Contact" ("id", "facilityId", "name", "phone", "email", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${input.facilityId}, ${input.name}, ${phone}, ${input.email ?? null}, NOW(), NOW())
    ON CONFLICT ("facilityId", "phone")
    DO UPDATE SET "phone" = EXCLUDED."phone"
    RETURNING "id"
  `;
  return rows[0]!;
}
