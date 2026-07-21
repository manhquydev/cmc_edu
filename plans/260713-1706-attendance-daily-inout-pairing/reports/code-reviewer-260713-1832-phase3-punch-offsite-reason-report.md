# Phase 3 Review — Backend punch offsite+reason (ADR 0043)

Scope: `apps/api/src/checkin/router.ts` (`checkInOutRouter.punch`, `ensureDayTicket`),
`apps/api/src/checkin/punch-offsite.test.ts` (new, 12 cases), `apps/api/src/checkin/ip-match.test.ts`
(2 tests rewritten/deleted). Phases 1–2 trusted, not re-reviewed.

## Verdict per focus point

### (a) F1 race guard — airtight
`ensureDayTicket`'s conditional `updateMany({where:{id, status:{in:['pending','resubmitted']}}})`
is safe **without** a preceding `SELECT ... FOR UPDATE` on the ticket row, given `withFacility`
runs at default Postgres `READ COMMITTED` (`packages/db/src/index.ts:66-80`, no `isolationLevel`
set). Reasoning:
- Prisma compiles `update`/`updateMany` to a single `UPDATE ... WHERE ...` statement, not a
  JS-side read-then-write. Postgres takes a row lock on any row an `UPDATE` touches, for the life
  of the transaction.
- If `manualPunch.approve`'s `update({where:{id}, data:{status:'approved',...}})` commits first,
  the punch tx's later `updateMany` re-evaluates its `WHERE status IN (...)` against the
  post-commit row (now `'approved'`) and correctly matches 0 rows.
- If the punch tx's `updateMany` runs first, it holds the row lock until its transaction commits;
  `approve`'s `update` blocks on that lock, then (via Postgres `EvalPlanQual`) re-reads the
  now-committed row and proceeds — no double-apply, no lost update.
- There is no window where both transactions read `status='pending'` and both "win" — Postgres's
  first-writer-wins-then-blocker-rereads semantics on `UPDATE` make this correct even though
  `approve`'s initial `findFirst` (line 267) is an unlocked plain `SELECT`. That `SELECT` only
  gates the `badRequest('Ticket is not pending.')` business check, which doesn't affect
  correctness here since only `approve`/`reject` ever mutate `status`.

No fix needed here. This is a legitimate conditional-update pattern, not a bug.

### (b) Duplicated `hasShift` query — real but narrow correctness gap, DRY issue
The router's pre-write reason gate (lines 184–206) and `ensureDayTicket` (lines 82–90) each run
their own `shiftRegistrationEntry.findFirst`. Under `READ COMMITTED`, two `SELECT`s in the same
open transaction are **not** guaranteed to see the same snapshot — a different transaction (e.g.
a director approving/submitting a shift registration for this exact appUser+day) can commit
between the two reads.

Concrete failure mode: pre-check sees no shift → skips the reason requirement → punch is written
without a reason → `ensureDayTicket`'s later, independent `hasShift` read now sees the
just-committed shift → proceeds to create a ticket with `note: reason ?? ''` (empty). Net effect:
a ticket silently gets created with an empty note instead of the intended
`OFFSITE_REASON_REQUIRED` rejection — not a security issue and not data loss, but it violates the
stated invariant ("first offsite punch of a shift day requires reason") in a way tests can't catch
(the window is sub-transaction-duration, effectively unhittable in a single-process test).

Recommend (not blocking, but worth doing before this pattern is copied elsewhere): compute
`hasShift` once and thread it into `ensureDayTicket` as a parameter, or fold the reason-gate logic
into `ensureDayTicket` itself and have it return a `reasonRequired: true` signal the router throws
on. Either removes the duplicate query and the associated snapshot-divergence window.

The `existingTicket` lookup is similarly duplicated (pre-check line 195, `ensureDayTicket` line
102) — see next finding for the concrete consequence of that duplication.

### (c) `checkInAt` uses the day's absolute first punch — confirmed correct
`ensureDayTicket`'s `dayPunches` query (`router.ts:92-95`) has no `withinNetwork` filter — it
pulls **every** `TimePunch` for the appUser in `[dayStart, dayEnd)`, onsite and offsite alike,
ordered by `punchAt asc`. Traced the full `punch1 onsite → punch2 offsite+reason → punch3 onsite`
sequence:
- punch1: `anyOffsite=false` → early return, no ticket.
- punch2: `dayPunches=[punch1,punch2]`, `checkInAt=dayPunches[0]=punch1`, `checkOutAt=punch2` →
  ticket created with `checkInAt=punch1` (onsite time), matching plan's Edge/Validation-Log case 5.
- punch3: `dayPunches=[punch1,punch2,punch3]`, `checkInAt` still `punch1`, `checkOutAt=punch3` →
  `updateMany` on the pending ticket. `checkInAt` never regresses to punch2's time.
Matches ADR 0043's "checkin = day's absolute first punch" rule exactly. No bug.

### (d) Cooldown checked before reason gate — correct priority, confirmed
Cooldown (`router.ts:155-167`) runs strictly before the offsite/reason branch (`180-206`) and
before the network computation used by that branch. A cooldown-blocked offsite-without-reason call
always surfaces `COOLDOWN`, never `OFFSITE_REASON_REQUIRED`. This is the right priority per the
task's own reasoning (retrying immediately with a reason would just re-hit cooldown) — no fix
needed.

