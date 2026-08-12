# Independent code review — Plan 2/3 LMS teaching spine

**Date:** 2026-08-11  
**Reviewer posture:** Staff Engineer, production-readiness / hostile to defects  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Plan:** `plans/260811-1118-lms-teaching-spine-api-ui-family/`  
**Method:** Plan + ship notes + gap analysis, then code/diff evidence (not claims). No code edits.

---

## 1. Scope + commits

### In-scope commits (Plan 2 teaching spine)

| SHA | Subject |
|-----|---------|
| `7e4034b` | feat(lms): teaching-spine cancel restamp and enrollment range ops |
| `30cf3de` | test(lms): cover cancel restamp, range ops, open-tier flags |
| `8fa8561` | feat(lms): family isActive/tokenVersion, attendance window, UI dual-gate |
| `37a83b1` | fix(lms): live-session gate on photo GET, dual-roster fail-closed |
| `5596384` | feat(lms): unify cancel restamp and unit-aware create class UI |
| `c973ffb` | fix(lms): race-safe cancel flip and create-class program filter |
| `3182ab8` | feat(lms): SessionExercise delivery and dual homework path |
| `c9ea484` | fix(lms): revoke delivery on cancel and exercise-id kill-switch path |
| `ff8137b` | docs(lms): refresh plan gap analysis after SessionExercise delivery |

**Range vs foundation:** `7d55b17..ff8137b`  
**Diff size (excl. plans):** ~38 files, **+2647 / −164** (full range incl. plans: +2988 / −203 across 52 files)

### Primary surfaces reviewed

| Area | Paths |
|------|--------|
| Cancel restamp | `apps/api/src/lms-ops/cancel-session.ts`, `stamp-sessions.ts`, `class/class-session-router.ts` |
| Enrollment ops | `apps/api/src/lms-ops/router.ts` (`grantPast` / `revokeFromNext` / archive) |
| Dual-gate | `on-roster.ts`, `rosterForSession`, `deliveredExerciseIdsForStudent` |
| Family auth | `session-token.ts`, `assert-live-session.ts`, `trpc.ts` `lmsProcedure`, `parentAccount.setActive` |
| Attendance / photo | `attendance/router.ts`, `session-evidence/photo-access.ts`, `exercise/upload-route.ts` |
| Exercise delivery | `exercise-delivery.ts`, `open-tier.ts`, worker `deliverDueExercises` |
| UI spines | `attendance-panel.tsx`, `session-detail.tsx`, `classes/index.tsx` |
| Residual production path | **`worker/session-done-sweep.ts` `runCancelSweep`** (not in Plan 2 commits; still live in `drainOnce`) |

### Scout findings (edge cases the happy path hides)

1. **Worker auto-cancel still creates makeup and never restamps** — active every `drainOnce` cycle.
2. **Attendance write API is not dual-gate** — UI filters; server accepts any active enrollment in the class.
3. **Assessment / legacy attendance UI still use unfiltered `listStudents`**.
4. **Admin “Thêm buổi bù” + `classSession.addMakeup` still ship** — plan outcome says “no makeup”.
5. **Cancel delivery revoke scopes submissions facility-wide by `exerciseId`** — wrong freeze boundary under shared catalog.
6. **No negative test** for open-tier OFF + delivery present but student **outside** unit range.
7. **No concurrent cancel vs done race test** (only sequential double-cancel).
8. **Grant logic duplicated** in `router.ts` vs `grant-units.ts` (`grantRangeOnEnrollment` not used by staff procedures).
9. Plan marks success criteria complete while phase-07 still has staging UAT unchecked.

---

## 2. Spec compliance per phase

