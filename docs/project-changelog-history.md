# CMC EDU v2 — Project Changelog (Archived History)

**Scope:** Archived tail of `docs/project-changelog.md` — entries dated
2026-07-07 and earlier (P1 backend build, initial remediation waves, P2
foundation kickoff). Split out 2026-08-08 to keep the main changelog under
the docs size budget; no content was rewritten, only moved.

**Newer entries (2026-07-08 onward) → `docs/project-changelog.md`.**

---

## [2026-07-07] G0 — Xanh hoá main: test drift fixes + phase-01b alignment (PR #12)

**Test drift: giao_vien student.lookup (K4)**
- `packages/auth/src/index.ts:71-75` intentionally added `giao_vien` to `student.lookup` roster (attendance name resolution, RLS + facilityId predicate). Unit tests (`@cmc/auth`) and API integration tests (`student/lookup.test.ts`) were still asserting the old FORBIDDEN state.
- Fix: updated to assert allowed; added `cskh` deny guard to preserve K4 scope.
- Files: `packages/auth/src/index.test.ts`, `apps/api/src/student/lookup.test.ts`

**Test drift: kind:'student' two-tier auth (phase-01b)**
- Migration `20260707120000_phase01b_lms_auth_two_tier` added `kind` field to LMS sessions; `requireLmsStudent` now checks `kind !== 'student'` → FORBIDDEN before checking `!studentId` → BAD_REQUEST. All student-facing test callers used the default `kind:'parent'`, causing FORBIDDEN where tests expected success.
- Fix: added `kind:'student'` to all `studentCaller` helpers and inline `buildLmsContext` calls; 'no selected student' negative tests now use `kind:'student'` + no `studentId`.
- Files: `apps/api/src/exercise/open-tier.test.ts`, `rewards/redeem-refund.test.ts`, `submission/grade.test.ts`, `submission/annotate-submit.test.ts`, `submission/teacher-annotation.test.ts`

**domain-time: passWithNoTests**
- Package has no test files; `vitest run` exits 1 on no-match by default. Added `--passWithNoTests` (standard flag; does not suppress failing tests).
- File: `packages/domain-time/package.json`

**Result:** 402/402 tests green (net +1 from lookup test split); typecheck 26/26; build 14/14.

---

## [2026-07-07] Code-review bug fixes (retroactive harness pass, wave 2)

**PDF viewer always returning 400 in grading screen**
- Root cause: `listForGrading` returned only `exerciseId`; `handleExercisePdfGet` requires a `blobRef` starting with `exercise-pdf/` — a bare UUID never passes the check.
- Fix: added `include: { exercise: { select: { basePdfRef: true } } }` to `listForGrading`; grading.tsx now builds PDF URL from `item.basePdfRef` when non-null, else shows a "no PDF" message.
- Files: `apps/api/src/submission/router.ts`, `apps/admin/src/pages/teaching/grading.tsx`

**Fractional grading scores rejected by Zod schema**
- Root cause: `score: z.number().int()` rejected step-0.5 inputs the UI allows.
- Fix: removed `.int()` — `z.number().nonnegative()` accepts fractional scores.
- File: `apps/api/src/submission/router.ts`

**`requireLmsParent` extracted as shared guard function**
- Three procedures had inline kind-check duplicates: `setPhotoConsent`, `enrollment.mine`, `lmsAuth.resetChildPassword`.
- Fix: added `requireLmsParent(ctx): { parentAccountId }` to `trpc.ts` (symmetric with `requireLmsStudent`), replaced all three inline checks.
- Files: `apps/api/src/trpc.ts`, `apps/api/src/session-evidence/router.ts`, `apps/api/src/enrollment/router.ts`, `apps/api/src/lms-auth/router.ts`

**Timing oracle — network round-trip (no-parent branch)**
- Root cause: PBKDF2 equalization fixed CPU time but the no-parent branch issued 1 DB query vs 2 in the no-student branch — leaking phone/email existence via latency.
- Fix: added `await ctx.db.$executeRaw\`SELECT 1\`` in the no-parent branch to match query count.
- File: `apps/api/src/lms-auth/router.ts`

**`credentials` option invalid on tRPC v11 `httpBatchLink`**
- Root cause: tRPC v11 removed `credentials` as a top-level option; passing it caused TS2353.
- Fix: use custom fetch wrapper `fetch(url, { ...options, credentials: 'include' })`.
- File: `apps/admin/src/lib/trpc.ts`

---

## [2026-07-07] Security bug fixes (retroactive harness pass)

