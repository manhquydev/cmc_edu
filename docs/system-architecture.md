# CMC EDU v2 — System Architecture (As-Built)

**Date:** 2026-07-06  
**Phase:** P1 Identity & Enrollment (complete)  
**Build Status:** Merged to main, 137/137 tests passing

---

## Architecture Overview

CMC EDU v2 is a **monorepo, facility-scoped ERP/LMS** with phase-driven buildout:
- **P1 (now):** Identity & enrollment pipeline (lead → opportunity → receipt → active enrollment)
- **P2-P4:** Class operations, HR/payroll, redemption (designed, not built)

### C4 Model (TL09)

```
┌─────────────────────────────────────────────────────────────┐
│ External Systems (P2+)                                      │
│ - Brevo (email)  · Graph (SMS)  · Real SSO (OAuth2)        │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ CMC EDU Platform (Monorepo)                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Frontend (Vite+React)                               │  │
│  │ - Admin dashboard (P0 scaffold)                     │  │
│  │ - LMS portal (parent+student, P2+)                 │  │
│  │ - Uses tRPC client + JWT from lmsAuth              │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                      │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │ tRPC API (Node.js)                                  │  │
│  │ - 7 domain routers (crm, finance, enrollment, …)   │  │
│  │ - RBAC middleware (requirePermission)              │  │
│  │ - Facility scope enforcement (scoped context)      │  │
│  │ - RLS context injection (facility_id session var) │  │
│  │ - Worker orchestration (reconcile, email relay)    │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                      │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │ Prisma ORM + Postgres                              │  │
│  │ - 13 core + 4 support tables                       │  │
│  │ - Row-level security (6 tables)                    │  │
│  │ - Append-only ledger (RefundRecord, AuditLog)      │  │
│  │ - Migrations: 5 total (P1 + 4 remediation waves)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│ [Agent/MCP layer: NOT YET BUILT — TL04, TL13 deferred]    │
└─────────────────────────────────────────────────────────────┘
```

---

## Layers & Responsibilities

### 1. Frontend (Vite+React)
**Status:** P0 scaffold only (admin app stub)

- `apps/admin/` — placeholder Vite+React app  
- Entry: `apps/admin/src/main.tsx`  
- Uses `@cmc/ui` for design tokens  

**P2+ Requirements:**
- Parent portal: `enrollment.mine` (approved children list)  
- Opportunity kanban: `crm.opportunityList` (paginated)  
- Enrollment flow: forms for `enrollment.enroll`, `crm.opportunityCreate`  
- LMS parent dashboard: receipt history, student progress  

**Auth Integration:** Retrieves JWT from `lmsAuth.verifyOtp`, attaches to tRPC client

---

### 2. API Layer (tRPC 11)
**Status:** P1 complete, worker stubs

**Routing:**
```
tRPC root router (appRouter)
├── health             [public query]
├── crm                [5 procedures]
├── finance            [5 procedures]
├── enrollment         [3 procedures]
├── guardian           [4 procedures]
├── student            [1 procedure stub]
├── lmsAuth            [2 procedures]
└── facility           [1 procedure stub]
```

**Middleware Stack (per procedure):**
1. **publicProcedure** or **authenticated** — token validation (fail-closed dev stub)  
2. **requirePermission(domain, action)** — RBAC gate via `@cmc/auth` registry  
3. **scoped(ctx)** — extract facilityId (server-controlled, never client input)  
4. **withFacility** — set RLS session variable + transactional context

**Request Flow:**
```
Client → tRPC call
  ↓
tRPC middleware chain
  ├─ token validation
  ├─ permission lookup (@cmc/auth registry)
  ├─ facility scope resolution
  └─ RLS context setup
  ↓
Prisma (with RLS + transaction)
  ├─ SELECT/INSERT/UPDATE/DELETE (filtered by facility_id policy)
  ├─ Append-only enforcement (ledger tables)
  └─ Atomic mutations
  ↓
Response (DTO serialization)
```

---

### 3. Domain Logic (Shared Packages)

#### `@cmc/auth` (RBAC Registry)
**Single source of truth** for role/permission mapping (docs/TL14).

```typescript
// Pattern: each procedure declares required role(s)
requirePermission('crm', 'opportunityCreate')  // checks registry
```

**Roles (7 total):**
- `super_admin` — bypass most gates (bootstrap, hardening context)  
- `giam_doc_dao_tao` — director of education (approval authority, second eye)  
- `giam_doc_kinh_doanh` — business director (money gate, self-approval)  
- `sale` — sales staff (lead entry, opportunity advancement)  
- `giao_vien` — teacher (P2+ attendance, payroll input)  
- `phu_huynh` — parent (LMS: read enrollment, request link)  
- `hoc_sinh` — student (LMS: read self)  