| Phase | Claimed | Evidence-based status | Notes |
|-------|---------|----------------------|-------|
| **1 Start** | done | **Met** | Foundation `7d55b17` present; plan inventory ok. |
| **2 Class engine cancel restamp** | done | **Partial** | Staff path unified (`classSession.cancel` + `lmsOps.cancelSessionAndRestamp` → `cancelSessionWithRestamp`). Race-safe `updateMany` flip. Int tests prove unit slide. **Worker cancel path + makeup UI/API still violate “no makeup / restamp”.** realignHistory deferred (explicit). |
| **3 Enrollment ops** | done | **Mostly met** | `grantPast` / `revokeFromNext` (past-guard) / archive / unarchive + FOR UPDATE re-fetch. Dual-gate on `rosterForSession` + fail-closed null stamp. **Write paths for attendance not dual-gated** (phase-03: “write paths filtered”). expiring list deferred. |
| **4 Family principal** | done | **Met (scoped)** | `isActive` + `tokenVersion` + login embeds `tv` + `lmsProcedure` / photo GET live gate + `setActive` bump. Ownership via Guardian (pre-existing). Parent login remains OTP-primary (password deferred) — acceptable per phase notes. |
| **5 Attendance / journal / photoConsent** | done | **Mostly met** | Window `[start−30m, end+2h]` + director override; `listForChild` hides cancelled; photoConsent fail-closed on list + GET; cancelled session photos denied. |
| **6 Exercise delivery** | done | **Met for spine** | `ClassExerciseItem` + `SessionExercise` + FORCE RLS; sequence freeze; worker delivery; open-tier OFF uses delivered exercise ids + dual-gate. Folder library UI deferred. Submission still exerciseId-keyed (documented). |
| **7 UI spines** | done (spine) | **Partial** | Create class → `createClassWithUnits`; session cancel → restamp; attendance **panel** dual-gate fail-closed. **Assessment panel + legacy attendance page + class-detail makeup dialog not dual-gate / no-makeup compliant.** Staging day SC unchecked. |

### Plan-level success criteria

| Criterion | Verdict |
|-----------|---------|
| Teacher can run teaching loop on monorepo APIs/UI spines | **Conditional** — staff cancel/create/roster/delivery spines exist; worker + makeup + non-dual write paths undermine a real teaching day. |
| Family can homework when entitled (open-tier default; delivery when flag off) | **Met in API** for default open-tier + kill-switch OFF path with dual-gate; LMS app still uses `openForStudent` (correct). |
| Open-tier path flag-off ready | **Met** (`LMS_OPEN_TIER_ENABLED=0` → SessionExercise ids). |
| Server kill-switch for dual homework models | **Met** (open-tier OFF + entitlement gate flag). |

Ship notes are directionally accurate for **staff** cancel unify and delivery spine, but over-claim Plan 2 “DONE” relative to live worker/makeup behavior.

---

## 3. Findings

### Critical

#### C1 — Worker `runCancelSweep` violates Plan 2 cancel invariants in production loop

**Evidence:** `apps/api/src/worker/session-done-sweep.ts` cancels via bare `updateMany` → `status: 'cancelled'`, then **creates** `isMakeup: true` tail sessions. `apps/api/src/worker/index.ts` `drainOnce` always runs `runCancelSweep` before `deliverDueExercises`. No call to `cancelSessionWithRestamp`, no restamp, no SessionExercise revoke.

**Impact:**
- Unit stamps **do not slide** after auto-cancel → wrong dual-gate roster, wrong open-tier Tier A units, wrong teaching progression.
- **Makeup sessions are auto-created** every poll cycle when 0-present late sessions exist — direct contradiction of plan outcome “Cancel session restamps units; **no makeup**”.
- Staff path was carefully unified; the worker silently undoes the product model.

**Ship notes call this “deferred polish”.** That is incorrect risk classification: it is an **always-on production writer**, not optional UI polish.

**Fix direction (any one is incomplete alone):**
1. Route auto-cancel through `cancelSessionWithRestamp` (or shared TX helper), **and**
2. Stop creating makeup / tail-append (or gate behind an explicit, default-OFF flag with product sign-off), **and**
3. Revoke undelivered/unsubmitted `SessionExercise` consistently, **and**
4. Add int tests: worker cancel restamps; no makeup row; dual-gate still consistent.

