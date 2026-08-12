# Independent Code Review — Plan 1/3 LMS foundation unit-range

**Reviewer posture:** production-readiness / hostile-to-defects  
**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Base:** `origin/main`  
**Plan:** `plans/260811-1117-lms-foundation-adr-va-spike-unit-range/`  
**Ship note:** `plans/reports/ship-lms-foundation-spike.md`

---

## 1. Scope reviewed + commits

### Primary commits (Plan 1)

| Commit | Summary |
|--------|---------|
| `7d55b17` | feat(lms): foundation unit-range domain, schema, and lmsOps spike |
| `76236e8` | fix(lms): harden revoke past-guard, restamp freeze, entitlement program scope *(shared-file harden; mostly Plan 2 surfaces, foundation-relevant deltas noted below)* |

**Note:** Branch HEAD is ~14 commits ahead of `origin/main` (Plans 2/3 landed on same branch). This review judges **Plan 1 contracts only**. Later commits (cancel restamp, grantPast, receipt grant, SessionExercise, family) are residual consumers, not Plan 1 deliverables.

### Surfaces inspected

| Area | Paths (Plan 1 state) |
|------|----------------------|
| Domain | `packages/domain-lms/src/unit-progression.ts` (+ tests) |
| Schema / migration | `packages/db/prisma/schema.prisma`, `migrations/20260811120000_lms_foundation_unit_range/migration.sql` |
| Spike API | `apps/api/src/lms-ops/{router,stamp-sessions,on-roster}.ts` + int/unit tests |
| RBAC | `packages/auth/src/index.ts` (`enrollment.grantUnits`) |
| ADRs | `docs/decisions/0045-*.md`, `0046-*.md` |
| Seed / harness | `seed.mjs`, `scripts/ensure-curriculum-units.ts`, `apps/api/src/test/db.ts`, `apps/e2e/src/db.ts` |
| Freeze neighbors | `apps/api/src/enrollment/router.ts` (`enroll` reserved-only) |
| Boot RLS | `apps/api/src/boot-checks.ts` (generic FORCE scan) |

### LOC (Plan 1 core, `7d55b17` numstat on foundation surfaces)

~1.3k insertions on domain + lms-ops + migration + schema + auth + ADRs (excluding multi-plan scaffolding docs).

### Scout findings (edge cases the diff does not show)

1. **Dual-gate is path-local.** `attendance.mark` / `classBatch.listStudents` still gate on `Enrollment.status` only — no `EnrollmentUnitRange` / session stamp. Matches red-team F-SEC-1 partial accept; **not** production dual-gate.
2. **Legacy `classBatch.create` + `schedule.generateSessions` still emit unstamped sessions.** Operators can create teachable calendar rows with null stamps → empty `rosterForSession`.
3. **Open-tier (ADR 0038) still consumes stamps.** Auto-stamp on create feeds homework open when sessions end; kill-switch deferred Plan 2 (documented, real blast radius).
4. **`currentOrder` defaults to `1` when `ClassBatch.currentUnitId` is null** — legacy batches without neo accept “future-only” grants from unit 1, which may be historically past relative to real progress.
5. **No DB exclusion / GiST on overlapping ranges** — correctness relies on app `FOR UPDATE` + re-read (good for same-enrollment writers; not a cross-table constraint).
6. **`facilityId` on `EnrollmentUnitRange` is denormalized with no CHECK that it equals `Enrollment.facilityId`** — app always copies scoped facility; raw/bypass writers can desync RLS visibility from enrollment tenant.
7. **Stamp writer silently skips missing `orderGlobal → unitId` maps** — leave `curriculumUnitId` null without failing the create TX.

---

## 2. Spec compliance checklist

### Owner invariants

