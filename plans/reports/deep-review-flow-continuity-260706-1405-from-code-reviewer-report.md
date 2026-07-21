# Deep Review — P1 Business-Flow Continuity (đứt gãy nghiệp vụ)

Branch: `feat/p1-identity-enrollment` · Scope: P1 identity & enrollment backend only · Lens: end-to-end operability as a real operator/parent · Read-only.

## Verdict (up front)

**P1 is NOT operable standalone as an end-to-end journey.** The money-gate + provisioning core correctly *creates rows*, but the parent-facing payoff — "log in and see my child" — is **unreachable in code**, and every second-actor review step (approve receipt, approve guardian link) has **no inbound work queue** to discover the item that needs review. Some breaks are genuine bugs; others are P1↔P2 seams that are only acceptable if explicitly documented as non-operable-yet. The `classBatchId` question is a *documented* seam; the guardian/provisioning disconnect is a *real bug*.

Severity counts: **3 CRITICAL (genuinely broken standalone) · 3 HIGH · 2 MEDIUM (seam / by-design).**

---

## CRITICAL — P1 genuinely broken standalone

### C1. Enrollment → pay → provision → parent-login → **see-child dead-ends at the last step**. Provisioning never creates the `Guardian` row the read gate requires. CONFIRMED
Journey 1 & 4, final step.

- The child-data read gate `getApprovedChildren` queries **only `Guardian` rows** (`guardian/approved-children.ts:39`). Both parent-facing reads flow through it: `lmsAuth.verifyOtp` profile picker (`lms-auth/router.ts:190`) and `enrollment.mine` (`enrollment/router.ts:68`).
- `Guardian` rows are created in **exactly one place**: `guardian.approveLink` (`guardian/router.ts:130`). Grep-confirmed no other writer.
- `provisionFromReceipt` (the auto-provisioning on receipt approval) creates `ParentAccount → Student → Enrollment(active) → StudentAccount` (`provision-from-receipt.ts:180-206`). It **never creates a `Guardian` row.** It links the parent to the child via `StudentAccount.parentAccountId` (`:155`) — a table the read gate **completely ignores**.

Result: a parent whose child was just provisioned by their own paid receipt logs in successfully (OTP works, `ParentAccount` exists) and sees **`children: []` — permanently**. The write side (`StudentAccount`) and the read side (`Guardian`) are disconnected. There is no reachable remediation in P1 (see C3/H1/H2 — the self-link path is itself dead). This is the single biggest flow-break: the entire enrollment machinery produces no visible outcome for the paying parent.

**This is a real bug, not a P1↔P2 seam.** Fix is inside P1: provisioning must also upsert a `Guardian` row (or the gate must honor `StudentAccount`). docs/02 §1 item 5 names exactly this failure mode ("auto-provision account, but the user hunts for a step that doesn't exist").

### C2. `finance.receiptApprove` — the money gate — has **no draft-receipt queue**; the second-actor approver cannot discover the receipt to approve. CONFIRMED
Journey 1, the money step.

- The approval separation-of-duties rule forbids `sale` from approving (`packages/auth/src/index.ts:47,50`) and forbids a GĐKD-only over-threshold approval (`finance/router.ts:166-173`). So the approver is a **different person** (kế toán / GĐĐT / GĐKD) than the sale who drafted.
- `receiptApprove` takes a `receiptId` (`finance/router.ts:125-127`). The **only** place a `receiptId` is emitted is the `receiptCreate` response DTO returned to **the drafter's client** (`:596-604`).
- Finance router exposes **only** `receiptCreate / receiptApprove / receiptCancel / refundCreate` (grep-confirmed). There is **no `receiptList`, no `receiptGet`, no draft queue.** `crm.opportunityList` returns opportunities but carries no receipt linkage.

Result: the approver has no procedure that returns "draft receipts awaiting my approval." The money gate cannot be reached by the person authorized to pass it, except by out-of-band ID passing. Standalone, the approve step stalls.

### C3. `guardian.approveLink` has **no pending-request queue**; staff cannot discover requests to approve. CONFIRMED
Journey via WF-P1-06.

- `approveLink`/`rejectLink` take a `requestId` (`guardian/router.ts:37-44`). The only emitter of `requestId` is the **parent's** `requestLink` response (`:95`), returned to the parent's LMS client, not to staff.
- Guardian router exposes only `requestLink / approveLink / rejectLink` (grep-confirmed). **No list of pending `GuardianLinkRequest` rows for staff.**

Result: even if a parent somehow filed a valid link request, no staff procedure surfaces it for review. The approve step is unreachable → no `Guardian` row is ever created via the intended path → compounds C1.

---

## HIGH

