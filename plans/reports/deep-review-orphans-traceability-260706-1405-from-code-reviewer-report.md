# Deep Review — Orphans & Traceability Closure (P1 backend, mồ côi hunt)

Branch: `feat/p1-identity-enrollment` · Read-only · Lens: orphaned / dead-end / gold-plated artifacts and broken requirement→code→test chains. Evidence is from ACTUAL code, not docs/claims.

Scope read: all 5 routers + `provisioning/`, `enrollment/activate-enrollment.ts`, `guardian/approved-children.ts`, `lms-auth/otp-hash.ts`, `trpc.ts`, `context.ts`, `router.ts`, `packages/db/prisma/schema.prisma`, `packages/auth/src/index.ts`, all 12 `*.test.ts`, 3 migrations. Compared against docs 00/07/10/11/14/23/24/25.

---

## (a) Orphan procedures

16 tRPC procedures exist. Reachability / gate / test matrix:

| Procedure | WF | RBAC/session gate | Test invocations | Status |
|---|---|---|---|---|
| `crm.opportunityCreate` | P1-01 | `crm.opportunityCreate` | 11 | OK |
| `crm.opportunityAdvance` | P1-01 | `crm.opportunityAdvance` | 24 | OK |
| `crm.opportunityMarkLost` | P1-01 | `crm.opportunityMarkLost` | 3 | OK |
| `crm.opportunityLookup` | P1-01 | `crm.opportunityLookup` | 2 | OK |
| **`crm.opportunityList`** | P1-01 | `crm.opportunityList` | **0** | **ORPHAN (untested)** |
| `finance.receiptCreate` | P1-02 | `finance.receiptCreate` | 20 | OK |
| `finance.receiptApprove` | P1-03 | `finance.receiptApprove` | 29 | OK |
| `finance.receiptCancel` | P1-08 | reuses `finance.receiptApprove` | 12 | OK (key reuse, documented) |
| `finance.refundCreate` | P1-08 | `finance.refundCreate` | 12 | OK |
| `enrollment.enroll` | P1-05 | `enrollment.enroll` | 12 | OK |
| `enrollment.mine` | P1-07 | `lmsProcedure` (no RBAC by design) | 8 | OK |
| `guardian.requestLink` | P1-06 | `lmsProcedure` | 11 | OK |
| `guardian.approveLink` | P1-06 | `guardian.approveLink` | 6 | OK |
| `guardian.rejectLink` | P1-06 | reuses `guardian.approveLink` | 1 | OK (key reuse, documented) |
| `lmsAuth.requestOtp` | P1-07 | `publicProcedure` (pre-auth by design) | 13 | OK |
| `lmsAuth.verifyOtp` | P1-07 | `publicProcedure` | 11 | OK |

**Finding A1 — CONFIRMED — `crm.opportunityList` is untested.** `apps/api/src/crm/router.ts:188-208`. It is the only paginated read in P1 (kanban screen `/crm/opportunities?view=kanban`, WF-P1-01) and its pagination math `skip: (input.page - 1) * input.pageSize` plus the `stage` filter and `contact` include are never exercised by any test (`crm/stage.test.ts` covers create/advance/markLost/lookup only). It is gated and reachable — this is a test-chain break, not a dead procedure. Severity: **Medium**.

No procedure is ungated-but-sensitive. `receiptCancel`/`rejectLink` deliberately reuse the `approve`/`approveLink` keys; `enrollment.mine`/`guardian.requestLink`/`lmsAuth.*` are LMS/public by design.

---

## (b) Orphan / write-only data structures

### Models

