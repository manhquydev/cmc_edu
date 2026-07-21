# RED-TEAM Attack Report — Master Execution Roadmap (plans/260706-1803-master-execution-roadmap)

Reviewer: code-reviewer (adversarial, read-only). Scope: plan.md + 8 phase files vs ground truth
(apps/api/src, packages/{auth,db}, docs/08/16/19/20/22/25/26/27/28/29/30, docs/decisions/0042).
All factual checks below were grep/read-verified, not assumed.

---

## Ranked findings

### CRITICAL

**C1 — phase-03 §Schema/§Procedures: Tier A/B is operationally unreachable — no procedure ever sets `ClassSession.curriculumUnitId`, creates makeup sessions, or cancels sessions.**
- What breaks: ADR 0038 Tier A requires a non-makeup session *teaching a unit* to have ended; Tier B requires an `isMakeup` session. T2 adds the `curriculumUnitId?` column but NO procedure to assign it. No phase (G1/T1/T2) adds `classSession.addMakeup` or `classSession.cancel` — verified: `apps/api/src/class/*` has zero makeup/cancel procedures; `isMakeup` defaults false and is never writable via API. TL26 WF-P2-01 explicitly says "Buổi bù (`isMakeup`) thêm riêng" and its state machine has planned→confirmed→cancelled transitions — all unreachable.
- Concrete failure: T2 tests and the e2e flow (publish→open Tier A→submit→grade) will seed these columns directly in the DB, pass green, and the roadmap declares 28/28 — while in production no exercise can ever open (Tier A) and no makeup flow (Tier B) or session-cancel exists. Textbook phantom coverage. Also T1's gate-1 test ("cancelled → BAD_REQUEST") guards a state nothing can produce.
- Severity: **Critical**.
- Fix: add `classSession.assignUnit` (GĐĐT), `classSession.addMakeup`, `classSession.cancel` to T1 or T2 scope with perms + tests, and require the e2e to drive Tier A through the real assign/cancel procedures.

**C2 — phase-04 (T3): TL08 §7 hard requirement "cơ chế đồng thuận & thu hồi đồng thuận" for child photos is silently dropped.**
- What breaks: docs/08 §7 (cited by the phase itself as "CỨNG") mandates a parental consent + consent-revocation mechanism for child data/photos ("cần cơ chế đồng thuận & thu hồi đồng thuận", verified docs/08:66-67; echoed TL19 §6b "ảnh trẻ cần đồng thuận"). T3's SessionEvidence/SessionEvidencePhoto scope has no consent model, no consent gate on publish/read, no revocation path.
- Concrete failure: phase merges "green" while violating the project's own hard child-data constraint; retrofitting consent later forces schema + read-path rework on the most sensitive tables. The plan's invariant line ("dữ liệu trẻ TL08 §7") gives false assurance because the phase's acceptance list doesn't contain consent at all.
- Severity: **Critical** (hard-invariant violation baked into the plan).
- Fix: add per-student photo-consent (grant/revoke by approved guardian or recorded staff consent) + "no consent → photo excluded from publish/read" test to T3 scope, or raise it as an explicit product stop-condition before T3.

### HIGH

**H1 — Grade/FinalGrade/computeFinalGrade is owned by NO phase, but three design docs require it.**
- TL19 §6: graded → "ghi `Grade`/`FinalGrade`"; TL26 WF-P2-06 acceptance: "Grade ghi nhận"; TL26 WF-P2-02: attendance bucket "feed computeFinalGrade"; TL29 §1 unit tier explicitly lists `computeFinalGrade`. T2's schema has only `Submission.score` — no Grade/FinalGrade model, no computeFinalGrade anywhere in T1..PD.
- Concrete failure: roadmap acceptance "28/28 + TL25 không ô trống" is claimed while WF-P2-06's own acceptance fails; the ICT-month attendance bucketing built in T1 feeds a function that never exists.
- Fix: add Grade/FinalGrade + computeFinalGrade (pure, unit-tested) to T2, or descope explicitly with a doc-change decision (this is a product decision → stop-condition, not an executor guess).