#### C2 — Plan “no makeup” is false end-to-end while UI/API still create makeups

**Evidence:**
- `classSession.addMakeup` still live (`class-session-router.ts`).
- Admin UI: `apps/admin/src/pages/classes/class-detail.tsx` “+ Thêm buổi bù” → `classSession.addMakeup`.
- Worker (C1) creates makeups automatically.

Phase-02 checked “No makeup session create path **in new ops**” — a scope weasel that does not match plan.md outcome. For ship of Plan 2 teaching spine, makeup remains a first-class product path.

**Fix:** Product decision required: either (a) remove/disable makeup create + worker append for unit-aware classes, or (b) rewrite plan outcome and dual-gate rules to include makeup explicitly. Current code + checked plan boxes are inconsistent.

---

### Important

#### I1 — Dual-gate is UI-preferential, not an attendance write trust boundary

**Evidence:**
- UI: `attendance-panel.tsx` correctly prefers `lmsOps.rosterForSession` and fail-closes when dual succeeds empty.
- API: `attendance.mark` / `markAll` only require enrollment `active` + same `classBatchId` (`loadGatedEnrollment`). **No `onRoster` / unit range / session stamp check.**
- `attendance.listBySession` returns all active enrollments (unfiltered).
- Phase-03 requirement: “write paths filtered (dual-gate on rosterForSession)”.

**Impact:** Any client (or teacher script) can mark attendance for students outside sold unit range / unstamped sessions. UI dual-gate is cosmetic under a malicious or legacy client. FinalGrade / open-tier Tier B can still be driven by those marks.

**Fix:** Enforce `onRoster` (or shared dual-gate helper) inside `mark`/`markAll` (and ideally assessment session writers). Keep admin `listStudents` unfiltered if desired for CRM views — teaching writes must not.

#### I2 — Assessment / legacy teaching UIs still unfiltered roster

**Evidence:** `assessment-panel.tsx`, `session-assessment.tsx`, `teaching/attendance.tsx` still `classBatch.listStudents` (reserved+active, no unit range).

**Impact:** Teachers mark comments / use legacy attendance for students not entitled for that unit stamp. Inconsistent with dual-gate panel on session hub.

#### I3 — Cancel delivery revoke uses facility-wide submission count on `exerciseId`

**Evidence:** `cancel-session.ts`:

```ts
submission.count({ where: { exerciseId: delivery.exerciseId, facilityId, status: { not: 'draft' } } })
```

**Impact:**
- If **any** student in the facility submitted the same catalog exercise (other class / prior delivery), cancel **keeps** this session’s `SessionExercise` → position stays burned even when **this class** has no submissions.
- Sequence “cancel must not burn position when no work submitted” fails across multi-class shared homework catalog (common when unit-stamp fallback reuses the same published homework).

**Fix:** Scope to students enrolled in this `classBatchId` (or submissions linked to this session when that model exists). Prefer class-scoped count until Submission is SessionExercise-keyed.

#### I4 — Open-tier OFF dual-gate negative path untested

**Evidence:** `exercise-delivery.int.test.ts` only proves **positive** open-tier OFF with range grant. No test: delivery exists + student **without** covering `EnrollmentUnitRange` → empty open set / submit blocked.

**Impact:** Regression can re-open homework for non-entitled students when kill-switch is flipped for production cutover — the exact path Plan 2 claims “ready”.

#### I5 — Staff grant procedures do not call the single-writer helper

**Evidence:** `grant-units.ts` documents “Single writer for EnrollmentUnitRange” and is used by `provisionFromReceipt` (Plan 3 already on branch). `lmsOps.addWithUnits` / `grantPast` reimplement overlap + FOR UPDATE + create in `router.ts`.

**Impact:** Drift risk (Plan 3 money path vs staff path). Not a functional break today, but violates the freeze narrative the ship notes sell to Plan 3.