### H1. No student lookup/list anywhere → renewal receipts, `enrollment.enroll`, and parent self-link all hit a wall. CONFIRMED
Journeys 2 & 3.

There is **no** `studentList / studentGet / studentSearch / studentLookup` procedure (grep-confirmed; every `student.find*` is internal to a mutation). Every flow that needs a caller-supplied `studentId`/`studentRef` therefore has no legitimate source:

- **Renewal (Journey 3):** `receiptCreate.studentId` (`finance/router.ts:70`) is validated to exist (`:544-551`) — but the operator has **no way to obtain** an existing `studentId`. Wall at input time.
- **`enrollment.enroll` (Journey via WF-P1-05):** requires `studentId` (`enrollment/router.ts:16-20`). Same wall.
- **Parent `guardian.requestLink` (Journey 2):** requires `studentRef` as a **`z.string().uuid()`** (`guardian/router.ts:27`). A real parent cannot possibly possess their child's internal `Student` UUID; there is no code path that ever discloses it to them. Dead-end at step 1 of the self-link flow.

### H2. `requestLink.studentRef` contract is internally contradictory and unusable by a parent. CONFIRMED
- Input validation: `z.string().uuid()` (`guardian/router.ts:27`) — forces a `Student` UUID.
- Schema comment: "`studentRef` is the raw input the parent supplied (**e.g. student code**)" (`schema.prisma:302`).
- Router comment: "ASSUMPTION … `studentRef` is the target `Student.id` (UUID)" (`guardian/router.ts:5-9`).

A parent has a student *code* at best, never a UUID. As coded, the only accepted value is exactly the thing the parent can never have. This is a design dead-end, not just a doc mismatch — and it is the first step of the only path that creates `Guardian` rows, so it gates C1's remediation too.

### H3. `enrollment.enroll` (the pre-payment `reserved` hold) is dead for a **new** student — chicken-and-egg on `studentId`. CONFIRMED
- `enroll` creates a `reserved` (unpaid) seat and **requires** an existing `studentId` (`enrollment/router.ts:16,39-42`).
- A brand-new lead has **no `Student` row** until a receipt is *approved* — at which point provisioning creates the student already **`active`**, not `reserved` (`activate-enrollment.ts:63-70`).

