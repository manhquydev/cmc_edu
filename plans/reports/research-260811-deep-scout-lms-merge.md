# Deep Scout Report — Hợp nhất LMS `cmc-lms` → `cmc_edu`

**Date:** 2026-08-11  
**Method:** 6 parallel explore agents (journals + code both repos + cross-diff) + main-agent verification of schema/domain/provision paths  
**Plan:** `plans/260811-1025-hop-nhat-lms-cmc-lms-vao-cmc-edu-erp/`

---

## 0. Executive conclusion

| Fact | Evidence |
|------|----------|
| **`cmc-lms` is LIVE ops** (~30/07 migrate, family cutover 07/08, Astryx complete 09/08) | Journals + `docs/migration.md` |
| **Ops data scale (post family cutover):** ~10 PH / 11 HS / 11 classes / 137 sessions | journal cutover 07/08 |
| **`cmc_edu` LMS = thin family portal** bolted to ERP money + staff teaching APIs | code + 31/38 journey ceiling |
| **Core teaching unlock chain in monorepo is NOT journey-proven** (P2-01/02/03/05 `no-ui-path`) | acceptance journals |
| **Merge is domain-model change**, not UI skin | 5 BLOCKER semantic diffs |

**Recommended SoT split (unchanged, now evidence-hardened):**

| Layer | Source of truth after merge |
|-------|------------------------------|
| Money, multi-facility, RLS, CRM, gift redeem, photoConsent, staff HR | **cmc_edu ERP** |
| Unit progression, unit-range entitlement, rolling sessions, cancel semantics, exercise library/delivery, attendance window, family auth UX, admin class ops depth, CSV curriculum | **cmc-lms** |

---

## 1. Agent fleet (what was scouted)

| Agent | Scope | Outcome |
|-------|--------|---------|
| A | `cmc-lms` all journals + roadmap + key reports | Timeline of locked decisions; prod live; non-regress laws |
| B | `cmc-lms` schema/domain/routers/services/UI/tests | ~105 procedures; domain package; cron; port priority |
| C | `cmc_edu` journals + LMS docs + acceptance | Evolution pain; 31/38; OTP/comms; no-ui-path spine |
| D | `cmc_edu` provision/LMS/teaching code | Call graph; procedure inventory; no EnrollmentUnitRange |
| E | `cmc-lms` AGENTS + migration + deploy + backlog | Locked decisions; migrate contract; residual ops |
| F | Cross-repo semantic 12-dimension diff | BLOCKER/HIGH matrix |

---

## 2. Production reality

### 2.1 `cmc-lms` (refined LMS)