**HIGH-2: `enqueueReceiptEmail` was writing phone number as email `to` field**
- Root cause: function signature used `parentPhone: string` but `ReceiptRow` carries `parentEmail: string | null`.
- Fix: renamed param to `parentEmail: string | null`, added null-guard early-return (no outbox row when email absent).
- Files: `apps/api/src/finance/router.ts`, `approve.test.ts`, `enqueue-receipt-email-best-effort.test.ts`

**MEDIUM-1: `loginStudent` timing oracle — phone enumeration via latency**
- Root cause: `studentAccounts.length === 0` branch returned immediately without PBKDF2, making it ~70ms faster than wrong-password branch — phone existence leakable via timing.
- Fix: added `verifyPassword(input.password, DUMMY_PASSWORD_HASH)` equalization call before the throw.
- File: `apps/api/src/lms-auth/router.ts`

**Phase-06 gap: `parentAccount.updateEmail` UI was missing**
- Backend procedure existed; no UI called it.
- Fix: added "Cập nhật email" modal to parents page (approved tab, gated by `canDo('parentAccount','updateEmail')`).
- File: `apps/admin/src/pages/parents/index.tsx`

**Revenue report M1/M2: truncation warning + decorative FilterBar removed**
- M1: added yellow alert when `data.total > items.length` (PAGE_SIZE=100 hardcoded).
- M2: removed `RANGE_FILTER` constant and `FilterBar` import — range filter was decorative, query param never used in API call.
- File: `apps/admin/src/pages/finance/revenue-report.tsx`

**Receipt create M3: opportunityId UUID validation**
- Raw `?opportunityId=` query param now validated against UUID regex before use; malformed param silently dropped (server rejects anyway, but prevents arbitrary string in UI alert).
- File: `apps/admin/src/pages/finance/receipt-create.tsx`

---

## [2026-07-07] Phase summary index (Phases 01a–07)

### Phase 01a — Backend deltas
- SO receipt code format (`SO00001`), `canApprove` field on `ReceiptDto` (self-approval guard + over-threshold second-eye), `session.me` nav-gating endpoint.
- Teacher annotation column (`teacherAnnotationLayer`) on Submission; `submission.saveTeacherAnnotation` procedure.

### Phase 01b — LMS auth 2-tier
- Email-OTP login (`requestOtpEmail` / `verifyOtpEmail`) alongside existing phone-OTP; student direct password login (`loginStudent`, PBKDF2, `mustChangePassword` flag).
- Kind discriminator (`kind: 'parent' | 'student'`) in session tokens; `lmsAuth.resetChildPassword` parent-only gate; 15-minute lockout after 5 failed login attempts.

### Phase 02 — UI foundation
- Mantine v7 design system integrated; tRPC React client wired to API; 10 `@cmc/ui` components (Button, Input, Modal, Table, Badge, etc.).
- App shell (sidebar nav + auth guard), staff login screen, facility switcher.

### Phase 03 — Sales screens
- Receipt create/approve screens with `canApprove` hint and over-threshold warning dialog.
- CRM kanban board (O1→O5 drag-and-drop); over-threshold gate surfaced as a blocking modal before approve.

### Phase 04 — Teaching screens
- Class schedule view, session lifecycle controls (confirm/cancel/makeup).
- Attendance marking UI (present/absent/late per student), grading screen with PDF annotation viewer, report-card PDF export.
- Teacher cockpit: today's sessions, pending grading queue.

### Phase 05 — Ops / HR
- IP-based clock-in/out (`checkInOut`), shift registration and approval workflow, revenue reconciliation worker and flag-review UI.
- Payroll: compensation rates, payslip generation (gross → net), KPI score submit/confirm/approve/override pipeline.

### Phase 06 — Generic admin coverage
- 15 admin routes across user, room, course, facility CRUD; `parentAccount.updateEmail` backfill for LMS email-OTP login.
- Super-admin facility management screen.

### Phase 07 — LMS app (parent + student portal)
- Parent login (phone-OTP + email-OTP), profile picker, enrollment list, session-evidence feed with photo-consent toggle.
- Student login (password + `mustChangePassword` redirect), PDF exercise viewer, submission draft/submit, star balance + gift redemption flow.
- Consent settings screen; push-notification consent stub.

---

## [2026-07-06] P1 Backend Complete & Merged

### Commits

**Merge:** `32147df` — Merge PR #1 (feat/p1-identity-enrollment → main)  
**Branch:** `feat/p1-identity-enrollment` (5 commits, 4 remediation waves)

### What Shipped

