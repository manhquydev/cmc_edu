---
phase: 2
title: "P0 Lost-opportunity receipt gate"
status: done
priority: P1
dependencies: []
effort: "2-3h"
---

# Phase 2: P0 Lost-opportunity receipt gate

## Overview
Finding F3 (HIGH). Today a receipt can be created AND approved on a **lost** opportunity; approve then force-advances it to O5_ENROLLED, overwrites `closedAt` with a fresh date and leaves `lostReason` populated → "enrolled-but-lost" corrupt rows and wrong win/loss reporting.

## Evidence (verified in-session)
- receiptCreate: only soft warning when stage ≠ O4 (`apps/api/src/finance/router.ts:714-718`); never checks `closedAt`/`lostReason`.
- Approve force-advance + closedAt overwrite: `finance/router.ts:330-336` (`...(stage !== 'O5_ENROLLED' ? { closedAt: new Date() } : {})` — fires for lost opps because their stage is O1–O4).
- Lost definition: `closedAt` set + `lostReason` set + stage unchanged (`apps/api/src/crm/router.ts:167-173`); NO lost stage exists (schema.prisma:40-46).
- Reopen path exists: `crm/router.ts:157-165` (reopen → O2_CONTACTED, clears lostReason/closedAt).

## Requirements
- Functional: (a) `finance.receiptCreate` rejects (`badRequest`, message tells staff to reopen) when linked opportunity is lost — defined as `closedAt != null && stage != 'O5_ENROLLED'`; (b) `runMoneyTransaction` (approve) re-checks the same predicate inside the transaction AND must acquire the opportunity row with **`SELECT ... FOR UPDATE`** before the gate check + O5 write — the current plain `findFirst` read (finance/router.ts:320) leaves the TOCTOU open against a concurrent `opportunityMarkLost` (crm/router.ts:171-174); the cancel path already row-locks for exactly this reason (finance/router.ts:434-438, pattern to copy); (c) legitimate advance to O5 clears `lostReason` (set `lostReason: null`) so no O5 row ever carries a lost reason.
- Functional (d) — **harden `crm.opportunityMarkLost` too** (red-team round 2: the corrupt "O5 + lostReason" row is producible from the OTHER side, even sequentially — markLost does an unlocked read then unconditionally writes lostReason+closedAt with no stage check, crm/router.ts:171-174): reject with `badRequest` when the opportunity's stage is `O5_ENROLLED` ("Đã ghi danh — dùng hủy phiếu thu (receiptCancel) thay vì đánh dấu mất"). Hard reject, not silent no-op: the sanctioned path for undoing an enrollment is `receiptCancel` (which reverts O5→O4 automatically, finance/router.ts:434-453); a silent no-op would hide the operator's mistake. Read the row `FOR UPDATE` inside the same tx so markLost cannot interleave with a concurrent approve.
- Non-functional: sibling flow preserved — second approved receipt on an already-O5 opp must still not touch `closedAt` (existing behavior finance/router.ts:326-336).

## Architecture
Single shared predicate `isOpportunityLost(opp)` in a small helper (co-locate in `apps/api/src/crm/` and import from finance) — one definition of "lost", used by create-gate, approve-gate, and later phases (5, 7). No schema change in this phase (lost stage redesign deliberately out of scope — UI separation handled in phase 6).

## Related Code Files
- Create: `apps/api/src/crm/opportunity-lost.ts` (predicate, ~10 lines)
- Modify: `apps/api/src/finance/router.ts` (create gate ~:708-718; approve gate + lostReason clear ~:318-336)
- Modify: `apps/api/src/crm/router.ts` (opportunityMarkLost O5-reject + FOR UPDATE)
- Tests: `apps/api/src/finance/create-from-opp.test.ts`, `apps/api/src/finance/approve.test.ts`, `apps/api/src/crm/stage.test.ts` (markLost-on-O5 rejected)

## Implementation Steps (TDD)
1. Baseline: `pnpm -F @cmc/api test -- create-from-opp approve` green.
2. Failing tests: (a) create on lost opp → BAD_REQUEST; (b) draft created while open, opp marked lost, approve → BAD_REQUEST, receipt stays draft, no provisioning side effects; (c) reopen then approve → succeeds, opp O5, `lostReason` null, `closedAt` set once; (d) sibling second receipt on O5 opp → approve OK, `closedAt` unchanged; (e) markLost on an O5 opp → BAD_REQUEST pointing at receiptCancel.
3. Implement predicate + both gates + lostReason clear; approve gate reads the opportunity via `$queryRaw SELECT ... FOR UPDATE` (replacing the :320 findFirst) so markLost cannot interleave.
3b. Concurrency test: approve and markLost racing on the same opportunity → exactly one wins; no O5-with-lostReason row possible.
4. `gitnexus_impact` upstream on `runMoneyTransaction` before edit (money path — expect HIGH; proceed, this is the sanctioned change). Full finance suite + `gitnexus_detect_changes`.

## Success Criteria
- [ ] All 4 new tests green; no existing finance test weakened.
- [ ] Grep proves no O5 write path leaves `lostReason` non-null AND no markLost path can write lostReason onto an O5 row (both directions closed).
- [ ] Error messages actionable (mention reopen), Vietnamese-consistent with existing error copy.

## Risk Assessment
- **Risk**: legitimate walk-in-like flow blocked? No — gate only fires when a lost opp is explicitly linked; unlinked receipts unaffected (phase 5 handles those).
- **Risk**: historical corrupt rows (O5 + lostReason) already in DB — add one-off cleanup to phase 8's data-fix migration OR document as known-historical; decide at implementation with a count query. Rollback: revert, no migration.
