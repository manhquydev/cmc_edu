# system-architecture.md vs Code — Audit Report

Scope: `docs/system-architecture.md` only, per assignment. Report-only, no edits made.

## 1. Agent/MCP layer wording (line 50, 416)

**Doc claim:** `[Agent/MCP layer: NOT YET BUILT — TL04, TL13 deferred]` (C4 diagram, line 50) and Deferred table row `AI Agent / MCP | Not built` (line 416).

**Code reality — mismatch, blanket claim is inaccurate:**
- `packages/llm/src/index.ts` (103 lines) is a real, functional `LLMClient`: deterministic offline stub + a genuine OpenAI-compatible `/chat/completions` path gated by `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL`, with a PII guard (`pii-guard.ts`) and its own test file (`index.test.ts`). This is not a stub in the "not built" sense.
- `packages/mcp-server/src/index.ts` (44 lines) IS a genuine skeleton — file header explicitly says `WALK-PHASE STUB: @modelcontextprotocol/sdk is not yet installed`, real SDK wiring is commented out, and running it prints `{"status":"skeleton", ...}`. `tools.ts` (70 lines) defines tool metadata only.

**Verdict:** the doc's single blanket "NOT YET BUILT" line conflates two different components with different states. The LLM client layer is built and tested; only the MCP transport/SDK wiring is a skeleton. Doc wording should be split, not merged.

## 2. Router count (lines 35, 95-106)

**Doc claim:** "7 domain routers (crm, finance, enrollment, …)" (line 35) and an explicit list of 8 keys including `health` (lines 98-105).

**Code reality:** `apps/api/src/router.ts:59-121` — `appRouter` mounts **38 domain routers** (plus `health`): crm, finance, enrollment, guardian, lmsAuth, student, facility, facilityNetwork, course, room, classBatch, classSession, schedule, attendance, curriculumUnit, exercise, submission, assessment, reportCard, sessionEvidence, user, checkInOut, manualPunch, shift, compensation, compensationPolicy, salaryTier, payslip, kpi, gift, rewards, parentMeeting, testAppointment, afterSale, reconciliation, session, parentAccount, audit.

**Verdict:** confirmed stale, badly stale (7 vs 38 — ~5.4x). Predates all P2-P4/HR/admin work as team-lead context predicted.

## 3. Table counts / migration counts (lines 44, 47, 202)

**Doc claim:** "13 core + 4 support tables" (17 total, line 44), "Migrations: 5 total (P1 + 4 remediation waves)" (line 47), "P1 schema complete + 5 migrations applied" (line 202).

**Code reality:**
- `packages/db/prisma/schema.prisma`: `grep -c "^model "` → **50 models**.
- `packages/db/prisma/migrations/`: `ls -d */` → **35 migration folders** (from `20260706025956_p1_identity_enrollment` through `20260716130000_audit_log_indexes`, plus one dated `20260717...` migration_lock.toml touch).

**Verdict:** confirmed stale — tables 17 vs 50 (~3x), migrations 5 vs 35 (7x).

## 4. Known Limitations & Deferred Components tables (lines 407-454)

Checked each row against code:

| Row | Doc status | Code reality | Verdict |
|---|---|---|---|
| **Admin Dashboard** (line 414) | "Scaffold only \| No operator access to create facilities" | `apps/api/src/facility/router.ts` has real `create`/`update`/`list` mutations+query (lines 67-118+). `apps/admin/src/pages/admin/facilities.tsx` (223 lines) + `facilities.test.tsx` + `admin.routes.tsx` — a real, tested admin facility-management UI. `facility/network-router.ts` (127 lines) and `audit/router.ts` (49 lines) are also live routers (part of PR #34, "super-admin completion — facility mgmt, network CRUD, audit log"). | **STALE — confirmed mismatch.** Operator CAN create facilities today. |
| **AI Agent / MCP** (line 416) | "Not built" | See item 1 — LLM client built & tested; only MCP transport is skeleton. | **STALE — imprecise, see item 1.** |
| Real OAuth2/SSO (line 411 / 452) | Stub, fail-closed | Not independently re-verified this pass (out of the 5-item deep-dive per team-lead scope); consistent with `x-dev-user` header language elsewhere in this same doc (lines 63, 86) — no contradicting code found. | Not flagged — insufficient evidence of staleness found. |
| Email/SMS Transport, Graph/Brevo (lines 412, 415, 448) | Relay ready, no transport / not integrated | `apps/api/src/worker/relay-email-outbox.ts` doc text (line 259) itself says "Brevo for parent-facing, Graph for internal mailboxes" **wired**, which directly contradicts the Deferred-table row "Graph/Brevo | Not integrated | External service calls blocked" two sections later. This is an **internal self-contradiction inside the same file**, not something I could resolve from code alone (I did not find actual Brevo/Graph API-key wiring code in this pass — would need dedicated check of `apps/api/src/worker/email-transport.ts`, flagged as related by GitNexus hook but not opened this pass). | **Flag as ambiguous/self-contradictory — not independently resolved.** |
| Student Lookup API (line 417 / 450) | Stub (K4) | Not verified this pass. | Not flagged — no evidence gathered. |
| Class Provisioning (line 418) | Scalars only, classBatchId not validated | Not verified this pass. | Not flagged — no evidence gathered. |

## 5. Auth/RLS/security sections (lines 144-156, 191-198, 341-364)

**Roles list (lines 144-156):** doc lists 9 staff roles (`super_admin`, `giam_doc_dao_tao`, `giam_doc_kinh_doanh`, `sale`, `giao_vien`, `ke_toan`, `cskh`, `ctv_mkt`, `hr`) + 2 LMS-only (`phu_huynh`, `hoc_sinh`). `packages/auth/src/index.ts:11-19,28-32` role-array matches exactly (9 staff roles present verbatim). **Verdict: accurate, no mismatch found** — consistent with the separately-verified 9-role/5-active-role model per team-lead context.

**RLS table list (lines 197, 361-362) — confirmed stale, same pattern as tables/migrations:**

**Doc claim:** "Policies applied to: Opportunity, Student, Enrollment, Receipt, RefundRecord, AuditLog" (line 197) and "Row-level security (6 tables)" (line 45).

**Code reality:** `grep -c "CREATE POLICY" packages/db/prisma/migrations/*/migration.sql` → RLS policies exist on **37 tables**: AfterSaleCase, AppUser, Attendance, ClassBatch, ClassBatchCodeCounter, ClassSession, CompensationPolicy, Contact, Course, Enrollment, FacilityNetwork, FinalGrade, Gift, KpiScore, ManualAttendanceTicket, Opportunity, Payslip, QualitativeAssessment, Receipt, ReconciliationFlag, RefundRecord, Reward, Room, SalaryRate, SalaryTier, ScheduleSlot, SessionEvidence, SessionEvidencePhoto, ShiftGroup, ShiftRegistration, ShiftRegistrationEntry, ShiftTemplate, StarTransaction, Student, Submission, TestAppointment, TimePunch.

Additionally, **`AuditLog` — which the doc explicitly lists as RLS-policied (line 197, and again line 361 "Append-only ledger... AuditLog") — has NO `CREATE POLICY` or `ROW LEVEL SECURITY` statement anywhere in `packages/db/prisma/migrations/*/migration.sql`** (`grep -n "AuditLog" ... | grep -i "polic\|row level"` → zero matches). AuditLog's actual protection is the separate append-only REVOKE mechanism (correctly described elsewhere, line 358-362), not RLS — the doc conflates the two protections for this table.

**Verdict:** RLS table count confirmed stale (6 vs 37, ~6x), and the doc misstates AuditLog as RLS-protected when it is not (append-only REVOKE only).

---

## Summary of confirmed mismatches

1. Agent/MCP blanket "NOT YET BUILT" — imprecise; LLM client is real/tested, only MCP transport is skeleton.
2. Router count: doc says 7, code has 38.
3. Table count: doc says 17 (13+4), code has 50 models.
4. Migration count: doc says 5, code has 35 folders.
5. "Admin Dashboard: Scaffold only" — stale; real facility CRUD UI + routers exist (PR #34).
6. RLS table count: doc says 6, code has 37 policies.
7. AuditLog listed as RLS-protected — it isn't; it's append-only REVOKE only.
8. Internal self-contradiction: doc says Brevo/Graph "wired" (line 259) in one section, "Not integrated" (line 415) in another — unresolved by this pass, needs dedicated check of `email-transport.ts`.

## Not flagged (insufficient evidence gathered this pass)

- Real OAuth2/SSO stub claim (lines 411/452) — no contradicting code found, but not independently deep-verified.
- Student Lookup API stub claim (line 417/450) — not checked.
- Class Provisioning scalars-only claim (line 418) — not checked.
- apps/admin "~30 routes" claim (line 61) — not counted, out of the 5-item scope.

## Unresolved Questions

- Should `docs/system-architecture.md` be fully regenerated (given how stale nearly every count is — router/table/migration/RLS all off by 3-7x) rather than patched line-by-line?
- Does the Brevo/Graph self-contradiction (item 8) need a dedicated follow-up audit of `apps/api/src/worker/email-transport.ts`?

Status: DONE
Summary: Confirmed 7 stale/inaccurate claims in system-architecture.md — router count (7 vs 38), table count (17 vs 50), migration count (5 vs 35), RLS table count (6 vs 37 + AuditLog wrongly listed), Admin Dashboard "scaffold only" (real CRUD exists via PR #34), and an imprecise blanket "Agent/MCP not built" line (LLM client is real, only MCP transport is a skeleton). Role list and role-registry cross-check were accurate. Found one internal self-contradiction (Brevo/Graph "wired" vs "not integrated") left unresolved pending a dedicated check of email-transport.ts.