**P1 Workflow Coverage (WF-P1-01 through WF-P1-07):**
- ✅ CRM pipeline (lead → O1..O5 opportunity stages)  
- ✅ Money gate (draft receipt → approved, idempotent provisioning, atomic claim)  
- ✅ Identity provisioning (student + guardian account creation)  
- ✅ Enrollment lifecycle (reserved → active, blockLms action)  
- ✅ Guardian linking (request + approval)  
- ✅ LMS auth (OTP login, enrollment list read)  

**Core Routers (7 total):**
- `crm` — 5 procedures (opportunityCreate, opportunityAdvance, opportunityMarkLost, opportunityLookup, opportunityList)  
- `finance` — 5 procedures (receiptCreate, receiptApprove, receiptCancel, refundCreate, receiptList)  
- `enrollment` — 3 procedures (enroll, blockLms, mine)  
- `guardian` — 4 procedures (requestLink, approveLink, pendingLinks, getApprovedChildren)  
- `lmsAuth` — 2 procedures (requestOtp, verifyOtp)  
- `student` — 1 stub (lookup)  
- `facility` — 1 procedure (create)

**Data Model:**
- 13 core tables + 4 support tables (Prisma schema `schema.prisma`)  
- 5 migrations applied (initial + 4 remediation waves)  
- RLS policies on 6 tables (Opportunity, Student, Enrollment, Receipt, RefundRecord, AuditLog)  
  > **Correction (2026-07-19):** the table list above is wrong — `AuditLog` never had RLS.
  > The wave-1 migration (`packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:105-133`)
  > actually enabled RLS on **Contact, Opportunity, Receipt, RefundRecord, Student, Enrollment**
  > (Contact was omitted above; AuditLog was wrongly included). `AuditLog` is a global
  > identity/audit table, deliberately excluded from RLS (same migration, lines 96-97) — its
  > immutability comes from a REVOKE UPDATE/DELETE grant instead
  > (`...20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:19`). Scope of
  > this correction is the wave-1 migration only, not a recount of all RLS tables today
  > (`@cmc/db`'s `system-architecture.md` lists the current full set).
- Append-only enforcement on ledger tables (RefundRecord, AuditLog)

**Domain Packages:**
- `@cmc/auth` — RBAC registry (7 roles, 20+ permission mappings)  
- `@cmc/domain-finance` — receipt code, refund cap, phone dedup  
- `@cmc/domain-identity` — phone normalization  
- `@cmc/db` — Prisma client + RLS helpers

**Test Coverage:**
- 137 tests across 24 test files  
- 95%+ statement coverage  
- 80%+ branch coverage (critical paths higher)  
- All test suites green

**Worker Infrastructure:**
- Reconcile orphaned receipts (mid-provision crash recovery)  
- Email relay (concurrent-safe claiming, delivery stub)

---

## [2026-07-06] Deep Review + Remediation Waves

### Session Context
4 code-review agents + 1 orchestrator identified **12 critical/high/medium findings**, then executed **5 targeted remediation waves** (A–C + deep review finalization). All fixes merged into single PR #1.

### Critical Findings (K1, K2, K3, K5) — Fixed

**K1: Guardian not created by provisioning**  
- **Impact:** Parents who paid had zero enrollment visibility (hidden from `enrollment.mine`)  
- **Root Cause:** `provisionFromReceipt` created StudentAccount but never Guardian  
- **Fix (Wave 2):** Added Guardian creation post-StudentAccount  
- **Commit:** `df2cc77`  
- **Tests:** guardian-provisioning.test.ts (5 test cases)  

**K2: Money orphan on mid-provision crash**  
- **Status:** Partial (reconciler + idempotent design; scheduler deferred)  
- **Root Cause:** Receipt approved atomically; provisioning in separate try/catch; no retry mechanism  
- **Mitigation:** 
  - Reconcile worker detects missing Guardian/StudentAccount/Enrollment  
  - Reruns `provisionFromReceipt` (idempotent design ensures safety)  
  - No active scheduler yet (manual trigger or future background job)  
- **Trade-off:** Money is safe; enrollment recovery requires ops intervention  

**K3: No receiptList/pending-link queue**  
- **Impact:** Approvers couldn't find receipts to approve; guardians couldn't find pending requests  
- **Fix (Wave C):** 
  - Added `finance.receiptList(page?, pageSize?, status?)` — paginated, filterable  
  - Added `guardian.pendingLinks()` — guardian requests awaiting approval  
- **Tests:** receipt-list.test.ts, pending-links.test.ts  

**K5: Ledger tables not append-only**  
- **Impact:** Audit trail mutable; possible finance fraud via UPDATE/DELETE  
- **Fix (Wave A):** 
  - Migration `20260706150000` — `REVOKE UPDATE, DELETE` on RefundRecord + AuditLog  
  - Enforced at Postgres ACL level (not just application logic)  
- **Tests:** append-only-privilege.test.ts  

### High Findings (R1–R5) — Fixed or Documented

**R1: Orphan detection query too narrow**  
- **Fix (Wave C):** Broadened CTE in reconciler to check Guardian/StudentAccount/Enrollment existence per resolved studentId  
- **Test:** reconcile-orphaned-receipts.test.ts "mid-provision failure" case  

**R2: Facility bootstrap deadlock**  
- **Fix (Wave A):** Added `super_admin` bypass in `requireValidFacility` (before existence lookup)  
- **Assumption:** Allows bootstrap of first facility without pre-existing Facility record  
- **Tests:** facility.test.ts (bootstrap + non-super_admin rejection)  

**R3: Email relay double-send race**  
- **Fix (Wave C):** Atomic claim via `updateMany` with new `sending` status  
- **Test:** relay-email-outbox.test.ts "concurrent drains" case  

**R5: Email enqueue mislabels provisioning failure**  
- **Fix (Wave 2):** Extracted `enqueueReceiptEmailBestEffort`; moved outside provisioning try/catch  
- **Tests:** enqueue-receipt-email-best-effort.test.ts  

**R4: Unbounded failed-audit spam**  
- **Status:** Documented, left unfixed (task scope: OPTIONAL)  
- **Note:** Receipts missing `classBatchId` fail every reconcile cycle; noted in code comments

---

## [2026-07-06] Verification & Gating

**Final Build State:**
```bash
✅ pnpm typecheck           — 12/12 tasks successful
✅ pnpm test                — 137/137 tests pass
✅ pnpm build               — 7/7 tasks successful
✅ prisma migrate deploy    — all 5 migrations applied
✅ Git status               — clean (no uncommitted changes)
```

**Coverage thresholds (per domain):**
- **finance:** 97.88% statements / 89.36% branches (gate: 90/80)  
- **provisioning:** 95.9% statements / 77.77% branches (gate: 90/75)  
- **All files:** 95.11% statements / 83.18% branches (gate: 90/80)

**Pre-merge Audits Passed:**
1. ✅ API contract audit (all 7 routers verified)  
2. ✅ Data model audit (schema matches ERD, RLS complete)  
3. ✅ Money/finance audit (receipt logic, refund cap, atomic claim)  
4. ✅ RBAC/RLS security audit (facility isolation, role registry)  
5. ✅ Data integrity audit (append-only, no orphan students)  
6. ✅ Flow continuity audit (full workflows end-to-end)  
7. ✅ Deep-review (orphan detection, integrity, flow completeness)

---

## [2026-07-06] Known Deferrals (Not Built in P1)

| Item | Category | Target | Reason |
|------|----------|--------|--------|
| **Student full lookup** (K4) | API | P2 | Parents lack child UUIDs; requires enrollment → name → UUID query |
| **Email transport** (K6) | Infra | Comms phase | Brevo/Graph not wired; relay logic ready |
| **Facility CRUD** (K7) | Admin | Admin phase | Only seed-based; super_admin bootstrap exists but no provisioning UI |
| **Real OAuth/SSO** | Auth | P2+ | Dev stub sufficient; full token processing deferred |
| **Class constraints** (K12) | P2+ | P2 backfill | FK scalars (`classBatchId`, `createdById`, `approvedById`) not enforced yet |
| **Withdrawal/cancel UI** | Frontend | Frontend phase | Backend ready; no UI yet |
| **P2-P4 workflows** | Features | Planned | Class ops, HR/payroll, redemption not started |
| **LMS frontend** | Frontend | Frontend phase | Parent/student portal not built |
| **Agent/MCP** | AI | TBD (TL04, TL13) | AI agent orchestration layer deferred |

---

## [2026-07-06] Debt Inventory

### Resolved This Session

✅ **K1** — Guardian creation missing (FIXED)  
✅ **K3** — No receiptList/pending-links (FIXED)  
✅ **K5** — Ledger not append-only (FIXED)  
✅ **R1** — Orphan detection too narrow (FIXED)  
✅ **R2** — Facility bootstrap deadlock (FIXED)  
✅ **R3** — Email double-send race (FIXED)  
✅ **R5** — Email enqueue false positive (FIXED)  

### Documented, Not Fixed (By Design)

⚠️ **K2** — Money orphan: partial mitigation (reconciler + idempotence; scheduler deferred)  
⚠️ **K4** — Student lookup: deferred to P2 (requires enrollment reverse-lookup)  
⚠️ **K6** — Email transport: deferred to comms phase (logic ready, transport stub)  
⚠️ **K7** — Facility creation: seed-only, CRUD deferred  
⚠️ **K8** — Block LMS missing writer → FIXED (enrollment.blockLms added)  
⚠️ **K9** — Cancel doesn't revoke LMS: deferred (enrollment.withdrawn logic ready)  
⚠️ **K10** — enrollment.enroll inert for new students → deferred (requires K4)  
⚠️ **K11** — opportunityList untested → FIXED (pagination + filter tests added)  
⚠️ **K12** — FK scalars unvalidated → deferred to P2 (accepted as scalars, backfill planned)  

### Low Priority

⚠️ **R4** — Unbounded failed-audit spam: documented, unfixed (optional scope)  

---

## [2026-07-05] Pre-Implementation State

### Initial Scaffolding (US-001, P0)
- ✅ Monorepo bootstrap (pnpm + Turbo)  
- ✅ tRPC + Prisma setup  
- ✅ Health check endpoint  
- ✅ Design tokens package (`@cmc/ui`)  
- ✅ RBAC registry foundation (`@cmc/auth`)  

### Design Corpus Frozen (TL00-TL31)
- 32 Vietnamese design documents completed  
- API contract defined (TL11)  
- Data model finalized (TL10)  
- Workflows specified (TL24, TL26-TL28)  
- Threat model complete (TL30)  

---

## [2026-07-06] Build Metrics Summary

| Metric | Value | Target |
|--------|-------|--------|
| **Tests Passing** | 137/137 | 100% |
| **Statement Coverage** | 95.11% | ≥90% |
| **Branch Coverage** | 83.18% | ≥80% |
| **Routers Implemented** | 7 | 7 (P1 scope) |
| **Procedures Total** | 25 | per TL11 spec |
| **Database Tables** | 17 (13 core + 4 support) | per TL10 |
| **Migrations Applied** | 5 | all P1 |
| **RLS Policies** | 6 tables | per TL01 security |
| **Critical Findings** | 12 found, 7 fixed in session | 0 remaining (K2 partial) |
| **Commits in Session** | 5 major (P1 scaffold → merge) | clean history |

---

## Version & Alignment

**CMC EDU Version:** v2.0.0-p1.1  
**Design Corpus:** TL00-TL31 (frozen; P1 implementation-complete)  
**Database:** Postgres 13+, Prisma 5.x  
**tRPC:** 11.x  
**Node.js:** ≥22 (ESM monorepo)

**Next Release:** P2 (class operations) — design complete, implementation to start

---

## References

- **Build Reports:** `plans/reports/` (24 session reports: audits, remediation, deep reviews)  
- **Design Docs:** `docs/` (TL00-TL31 + ADRs in `decisions/`)  
- **Code:** `apps/api/src/` (routers, provisioning, workers)  
- **Schema:** `packages/db/prisma/schema.prisma` + 5 migrations  
- **Tests:** 24 test files, 137 tests total  

---

**Compiled:** 2026-07-06 by docs-manager  
**Branch:** main (HEAD: 32147df)  
**Status:** P1 implementation complete, all gates passed, ready for P2 planning

## 2026-07-06 — P2-Foundation (class operations) merged to main (PR #2)
- Class-ops data model (Course/Room/ClassBatch/ScheduleSlot/ClassSession) behind RLS; class-code + atomic counter; auto-session generation (idempotent); room double-booking enforced on create AND regenerate; class-span capped.
- P1↔P2 seam closed: receipt/enrollment require a real same-facility ClassBatch (FK + validation).
- G1 merge-gate: 0 Critical/High; M1/M2 fixed, M3/L1/L2 backlogged (#10). 159 api tests pass.

## 2026-07-06 — T1: attendance + session lifecycle + e2e + CI (PR #3); T2-I: exercise foundation (PR #4)
- **T1:** attendance.mark/markAll/listBySession (5 gates, RLS), classSession lifecycle, e2e skeleton (2 paths), GitHub Actions CI, 176 tests + e2e 2/2.
- **T2-I:** @cmc/storage seam, global CurriculumUnit/Exercise (no-RLS), exercise CRUD, PDF upload (10MB), 192 api + 7 storage tests.

## 2026-07-07 — Phase-08: test-seam OTP + e2e security specs
- Test-seam OTP (`_testSeamCode` mode, fail-closed in production); 4 new e2e specs (lms-auth, finance-approval, kind-isolation, attendance-grading); e2e/src/db.ts seed helpers + cleanupFacility refactored.

---

**Pre-Implementation State (2026-07-05–07):** P1–P5 routers/schema/workers assembled (5 PRs/TL16 stack). Gaps: staff SSO, Brevo/Graph transport (P2+). Boot-checks wired; threat checklist live.