**H2 — phase-05 P3a "Nối dev-session → AppUser" is a suite-wide breaking change disguised as a bullet.**
- Enforcing "userId trong header phải là AppUser thật" invalidates every existing integration test context (P1/P2 tests use arbitrary UUIDs — 157 tests across 24 files) and the T1/T2 e2e dev-auth flows built two phases earlier. The FK backfill of `Receipt.createdById`/`Attendance.markedById` also hits rows created by T1/T2 e2e runs with random ids.
- Concrete failure: P3a blows up mid-flight into a repo-wide test-harness refactor the estimate doesn't contain; under the "no-ask" protocol the executor will either weaken the enforcement or half-migrate the suite.
- Fix: scope an explicit "test-harness AppUser seeding helper + e2e auth rework + FK backfill script" task inside P3a with its own acceptance.

**H3 — phase-06 P4a: `Gift.minLevel` has no data source — level system was cut.**
- TL19 §6d: LevelProgress **removed** from v2 ("giữ bảng DB, không build UI/nghiệp vụ"); verified `Student` model has no level column and no phase builds levels. Yet P4a redeem must "check … minLevel" (also in TL28 — the contradiction lives in the corpus and the plan inherits it unresolved).
- Concrete failure: executor invents level semantics on a money-adjacent gate (stars), or hardcodes minLevel=0 silently — either way an unreviewed product decision.
- Fix: pre-resolve now: drop the minLevel check in v2 (align with the LevelProgress cut) or name the level source; one line in phase-06 Pre-resolved.

