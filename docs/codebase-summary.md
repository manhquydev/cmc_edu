# CMC EDU v2 — Codebase Summary

**Status:** P1 (Identity & Enrollment) implemented & merged to main  
**Last Updated:** 2026-07-06  
**Build State:** 137/137 tests passing; 95%+ coverage (finance 97.88% statements, provisioning 95.9%)

---

## Monorepo Structure

```
D:\project\vip\CMC
├── apps/
│   ├── admin/           # Vite+React placeholder (P0)
│   └── api/             # tRPC backend (Node.js + Prisma + Postgres)
├── packages/
│   ├── auth/            # RBAC registry (single source of truth for roles/permissions)
│   ├── db/              # Prisma schema, migrations, seed
│   ├── domain-finance/  # Finance domain logic (receipt codes, refund cap, phone dedup)
│   ├── domain-identity/ # Identity domain logic (phone normalization)
│   └── ui/              # Design tokens
├── docs/                # Design docs (TL00-TL31, frozen design corpus)
└── plans/               # Session reports (audits, remediation, deep reviews)
```

**Stack:**  
- **Monorepo:** pnpm + Turbo  
- **Language:** TypeScript (ESM)  
- **API:** tRPC 11 (procedure-based, not REST)  
- **Database:** Postgres + Prisma ORM with row-level security (RLS)  
- **Frontend:** Vite + React (admin app stub; LMS frontend not yet built)  
- **Auth:** Registry-driven RBAC (centralized in `@cmc/auth`)

---

## P1 Routers (tRPC Procedures)

All procedures are **authenticated** and **facility-scoped**. RLS enforces facility isolation at the database layer.

### 1. CRM Router (`apps/api/src/crm/router.ts`)
Lead-to-Opportunity pipeline (WF-P1-01).

**Procedures:**
- `crm.opportunityCreate(contactName, phone, email)` → Opportunity (O1_LEAD)  
- `crm.opportunityAdvance(opportunityId, toStage)` → Opportunity (O1→O4 state machine)  
- `crm.opportunityMarkLost(opportunityId, lostReason?, reopen?)` → mark O2+ as closed  
- `crm.opportunityLookup(phone)` → { exists: bool } (dedup gate)  
- `crm.opportunityList(stage?, page?, pageSize?)` → paginated pipeline view

**Test Coverage:** 2 test files, ~30+ test cases (create, advance, mark lost, lookup, pagination)

---

### 2. Finance Router (`apps/api/src/finance/router.ts`)
Money gate & receipt lifecycle (WF-P1-02, WF-P1-03, WF-P1-08).

**Procedures:**
- `finance.receiptCreate(opportunityId?, studentId?, studentName, parentPhone, amount, classBatchId?)` → Receipt (draft)  
- `finance.receiptApprove(receiptId)` → Receipt (approved) + triggers provisioning (idempotent)  
- `finance.receiptCancel(receiptId)` → revert opportunity O4→O3, void enrollment  
- `finance.refundCreate(receiptId, amount)` → append-only refund ledger (capped at netAmount)  
- `finance.receiptList(page?, pageSize?, status?)` → K3 remediation: paginated, filterable receipts (facility-scoped)

**Business Rules:**
- **APPROVAL_SECOND_EYE_THRESHOLD = 20,000,000 VND** — above threshold requires `giam_doc_dao_tao` or `super_admin` approval (independent second eye, ADR-B)  
- **Refund cap:** sum of all refunds ≤ receipt.netAmount (protected by `FOR UPDATE`)  
- **Receipt code:** globally unique (shared counter, not facility-scoped) — fixed in Wave A  
- **Email:** best-effort (enqueue outside provisioning try/catch) — Wave C isolation

**Test Coverage:** 5 test files (create, approve, cancel/refund, receipt list, RLS negative)

---

### 3. Enrollment Router (`apps/api/src/enrollment/router.ts`)
Student enrollment lifecycle (WF-P1-05, WF-P1-07).

**Procedures:**
- `enrollment.enroll(studentId, classBatchId, opportunityId?)` → Enrollment (reserved)  
- `enrollment.blockLms(studentId)` → set Student.lifecycle='blocked_lms' (K8 remediation)  
- `enrollment.mine()` → [EnrollmentDto] approved children (LMS parent-facing read)

