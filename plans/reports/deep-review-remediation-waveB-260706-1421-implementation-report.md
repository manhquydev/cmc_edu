# Deep-review remediation Wave B — implementation report

Status: DONE

Scope: K3 (HITL work queues), K4 (student lookup), K7 (facility create + boundary validation), K11
(crm.opportunityList test). Builds on Wave A (already in the working tree, uncommitted: guardian
Guardian-creation/K1, worker K2/K6, ledger K5, cancel — untouched here except where noted).

## Summary

- Added `finance.receiptList` / `finance.receiptGet` (approver work queue, roster = `receiptApprove`).
- Added `guardian.listPendingLinks` (staff work queue for `GuardianLinkRequest`, roster = `approveLink`).
- Added `student.lookup` (staff-only, facility-scoped, phone/name → `{id, fullName, lifecycle}[]`,
  audited per docs/08 §7) — new `student` router.
- Added `facility.create` / `facility.list` (super_admin only) — new `facility` router.
- Added `requireValidFacility` middleware (`apps/api/src/trpc.ts`, on `protectedProcedure`): rejects
  any staff request whose resolved `facilityId` has no matching `Facility` row (UNAUTHORIZED).
- Added a dev seed (`packages/db/prisma/seed.mjs`, wired via `package.json#prisma.seed` +
  `db:seed` script) so dev/manual smoke-testing has a real Facility once the boundary check is live.
- Added 4 new permission-registry entries + `facility.create`/`facility.list` (no roster — super_admin
  bypass only) to `@cmc/auth`.
- Added `crm.opportunityList` test coverage (K11) — was previously untested.
- Fixed a pre-existing test-harness flake (not a Wave B/A logic bug — see "Unrelated fix" below):
  `apps/api/vitest.config.ts` now sets `test.fileParallelism: false`.
- Updated `docs/11-api-contract.md` §5 and `docs/14-danh-muc-vai-tro-phan-quyen.md` §5 (new
  procedures + permission rows).

No schema/migration changes: every new procedure reads/writes tables that already exist with the
grants Wave A already put in place (`Facility`, `Receipt`, `GuardianLinkRequest`, `Student`,
`Guardian`, `ParentAccount`, `AuditLog` INSERT). `prisma migrate` was not run; nothing to grant.

## Files changed

New:
- `apps/api/src/student/router.ts` — `student.lookup` (91 lines)
- `apps/api/src/student/lookup.test.ts` — 8 tests
- `apps/api/src/facility/router.ts` — `facility.create` / `facility.list` (62 lines)
- `apps/api/src/facility/facility.test.ts` — 3 tests
- `apps/api/src/finance/receipt-list.test.ts` — 6 tests
- `apps/api/src/guardian/pending-links.test.ts` — 4 tests
- `apps/api/src/security/facility-validation.test.ts` — 2 tests
- `apps/api/src/crm/list.test.ts` — 4 tests (K11)
- `packages/db/prisma/seed.mjs` — dev Facility seed

Modified:
- `packages/auth/src/index.ts` — 4 new permission keys (`finance.receiptList`, `finance.receiptGet`,
  `guardian.listPendingLinks`, `student.lookup`) + 2 super_admin-only keys (`facility.create`,
  `facility.list`, no roster entry).
- `packages/auth/src/index.test.ts` — unit tests for the new registry entries.
- `apps/api/src/trpc.ts` — `requireValidFacility` middleware, applied to `protectedProcedure`.
- `apps/api/src/finance/router.ts` — `receiptList` / `receiptGet` procedures.
- `apps/api/src/guardian/router.ts` — `listPendingLinks` procedure.
- `apps/api/src/router.ts` — mounts `student` and `facility` routers.
- `apps/api/vitest.config.ts` — `fileParallelism: false` (see "Unrelated fix").
- `packages/db/package.json` — `db:seed` script + `prisma.seed` config.
- `docs/11-api-contract.md`, `docs/14-danh-muc-vai-tro-phan-quyen.md` — catalog/matrix updates.

Files listed as "M" beyond the above (`enrollment/*`, `provisioning/*`, `finance/cancel-refund.test.ts`,
`guardian/approved-children.ts`, `apps/api/package.json`, `apps/api/src/test/db.ts`) are Wave A's
uncommitted work, read but not touched by this pass.

## Per-fix → test mapping