| # | Invariant | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Khóa học > Unit; grant by unit in course/program | **PASS** | ADR 0045; ranges store `from/toOrderGlobal`; program membership checked in `addWithUnits` via `loadProgramUnitOrders` |
| 2 | `EnrollmentUnitRange` + facility FORCE RLS | **PASS** | Migration ENABLE+FORCE+`facility_isolation` policy + GRANT to `cmc_app`; boot-check covers all RLS tables generically |
| 3 | `orderGlobal` unique(`program`, `orderGlobal`) | **PASS** | Schema `@@unique([program, orderGlobal])` + migration unique index; NOT NULL after backfill |
| 4 | Dual-gate: active ∩ range cover for roster | **PASS (new path only)** | `onRoster` + `lmsOps.rosterForSession`; int test cover/miss + reserved reject |
| 5 | Procedure freeze: enroll reserved-only; ranges via grantUnits | **PASS** | `enrollment.enroll` creates `status: 'reserved'` only; `addWithUnits` uses `enrollment.grantUnits` and never sets active |
| 6 | Create class stamps sessions with unit neo | **PASS (spike path)** | `lmsOps.createClassWithUnits` sets neo + same-TX `restampBatchSessions`; int asserts all non-null stamps |
| 7 | Null stamp fail-closed | **PASS** | `onRoster` rejects `sessionOrderGlobal == null`; int test forces null → empty roster |
| 8 | Sale cannot `grantUnits` | **PASS** | RBAC matrix + auth unit test + int `FORBIDDEN` for sale |

### Plan success criteria (`plan.md`)

| Criterion | Result | Notes |
|-----------|--------|-------|
| ADRs + procedure/RBAC/orderGlobal freezes published | **PASS** | 0045/0046 + ship note freeze table |
| domain-lms package tests green; wired into api | **PASS** | `@cmc/domain-lms` workspace dep; `pnpm --filter @cmc/domain-lms test` → unit-progression 19 green (local re-run) |
| Migration all-or-nothing: ranges+facilityId+FORCE+anchors+orderGlobal | **PASS** | Single migration file; CHECK `from ≤ to` |
| Int tests: cover/miss; reserved+range not on roster; null fail-closed; sale cannot grant | **PASS** | `lms-ops.int.test.ts` (Plan 1: 3 cases); reserved path proves grant blocked (not “range exists + reserved”) — unit `onRoster` covers reserved+ranges predicate |
| Real class create path stamps sessions (not seed-only) | **PASS** | `createClassWithUnits` only; legacy create explicitly non-stamping |
| Provision/finance regression green | **CLAIMED / NOT RE-RUN** | Ship note “30 green”; this review did not re-execute finance suite |
| Ship note contracts for plan 2/3 | **PASS** | Freeze table + open-tier side-effect + Plan 2 checklist |
| Red-team log resolved | **PASS (plan text)** | Critical items mapped into schema/API; open-tier dual-gate deferred honestly |

### Phase checklist honesty gaps

| Claim | Reality |
|-------|---------|
| Phase 6: `seedEnrollmentWithUnits` helper | **Not found** in `apps/api/src/test/db.ts` — only `seedActiveEnrollment` + separate `addWithUnits` |
| Phase 6 “all green” checkboxes | Checked in markdown without CI run artifacts attached to plan |

---

## 3. Findings

### Critical

*None that break Plan 1 owner invariants on the spike surface as implemented.*

(If this were marketed as “production dual-gate complete for teaching,” that would be Critical false advertising — ship note correctly avoids that claim.)

### Important

#### I1 — `restampBatchSessions` fail-open on missing unit map / empty catalog edge

**Where:** `apps/api/src/lms-ops/stamp-sessions.ts` (Plan 1)  
```ts
if (units.length === 0) return 0;
// ...
const unitId = unitIdByOrder.get(stamp.order);
if (!unitId) continue; // silent skip → curriculumUnitId stays null
```

**Impact:** `createClassWithUnits` can COMMIT a class with partial/null stamps, return `sessionsStamped < sessionsCreated`, and leave operators with fail-closed empty rosters without a hard error. Contiguous seeds hide this; holes in `orderGlobal` (or program/unit drift) do not.

**Fix:** After derive, if any stamp lacks `unitId`, throw `badRequest`/`INTERNAL` and abort TX. Optionally assert `sessionsStamped === nonCancelledCount` before commit.

#### I2 — `addWithUnits` does not re-validate enrollment status after `FOR UPDATE`

**Where:** `apps/api/src/lms-ops/router.ts` `addWithUnits`  
Order: read → check `active` (and archived only after `76236e8`) → validate → `FOR UPDATE` → re-check **ranges only** → insert.

**Impact:** Concurrent archive / status flip between read and lock can still grant ranges onto a no-longer-active enrollment. Roster remains dual-gated (active required), so teaching impact is limited, but **entitlement rows become orphaned rights** that activate if status is restored without re-review.