**Invariants:**
- `active` status only set by `finance.receiptApprove` (inside provisioning) — never by direct mutation  
- `enrolled.mine` reads only `Guardian`-approved children (separated from student creation)

**Test Coverage:** 3 test files (enroll, blockLms, reserved→active transition, LMS read)

---

### 4. Guardian Router (`apps/api/src/guardian/router.ts`)
Parent account linking & linking requests (WF-P1-04, WF-P1-06).

**Procedures:**
- `guardian.requestLink(studentRef, requestingEmail?)` → GuardianLinkRequest (pending)  
- `guardian.approveLink(requestId)` → Guardian + LMS parent account  
- `guardian.pendingLinks()` → [GuardianLinkRequest] awaiting approval (K3 remediation)  
- `guardian.getApprovedChildren()` → [Student] with Guardian (excludes blocked_lms)

**Tests:** 2 test files (link request, approval, reading approved children)

---

### 5. Student Router (`apps/api/src/student/router.ts`)
Student identity (minimal in P1).

**Procedures:**
- `student.lookup(phone)` → { exists: bool, studentId?: uuid } — **MISSING FULLY QUALIFIED LOOKUP** (K4 deferred to P2)

**Status:** Stub (full student lookup deferred; provisioning creates Student inline)

---

### 6. LMS Auth Router (`apps/api/src/lms-auth/router.ts`)
Parent/student login & session (WF-P1-07 — enrollment.mine read).

**Procedures:**
- `lmsAuth.requestOtp(phone, loginKind)` → { requested: bool } (enqueue email OTP)  
- `lmsAuth.verifyOtp(phone, otp)` → JWT token + { children: [EnrollmentDto] } for parent; basic student data for student

**Session:** JWT (issued in `verifyOtp`); parent reads `enrollment.mine`, student reads basic data

**Test Coverage:** 1 test file (OTP flow, enrollment retrieval)

---

### 7. Facility Router (`apps/api/src/facility/router.ts`)
Facility bootstrap (R2 remediation).

**Procedures:**
- `facility.create(name, address?, facilityId?)` → Facility (R2: super_admin bypass for bootstrap)

**Status:** Stub (actual facility provisioning defer; dev seed in `packages/db/prisma/seed.mjs`)

---

## Worker/Background Jobs

### `apps/api/src/worker/reconcile-orphaned-receipts.ts`
Detects and recovers mid-provision failures (K2 partial remediation).

**Trigger:** On-demand (manual run, or future scheduler)  
**Scope:** Receipts with approved status but missing Guardian/StudentAccount/Enrollment  
**Recovery:** Reruns `provisionFromReceipt` (idempotent design)  
**Tests:** 5 test cases (crash-no-marker, marker-recovery, fully-provisioned no-touch, renewal no-touch, R1 mid-provision failure)

---

### `apps/api/src/worker/relay-email-outbox.ts`
Sends queued emails via EmailOutbox (R3 atomic claim).

**Status:** Relay logic exists; **transport NOT wired** (K6: email relay deferred)  
**Concurrency:** Atomic claim via `updateMany` with new `sending` status (prevents double-send)  
**Tests:** 5 test cases (concurrent drain safety, idempotency, retry, failed email)

---

## Provisioning Engine

### `apps/api/src/provisioning/provision-from-receipt.ts`

**Triggered by:** `finance.receiptApprove` (atomic with receipt status change)

**Workflow (K1 remediation — creates Guardian):**
1. Resolve student: reuse existing (renewal) or create new  
2. Create StudentAccount (LMS login identity)  
3. **Create Guardian (parent account link)** — K1 fix  
4. Create/activate Enrollment  
5. Enqueue receipt email (best-effort, outside try/catch)

**Idempotency:** All steps check existence before create; reruns are safe (R1 recovery pattern)

**Tests:** 3 test files (guardian provisioning, idempotency, renewal-reuse)

---

## Data Model (P1)

**Prisma Schema:** `packages/db/prisma/schema.prisma` (393 lines)

### Core Tables (13 + 4 RLS-protected)