---

#### `@cmc/domain-finance` (Money Logic)
Atomic financial operations, not tied to any table schema directly.

**Exports:**
- `nextReceiptCode(facilityId, counter)` — global receipt code counter (atomic)  
- `computeReceiptKind(studentId, classBatchId)` — detects new vs renewal  
- `duplicatePhoneWarning(db, phone)` — alerts on parent phone reuse (K12)  
- `assertRefundWithinCap(receipts, refund)` — ensures sum(refunds) ≤ receipt.netAmount  
- `RefundCapExceededError` — exception class

**Idempotency Pattern:**
- All functions accept transaction (Prisma.TransactionClient)  
- Check existence before create (safe to replay)

---

#### `@cmc/domain-identity` (Identity Logic)
Minimal (P1) — mostly handles phone normalization.

**Exports:**
- `normalizeLoginPhone(phone)` — Vietnamese phone format (09xxx → 84xxx)

---

#### `@cmc/db` (Database Layer)
Prisma schema + helper functions.

**Key Exports:**
- `PrismaClient` — configured with RLS + JSON logging  
- `withFacility(db, facilityId, callback)` — wraps transaction + RLS context  
- RLS policy templates (shared across migrations)

**RLS Setup:**
```sql
CREATE POLICY "facility_isolation" ON table_name
  FOR SELECT USING (facilityId = current_setting('app.facility_id')::uuid)
```

Policies applied to: Opportunity, Student, Enrollment, Receipt, RefundRecord, AuditLog

---

### 4. Database (Postgres)
**Status:** P1 schema complete + 5 migrations applied

#### Core Entity Groups

**Sales Pipeline (WF-P1-01):**
- `Contact` — prospect details (name, phone, email)  
- `Opportunity` — lead to O5_ENROLLED (RLS by facilityId)  
- Lifecycle: O1_LEAD → O2_CONTACTED → O3_TEST_SCHEDULED → O4_TESTED → O5_ENROLLED  

**Money Gate (WF-P1-02, WF-P1-03, WF-P1-08):**
- `Receipt` — payment record (draft → approved → cancelled, RLS)  
- `RefundRecord` — append-only ledger (UPDATE/DELETE forbidden)  
- `ReceiptCodeCounter` — global atomic counter (shared across facilities)  
- Invariants: receipt.code globally unique; sum(refunds) ≤ receipt.netAmount  

**Identity & Enrollment (WF-P1-04, WF-P1-05, WF-P1-06, WF-P1-07):**
- `Student` — child identity (lifecycle: active/blocked_lms/withdrawn, RLS)  
- `StudentAccount` — LMS login (created by provisioning)  
- `ParentAccount` — guardian phone identity  
- `Guardian` — parent→child link (approved or pending, created by provisioning)  
- `GuardianLinkRequest` — parent approval workflow  
- `Enrollment` — student→class seat (status: reserved/active/withdrawn, RLS)  

**Compliance:**
- `AuditLog` — immutable action log (append-only, RLS)  

**Support:**
- `AppUser` — staff/admin identity (no RLS, facility context via session)  
- `Facility` — tenant boundary  
- `EmailOutbox` — queued emails (status: pending/sending/sent/failed)  
- Enums: `OpportunityStage`, `StudentLifecycle`  

---

### 5. Workers (Async Jobs)

#### Reconcile Orphaned Receipts
**File:** `apps/api/src/worker/reconcile-orphaned-receipts.ts`

**Purpose:** Recover from mid-provision crashes (K2 partial mitigation).

**Trigger:** Manual run (scheduled executor not yet built)

**Logic:**
1. Find receipts with `status='approved'` but missing Guardian/StudentAccount/active Enrollment  
2. For each: rerun `provisionFromReceipt` (idempotent)  
3. Log recovery in AuditLog

**Tests:** 5 test cases (crash scenarios, fully-provisioned no-touch, renewal no-touch)

---

#### Email Relay
**File:** `apps/api/src/worker/relay-email-outbox.ts`

**Purpose:** Deliver queued emails from EmailOutbox.

**Status:** Relay logic ready; **transport layer NOT WIRED** (Brevo/Graph deferred).

**Concurrency Safety (R3 remediation):**
- Each worker replica claims rows via `updateMany({ where: { id, status: { in: ['pending','failed'] } }, data: { status: 'sending' } })`  
- Only claimer (count=1) proceeds to send  
- Prevents double-send in distributed setup

**Tests:** 5 test cases (concurrent drain, idempotency, failed email retry, retry limit)

---

## Provisioning Workflow (WF-P1-03)