### (e) Test authenticity — tests 4 and 9 verified as real second-call exercises
- **Test 4** (`punch-offsite.test.ts:134-164`): seeds punch1 at `now-20_000ms` — outside the 10s
  cooldown window (`recentCutoff = now-10_000ms`), so the subsequent real `caller(...).punch({})`
  is not blocked by cooldown and genuinely reaches `ensureDayTicket`'s "existing ticket" branch.
  Seeded ticket has no explicit `status`, defaulting to `'pending'` (`schema.prisma:1149`),
  satisfying the `updateMany` guard. Assertions correctly check `checkInAt` unchanged (still
  punch1) and `checkOutAt` equal to the real call's returned `punchAt`. Legitimate.
- **Test 9** (R1, lines 209-248): seeds ticket with `status:'approved'`; the real follow-up call
  uses IP `10.0.0.1` against seeded network `192.168.1.0/24` → genuinely offsite. Because a ticket
  already exists (regardless of status), the pre-write reason gate's `if (!existingTicket)` is
  false, so no reason is required — correctly exercising the "ticket exists, any status, no reason
  needed" path. `ensureDayTicket`'s `updateMany` then matches 0 rows since `'approved'` isn't in
  `('pending','resubmitted')`. Assertions confirm `checkInAt`/`checkOutAt`/`status` unchanged and
  `TimePunch` count = 2 (both punches recorded). Legitimate, correctly proves R1 freeze via a real
  router call, not a coincidental pass.

### (f) `ip-match.test.ts` boundary coverage — claim of "fully superseded" is NOT accurate
The old 5-minute-boundary pair (`4:59.9` blocked / `5:00.1` allowed) tested **both sides** of the
cooldown threshold with precise seeded timestamps. The replacement set only covers one side with
that precision:
- Test 11 (`10.1s ago → succeeds`) is a faithful analog of the old "just over → allowed" case.
- Test 10 (`ip-match.test.ts:111-116`, "cooldown 10s: punch lại trong 10s → COOLDOWN") does two
  back-to-back real calls (~0ms apart) — it proves cooldown blocks *immediate* retries, but it does
  **not** test the precise near-boundary "still blocked" case (e.g. seeded ~9.9s ago) the way the
  deleted test did.

Net: real coverage was lost. An off-by-one in the cutoff comparison (e.g. `>` vs `>=` at exactly
10s, or a boundary shifted by one unit) would not be caught by either the new or retained tests.
Recommend adding one seeded `~9.9s ago → still COOLDOWN` case to `punch-offsite.test.ts` to restore
symmetric boundary coverage before considering this phase's test matrix complete.

### (g) Facility scoping in `ensureDayTicket` queries — consistent with existing convention, no new gap
- `shiftRegistrationEntry.findFirst` — explicit `facilityId` filter, both in the pre-check and in
  `ensureDayTicket`. Good.
- `timePunch.findMany` (day punches) and `manualAttendanceTicket.findUnique` (existing ticket) —
  no explicit `facilityId` filter, but both are scoped through `appUserId`, and `appUser` itself
  was resolved earlier with an explicit `{userId, facilityId}` filter (`router.ts:143-145`), so
  `appUser.id` is already facility-bound by construction. This matches the pre-existing pattern in
  the same file (the cooldown lookup, `router.ts:157-160`, has the same shape) — not a new
  deviation. RLS (`app.current_facility_id` GUC) backstops both either way. No action needed.
- `manualAttendanceTicket.create` explicitly sets `facilityId` in the write payload. Good.

## Additional finding (not in the original focus list)

**New cross-endpoint race: `ensureDayTicket`'s `create` vs `manualPunch.create` can both target the
same `(appUserId, ticketDate)` unique key, unhandled.** Before phase 3, `ManualAttendanceTicket`
rows were only ever created by `manualPunch.create` (single writer per date, guarded by its own
`existing.status === 'pending'` check). Phase 3 adds a second, independent creator
(`ensureDayTicket`, triggered by `checkInOut.punch`) that does not coordinate with
`manualPunch.create` beyond the unique constraint. If a punch's `ensureDayTicket` and a concurrent
`manualPunch.create` call race for the same appUser+day, one of the two `create()` calls will hit
a Prisma `P2002` unique-constraint violation that neither call site catches — it will surface as an
unhandled `INTERNAL_SERVER_ERROR` instead of a friendly `CONFLICT`/`BAD_REQUEST`. Low likelihood
(requires the employee to punch offsite and separately submit a manual ticket for the same day
within the same few-ms window) but worth a follow-up: catch `P2002` around both `create()` calls
and map it to `conflict(...)`, or re-check `existing` after a caught unique violation.

## Test suite / build verification
Not independently re-run (relying on the reported `pnpm --filter @cmc/api test -- src/checkin/` →
43 passed/1 skipped/0 failed and `typecheck` → 2 pre-existing unrelated errors, both stated as
verified by the requester). Spot-read of the 12 new tests confirms they exercise real router
codepaths (see (e)); no phantom/no-op tests found in the sample checked.

## Priority summary

| # | Finding | Priority |
|---|---|---|
| b | Duplicated `hasShift`/`existingTicket` reads under READ COMMITTED — narrow window where a ticket can be created with an empty `note` instead of throwing `OFFSITE_REASON_REQUIRED` | Medium (DRY + narrow correctness) |
| new | `ensureDayTicket` vs `manualPunch.create` unique-constraint race, unhandled `P2002` | Medium |
| f | Lost precise near-boundary "still blocked" cooldown test coverage after deleting the old 4:59.9/5:00.1 pair | Low (test-quality) |
| a,c,d,e,g | Verified correct, no action needed | — |

## Unresolved Questions
- None blocking. Confirm with the plan owner whether (b) and the new cross-endpoint race finding
  warrant a fix now or a tracked follow-up before phase 4 touches `manualPunch.approve/reject`.