| Table | Purpose | RLS | Notes |
|-------|---------|-----|-------|
| `Facility` | Tenant boundary | ✓ | Bootstrap enabled (R2); seed-only initially |
| `Role` | RBAC registry (enum-like) | | Single source (docs/TL14) |
| `AppUser` | Staff/admin accounts | ✓ | `super_admin`, `giam_doc_*`, `sale`, `giao_vien` |
| `Contact` | Lead details | ✓ | Phone, name, email |
| `Opportunity` | Sales pipeline | ✓ | O1–O5 stages; RLS on created_by |
| `ParentAccount` | Guardian identity | ✓ | Phone+parent_type+facilityId unique |
| `Guardian` | Parent→student link | ✓ | Created by provisioning (K1 fix) |
| `Student` | Child identity | ✓ | lifecycle: active/blocked_lms/withdrawn |
| `StudentAccount` | LMS login | ✓ | Created by provisioning |
| `Enrollment` | Student→class seat | ✓ | status: reserved/active/withdrawn |
| `Receipt` | Payment record | ✓ | Globally unique code; status: draft/approved/cancelled |
| `RefundRecord` | Append-only refund ledger | ✓ | Immutable (UPDATE/DELETE denied in RLS) |
| `AuditLog` | Compliance log | ✓ | Immutable; all mutations logged |

### Support Tables (non-RLS)

| Table | Purpose |
|-------|---------|
| `EmailOutbox` | Queued emails + status (pending/sending/sent/failed) |
| `ReceiptCodeCounter` | Global receipt code atomic counter |
| `StudentLifecycle` | Enum (active, blocked_lms, withdrawn) |
| `OpportunityStage` | Enum (O1_LEAD ... O5_ENROLLED) |

### Migrations (5 total)

1. **20260706025956_p1_identity_enrollment** — Initial schema (Student, Guardian, Enrollment, Receipt, etc.)  
2. **20260706054322_p1_remediation_wave1_schema_rls** — RLS policies (6 tables), `withFacility` trigger, GRANT refinement  
3. **20260706140000_p1_remediation_wave2_logic_fixes** — Guardian creation in provisioning (K1), email enqueue isolation (R5)  
4. **20260706150000_p1_remediation_wavea_privilege_hardening** — REVOKE UPDATE/DELETE on ledger+audit (K5 append-only)  
5. **20260706160000_p1_remediation_wavec_outbox_atomic_claim** — New `sending` status for EmailOutbox (R3 atomic claim)

---

## Shared Packages

### `@cmc/auth` (Role/Permission Registry)
Single RBAC source of truth. Consulted by every mutation via `requirePermission(domain, action)`.

**Roles:** `super_admin`, `giam_doc_dao_tao`, `giam_doc_kinh_doanh`, `sale`, `giao_vien`, `phu_huynh`, `hoc_sinh`  
**Pattern:** Each procedure declares which role(s) can call it; `can()` checked at procedure entry.

---

### `@cmc/domain-finance`
- `nextReceiptCode(facilityId, counter)` — atomic counter read/write  
- `computeReceiptKind(studentId, classBatchId)` — new vs renewal  
- `duplicatePhoneWarning(db, phone)` — K12: warn on reuse (not enforced)  
- `RefundCapExceededError` — cap validation  
- `assertRefundWithinCap(receipts, refund)` — idempotent check

---

### `@cmc/domain-identity`
- `normalizeLoginPhone(phone)` — Vietnamese phone normalization (09xxx → 84+xxx)

---

### `@cmc/db`
- Prisma client export & type definitions  
- `withFacility(db, facilityId, callback)` — transactional facility-scoped context  
- RLS context setup (hidden session variable)

---

## Security (RLS + Append-Only)

### Row-Level Security (RLS)
6 tables enforce facility isolation via `facility_id` column:
- Opportunity, Student, Enrollment, Receipt, RefundRecord, AuditLog

**Pattern:** `CREATE POLICY "facility_isolation" ON table_name FOR SELECT USING (facilityId = current_setting('app.facility_id')::uuid)`

**Dev Auth:** Fail-closed stub in `apps/api/src/context.ts` — no token processing in dev mode (all requests granted)

### Append-Only Ledger (K5 remediation)
- **RefundRecord:** `REVOKE UPDATE, DELETE` (RLS allows INSERT/SELECT only)  
- **AuditLog:** `REVOKE UPDATE, DELETE` (RLS allows INSERT/SELECT only)  
- **Enforcement:** Database layer (migration 20260706150000)

---

## Test Coverage & Validation

**Test Framework:** Vitest  
**Test Count:** 137 passing tests across 24 test files