The core of P1 — transforms approved Receipt → active Enrollment.

**Entry Point:** `finance.receiptApprove(receiptId)`

**Atomic Steps (all-or-nothing within transaction):**

1. **Claim Receipt**  
   - Verify `status='draft'`  
   - Set `status='approved'` + `approvedAt=now()`  
   - Atomic with receipt ID (preventing re-approval race)  

2. **Resolve Student**  
   - If `receipt.studentId` (renewal): reuse existing  
   - Else: create new Student (inline, unique per receipt)  

3. **Create StudentAccount** (K1 remediation)  
   - Phone from ParentAccount or request body  
   - One per student (unique constraint)  

4. **Create Guardian** (K1 remediation — **was missing**)  
   - Link `StudentAccount` to `ParentAccount`  
   - Approve linking  

5. **Create/Activate Enrollment**  
   - Set `status='active'`  
   - Unlock `enrollment.mine` read for parent  

6. **Enqueue Email** (R5 remediation)  
   - Outside try/catch (failure doesn't block enrollment)  
   - Records `email.enqueue_failed` if it throws (not `provisioning.retry_pending`)  

**Idempotency:**
- All creates check existence first  
- Replaying on same receipt is safe (Guardian already exists, Enrollment already active)  
- Used by reconciler for recovery

**Tests:**
- 3 test files dedicated to provisioning (guardian, idempotency, renewal)  
- 20+ scenarios covering new student, renewal, failure paths

---

## Security Controls

### Authentication (Dev Stub)
**Status:** Fail-closed, no token processing in P1.

**Mechanism:** `context.ts` checks for authorization header presence, accepts any UUID in dev mode.

**Upgrade Path:** Real OAuth2/SSO integration in P2+ (TL04 deferred).

### Authorization (RBAC Registry)
**Mechanism:** `requirePermission(domain, action)` checks `@cmc/auth` registry before procedure logic.

**Registry Entry Example:**
```typescript
{
  action: 'crm.opportunityCreate',
  roles: ['sale', 'giam_doc_kinh_doanh', 'super_admin']
}
```

**Single Source:** `packages/auth/src/index.ts` (documented in docs/TL14)

### Facility Isolation (RLS)
**Mechanism:** Database-level row filtering via Postgres RLS policies.

**Pattern:**
```sql
CREATE POLICY "facility_isolation" ON Opportunity
FOR SELECT USING (facilityId = current_setting('app.facility_id')::uuid)
```

**Enforcement Layers:**
1. tRPC middleware sets RLS context (UUID only, never client input)  
2. Prisma injects session variable before query  
3. Postgres enforces policy at row level

**Impact:** Out-of-facility record IDs are invisible (not "403 forbidden" — they're "not found").

### Data Integrity (Append-Only Ledgers)
**Mechanism:** Postgres REVOKE on UPDATE/DELETE for sensitive tables.

**Applied to:**
- `RefundRecord` — immutable refund history  
- `AuditLog` — immutable compliance log

**Migration:** `20260706150000_p1_remediation_wavea_privilege_hardening`

---

## Error Handling

**tRPC Error Types:**
- `badRequest` (400) — input validation, business rule violation  
- `forbidden` (403) — permission denied  
- `notFound` (404) — record not found (also masks RLS filters)  
- `conflict` (409) — uniqueness/state machine violation

**Pattern:**
```typescript
if (!opportunity) throw notFound('Opportunity not found.');
if (!canApprove) throw forbidden('Insufficient role for approval.');
```

**Testing:** Dedicated negative test files (`rls-negative.test.ts`, `security/` suite)

---

## Testing Strategy

**Pyramid (TL29):**
- **Unit (20%):** Domain logic, receipt code generation, phone normalization  
- **Integration (60%):** Procedure logic, multi-step workflows (receipt→enrollment), RLS enforcement  
- **End-to-End (20%):** Full user journeys (lead→receipt→active enrollment, cancellation, refund)

**Coverage Thresholds:**
- Statements: ≥90%  
- Branches: ≥80%  
- Special: finance ≥90/80, provisioning ≥90/75

**CI Integration:** Pre-merge gate (all tests must pass)

**Test Organization:**
- `*.test.ts` colocated with source  
- `test/db.ts` — shared test database setup  
- `vitest.config.ts` — isolated test environment per test file

---

## Deferred Components (P2+)

| Component | Status | Impact | Target |
|-----------|--------|--------|--------|
| **Real OAuth2/SSO** | Stub (fail-closed) | Auth only; no tenant isolation risk | P2+ |
| **Email/SMS Transport** | Relay logic ready, no transport | Parents don't receive emails | Comms phase |
| **LMS Frontend** | Not started | No user-facing enrollment | Frontend phase |
| **Admin Dashboard** | Scaffold only | No operator access to create facilities | Admin phase |
| **Graph/Brevo** | Not integrated | External service calls blocked | Comms phase |
| **AI Agent / MCP** | Not built | TL04/TL13 capabilities unavailable | Agent phase (TBD) |
| **Student Lookup API** | Stub (K4) | Parents can't query which child by UUID | P2 |
| **Class Provisioning** | Scalars only | classBatchId not validated (P2 backfill) | P2 |

---

## Deployment Model (Inferred)

**Type:** Facility-scoped multi-tenant SaaS

**Tenant Isolation:**
- Facility boundary enforced at:
  - RBAC (role membership scoped to facility)  
  - RLS (database row filtering)  
  - Session context (facility_id injected, never trusted from client)

**Scaling:**
- Postgres replication (standard RDS multi-AZ recommended)  
- tRPC server stateless (can horizontally scale)  
- Worker instances independent (reconcile + relay can run in parallel)

**Backup/Disaster Recovery:**
- PostgreSQL PITR (point-in-time recovery)  
- Append-only ledgers (RefundRecord, AuditLog) enable audit trail reconstruction  
- Migration history allows schema replay

---

## Known Limitations & Workarounds

| Issue | Mitigation | Planned Fix |
|-------|----------|-------------|
| **Email relay untested in prod** (transport stub) | Manual verification; no auto-send in P1 | Wire Brevo/Graph in comms phase |
| **Facility creation blocked (R2)** | Dev seed only; super_admin bootstrap gate exists | Admin CRUD endpoint in admin phase |
| **Student lookup missing (K4)** | Enrollment shows child by studentId; full search deferred | P2 API + UI |
| **No retry scheduler** (K2) | Manual `reconcile-orphaned-receipts` trigger | Background job queue in ops phase |
| **No real auth** | Dev stub accepts any header; RLS enforces tenant | Real OAuth2 in P2+ |
| **classBatchId not validated** | Scalars accepted; FK created in P2 | P2 data backfill + constraint |

---

## Code Organization Principles

**Cohesion:** Code grouped by domain (crm/, finance/, enrollment/), not layer.

**SOLID:**
- **S:** Each router owns one domain; `with Facility` isolates transactions  
- **O:** Domain packages (`@cmc/domain-*`) extend without modifying core  
- **L:** Procedures implement tRPC contract; easy to mock/replace  
- **I:** Shared `requirePermission` middleware; depends only on registry  
- **D:** RBAC registry injected; easier to test with mock registry  

**File Naming:** kebab-case TS files; routers, helpers, tests colocated per domain

**Test Cohabitation:** `foo.test.ts` next to `foo.ts` enables rapid feedback

---

## Development Workflow

**Local Setup:**
```bash
pnpm install                           # install workspace
pnpm --filter @cmc/db prisma generate # Prisma types
pnpm --filter @cmc/db prisma db seed  # seed local Postgres
pnpm dev                               # start tRPC server + watch
```

**Build & Verify:**
```bash
pnpm typecheck                         # TypeScript validation
pnpm test                              # vitest (all domains)
pnpm build                             # Turbo build (all packages)
```

**Database Migrations:**
```bash
pnpm --filter @cmc/db prisma migrate dev --name <description>
pnpm --filter @cmc/db prisma migrate deploy  # in CI/deploy
```

---

## Alignment with Design Corpus (TL00-TL31)

This implementation strictly follows the frozen design:

| Design Doc | Aspect | Implemented As |
|------------|--------|-----------------|
| TL01 | Invariants I1–I11 | Database schema + constraint tests |
| TL10 | Data model ERD | `schema.prisma` + Prisma migrations |
| TL11 | API contract | tRPC routers + error types |
| TL14 | RBAC registry | `@cmc/auth` package |
| TL16 | ADR A–D | Procedure implementations + tests |
| TL24 | P1 workflows | 7 routers (CRM, Finance, Enrollment, Guardian, LMS, Student, Facility) |
| TL25 | Traceability | Test coverage matrix aligns with workflow specs |

**Design as Authority:** Changes to procedures must first update design docs (TL24, TL11).

---

## Next Session Priorities

1. **Student lookup** — unblock parent enrollment query flow (K4)  
2. **Facility CRUD** — move bootstrap out of dev seed  
3. **Email transport** — wire Brevo/Graph + test end-to-end  
4. **Class management** — start P2 (attendance, shifts)  
5. **LMS frontend** — build parent portal (enrollment.mine, student dashboard)

---

**Last Updated:** 2026-07-06 by docs-manager subagent  
**Aligns with:** P1 backend complete state, commit 32147df (main branch)
