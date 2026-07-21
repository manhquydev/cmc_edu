---
phase: 8
title: "P2 Contact unique phone"
status: done
implementationNote: "normalizeContactPhone outputs 84xxxxxxxxx (NOT the guidance's +84) to align with ParentAccount storage + phase-5 walk-in + digit search. findOrCreateContact uses upsert on the unique index (ON CONFLICT, race-safe, no aborted-tx refetch) not P2002-catch. Migration ran on empty cmc_edu. KNOWN LIMITATION (accepted per plan household-identity trade-off): contacts whose phone cleans to '' collapse into one keeper — a non-empty prod target needs the pre-migration audit + dump. Added apps/admin format-contact-phone.ts display formatter (84->0) at 5 sites."
priority: P2
dependencies: [3]
effort: "3-4h"
---

# Phase 8: P2 Contact unique phone

## Overview
Finding F8 (MEDIUM). Contact dedup is app-level find-or-create only — two concurrent creates for the same phone produce duplicate Contacts. Add `@@unique([facilityId, phone])` after a dedup data migration, and normalize phone at the write boundary.

> Reordered after red-team: this phase now lands **BEFORE phase 5** (walk-in adds a second Contact writer — the unique index + normalizer must exist first, else phase 5 creates dupes its own P2002-catch can't prevent). This phase also **creates `normalizeContactPhone`** — it does NOT exist yet: `normalize-login-phone.ts:3` only mentions it in a comment, and CRM stores/queries RAW `input.phone` today (crm/router.ts:92,94). Additionally extract the shared **`findOrCreateContact`** helper (from crm/router.ts:88-95) here so phase 5 imports it instead of re-implementing.

## Evidence (verified in-session)
- No unique on Contact (schema.prisma:258-269, only `@@index([facilityId])`).
- App-level find-or-create race window: `crm/router.ts:91-95`.
- Phase 5 adds a second Contact writer (walk-in auto-create) — same race, higher stakes.
- Established repo pattern for this fix: P2002-catch-refetch (provision-from-receipt.ts find-or-create steps).

## Requirements
- Create `normalizeContactPhone` (new util in `apps/api/src/crm/` — the CRM domain, per the guidance comment at normalize-login-phone.ts:3-4; SAME digit-cleaning rules as `normalizeLoginPhone`, different output form; unit-test VN formats `0xx`/`+84`/spaces/dashes).
- Data migration (single migration, ordered; DO $$ plpgsql block so it can conditionally abort):
  1. Normalize existing `Contact.phone` in-place using SQL equivalent of the normalizer.
  2. Count dupes per (facilityId, normalized phone); `RAISE EXCEPTION` if dupes exceed 5% of rows (unexpected-volume guard — red-team: Prisma migration can't "abort" imperatively, but a DO block CAN).
  3. Dedup: keep oldest (min createdAt), repoint `Opportunity.contactId`, merge name/email (keeper wins, fill nulls), delete dupes (migration role bypasses cmc_app grants).
  4. `CREATE UNIQUE INDEX` on ("facilityId","phone") — plain, not CONCURRENTLY (table is tiny, 1 facility; CONCURRENTLY can't run in Prisma's migration transaction).
- App changes:
  - Extract `findOrCreateContact(tx, {facilityId, name, phone, email})` from crm/router.ts:88-95 into `apps/api/src/crm/find-or-create-contact.ts`: normalizes phone, find-first, create with P2002-catch-refetch. `opportunityCreate` uses it; phase 5 will import it.
  - `opportunityLookup` + phase-3 search: normalize input phone via the same util (single normalizer — DRY; lives in `apps/api/src/crm/`, see above).
- Residual limit (documented, red-team): the unique index enforces string equality on the (now-normalized) stored values — normalization itself is app-side; any future writer bypassing `findOrCreateContact` can insert a variant. Mitigation: the helper is the only sanctioned writer; test covers both current writers.
- Optional (decide at implementation with a count): one-off cleanup of historical "O5 + lostReason non-null" rows from phase 2's risk note — same migration, separate statement, logged counts.

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` + migration SQL
- Modify: `apps/api/src/crm/router.ts`; shared normalizer import (from provisioning util or extract to `packages/domain-*`/local util)
- Tests: `apps/api/src/crm/list.test.ts`, new dedup-migration assertion test (seed dupes pre-migration in test DB harness if supported; else unit-test the normalizer + P2002 path)

## Implementation Steps
1. Create `normalizeContactPhone` + unit tests. Per the guidance comment at normalize-login-phone.ts:3: it lives with the CRM domain (`apps/api/src/crm/`), and its OUTPUT FORM is the CRM/+84 display form described there — NOT login's `84xxx` form; only the digit-cleaning rules are shared. Keep the two functions separate.
2. Write migration (normalize → dedup → unique). Test against local-sim staging copy first (`cmc_staging`), record dupe counts.
3. App-side P2002-catch-refetch + normalization at all Contact write/read-by-phone sites.
4. Concurrency test: two parallel opportunityCreate same phone → one Contact, two Opportunities.
5. Full api suite; `gitnexus_detect_changes`.

## Success Criteria
- [ ] Unique index exists; concurrent-create test yields exactly one Contact.
- [ ] Zero data loss: post-migration Opportunity count unchanged; all contactId FKs valid.
- [ ] Lookup/search matches regardless of input formatting.

## Risk Assessment
- **Risk**: normalization collides two REAL distinct contacts sharing a phone → by product definition phone identifies the household (same rule provisioning already uses for ParentAccount) — consistent, acceptable.
- **Risk**: migration on live data — run on staging first, wrap in transaction, abort on unexpected dupe volume (>5% rows).
- **Rollback**: drop unique index; dedup is destructive → keep pre-migration dump per runbook before applying.
