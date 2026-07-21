# Red-team review — Security Adversary perspective

Plan: `260720-2229-crm-remediation-full-scope`. Reviewer posture: hostile attacker mindset + Fact Checker. Every finding grep/read-verified against source. No praise.

---

## Finding 1: Approve-gate TOCTOU is not actually closed — no row lock on the opportunity
- **Severity:** High
- **Location:** Phase 2, "Requirements" (b) — "`runMoneyTransaction` (approve) re-checks the same predicate inside the transaction (TOCTOU: opp can be marked lost between draft and approve) and rejects"
- **Flaw:** The plan claims re-checking the lost predicate "inside the transaction" defeats the TOCTOU, but `runMoneyTransaction` reads the opportunity with a plain `findFirst` and **no `FOR UPDATE`** (`apps/api/src/finance/router.ts:320`). Under READ COMMITTED, a `SELECT`-then-`UPDATE` on the same row is not atomic against a concurrent writer. `crm.opportunityMarkLost` (`crm/router.ts:171-174`) updates the very same row with no coordinating lock. Compare the cancel path, which explicitly `SELECT ... FOR UPDATE`s the opportunity precisely to avoid this class of race (`finance/router.ts:434-438`). The approve-gate inherits none of that.
- **Failure scenario:** Draft receipt on an open opp. Approver A begins `runMoneyTransaction`, the new gate reads stage=O4/closedAt=null → passes. Concurrently sale B calls `opportunityMarkLost` and commits (sets `closedAt`, `lostReason`). A then executes the O5 update (`:330-336`), overwriting to `O5_ENROLLED`, clearing `lostReason` to null — producing exactly the "enrolled receipt on a lost lead" corruption Phase 2 exists to prevent, plus a silently discarded loss reason. The gate gives false assurance.
- **Evidence:** `apps/api/src/finance/router.ts:320` (unlocked read), `:330-336` (update), `:434-438` (cancel path's `FOR UPDATE` proving the codebase's own lock convention), `apps/api/src/crm/router.ts:171-174` (concurrent lost writer).
- **Suggested fix:** Mandate `SELECT ... FOR UPDATE` on the opportunity row in the approve-gate (reuse the cancel path's `$queryRaw ... FOR UPDATE` pattern) before the lost-check and the O5 write. State this explicitly in the phase; a bare re-read is insufficient.

## Finding 2: `crm.opportunityAssign` design is self-contradictory — either sale cannot self-assign, or sale can steal any lead
- **Severity:** High
- **Location:** Phase 10, "API" — "New: `crm.opportunityAssign` ... add `crm.opportunityAssign: ['giam_doc_kinh_doanh']` + allow sale self-assign only"
- **Flaw:** The permission registry `can()` is purely role-based — it maps `module.action` → allowed roles and has no row-level / ownership concept (`packages/auth/src/index.ts:137-149`, `PERMISSIONS` `:54-131`). "Allow sale self-assign only" cannot be expressed in the registry. Two mutually exclusive outcomes follow from the plan as written: (a) if the key lists only `giam_doc_kinh_doanh`, `requirePermission('crm','opportunityAssign')` rejects `sale` outright → sale self-assign is unreachable; (b) if `sale` is added to the key to make self-assign reachable, then absent an explicit in-procedure `assignedToId == ctx.subject.userId` ownership check, sale can reassign **any** opportunity in the facility — i.e. steal another rep's leads / KPI attribution. The plan specifies neither the row-level check nor which outcome it wants.
- **Failure scenario:** Outcome (b) shipped without the ownership guard: sale rep B calls `opportunityAssign({opportunityId: <rep A's lead>, assignedToId: B})`, permission passes (role = sale), B now owns A's lead and its future approved-receipt revenue attribution. Privilege escalation via KPI theft.
- **Evidence:** `packages/auth/src/index.ts:137-149` (`can()` role-only, no ownership), `:54-131` (registry rows are `action → roles`, no per-row scoping); the plan text itself contradicts (`phase-10 ... 'opportunityAssign': ['giam_doc_kinh_doanh'] + allow sale self-assign only`).
- **Suggested fix:** Decide explicitly: grant the key to `['giam_doc_kinh_doanh','sale']` AND specify a procedure-level branch — sale may set `assignedToId` only to their own userId (and only on unowned or own leads); GĐKD may assign anyone. Make the "self-only" rule a coded assertion, not a registry expectation. Add the matrix test as a *gate*, not an afterthought.

## Finding 3: Phase 5 evidence fabricates a `ParentAccount.name` field that does not exist
- **Severity:** High (Fact Checker)
- **Location:** Phase 5, "Evidence" line 3 and "Requirements" #3 — "ParentAccount ... has a name field usable for Contact.name" / "name := ParentAccount name when provisioning already resolved it"
- **Flaw:** `ParentAccount` has no `name` column. Its fields are `id, phone, email?, passwordHash?, createdAt, updatedAt` + relations (`packages/db/prisma/schema.prisma:424-437`). Provisioning creates it with `{ phone }` only (`apps/api/src/provisioning/provision-from-receipt.ts:106`), and the optional email upsert is the only other write. `Contact.name` is `String` NOT NULL (`schema.prisma:261`). The plan's primary naming branch is therefore impossible; the implementer is directed to read a field that isn't there.
- **Failure scenario:** Implementer either (a) wastes a cycle discovering the field is absent, or (b) worse, adds a `name` column to the global, non-RLS `ParentAccount` on the strength of the plan's claim (scope creep on a shared identity table), or (c) the "ParentAccount name" branch silently yields `undefined` → `Contact.name` insert violates NOT NULL → walk-in approve throws inside `runMoneyTransaction`, blocking the money path. All three are bad; the walk-in Contact name will in practice always be the `"PH " + studentName` placeholder, so the whole first branch is dead.
- **Evidence:** `packages/db/prisma/schema.prisma:424-437` (no name field), `apps/api/src/provisioning/provision-from-receipt.ts:106` (`create({ data: { phone } })`), `schema.prisma:261` (`Contact.name String` NOT NULL).
- **Suggested fix:** Drop the false branch. State that walk-in Contact.name uses the `"PH " + studentName` placeholder unconditionally (or capture a real parent name at receiptCreate first). Do not add a name column to ParentAccount as a side effect.

## Finding 4: Phase 1 compensating cleanup is sited outside any RLS/facility transaction — the Student withdraw will not run
- **Severity:** Medium (borderline High)
- **Location:** Phase 1, "Architecture" layer 2 — "in the abort handler that writes `provisioning.aborted_receipt_not_approved` (finance/router.ts:895-914 call side), first run the same Student-withdraw logic as the cancel rollback"
- **Flaw:** That abort handler runs on the bare root client `ctx.db` **outside** any `withFacility(...)` scope (`finance/router.ts:895`, `:906`), because `provisionFromReceipt` is deliberately called outside the money transaction (`:876`) and manages its own per-step scoping. `AuditLog` writes succeed there only because it has no RLS. But `Student` is RLS-protected (facility-scoped) — a `student.update(... lifecycle: 'withdrawn')` issued on bare `ctx.db` with no `app.current_facility_id` set will either see zero rows (RLS filter) or be rejected, so the "withdraw the orphan" step silently no-ops. Separately, layer 1 says re-read receipt status "inside that step's transaction ... on `createParentAccount`," but `findOrCreateParentAccount` uses plain non-transactional client calls (`provision-from-receipt.ts:94-128`) and carries no facility context, so a `FOR SHARE` on the RLS Receipt row is not implementable there as described (and ParentAccount is not the orphan risk anyway).
- **Failure scenario:** The exact orphan Phase 1 targets — cancelled receipt + committed active Student — reaches the abort handler; the compensating withdraw runs on unscoped `ctx.db`, matches no row under RLS, and the active guardian-visible Student persists. The plan believes it cleaned up; it did not.
- **Evidence:** `apps/api/src/finance/router.ts:876` (provisioning outside withFacility), `:895` and `:906` (`ctx.db.auditLog.create` — bare client), `apps/api/src/provisioning/provision-from-receipt.ts:94-128` (ParentAccount step: no transaction, no facility scope).
- **Suggested fix:** Wrap the layer-2 cleanup in its own `withFacility(ctx.db, facilityId, tx => ...)` and reuse the cancel rollback's Student-resolution + row-lock logic (`finance/router.ts:461-486`). Drop the ParentAccount status-check from layer 1 (unimplementable + unnecessary); rely on the `findOrCreateStudent` in-transaction `FOR SHARE` as the real window-closer.

## Finding 5: Phase 7's "relaxed CHECK" lets new entrance rows skip the opportunity link entirely
- **Severity:** Medium
- **Location:** Phase 7, "Schema" — "relax CHECK to also accept `type='entrance' AND \"studentId\" IS NOT NULL` for legacy rows ... prefer the relaxed CHECK, simpler"
- **Flaw:** A CHECK constraint cannot distinguish "legacy row" from "new row." Relaxing it to accept `entrance AND studentId IS NOT NULL` means the DB permanently allows a **new** entrance appointment with `studentId` set and `opportunityId` NULL. The entrance↔Opportunity linkage the whole phase is built on is then enforced only by the router's zod refinement — the DB integrity guarantee the phase claims is illusory.
- **Failure scenario:** Any future writer, a raw insert, a bug in the refinement, or a second code path creates an entrance appointment carrying `studentId` and no `opportunityId`. It passes the CHECK, the stage-sync (O2→O3→O4) never fires (no opp attached), and the funnel silently under-reports tested leads — the F5 problem re-emerges through the relaxation. Defense-in-depth advertised, not delivered.
- **Evidence:** `packages/db/prisma/schema.prisma:1531-1542` (current `TestAppointment`, `studentId String` non-null, no relation); Phase 7 requirement text proposing the relaxed CHECK.
- **Suggested fix:** Backfill/segregate legacy rows instead of relaxing the invariant — e.g. keep the strict CHECK `(entrance ⇒ opportunityId NOT NULL) AND (periodic ⇒ studentId NOT NULL)` and handle historical entrance rows by backfilling an opportunity or moving them to `type='periodic'`/an archival flag. If a relaxed CHECK is truly required, gate it behind a `createdAt < <migration timestamp>` predicate so it cannot apply to new rows.

## Finding 6: Phase 8 `@@unique([facilityId, phone])` enforces string equality, not normalization — false dedup confidence
- **Severity:** Medium
- **Location:** Phase 8, "Requirements" — "`CREATE UNIQUE INDEX ... ON \"Contact\"(\"facilityId\", \"phone\")`" + "normalize phone at the write boundary"
- **Flaw:** The DB constraint enforces uniqueness on the *stored* string. Normalization lives only in app code at "all Contact write sites." The DB cannot guarantee the invariant it appears to guarantee: any writer that inserts a non-normalized value (`"090 123 4567"` vs `"0901234567"`, `+84` vs `0` prefix) creates a duplicate the unique index will not catch. The plan adds a *second* Contact writer in Phase 5 (walk-in auto-create) and depends on the search path (Phase 3) also normalizing — every one of these must be perfect forever, and the constraint provides no backstop if one is missed.
- **Failure scenario:** Phase 5's walk-in auto-create, or a later import/feature, writes a raw-format phone. The unique index sees a distinct string, allows it, and the household now has two Contacts again — the exact F8 defect, now masked by a constraint everyone trusts. Also: if the normalization rule is ever changed, previously-unique rows can collide or split.
- **Evidence:** `packages/db/prisma/schema.prisma:258-269` (Contact today: only `@@index([facilityId])`, `phone String` free-form); Phase 5 introduces a second writer (`phase-05 ... create Contact`); the codebase already stores phones as-entered (Contact has no normalization column).
- **Suggested fix:** Either store a dedicated `phoneNormalized` column and put the unique index on `(facilityId, phoneNormalized)` computed at the DB/trigger level (or a generated column), so normalization is not bypassable by any writer; or explicitly document that the constraint is a best-effort backstop and centralize all Contact writes through one repository function. A raw unique index on the free-form column is fragile.

## Finding 7: Phase 10 claims `remindedAt` has "zero readers" — it is returned by three live procedures
- **Severity:** Low (Fact Checker; contract-shape risk)
- **Location:** Phase 10, "Evidence" — "`remindedAt` dead: only schema.prisma:1523 + its migration — zero readers/writers (shell grep whole repo)"
- **Flaw:** The `parentMeeting` router returns full `ParentMeeting` rows from `schedule` (`{ ...created }`), `complete`, and `cancel` (`apps/api/src/meeting/router.ts:61, :82-83, :100-102` returning un-projected `.update(...)`), so `remindedAt` is serialized into all three tRPC response types — visible in the compiled surface at `apps/api/dist/meeting/router.d.ts:32,50,67`. It is a reader (part of the API contract), not dead. The plan's "zero readers" is the basis for calling the drop trivially reversible, and it's wrong.
- **Failure scenario:** Phase 9 wires the admin meeting UI onto these exact procedures; Phase 10 then drops the column, changing the response shape those screens consume. Low blast radius because the field is always null, but the plan's risk assessment is built on a false premise, so the sequencing risk (9 wires it, 10 removes it) went unassessed.
- **Evidence:** `apps/api/src/meeting/router.ts:60-63` (`return { ...created }`), `:80-83`, `:100-102` (return raw `update` rows); `apps/api/dist/meeting/router.d.ts:32,50,67` (`remindedAt: Date | null` in return types); `packages/db/prisma/schema.prisma:1523`.
- **Suggested fix:** Correct the evidence to "returned (never populated) by parentMeeting.schedule/complete/cancel." Either project it out of those returns in Phase 9 first, or accept the response-shape change and note it. Keep the drop, but on accurate grounds.

---

## Verified-accurate claims (fact-check pass, no action needed)
- Contact has no unique on `(facilityId, phone)` — confirmed `schema.prisma:258-269`.
- `runRefundTransaction` writes zero AuditLog — confirmed `finance/router.ts:548-626`; Phase 4's headline gap is real.
- receiptCreate only soft-warns on stage≠O4, never checks `closedAt`/`lostReason` — confirmed `finance/router.ts:706-718`.
- approve force-advances + overwrites `closedAt` for non-O5 opps — confirmed `finance/router.ts:330-336`.
- `crm.opportunityCreate`/`markLost`/`reopen`/`lookup`/`list` exist; `opportunityList` input has no text search — confirmed `crm/router.ts:81-190, :75-79`.
- post-sale routers have no `list` query — confirmed (grep: none in after-sale/meeting/appointment).
- permission rosters for `crm.*` and `*.manage` — confirmed `packages/auth/src/index.ts:55-59, :126-128`.
- "entrance never mutates CRM" invariant comment — confirmed `appointment/router.ts:3-4` and `schema.prisma:1530`.
- Receipt.opportunityId optional, no parent-name field on Receipt — confirmed `schema.prisma:316, :329-333`.

## Unresolved questions
1. Phase 5: with the `ParentAccount.name` branch removed, is the `"PH <studentName>"` placeholder acceptable to the PO for funnel Contact names, or must a real parent name be captured at receiptCreate (schema addition to Receipt)?
2. Phase 2 + Phase 5 both write O5 inside `runMoneyTransaction` without locking the opportunity — should a single shared `lockOpportunityForApprove()` helper (FOR UPDATE) be mandated for every O5 write path?
3. Phase 10: which resolution for `opportunityAssign` — sale excluded entirely, or sale-with-coded-self-check? This is a product/authorization decision, not derivable from the repo.

Status: DONE_WITH_CONCERNS
Summary: 7 findings (2 High auth/concurrency, 1 High fabricated-evidence, 3 Medium DB-integrity/RLS, 1 Low fact-check). The plan's two money-path safety gates (Phase 2 TOCTOU, Phase 1 compensating cleanup) are specified in a way that does not actually close the race/RLS gap they target, and Phase 10's `opportunityAssign` has an unresolved privilege-escalation surface.