#### I6 — Phase-07 staging success criterion still open; plan.md over-checks

**Evidence:** phase-07 SC “Staging teaching day without cmc-lms” unchecked. plan.md success criteria all `[x]`. Gap analysis marks Plan 2 DONE spines.

**Impact:** Process/trust issue — completion claims exceed executable proof (no staging UAT; human UAT still none per project docs).

---

### Suggestions

#### S1 — Concurrent cancel vs done race untested

Race-safe `updateMany` is good; only sequential double-cancel is tested. Add a test that marks done concurrently and asserts cancel fails without restamping half-done state.

#### S2 — `restampBatchSessions` N updates per session

Per-session `update` loop is fine for class-sized batches; `updateMany` by unit groups would be cheaper at scale. Non-blocking.

#### S3 — Worker `deliverDueExercises` swallows errors

Poison sessions retry for 14 days with console.error only. Consider dead-letter metric / status. Non-blocking for Plan 2 spine.

#### S4 — `deliveredExerciseIdsForStudent` loads all active enrollments’ deliveries

Correct dual-gate application; watch N×deliveries growth. Index already on facilityId/exerciseId.

#### S5 — Parent password multi-child “spine” is OTP + student password only

Matches phase notes; do not market as full phone+password family principal until built.

#### S6 — Folder library / SessionExercise-keyed Submission

Documented deferred; acceptable for Plan 3 entry **only if** I3 is fixed or accepted with catalog-uniqueness assumptions.

---

## 4. Solid areas

These are real, evidence-backed strengths — not praise padding:

1. **Staff cancel unify is real:** both `classSession.cancel` and `lmsOps.cancelSessionAndRestamp` call `cancelSessionWithRestamp`; int test proves unit stamp **slide** after cancel (`ordered[4]` 102→101).
2. **Race-safe cancel flip** (`updateMany` status ∈ planned|confirmed) matches session-done sweep pattern; prevents done overwrite.
3. **`restampBatchSessions` freezes `done`** while still counting them for progression — correct teaching history.
4. **Dual-gate pure predicate** `onRoster` fail-closed on null `sessionOrderGlobal`; roster int tests cover hit/miss/null/archive/revoke.
5. **`revokeFromNext` past-guard** (`fromOrderGlobal < class.currentOrder` rejected) + FOR UPDATE re-fetch on grants.
6. **Family live session:** `tokenVersion` in signed token, `assertLiveLmsSession` on `lmsProcedure` **and** session-photo GET; deactivate bumps tv; photoConsent + cancelled session fail-closed.
7. **Exercise delivery design:** advisory locks per batch, sequence freeze via MAX(position), cancelled never delivers, open-tier OFF uses **exercise ids** (not whole unit catalog) in list + `assertExerciseOpenForStudent`.
8. **FORCE RLS** on `ClassExerciseItem` / `SessionExercise` migrations.
9. **UI create class** switched to `createClassWithUnits` with program-aware start unit filter (post-`c973ffb`).
10. **Attendance window** pure helper + director override + env kill-switch style.

---

## 5. Verdict

# **NO-GO** for ship-to-develop of Plan 2 as a complete teaching spine

### Why not GO

Plan 2’s **owner invariants** are not held by the running system:

| Invariant | Staff path | System as deployed |
|-----------|------------|--------------------|
| Cancel restamps units | Yes | **Worker cancel does not** |
| No makeup | New ops only | **Worker + UI + API still create makeup** |
| Dual-gate on teaching writes | Roster read + UI panel | **Attendance API unfiltered** |
| Open-tier OFF dual homework | Implementation yes | **Missing negative entitlement test** |

Merging to `develop` with worker enabled will **actively corrupt unit progression** and **spawn makeup sessions** on any facility that hits the 0-present cancel sweep — while docs claim Plan 2 complete and Plan 3 ready.