**Finding B1 — CONFIRMED — `Facility` is an island model.** `schema.prisma:114-118`. No app/package code ever creates or reads `Facility` (only `test/db.ts` fixtures + `db.facility.deleteMany`); no migration seeds it; **no FK anywhere references it** (`Contact.facilityId`, `Opportunity.facilityId`, `Receipt.facilityId`, `Student.facilityId`, `Enrollment.facilityId`, `Guardian.facilityId`, `GuardianLinkRequest.facilityId`, `RefundRecord.facilityId` are all plain scalars). `facilityId` originates only from the dev-session header (`context.ts`) / future SSO claim and is never validated against a real `Facility`. A typo'd or forged `facilityId` silently mints a phantom tenant whose data is invisible to every other tenant. Severity: **Medium** (multi-tenant integrity).

**Finding B2 — CONFIRMED — `EmailOutbox` is a dead-end (write + self-dedup-read only).** `schema.prisma:367-375`; written at `finance/router.ts:703` (`enqueueReceiptEmail`), read only by its own dedup raw query at `:697`. **Nothing in the repo relays it** — no consumer flips `pending → sent/failed` and no code sends the email. The enqueue satisfies the literal WF-P1-03 acceptance bullet "email queued" / catalog "outbox email" (docs/23 §12, docs/11 §5) and is proven by `finance/approve.test.ts:248`, so it is not gold-plating — but no parent ever receives the email in P1, and the delivery worker is unbudgeted and undocumented. Severity: **Low-Medium** (silent no-op notification).

**Finding B3 — CONFIRMED — `AuditLog` is write-only by app code.** 4 write sites; reads occur only in tests. By design — the consumer is WF-P1-09 reconciliation agent (read-only MCP), which is NOT built. Acceptable until P1-09. Severity: **Low**.

### Defined-but-never-written enum values

| Enum value | Written? | Read/consumed? | Status |
|---|---|---|---|
| `StudentLifecycle.blocked_lms` | **never by app code** | yes — filtered out in `getApprovedChildren` (`approved-children.ts:42`) | **B4 — write-never, dead filter branch** |
| `EnrollmentStatus.completed` | never | referenced only in comments | B5 — cosmetic (future lifecycle) |
| `EnrollmentStatus.transferred` | never | never | B5 — cosmetic |
| `ReceiptStatus.sent` | never | never | B5 — cosmetic |
| `EmailOutboxStatus.sent` / `.failed` | never | never | B6 — tied to dead outbox (B2) |
| `EmailTransport.graph` | never (only `'brevo'` hardcoded, `router.ts:706`) | never | B6 — cosmetic |

**Finding B4 — CONFIRMED — `blocked_lms` is set by no P1 code path.** Only a test hand-sets it (`lms-auth/login.test.ts:179`). The read-side filter exists and is tested, so the acceptance "lifecycle bị chặn không vào được" (WF-P1-07) is proven at filter level — but there is no P1 procedure to actually block a student, so the "block" half of the feature is absent (break-glass admin surface, ADR 0041, not built). Severity: **Low-Medium**.

### Columns

**Finding B7 — CONFIRMED — stale schema comment on `Receipt.studentId`.** `schema.prisma:179-184` says the renewal-reuse write path "lands in the next remediation wave; this column only holds the shape." It is live NOW: written in `receiptCreate` (`finance/router.ts:584`), read in provisioning reuse (`provision-from-receipt.ts:96`) and cancel rollback (`finance/router.ts:341`), and proven by `finance/renewal-reuse.test.ts`. Misleads maintainers. Severity: **Low** (doc drift). All other columns are written and read.

---

## (c) Orphan permissions

Registry (`packages/auth/src/index.ts`) has 10 keys. Every key is gated by ≥1 procedure; every gate resolves to a registered key.

- **Granted-but-unused: NONE.** All of `crm.opportunity{List,Lookup,Create,Advance,MarkLost}`, `finance.{receiptCreate,receiptApprove,refundCreate}`, `enrollment.enroll`, `guardian.approveLink` are consumed. `receiptApprove` is consumed twice (approve + cancel); `approveLink` twice (approve + reject).
- **Used-but-unregistered: NONE.** `receiptCancel`/`rejectLink` reuse registered keys intentionally.