**Fix:** After `FOR UPDATE`, re-fetch enrollment row; require `status === 'active' && archivedAt == null`.

#### I3 — No multi-facility / RLS negative proof for `EnrollmentUnitRange`

**Where:** migration policy present; **no** int test inserts range in facility A and reads as facility B under `cmc_app`.

**Impact:** Red-team Critical F-SEC-2 is implemented in SQL but **unproven** in harness. FORCE is covered indirectly by generic boot-check, not by tenant isolation behavior.

**Fix:** One int test: create range under facility A; withFacility(B) findMany returns 0; withFacility(A) returns 1. Optionally assert WITH CHECK rejects cross-facility insert.

#### I4 — Denormalized `facilityId` has no integrity tie to `Enrollment.facilityId`

**Where:** migration creates `facilityId TEXT NOT NULL` without FK to `Facility` and without `CHECK`/`trigger` matching parent enrollment.

**Impact:** Matches broader monorepo pattern (Enrollment itself is denorm), but for a **new RLS force table** born specifically to avoid join-only RLS, a desynced `facilityId` is the classic footgun: wrong tenant sees/hides entitlement. App path is safe; bypass/migrate/raw SQL is not.

**Fix (defense-in-depth):**  
`CHECK` via trigger: `NEW.facilityId = (SELECT facilityId FROM "Enrollment" WHERE id = NEW.enrollmentId)`, or composite FK if schema allows.

#### I5 — `currentOrder = 1` when neo missing

**Where:** `addWithUnits`  
```ts
let currentOrder = 1;
if (enrollment.classBatch.currentUnitId) { /* resolve */ }
```

**Impact:** Legacy `classBatch.create` classes (null neo) treat “past” as anything `< 1`, so grants from unit 1..N always pass `validateNewRange` even mid-program. Spike create sets neo; production dual paths make this live.

**Fix:** If `currentUnitId` null, reject grant with explicit “class missing unit neo — use createClassWithUnits / backfill neo” rather than defaulting to 1.

#### I6 — Dual-gate not adopted by attendance / listStudents (residual product risk)

**Where:** `apps/api/src/attendance/router.ts` (`loadGatedEnrollment` → active only); `classBatch.listStudents` includes reserved+active, no ranges.

**Impact:** Teacher can mark attendance for active student with **zero** unit ranges on a stamped session. Plan 1 red-team accepted partial dual-gate; still a **teaching integrity hole** the moment spike ships beside live attendance UI.

**Fix:** Plan 2 must either route mark through `onRoster` or document deliberate “attendance ≠ entitlement” (product decision). Do not let UI call `listStudents` as teaching roster.

#### I7 — Phase/ship evidence inflation

**Where:** phase-06 claims `seedEnrollmentWithUnits`; plan status `completed` with phase files still `status: todo` in frontmatter; finance regression not re-verified here.

**Impact:** False confidence for Plan 2/3 entry. Contracts exist; “all green” is not fully artifacted in-repo for this review.

### Suggestions

#### S1 — `resolveReferenceAnchor` exported, untested in Plan 1 domain suite  
Dead for spike; Plan 2 restamp/migrate will need tests before use.

#### S2 — `domain-lms` `tsconfig` includes `*.test.ts` in `src` → emits tests into `dist/`; vitest currently double-runs `src` + `dist` tests (48 total with later modules). Exclude tests from build `rootDir`/`include`.

#### S3 — Prefer `Prisma.sql` / `$queryRaw` over `$queryRawUnsafe` for `FOR UPDATE`.

#### S4 — N sequential `classSession.update` in stamp; fine for spike, batch/`updateMany` by order groups later.

#### S5 — ADRs are thin but adequate; add explicit “consumers still single-gate” inventory table (attendance, listStudents, open-tier) as promised in phase-02 inventory checkbox.

#### S6 — Ship note “Post code-review fixes H1 FOR UPDATE” is already in `7d55b17`; archived grant reject is `76236e8` (good). Keep changelog accurate.

---

## 4. What is solid