So the `reserved`-before-payment state (WF-P1-05's stated purpose) is unreachable for new students; `enroll` is only usable for an already-provisioned (already-paid) student, which contradicts its "held, not fee-activated" intent (`schema.prisma:63-64`). Combined with H1 (no way to get the studentId anyway), `enrollment.enroll` is effectively inert in P1.

---

## MEDIUM — P1↔P2 seam / by-design (document, don't necessarily fix now)

### M1. `classBatchId` is an unvalidated free string with no P1 source — documented P1↔P2 seam. CONFIRMED as seam
- `ClassBatch` model does not exist; `classBatchId` is a plain scalar (`schema.prisma:187-188, 335-336`).
- `receiptCreate` requires it at runtime but only as `z.string().min(1)` (`finance/router.ts:74,517-519`); `enroll` as `z.string().min(1)` (`enrollment/router.ts:18`). No referential check (there is no table to check against). An operator can pass `"abc"`.
- Docs acknowledge this: WF-P1-05 "**Precondition: HS + lớp tồn tại**" (docs/24:124) and class creation is explicitly P2 (`class.create` owned by GĐĐT — docs/17:106, docs/24:283).

Assessment: this is an **expected seam**, but it means P1 has **no legitimate way to produce a valid class-linked enrollment** on its own — the value is opaque and unvalidated until P2 lands. Acceptable-for-now **only if** documented that P1 `classBatchId` is a placeholder and downstream class-linked reporting will dangle. It is not "P1 broken," but it is "P1 not truly end-to-end standalone."

### M2. Cancel/refund does **not** revoke LMS access; the `blocked_lms` gate has no writer. CONFIRMED
Journey 5.

- Genuine cancel (`void=false`, the default) withdraws the `Enrollment` but leaves `Student.lifecycle` untouched by design (QĐ 0024 — `finance/router.ts:341-375`). `void=true` sets lifecycle `withdrawn`.
- The read gate excludes only `blocked_lms` students (`approved-children.ts:42`). **No P1 procedure ever writes `blocked_lms`** (grep-confirmed: only read/comment references). So the "block LMS access" outcome is defined in the enum and the gate but is **unreachable**.
- Because the gate keys on `Guardian` rows + lifecycle (not enrollment status), a genuine cancel leaves any existing `Guardian` link intact and the student non-`blocked_lms` → `enrollment.mine` **still lists the now-`withdrawn` enrollment** and the child stays in the profile picker forever. A de-enrolled child is still "seen."

Assessment: partly by-design (QĐ 0024 keeps the identity), but the combination means "lose LMS access on cancel" is not achievable in P1, and a withdrawn child never disappears from the parent view. Note that in practice C1 masks this (no `Guardian` row is ever created, so the parent sees nothing anyway) — but if C1 is fixed without addressing M2, cancelled enrollments will linger in the parent view.

---

## Role reachability (Journey 7) — can each active role finish its core P1 job?

| Role | Core P1 job | Reachable standalone? |
|---|---|---|
| sale | create opp, advance O1–O4, draft receipt | **Partial.** Can draft; but drafted receipt then needs an approver who can't find it (C2). Cannot approve (by design). Cannot get `studentId` for `enroll` (H1/H3). |
| giam_doc_kinh_doanh / ke_toan / giam_doc_dao_tao | approve receipt (money gate) | **Blocked.** No draft-receipt queue (C2). Can only approve if handed a `receiptId` out-of-band. |
| giao_vien | (P1: only `guardian.approveLink`) | **Blocked.** No pending-request queue (C3). Core teaching job is P2, not built. |
| cskh / sale (guardian approve) | approve parent link | **Blocked.** No pending-request queue (C3); upstream `requestLink` is itself dead (H2). |
| super_admin | everything | Bypasses `can()` but hits the **same missing endpoints** — no list/queue exists to call. |
| parent (LMS) | log in, see child | **Blocked at payoff.** Login works; child list empty because provisioning never creates a `Guardian` row (C1); self-link path dead (H2). |

No active role can complete its core P1 job end-to-end without out-of-band ID passing or the missing list/queue endpoints.

---

## The docs/02 §1 "original sin" (Journey 6) — flows that run in backend but no user can initiate

Confirmed instances where the backend runs but no operator can trigger/complete via existing procedures:
- **Approve a receipt** — logic exists, no queue to find the receipt (C2).
- **Approve a guardian link** — logic exists, no queue to find the request (C3).
- **Parent sees provisioned child** — provisioning runs, but the read gate is fed by a table provisioning never writes (C1); the "create account" step the parent hunts for is exactly docs/02 §1 item 5.
- **Reserve a seat before payment** — `enroll` exists but is unreachable for new students (H3).

---

## Distinguishing broken-standalone vs expected-seam

- **Genuine P1 bugs (must fix to be operable):** C1 (provisioning ↔ guardian-gate disconnect), C2/C3 (missing review queues), H1/H2/H3 (no student lookup; UUID-only self-link; inert reserved-hold). These are *internal* to P1 and do not depend on P2.
- **Expected P1↔P2 seams (document, defer):** M1 (`classBatchId` opaque until `ClassBatch`/`class.create` land in P2). M2 is a hybrid — the `blocked_lms` gate having no writer and cancelled enrollments lingering is arguably P1's own gap, but revoke-on-cancel semantics tie into class-ops maturity.

## Recommended actions (priority order)
1. **C1:** Have `provisionFromReceipt` upsert a `Guardian(parentAccountId, studentId)` row (or make `getApprovedChildren` honor `StudentAccount` ownership). Without this, the whole enrollment→LMS journey yields nothing.
2. **C2/C3:** Add staff-facing list/queue procedures — draft receipts awaiting approval; pending `GuardianLinkRequest`s. These are the inbound work surfaces the second actors need.
3. **H1:** Add a facility-scoped `studentLookup`/`studentList` (by phone/name) so renewal, `enroll`, and staff cross-check have a source of `studentId`. Reconcile with the docs/08 §7 child-data boundary.
4. **H2:** Decide the real `requestLink` key (student code the parent actually has) and relax the `uuid()` validation accordingly; align schema comment, router comment, and validator.
5. **H3:** Clarify whether `reserved` pre-payment holds are in P1 scope; if so, provide a student-create path that precedes payment.
6. **M1/M2:** Document `classBatchId` as an opaque P1 placeholder; document that LMS-access revocation and `blocked_lms` are deferred, and decide whether withdrawn enrollments should drop out of `enrollment.mine`.

## Unresolved questions
- Is the `StudentAccount`-vs-`Guardian` split intentional (StudentAccount = login link, Guardian = data-access grant), such that provisioning is *supposed* to also create a Guardian? Or is `StudentAccount` meant to be the gate? (Determines C1 fix shape.)
- Are the missing list/queue endpoints deliberately deferred to a later P1 slice / FE-owned, or an omission? Their absence is what makes P1 non-operable today.
- Intended real-world source of `studentRef` for parent self-link (student code printed on a receipt/card?).
- Is `classBatchId` expected to remain an opaque string through all of P1, accepted as non-validated until P2?

Status: DONE