Clean. One non-orphan drift note: registry grants `ke_toan` on `finance.receiptApprove` (`index.ts:50`) while docs/11 §5 says "v2: GĐKD — ke_toan deferred". Scope mismatch, not an orphan.

---

## (d) Unproven acceptance (broken requirement→code→test chains)

Walked every acceptance bullet in docs/24 + docs/23 §12:

| WF | Acceptance bullets | Proven? |
|---|---|---|
| P1-01 | no manual O5 / lost needs reason / lookup dedup / O5 only via approve | ✓ all — **except the kanban list read (A1) is untested** |
| P1-02 | prefill / warning-narrow / opportunityId set | ✓ (`create-from-opp.test.ts`) |
| P1-03 | sale forbidden / Student+ParentAccount+Enrollment(active)+**email queued** / no-rollback / self-approve audit | ✓ (`approve.test.ts` + `idempotent.test.ts:125` + F8 outbox `approve.test.ts:248`) |
| P1-04 | no orphan student / replay no-dup / error handling | ✓ (`idempotent.test.ts`, 5 cases) |
| P1-05 | **"reserved không điểm danh được"** / active⇔approved / legacy backfill | active⇔approved ✓; **"reserved can't attend" UNPROVABLE in P1** — attendance is P2, not built (cross-phase); backfill N/A (greenfield) |
| P1-06 | pending no child data / approve creates Guardian / reject | ✓ (`link.test.ts`, 8) |
| P1-07 | phone=login / picker≥2 / blocked can't enter / OTP expiry | ✓ (`login.test.ts`, 10) — blocked path proven at filter level (see B4) |
| P1-08 | refund≤netAmount / revert O4+clear closedAt / real-refund vs void archive | ✓ (`cancel-refund.test.ts`, 14) |

**Unproven:** A1 (opportunityList read); P1-05 "reserved không điểm danh được" (depends on P2 attendance — the enforceable P1 half is proven). Severity: Medium / cross-phase-deferred.

---

## (e) Gold-plating (reverse orphan — code no P1 requirement asks for)

- **E1 — Contract drift, `receiptCreate.studentId` input** (`finance/router.ts:70`): not in the docs/11 §5 catalog signature `{opportunityId?, studentName, parentPhone, amount, classBatchId?}`. Added for H3 renewal reuse; documented, but exceeds the published contract. Low.
- **E2 — Contract drift, `refundCreate.idempotencyKey` input** (`finance/router.ts:397`): catalog signature is `{receiptId, amount}`. Added (docs/11 §4 idempotency); documented but off-contract. Low.
- **E3 — Unpinned invented constants:** `APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000` (`finance/router.ts:34`), `OTP_REQUEST_COOLDOWN_SECONDS = 30`, `MAX_OTP_VERIFY_ATTEMPTS = 5` (`lms-auth/router.ts:45-48`). No decision doc fixes these; all self-declared placeholders. Acceptable but flagged — a threshold with no owner is a silent policy decision. Low.
- **E4 — `LmsSubject.studentId` optional field** (`trpc.ts:20`): never read anywhere (`mine`/`requestLink` use `parentAccountId` only). Dead field. Low/cosmetic.
- **E5 — `opportunityMarkLost.reopen`** (`crm/router.ts:64`): reopen-to-O2 path; present in the WF-P1-01 state diagram (docs/24) so likely in-scope, but no acceptance bullet names it and it is only lightly tested. SUSPECTED minor gold-plating. Low.

Note: `EmailOutbox` itself is NOT gold-plating (required by WF-P1-03 "email queued"); only its unused `graph`/`sent`/`failed` values are forward-looking (B6).

---

## (f) Dangling forward-refs (loose scalars referencing not-yet-built models)

