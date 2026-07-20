// Shared Contact find-or-create (F8 / phase-08). The ONLY sanctioned writer of
// Contact rows — `crm.opportunityCreate` and the phase-05 walk-in auto-link
// both route through here so the `@@unique([facilityId, phone])` invariant and
// phone normalization are enforced in exactly one place.
//
// Phone is normalized to the canonical `84xxxxxxxxx` form so "0912...",
// "+84 912..." and "84912..." all resolve to one Contact. Implemented as an
// `upsert` on the `@@unique([facilityId, phone])` index: Prisma emits a native
// `INSERT ... ON CONFLICT` for Postgres, which is race-safe AND does not abort
// the surrounding transaction on conflict — unlike a find-then-create with a
// P2002 catch, whose refetch would run on an already-aborted tx (25P02), since
// the caller (opportunityCreate) does the Contact + Opportunity + audit writes
// in ONE transaction. `update: {}` = leave an existing Contact's name/email
// untouched (find semantics).

import type { Prisma } from '@cmc/db';
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

  return tx.contact.upsert({
    where: { facilityId_phone: { facilityId: input.facilityId, phone } },
    create: { facilityId: input.facilityId, name: input.name, phone, email: input.email ?? null },
    update: {},
  });
}