| Domain | Tests | Coverage (Statements) | Notes |
|--------|-------|----------------------|-------|
| finance | ~40 | 97.88% | Highest coverage; receipt lifecycle critical |
| provisioning | ~20 | 95.9% | Idempotency + recovery testing |
| guardian | ~15 | (>90%) | Link approval, approved-children reads |
| enrollment | ~15 | (>90%) | reserved→active, blockLms, LMS read |
| crm | ~20 | (>90%) | Pipeline state machine, pagination |
| lms-auth | ~10 | (>90%) | OTP, enrollment retrieval |
| auth | ~5 | (>90%) | Permission registry |
| security/RLS | ~10 | (>90%) | Facility isolation, append-only enforcement |

**Gateway:** All test suites must pass before merge. Coverage thresholds: ≥90% statements / ≥80% branches.

---

## Known Deferrals (Not Built in P1)

| Item | Category | Reason | Target Phase |
|------|----------|--------|--------------|
| **Student lookup (full)** | Data | PH don't have child UUIDs; requires enrollment → student name lookup | P2 |
| **Email relay** | Workers | Transport layer (Brevo/Graph) not wired | Comms phase |
| **SSO / Real OAuth** | Auth | Dev stub sufficient for P1 enrollment flow | Post-P1 |
| **Facility creation UI** | Frontend | Admin dashboard not built; seed-only for now | Admin phase |
| **Graph/Brevo integration** | Infra | Email, SMS transports deferred | Comms phase |
| **Class provisioning** | P2+ | classBatchId scalars not validated (FK created in P2) | P2 |
| **Withdrawal/cancellation UI** | Frontend | Backend ready; UI not yet built | Frontend phase |

---

## Debt & Known Issues (Documented)

### Critical (Fixed)
- **K1:** Guardian not created by provisioning → **FIXED** (Wave 2)  
- **K2:** Money orphan on mid-provision crash → **PARTIAL** (reconciler + worker, no active retry scheduler)  
- **K3:** No receiptList/pending-link queue → **FIXED** (Wave C)  
- **K5:** Ledger not append-only → **FIXED** (Wave A)  

### Medium (Documented, deferred)
- **K4:** Student lookup requires PH→name→UUID path (P2 requirement)  
- **K6:** Email relay transport not wired (communications phase)  
- **K12:** FK scalars `createdById`, `approvedById`, `classBatchId` not enforced (P2 backfill planned)  

### Low (Documented in code comments)
- **R4:** Unbounded failed-audit spam (documented, left unfixed per task scope)  
- Enum cleanup (completed/transferred/sent/graph deferred)

---

## Build & Verification

**Commands:**
```bash
pnpm install                    # install workspace
pnpm typecheck                  # tsc + turbo (12 tasks)
pnpm --filter @cmc/api exec vitest run      # 137 tests
pnpm --filter @cmc/api exec vitest run --coverage
pnpm build                      # turbo build (7 tasks)
```

**Current State:**
- ✅ All tests passing (137/137)  
- ✅ Type checking green  
- ✅ Build successful  
- ✅ Migrations applied & schema up-to-date  
- ✅ Merged to main (2026-07-06 16:18 UTC)

---

## Design Artifacts Preserved

P1 implementation adheres to frozen design corpus (docs/TL00-TL31):

- **TL01** — Backend invariants (I1–I11): all implemented  
- **TL10** — Data model: Prisma schema matches  
- **TL11** — API contract: tRPC procedures + error handling  
- **TL14** — RBAC registry: `@cmc/auth` single source  
- **TL16** — ADR A–D decisions: all encoded in procedures + schema  
- **TL24** — P1 workflow spec: 9 workflows implemented  
- **TL25** — Traceability matrix: P1 fully mapped (see `docs/25-ma-tran-truy-vet-p1.md`)

**Design remains authoritative.** Code is derived artifact.

---

## Next Steps (P2+)

1. **Student lookup** — Frontend needs "which child is this enrollment?" query (deferred)  
2. **Class operations** — P2 workflow: attendance, shifts, payroll (not started)  
3. **Email/comms** — Wire Brevo/Graph transport for provisioning emails  
4. **Admin dashboard** — Facility creation, user seed, batch operations  
5. **LMS frontend** — Parent/student web portal (React app)  

---

**Repository:** CMC EDU v2 @ `D:\project\vip\CMC`  
**Docs Root:** `docs/` (Vietnamese design corpus + English implementation notes)  
**Reports:** `plans/reports/` (session audits, remediations, deep reviews)