- **Live since ~2026-07-30** at `hoc.cmcvn.edu.vn` (1 server Docker Compose).
- Migrated from CMCnew backup: **running classes only**; ERP tables dropped; submissions old **skipped** (incompatible with new library).
- **Family auth cutover 07/08** (`kind:'family'`, drop OTP, Netflix switcher) on prod `91a6c58`.
- Astryx complete 09/08 (PR #33); Mantine gone.
- Residual: 31 photo blobs rsync may still need verify; some migrated classes lacked ScheduleSlot historically (fixed by addSlot cascade).

### 2.2 `cmc_edu` (ERP + thin LMS)

- Full ERP P1–P4 + multi-facility RLS.
- LMS SPA: parent email-OTP + student password; thin pages.
- **Money gate:** `receiptApprove` → `provisionFromReceipt` (ADR 0041) — identity + whole-class `Enrollment.active`.
- **Acceptance ceiling 31/38** (journey smoke, not business math); UAT human not done.
- **No-ui-path teaching spine:** class create, attendance deep-link, open-tier assignUnit, student submit.
- OTP email historically blocked on bad Brevo key / stub transport (journals).

---

## 3. Locked product laws from `cmc-lms` (must not regress)

Source: journals + `AGENTS.md` + `class-unit-spec.md` + code domain package.

1. **Unit = 4 non-cancelled sessions** from neo `(currentUnitId, currentUnitAnchor)` — not calendar month.
2. **Roster D1:** entitlement on **session’s stamped unit** + `archivedAt` day gate + lifecycle gate.
3. **Past ADD ok (grantPast); past SUBTRACT forbidden** — revoke from next only.
4. **No makeup sessions** — cancel rewinds future unit stamps.
5. **Exercise library decoupled from curriculum** — freeze sequence; 1 PDF/session at end via cron; realign units **must not** move `SessionExercise`.
6. **Family phone+password multi-child** — explicit `studentId` on every sink (no `studentIds[0]`).
7. **Admin owns create people/class**; teacher teaches only.
8. **Score/stars constants 10/10**; stars credit on **grade publish**.
9. **Admin roster view intentionally NOT lifecycle-filtered**; ops write paths ARE filtered.
10. **Published academic history forever** for family (no re-filter by current unit).

---

## 4. Hard ERP invariants in `cmc_edu` (must preserve)

1. **ADR 0041:** money commits first; provision idempotent outside money TX; reconciler for orphans.
2. **No orphan students** as normal path; `createdByReceiptId` provenance.
3. **Enrollment.reserved → active only via receipt** (ADR-A).
4. **Multi-facility + RLS** (ADR 0042); parent multi-facility via Guardian ownership.
5. **Staff identity ≠ LMS identity.**
6. **photoConsent** on Guardian for evidence photos.
7. **Gift redeem lifecycle** (facility catalog) already live in monorepo.
8. CI: `typecheck-and-test` + `ui-e2e`; acceptance re-measure after merge.

---

## 5. Semantic DIFF (12 dimensions)

| # | Dimension | Severity | Prefer |
|---|-----------|----------|--------|
| 1 | Student creation | **BLOCKER** | Receipt SoT + admin break-glass |
| 2 | Enrollment access | **BLOCKER** | Unit ranges **on top of** reserved/active |
| 3 | Unit progression | **BLOCKER** | cmc-lms session-count engine |
| 4 | Exercise open/delivery | **BLOCKER** | cmc-lms library+sequence (supersede 0038) |
| 5 | Attendance window / makeup | **HIGH** | Window from cmc-lms; drop makeup as primary |
| 6 | Session evidence | **MED** | cmc-lms quality + cmc_edu photoConsent |
| 7 | Auth family vs dual | **HIGH** | Family UX + edu security primitives |
| 8 | Stars / gifts | **MED** | Earn from lms; redeem from edu |
| 9 | Admin class ops depth | **HIGH** | Port cmc-lms procedures |
| 10 | Multi-facility | **BLOCKER** if multi-site | Grow facilityId+RLS on ported tables |
| 11 | Curriculum | **HIGH** | CSV orderGlobal from cmc-lms |
| 12 | Session gen / cancel | **HIGH** | Rolling + cancel reasons + restamp |

### Dangerous same-name collisions

| Name | cmc-lms | cmc_edu |
|------|---------|---------|
| `Enrollment.status` | Migrate residue; roster ignores | Live access gate |
| `CurriculumUnit` | orderGlobal + 4 sessions | level/monthIndex open-tier key |
| `Course` | Global program | Facility-scoped |
| `ClassBatch.code` | `CMC-YY-NNNN` | `{facility}-{program}-{year}-seq` |
| Makeup | Removed | First-class + Tier B |
| Exercise open | SessionExercise delivery | ADR 0038 unit-end |

---

## 6. Schema / capability matrix

### Only on `cmc-lms` (port targets)

- `EnrollmentUnitRange`
- `ClassBatch.currentUnitId` / `currentUnitAnchor` / `startUnitId`
- `ClassSession.cancelReason`
- `ScheduleSlot.effectiveFrom` + per-slot teacher
- Full `CurriculumUnit.orderGlobal` + `CurriculumLesson`
- `ExerciseFolder` / `ExerciseFile` / `ClassExerciseItem` / `SessionExercise`
- `Enrollment.archivedAt`
- `RecordEvent` chatter
- Richer `StudentLifecycle`
- Domain package: unit-progression, exercise-sequence, session-schedule, grading-scale

### Only on `cmc_edu` (keep)

- `facilityId` + RLS everywhere teaching/ERP
- `Receipt` / Opportunity / CRM / finance
- `isMakeup` / makeup graph (likely deprecate after decision)
- `createdByReceiptId`
- `Guardian.photoConsent*`
- StudentAccount lockout / mustChangePassword
- Gift facility redeem pipeline
- HR/payroll/shift

### Confirmed absent on monorepo today

**`EnrollmentUnitRange` does not exist** in `packages/db/prisma/schema.prisma`.

---

## 7. ERP→LMS call graph (as-built monorepo)

```
finance.receiptApprove
  → money TX (approved + O5)
  → provisionFromReceipt (after money):
       ParentAccount → Student → Guardian
       → activateEnrollment (reserved→active whole class)
       → StudentAccount (default password)
       → audit provisioning.completed
  → email outbox best-effort
worker.reconcileOrphanedReceipts → re-provision
worker.reconcileCancelledButProvisioned → withdraw stray enrollments
```

**Missing for ops standard:** grant `EnrollmentUnitRange` from receipt product mapping.

---

## 8. Procedure / UI inventory snapshot

### cmc-lms (~105 procedures) — zones

| Zone | Capability |
|------|------------|
| Admin | class lifecycle, unit realign, enroll ranges, library, expiring, students/parents, attendance report |
| Teacher | week calendar, attendance window, journal, PDF grade |
| Family | classes, exercises work, attendance, journal, star balance, account |

Cron: monthly materialize sessions + every 5m exercise delivery.

### cmc_edu LMS UI (thin)

| Route | Notes |
|-------|-------|
| Parent OTP login | Brevo historically fragile |
| Parent home/evidence/homework/report/consent/reset-child | Uses Guardian |
| Student open exercises + gifts + change-password info | ADR 0038 |

**API without UI:** `enrollment.mine`, `guardian.requestLink`, phone OTP.

### cmc_edu teaching (ERP admin)

Schedule, session detail, attendance, grading, exercises CRUD, evidence, assessment — **but** create class / assignUnit / attendance entry paths incomplete for acceptance journeys.

---

## 9. Journal lessons that must drive merge process

### From cmc-lms

- Journals are **SoR for “is prod live?”** when docs lag.
- Read code before designing (realign Option A discovered escape hatch already existed).
- Dual session models + `studentIds[0]` are multi-child landmines.
- TOCTOU previews must include **target state** in seen keys.
- Phone writers share advisory lock namespace.
- Non-idempotent e2e needs clean DB between specs.
- Feature flags that only hide UI ≠ off.

### From cmc_edu

- Green unit tests on dead wires (reconciler never mounted).
- Dev auth ≠ prod auth (Mode-B false green).
- Credentials never validated (Brevo 401) = feature incomplete.
- TL25 / acceptance docs go stale — measure with `pnpm acceptance:report`.
- Journey smoke ≠ business correctness.
- Seed must not masquerade as UI proof.

---

## 10. Port priority (ops go-live order)

1. Family auth + multi-child ownership gates  
2. CSV curriculum + class create + session materialize + unit restamp  
3. Enrollment unit ranges + expiring + archive/grantPast  
4. Student/parent intake (break-glass) + staff mapping  
5. Teacher schedule + attendance window + journal  
6. Exercise library + sequence + delivery cron  
7. Submission grade publish + star ledger  
8. ERP bridge: receipt → unit range grant  
9. Realign history (migrate repair)  
10. Gifts redeem (keep edu) / polish  

**Deferred intentionally (cmc-lms v2):** badges, levels, leaderboard, SSE, parent meetings, gift UI on lms (if not using edu gifts).

---

## 11. Implications for existing plan `260811-1025`

| Plan item | Deep scout update |
|-----------|-------------------|
| Phase 1 decisions | **D3 (replace 0038)** and **D5 (no makeup)** strongly supported by live ops law |
| Phase 4 receipt→range | **BLOCKER** for real linkage; product mapping still open |
| Phase 7 family cutover | Must plan password seed for OTP-only parents (edu has OTP history) |
| Phase 8 migration | Prefer: **import from live cmc-lms DB** if that is teaching SoR; monorepo may not hold real class ops data |
| Facility | **Must add facilityId+RLS** on every ported table — cmc-lms has none |
| Acceptance | After merge, rebuild journeys for unit-range + sequence delivery; retire open-tier journeys |

### Data go-live scenarios (must pick)

| Scenario | Meaning |
|----------|---------|
| **A** | Teaching already only on monorepo → backfill ranges synthetically |
| **B** | Teaching live on **cmc-lms** → one-time import into monorepo then cut DNS |
| **C** | Both dirty → freeze one SoT |

Deep scout strongly suggests **B** (cmc-lms live with real families) unless operator states otherwise.

---

## 12. Absolute path index (high value)

### cmc-lms
- `/home/manhquy/Downloads/cmc-lms/AGENTS.md`
- `/home/manhquy/Downloads/cmc-lms/docs/class-unit-spec.md`
- `/home/manhquy/Downloads/cmc-lms/docs/role-matrix.md`
- `/home/manhquy/Downloads/cmc-lms/docs/migration.md`
- `/home/manhquy/Downloads/cmc-lms/packages/domain/src/unit-progression.ts`
- `/home/manhquy/Downloads/cmc-lms/packages/domain/src/exercise-sequence.ts`
- `/home/manhquy/Downloads/cmc-lms/packages/db/prisma/schema.prisma`
- `/home/manhquy/Downloads/cmc-lms/apps/api/src/services/{session-generator,exercise-delivery,batch-unit,star-ledger}.ts`
- `/home/manhquy/Downloads/cmc-lms/apps/api/src/routers/*`
- `/home/manhquy/Downloads/cmc-lms/plans/journals/*` (32 files; 07–09/08 most critical)

### cmc_edu
- `/home/manhquy/Downloads/cmc_edu/docs/decisions/0038-*.md`, `0041-*.md`
- `/home/manhquy/Downloads/cmc_edu/apps/api/src/provisioning/provision-from-receipt.ts`
- `/home/manhquy/Downloads/cmc_edu/apps/api/src/exercise/open-tier.ts`
- `/home/manhquy/Downloads/cmc_edu/apps/api/src/lms-auth/router.ts`
- `/home/manhquy/Downloads/cmc_edu/apps/lms/src/routes/index.tsx`
- `/home/manhquy/Downloads/cmc_edu/docs/journals/260711-erp-lms-workflow-audit.md`
- `/home/manhquy/Downloads/cmc_edu/docs/journals/260726-journey-ceiling-31-38-*.md`
- `/home/manhquy/Downloads/cmc_edu/docs/journals/260710-lms-gap-otp-parent-visibility.md`
- `/home/manhquy/Downloads/cmc_edu/plans/260811-1025-hop-nhat-lms-cmc-lms-vao-cmc-edu-erp/`

---

## 13. Status

```
Status: DONE
Summary: Six-agent deep scout confirms cmc-lms is live refined ops LMS and cmc_edu is money-gated ERP with thin LMS; merge must port unit-range/session/exercise/family domain under facility+RLS and extend provisionFromReceipt to grant unit ranges while preserving ADR 0041.
```