**H4 — T1/T2/T3 grant facility-wide teacher access to child data — violates TL08 §7 "quyền truy cập hẹp (GV lớp)", and the plan never tightens it.**
- docs/08 §7: photos/comments/records open only to "GV lớp" (the class's teacher), directors, own parents. T1 `attendance.mark`, T2 `submission.grade`, T3 `assessment.*`/`sessionEvidence.*` all gate on role `giao_vien` only — teacher↔class binding is impossible before P3 (`ClassBatch.teacherId` is a dangling scalar until AppUser exists), and no later phase adds an ownership check retroactively.
- Concrete failure: any teacher in a facility can mark/grade/draft assessments/publish photos for any child in any class, permanently — the sequencing gap becomes the shipped authz model.
- Fix: add a "teacher-of-class ownership check" follow-up task in P3 (after teacherId becomes a real FK) covering attendance/grade/assessment/evidence, or document the deviation as an accepted product decision.

**H5 — "GĐ" permission roster is ambiguous across four sensitive procedures; no `GĐ` role exists.**
- Verified `packages/auth/src/index.ts`: roles are super_admin, giam_doc_kinh_doanh, giam_doc_dao_tao, … — no plain "GĐ". Plan assigns "GĐ" to: `user.manage` (P3a), `compensation.upsertRate` (P3d), `kpi.approve` (P3d), `gift.upsert/archive` (P4a), `student.setLifecycle` (P4c). TL27/TL28 say "GĐ" too, so the docs don't resolve it. Precedent conflicts both ways: `enrollment.blockLms` = GĐKD+GĐĐT; `facility.create` = super_admin only.
- Concrete failure: executor guesses rosters for salary-setting and child-lifecycle procedures — exactly the class of authz decision that must not be guessed.
- Fix: one table in plan.md pre-resolving the exact roster (e.g. GĐ := {giam_doc_kinh_doanh, giam_doc_dao_tao}) per procedure.

### MEDIUM

**M1 — phase-05: no e2e for TL29 §1 critical paths "chấm công" and "duyệt ca".** TL29 names them as E2E-tier critical; P3's phase file has integration tests only. Roadmap acceptance claims a full pyramid. Fix: add 2 API-driven e2e flows to P3 acceptance.

**M2 — phase-05 P3d: payslip/punch READ paths unspecified — salary privacy relies on facility-level RLS, which is insufficient.** Any role with a payroll read perm in a facility sees everyone's slips; neither TL27 nor the plan defines self-only/manager-chain read. Fix: pre-resolve payroll/punch read rosters (self + direct manager chain + GĐ) with a negative test.

**M3 — phase-03: StarTransaction is treated as a money-like ledger but append-only is not mandated.** TL10 §4 "Sổ tiền append-only"; refund idempotency (P4a "hoàn sao đúng 1 lần") only holds if rows are immutable. No phase requires INSERT/SELECT-only GRANT (no UPDATE/DELETE) on StarTransaction. Fix: add "StarTransaction append-only + least GRANT + no UPDATE/DELETE" to T2 invariants and G-review lens.

**M4 — phase-06 P4a review gate under-scaled vs its own rule.** plan.md §4: money-touching phases get mandatory adversarial review; stars are soft money with a concurrent-redeem race and refund idempotency, yet P4a gets "adversarial … nếu reviewer rảnh, không bắt buộc". Fix: make adversarial review of P4a mandatory (small diff, cheap).

**M5 — phase-07: recon thresholds and flag idempotency unspecified.** ">N lần", ">X giờ" have no values; worker runs every 60s with no unique/open-flag dedup rule → flag spam or duplicate queue rows. Contradicts plan.md's "mọi quyết định thường đã pre-resolved". Fix: pre-resolve N/X defaults + unique `(kind, refId, status=open)` dedup.

**M6 — phase-07: agent principal claimed "CHỈ ĐỌC finance + audit" but the worker WRITES ReconciliationFlag rows; and adding role `ai_agent_recon` contradicts the 9-role discipline.** `packages/auth` comment: "Do not add roles here without an ADR" (docs/14 catalog). The read-only negative test as specified would fail against the worker's own inserts. Fix: write decision doc (0043: agent principal, allowed writes = its own flag table) and phrase the negative test as "no mutation outside ReconciliationFlag".

**M7 — phase-06 P4b: "nhắc qua EmailOutbox" hides a scheduler.** A meeting reminder is time-based; the existing relay worker only drains queued rows (verified `apps/api/src/worker/relay-email-outbox.ts`). Nothing scopes who enqueues at T-minus. Executor will enqueue at scheduling time (wrong semantics) or build an unscoped worker. Fix: pre-resolve reminder rule (e.g. worker scan: meetings within 24h → enqueue once, dedup key).

**M8 — phase-06 P4b: "no_show cập nhật CRM" under-specified against the O-stage state machine.** TL28 says only "CRM cập nhật". Auto-mutating Opportunity stage risks colliding with the P1 invariant O5 ⇔ approved receipt (I-invariants, QĐ0024). Fix: pre-resolve to a non-stage effect (activity/note or a `lastTestResult` field), explicitly forbidding stage transitions.

**M9 — phase-02: T1's gate list drops TL19 §5's "lifecycle hợp lệ".** TL19 §5 requires student active **và lifecycle hợp lệ**; T1's five gates check enrollment status only — a `withdrawn`/`blocked_lms` student with a stale active enrollment is markable. Fix: add gate 6 (student lifecycle) or a one-line rationale why enrollment status subsumes it.

**M10 — phase-05: notifications (TL20 §8b: `manual_punch_pending/resubmitted/rejected`, `shift_reg_submitted/approved/rejected`) silently dropped.** TL27 exceptions name them; no phase mentions any notification mechanism for P3. Fix: pre-resolve (EmailOutbox rows now vs explicit descope note in phase file).

**M11 — CI arrives only at PD.** Every phase merges to main gated solely by locally-run checks under a no-human-ask protocol; a skipped/hidden failure has no independent net for the entire roadmap. Fix: pull a minimal typecheck+test GitHub Action forward to G1 (hours, not days).

**M12 — plan.md acceptance "traceability TL25 không ô trống" is unverifiable as stated.** TL25 already declares itself "ĐÓNG HOÀN TOÀN" with *target* spec paths; phases rename perms (TL25: `assessment.*`, `grade` → plan: `exercise.manage`, `submission.grade`) and test paths (`attendance/gate.spec` → `src/attendance/gate.test.ts`) with no mapping rule, so the closing check is manual and drift-prone. Fix: add a per-phase "TL25 row → actual perm/test path" mapping line in each phase's acceptance.

### LOW

**L1 — phase-02 e2e: OTP retrieval needs a DB-read seam** (OTP only lands in LoginOtp/EmailOutbox); not scoped — small but the first e2e task will stall on it.
**L2 — phase-08: "Entra SSO thật … session ký + hết hạn cho staff & LMS" is a subsystem compressed into one checklist bullet**; it also invalidates the dev-header e2e auth again (second rework after P3a). Acceptable as deploy-gated, but the estimate is misleading.
**L3 — phase-02: `attendance.mark` roster adds GĐĐT beyond TL25's `giao_vien`** — fine, but document the expansion so the TL25 close-out doesn't flag it.
**L4 — phase-03: `exercise.manage` grants a facility-scoped role (GĐĐT) write access to GLOBAL tables (Exercise/CurriculumUnit, no RLS)** — cross-facility blast radius by design (QĐ0021/0022 single shared curriculum), but worth one sentence acknowledging it in T2 so the reviewer doesn't "fix" it into per-facility.

---

## What the plan gets RIGHT (verified — do not regress while fixing)

- **Factual claims check out:** exactly 157 api tests (counted); `enrollment.blockLms` exists with roster GĐKD+GĐĐT + tests; relay worker + reconcile-orphaned-receipts worker exist; `lmsProcedure`/`requirePermission`/`can()` registry/`withFacility`/ict-time helpers all present; second-eye threshold (`APPROVAL_SECOND_EYE_THRESHOLD`) implemented with H1 tests; OTP has app-level attempt lockout; `hr` deferred claim matches ADR-D ("giữ trong registry, deferred").
- **QĐ0021/0022 citation is correct** (docs/10 §4, docs/19 §1): CurriculumUnit/Exercise global without RLS is the documented decision, not an invented shortcut.
- **ADR 0038 rendition in T2 is verbatim-faithful** (Tier A non-makeup ended-ICT, Tier B per-student via Attendance, cancelled opens nothing, blocked-lifecycle base condition).
- **WF coverage at the WF level is complete:** G1→P2-01, T1→P2-02, T2→P2-03..06, T3→P2-07..08, P3→P3-01..06, P4→P4-01..05, P5→P1-09; P1-01..08 on main = 28/28. No whole workflow is dropped (the gaps are sub-elements — C1/H1/C2).
- **Sequencing spine is sound:** StarTransaction in T2 before P4 redeem; markedById as scalar in T1 with FK debt paid in P3; rule-based recon before any LLM; blob/LLM behind seams with real providers gated on credentials (correct stop-conditions); regenerate-sessions is additive (`createMany skipDuplicates` — verified), so T1's Attendance FK is not endangered by re-generation.
- **G1 review lens targets the real hot spots** (counter atomicity, RLS fail-closed on 5 new tables, seedClassBatch regression across 13 P1 test files, room-conflict boundary).
- **Risk-scaled review + periodic flow-continuity pass** is the right lesson from P1; keep it (just fix its P4a application, M4).

---

## Severity counts & verdict

| Severity | Count |
|---|---|
| Critical | 2 (C1 unreachable Tier A/B + missing session lifecycle procedures; C2 child-photo consent dropped) |
| High | 5 (H1 Grade/computeFinalGrade unowned; H2 P3a suite-wide break; H3 minLevel orphan; H4 teacher-scope authz; H5 "GĐ" roster ambiguity) |
| Medium | 12 (M1–M12) |
| Low | 4 (L1–L4) |

**Verdict: FIX-BEFORE-EXECUTE.**
G1 may proceed as written (its scope is unaffected by any finding). Before T1 starts, the plan needs:
C1 (add session assign-unit/makeup/cancel procedures to T1/T2), C2 (consent scope or product stop),
H1 (Grade decision), H5 (roster table), H3 (minLevel pre-resolve), H4 (post-P3 ownership task), and
H2 (P3a migration task). Mediums are one-line pre-resolves in phase files — cheap now, expensive as
mid-phase guesses under a no-ask protocol.

## Unresolved questions (product-level, cannot be resolved from repo)
1. Is Grade/FinalGrade genuinely descoped from v2, or must T2 build it? (H1 — contradicting docs)
2. What is the consent mechanism of record for child photos — guardian-initiated in LMS, or staff-recorded? (C2)
3. Who exactly is "GĐ" per sensitive procedure? (H5)
4. Does minLevel survive the LevelProgress cut? (H3)