1. **Domain math is coherent and well-tested** (`deriveSessionUnits` 4-session jump, cancel-shift, cap, entitlement gaps, `remainingUnits` set-semantics, archive day-gate pure rules). Local re-run: unit-progression tests green.
2. **Schema matches red-team hard contracts:** denormalized `facilityId`, FORCE RLS, CHECK `from ≤ to`, `orderGlobal` NOT NULL + unique(program, orderGlobal), ClassBatch neo columns, `Enrollment.archivedAt`.
3. **Procedure / SoD freeze is real code, not docs-only:**  
   - `enrollment.enroll` → reserved only  
   - `enrollment.grantUnits` → **only** `giam_doc_dao_tao` (sale **and** GDKD excluded)  
   - `addWithUnits` refuses non-active  
   - `rosterForSession` uses `classRoster.read`, not enroll
4. **Create+stamp same transaction** via `withFacility` → correct atomicity for spike create path.
5. **Grant race on ranges** addressed with enrollment `FOR UPDATE` + fresh range re-read before insert (Plan 1 already; good).
6. **Fail-closed null stamp** implemented in pure `onRoster` + int proof.
7. **Seed/e2e orderGlobal plumbing** fixed so NOT NULL schema does not break harness (`seedCurriculumUnit`, e2e db, ensure script).
8. **Ship note** correctly names open-tier side-effect and legacy unstamped create — no over-claim of production dual-gate.

---

## 5. Verdict

### **GO** for ship-to-develop of **Plan 1 foundation contracts**

Rationale: all eight owner invariants hold on the intended spike surface; migration/RBAC/domain/API freezes are implementable dependencies for Plan 2/3; Critical red-team schema items (FORCE RLS, orderGlobal uniqueness, sale exclusion, create+stamp TX) are present in code.

**Not a rubber stamp:** address **I1–I3** before or immediately after merge if Plan 2 will treat foundation as load-bearing production path. **I6** is the largest product footgun and must be explicit in Plan 2 entry, not discovered in UAT.

**Do not** describe Plan 1 as “LMS teaching production-ready.”

---

## 6. Residual risks for Plan 2/3 consumers

| Risk | Consumer impact |
|------|-----------------|
| Dual-gate only on `lmsOps.rosterForSession` | Teaching spine UI / attendance / family must not reuse `listStudents` or active-only queries as entitlement roster |
| Legacy class create unstamped | Plan 2 cancel/restamp and create-class UI must standardize on unit-aware path or stamp on generateSessions |
| Open-tier still stamp-driven | Plan 2 kill-switch / `LMS_ENTITLEMENT_GATE` must land before stamped sessions hit production homework |
| `currentOrder` default 1 | Receipt grant (Plan 3) and revoke math will mis-fire on legacy batches without neo backfill |
| Silent stamp holes (I1) | Import/cutover (Plan 3) with non-contiguous CSV orders → ghost null stamps |
| No range overlap DB constraint | Second writer outside `addWithUnits` (Plan 3 `grantUnitsFromReceipt`) must share same lock protocol — later commits introduced `grant-units.ts`; keep single writer |
| orderGlobal backfill by level/monthIndex | ADR 0046: any pre-existing catalog order may not match live cmc-lms CSV; remap before selling ranges |
| Archive day-gate timezone | API uses `ictDateOnlyOf` + `ictToUtc` correctly **if** all callers pass ICT-normalized days; Plan 2 archive endpoints must not pass raw wall clocks into domain |
| Branch contains Plan 2/3 commits | Shipping “Plan 1 only” requires either stack-split PR or explicit partial cherry-pick; do not assume `7d55b17` alone is branch tip |

---

## Metrics (Plan 1 slice)

| Metric | Value |
|--------|-------|
| domain-lms unit-progression tests | 19 (green, local) |
| onRoster unit tests | 7 |
| lms-ops int tests (Plan 1 pure) | 3 |
| Auth matrix coverage for grantUnits | yes (unit + int) |
| RLS negative isolation test | **missing** |
| Type coverage / full CI finance suite | not re-measured this review |
| Linting | not re-run |

---

## Unresolved questions

1. Product: should attendance mark require unit entitlement in the same release as foundation, or is “active seat without units may still be marked present” intentional until Plan 2?
2. Ops: will production cut over class creation to `createClassWithUnits` only, or must `classBatch.create` gain stamping before any real class is scheduled?
3. Data: is level/monthIndex backfill order accepted as permanent `orderGlobal` for existing UCREA rows, or is a CSV remap required before any grant?

---

**Status: DONE_WITH_CONCERNS**