### Minimum bar to re-grade as **GO (conditional)**

Must land before merge (or land with hard feature-kill in same PR):

1. **C1 fixed or hard-disabled:** `runCancelSweep` either uses restamp+no-makeup or is default-OFF behind env with loud ops docs + CI assertion that prod config cannot enable legacy makeup cancel.
2. **C2 product decision recorded** and code aligned (disable makeup UI/API for unit-aware classes, or amend plan outcome).
3. **I1:** dual-gate on `attendance.mark` / `markAll` (server).
4. **I4:** open-tier OFF + not-entitled negative int test green.
5. **I3:** class-scoped submission check for delivery revoke (or documented single-exercise-per-facility assumption with test).

Without (1), **do not merge**.

### What is acceptable to leave as residual after conditional GO

- Folder library UI, SessionExercise-keyed Submission, grant range admin UI, realignHistory, staging human UAT, parent phone+password (OTP remains).
- Assessment panel dual-gate (I2) can be follow-up **if** attendance write gate (I1) lands first.

---

## 6. Residual risks

| Risk | Severity if ignored |
|------|---------------------|
| Worker cancel without restamp in any env running worker | **Data corruption** of curriculum stamps / roster / open-tier |
| Makeup auto-create + manual “buổi bù” | Breaks dual-gate empty stamp sessions; reintroduces Tier B open-tier side paths |
| Attendance marks outside sold range | Wrong FinalGrade denominator/numerator; inflated present rates; open-tier Tier B leaks |
| Facility-wide submission guard on revoke | Sequence pointer stuck; homework undeliverable positions |
| Dual grant implementations | Plan 3 money path drifts from staff grant semantics |
| LMS_ENTITLEMENT_GATE default OFF + open-tier default ON | Production still ADR 0038 open homework until ops flips flags — intentional, but cutover must be deliberate |
| No staging teaching-day proof | “Teacher can run loop” is lab-green, not ops-green |
| Plan 3 code already on branch (`grantUnitsFromReceipt`, reconciler) | Review Plan 3 separately; do not assume Plan 2 isolation |

---

## Metrics (approximate / qualitative)

| Metric | Value |
|--------|--------|
| Plan 2 LOC (code excl. plans) | ~+2.6k / −0.2k |
| Focused tests observed | lms-ops int (cancel/grant/roster/archive), open-tier flags, exercise-delivery int (5), setActive, attendance window, photo-access |
| Type coverage | Not re-run in this review (static read) |
| Critical open | **2** (C1, C2) |
| Important open | **6** (I1–I6) |
| Staging UAT | **None** (phase-07 SC open) |

---

## Recommended actions (priority order)

1. **Stop the bleeding:** disable or rewrite `runCancelSweep` makeup+no-restamp path; wire through `cancelSessionWithRestamp`; tests.
2. **Align makeup product policy** with code (kill UI/API or rewrite plan).
3. **Server dual-gate on attendance writes.**
4. **Fix delivery revoke scope + add open-tier OFF not-entitled test.**
5. Route staff grants through `grantRangeOnEnrollment`.
6. Dual-gate assessment panel; drop or relabel legacy attendance page.
7. Only then re-open Plan 3 money bridge with honest Plan 2 residual list.

---

## Unresolved questions (need owner, not code)

1. Is auto-cancel+makeup from HR phase-7 **still desired product** for unit-aware classes, or pure legacy?
2. When open-tier is eventually turned OFF in prod, is `LMS_ENTITLEMENT_GATE` required ON, or is delivery dual-gate alone sufficient?
3. Are makeup sessions ever supposed to carry unit stamps / dual-gate roster?

---

**Status: BLOCKED**

Plan 2 staff spines are non-trivial and partly well-built, but **live worker cancel + makeup create paths falsify the core Plan 2 cancel model**. Treat Plan 2 as **not ship-complete** until C1/C2 are resolved with tests; do not promote “DONE / Plan 3 ready” language into develop without that fix.