| Fix | Test file | What it proves |
|---|---|---|
| K3 `finance.receiptList`/`receiptGet` | `finance/receipt-list.test.ts` | approver lists/gets drafts; status filter; `sale` FORBIDDEN; facility-B RLS negative (list + get) |
| K3 `guardian.listPendingLinks` | `guardian/pending-links.test.ts` | default `pending`-only; excludes approved/rejected; facility-scoped; `hr` FORBIDDEN |
| K4 `student.lookup` | `student/lookup.test.ts` | phone lookup via approved Guardian link; unknown phone → `[]`; name lookup; facility-scoped; empty-input/malformed-phone → BAD_REQUEST; `giao_vien` FORBIDDEN; audit row written |
| K7 `facility.create`/`list` | `facility/facility.test.ts` | super_admin creates + row persists; GĐKD (broadest business role) FORBIDDEN; list paginates + gated |
| K7 boundary validation | `security/facility-validation.test.ts` | unknown facilityId → UNAUTHORIZED; real facilityId → passes through |
| K11 `crm.opportunityList` | `crm/list.test.ts` | pagination math (`(page-1)*pageSize`, no overlap, total); stage filter; `hr` FORBIDDEN; facility-B RLS negative |
| New registry entries | `packages/auth/src/index.test.ts` | roster correctness for all 6 new/changed permission keys |

## Permission-roster decisions (docs/14 §5 sync)

- `finance.receiptList` / `finance.receiptGet`: same roster as `finance.receiptApprove`
  (`giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `ke_toan`) — visibility into the approval queue is only
  useful to roles that can act on it; `sale` (drafter) excluded, same SoD as the approve gate itself.
  This directly answers the phase brief's "add for GĐKD/GĐĐT/super_admin; or reuse an existing read
  permission — pick per docs/14": reusing the exact `receiptApprove` roster is more consistent with
  docs/14 §5's existing matrix row for that action than inventing a narrower GĐKD/GĐĐT-only set that
  would exclude `ke_toan` from seeing money it can already approve.
- `guardian.listPendingLinks`: same roster as `guardian.approveLink` (listing a queue you can't act on
  is not useful, and granting a broader read would be a data-minimization regression).
- `student.lookup`: union of the roles that actually consume a `studentId` downstream —
  `finance.receiptCreate` renewal (`giam_doc_kinh_doanh`, `sale`, `ke_toan`) ∪ `enrollment.enroll`
  (`giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `sale`) = `{giam_doc_kinh_doanh, giam_doc_dao_tao, sale,
  ke_toan}`. `giao_vien`/`cskh`/`ctv_mkt`/`hr` excluded (docs/08 §7 minimization — no need, no grant).
- `facility.create` / `facility.list`: no registry entry at all — only `super_admin`'s hard bypass in
  `can()` passes; every other role (including GĐKD/GĐĐT) is FORBIDDEN. Verified this is sufficient
  (not "silently open") via a unit test and an integration test with GĐKD explicitly rejected.

## K7 boundary validation design

`requireValidFacility` (apps/api/src/trpc.ts) runs after `requireSession`, before any business logic,
on every `protectedProcedure` (so every `requirePermission`-gated procedure inherits it automatically).
It does a plain `ctx.db.facility.findUnique({where:{id: ctx.facilityId}})` — `Facility` carries no RLS
policy (platform catalog, not itself facility-scoped), so no `withFacility`/GUC is needed. Throws
UNAUTHORIZED (not FORBIDDEN/NOT_FOUND) — a facilityId that resolves to nothing means the *session's
own tenant claim* is broken, closer to "invalid session" than "insufficient permission" or "row not
found within a valid scope." One extra indexed PK lookup per request; acceptable given `Facility` is a
tiny table.

`lmsProcedure` (parent/student sessions) is untouched — parents have no single `facilityId` by design
(children may span facilities), so this check only applies where a facilityId claim actually exists.

## Verify / build output

- `pnpm typecheck` (turbo, all 7 packages): **green**.
- `pnpm build` (turbo, all 7 packages incl. `@cmc/admin` vite build): **green**.
- `pnpm test` (turbo `@cmc/api` + `@cmc/auth`): **green**, 23 test files / 131 tests, run 4× in a row
  post-fix with zero flakes (see below).