| Scalar | Target model | Modeled? | App-side validation |
|---|---|---|---|
| `Receipt.createdById` | `AppUser` | no | none (taken from `ctx.subject.userId`, dev header) |
| `Receipt.approvedById` | `AppUser` | no | none |
| `Receipt.classBatchId` | `ClassBatch` | no | none — any string accepted as a class |
| `Enrollment.classBatchId` (NOT NULL) | `ClassBatch` | no | none — any string |
| `Receipt.studentId` | `Student` | yes | ✓ validated in `receiptCreate` (`router.ts:544`) — plain scalar, not a Prisma relation |
| all `facilityId` columns | `Facility` | yes but island (B1) | none anywhere |
| `GuardianLinkRequest.studentRef` | `Student.id` | yes | ✓ resolved in `requestLink` (`guardian/router.ts:63`) |
| `AuditLog.entity/entityId/actor`, `EmailOutbox.to`, `LoginOtp.phone` | polymorphic / free-form | n/a | by design |

**Nothing validates `classBatchId` or the `AppUser` id scalars.** `classBatchId` is a free-form required string on `Enrollment` and on approved `Receipt` — a receipt/enrollment can name a class that will never exist. Acknowledged in schema comments as awaiting the academic-domain phase; flagged here for the closure inventory. `Receipt.studentId` and `GuardianLinkRequest.studentRef` ARE validated app-side (good). `facilityId` is the one modeled-but-unvalidated target (B1).

---

## Ranked — the ones that MATTER

1. **B1 · Facility island model (Medium).** No FK, no writer, no validation of `facilityId` anywhere. Forged/typo'd facility silently creates an invisible tenant. Structural multi-tenant risk — real, not cosmetic.
2. **A1 · `crm.opportunityList` untested (Medium).** Only paginated read in P1; offset math + stage filter + permission gate all unexercised on a live kanban screen.
3. **B2 · EmailOutbox dead-end (Low-Medium).** Enqueue satisfies "queued" but no relay exists in the repo; parents never actually get the receipt email; delivery worker unbudgeted/undocumented — will surprise anyone who assumes notifications work.
4. **B4 · `blocked_lms` write-never (Low-Medium).** Filter exists and is tested, but no P1 path can block a student — the block half of the feature is absent.
5. **B7 · Stale `Receipt.studentId` schema comment (Low).** Claims the write path is future; it is live and tested now.
6. **E1/E2 · Off-catalog inputs (`receiptCreate.studentId`, `refundCreate.idempotencyKey`) (Low).** Documented but exceed docs/11 §5 contract.
7. **Cosmetic (Low):** unused enum values (`EnrollmentStatus.completed/transferred`, `ReceiptStatus.sent`, `EmailOutboxStatus.sent/failed`, `EmailTransport.graph`), dead `LmsSubject.studentId` field, unpinned constants (E3), `reopen` (E5), registry/doc `ke_toan` drift.

---

## Severity counts

- Critical: 0
- High: 0
- Medium: 2 (B1 Facility island, A1 opportunityList untested)
- Low-Medium: 2 (B2 dead outbox, B4 blocked_lms write-never)
- Low: 8 (B3, B5, B6, B7, E1, E2, E3, E4/E5 + catalog drift)

Permissions registry: **clean — zero orphan permissions.** All 16 procedures reachable from a P1 WF; 15/16 tested.

## Verdict

Traceability is substantially closed — every procedure maps to a WF, every permission is consumed, and the money-gate acceptance chains (P1-03/04/08) are genuinely proven, not phantom-tested. The real gaps are structural orphans the trace matrix (docs/25, which asserts "no blank cells") does not catch: an unvalidated `Facility` tenant boundary, one untested paginated read, and a notification outbox that enqueues into the void. None block correctness of the built flows; B1 and A1 warrant closing before this substrate is trusted for multi-tenant production.

## Unresolved questions

1. Is an EmailOutbox relay/delivery worker in P1 scope, or explicitly deferred? Nothing in-repo consumes the outbox.
2. Where is `Facility` meant to be created (seed / admin surface / SSO onboarding)? No writer exists.
3. Is `finance.receiptApprove` supposed to grant `ke_toan` (registry) or defer it (docs/11 §5)? The two disagree.