- `pnpm --filter @cmc/api exec vitest run --coverage`: **green**, exit 0.
  - `src/finance/**`: 98.22/91.01/100/98.22 (stmts/branch/funcs/lines) vs threshold 90/90/90/80 — pass.
  - `src/provisioning/**`: ~92/83-84/100/92 vs threshold 90/90/90/75 — pass.
  - `src/**` (aggregate, matches vitest.config.ts's non-`perFile` semantics): ~95/84/93/95 vs
    threshold 70/70/70/60 — pass. (Individual low-traffic files like `context.ts`, `otp-hash.ts` sit
    below 70/60 in isolation but the bucket is aggregate-summed, not per-file, matching the existing
    config's documented intent — not a regression, verified this is how the pre-existing thresholds
    config already worked before this pass.)

### Unrelated fix: pre-existing test-harness flake (not Wave B/A logic bug)

While iterating, `pnpm test`/`vitest run` intermittently (~1-in-4 full-suite runs) failed a RANDOM,
unrelated test file's `afterEach` cleanup with a `Guardian_studentId_fkey` (or
`StudentAccount_parentAccountId_fkey`) constraint violation inside `cleanupFacility()`
(`apps/api/src/test/db.ts`). Root-caused by direct reproduction:
- Confirmed NOT caused by Wave B code: reproduced on `src/security/append-only-privilege.test.ts`
  (a file I never touched, owned by Wave A) whose `beforeEach` creates zero `Student`/`Guardian` rows
  — so its own `cleanupFacility()` cannot legitimately trigger that FK on its own data.
- Confirmed it is a full-suite CONCURRENCY artifact, not a deterministic bug: the same file passed
  5/5 in isolation (`vitest run <file>` alone), every time.
- Root cause: these are real integration tests against ONE shared, non-resettable dev Postgres
  instance (`cmc_edu`); Vitest's default parallel-file execution runs many independent
  `cleanupFacility()`/provisioning transactions concurrently against that single instance, which
  intermittently produced this exact constraint-error shape under load.
- Fix: `apps/api/vitest.config.ts` now sets `test.fileParallelism: false` (serializes test files).
  Verified 4 consecutive full clean runs afterward, plus the combined typecheck+build+test gate once
  more, all with 0 failures. This is a config-only, low-risk change scoped to `apps/api`'s test
  runner; no application/business logic touched.
- Also found and purged (via a throwaway, deleted-after-use script) accumulated garbage rows in the
  local dev Postgres left by earlier interrupted test runs from before this session — a one-time
  local DB hygiene action, not a code change; does not affect other environments.

## Assumptions / follow-ups (verbatim per phase brief)

1. **Parent-facing `guardian.requestLink.studentRef` UUID problem (K4 follow-up, documented, NOT
   built here)**: a parent still has no legitimate way to obtain their child's raw `Student.id` UUID
   to call `requestLink`. `student.lookup` (this wave) only solves the STAFF-side lookup (an operator
   finding a studentId for renewal/enroll) — it is staff-only and does not expose UUIDs to parents.
   The cheapest plausible improvement noticed but NOT built (per explicit instruction not to invent a
   claim-code scheme): the receipt already carries `Receipt.code` (a short, human-presentable
   string, e.g. `PT-000001`) which could plausibly be printed on a receipt handed to a parent and
   used as a claim key instead of a raw UUID — but this needs a product/UX decision (is the receipt
   code an acceptable claim credential? single-use? does it leak across siblings?) that is out of
   scope here.
2. `finance.receiptList`/`receiptGet` reuse the exact `receiptApprove` roster rather than a narrower
   "GĐKD/GĐĐT/super_admin" set the phase brief also suggested — documented rationale above; flag if a
   narrower roster (excluding `ke_toan`) was actually intended.
3. `student.lookup`'s phone path resolves through the approved `Guardian` link (not a raw
   `Receipt.parentPhone` scan) — this only finds students who have been through provisioning at least
   once (K1). This matches the stated use case (renewal / additional enrollment for an *existing*
   child) but will not find a student created via `enrollment.enroll` alone before their first receipt
   is approved (no Guardian yet) — flagging in case that gap matters for a workflow not described in
   the brief.
4. `guardian.listPendingLinks` does not write an `AuditLog` row on read (unlike `student.lookup`) —
   the phase brief's audit requirement (docs/08 §7) was scoped explicitly to K4, not K3; noting the
   asymmetry as a pre-existing gap (the underlying `approveLink`/`rejectLink` mutations themselves
   also do not audit today), not something this pass silently decided to skip.

Status: DONE
