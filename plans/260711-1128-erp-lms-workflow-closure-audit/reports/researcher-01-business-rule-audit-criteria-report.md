# Audit Criteria: Business Rules & Test Assertions for P1–P4 Workflows

**Purpose:** Define the ground-truth business rule for each of 28 workflows so test coverage can validate the **invariant**, not just "file exists". Each workflow's rule is sourced from TL19/20 (business rules), TL17 (role-workflow linkage), and TL25 (traceability matrix). Tests should assert the rule directly; missing test ≠ rule holds.

---

## Priority Focus: 6 High-Risk Workflows (User-Named)

### **P2-05: Submission—"Làm bài trên PDF & nộp"**
| Aspect | Detail |
|---|---|
| **Business Rule** | Learner annotates PDF (layer JSON) + optionalAnswerText; draft saved per `[exerciseId, studentId]` pair; submit transitions to `submitted` state & stamps `submittedAt`. Cannot re-submit once submitted. |
| **Invariant** | One `Submission` per student+exercise. `annotationLayer` is JSON schema (not plain string). `status: draft|submitted|graded` — no other states in lifecycle. |
| **Edge Cases (Test MUST Cover)** | (1) Concurrent draft saves (race) → version increments correctly, final annotation preserved. (2) Submit twice on same draft → 2nd submit rejected or idempotent (TL19 §3 silent on idempotency; **FLAG: ambiguous**). (3) Cross-student submission leak (student A sees B's annotations via API). (4) Transition from submitted back to draft (disallowed). (5) Submit when exercise unpublished (should fail gate per TL19 §4 condition). |
| **Coverage Gap** | No explicit idempotency guarantee or race-handling spec in TL19. |

### **P2-06: Grading—"Chấm bài & cộng sao"**
| Aspect | Detail |
|---|---|
| **Business Rule** | Giáo viên grades `Submission` (submitted→graded), records `Grade` (scale `maxScore`, default 10), increments star (`starReward`, default 10) via `StarTransaction` type `homework_completed`. Student sees Grade + stars; **does NOT see** `gradedById`, raw annotation, or grader identity. |
| **Invariant** | `Submission.status: submitted → graded` (one-way). `Grade.score` ≤ `Exercise.maxScore`. `StarTransaction` logged with type & student. Grader role validated (giao_vien only). |
| **Edge Cases (Test MUST Cover)** | (1) Grade same submission twice (prevent double-star or enforce single grade). (2) Cross-student grade visibility (GV grades A, B sees A's grade). (3) Grade without permission (wrong role, e.g., student or sale tries). (4) Concurrent grades on same submission → last-write-wins or conflict? (TL19 silent on race). (5) Star transaction appears in `StarTransaction` audit trail. (6) Star visible in LMS child profile (`submission.listForChild` returns `stars`, not `annotation`). |
| **Coverage Gap** | No explicit race-handling; **ambiguous whether concurrent grades use last-write-wins or reject**. |

### **P2-07: Assessment—"Nhận xét (AI nháp, GV chốt)"**
| Aspect | Detail |
|---|---|
| **Business Rule** | Agent generates draft comment (AI); **giáo viên confirms** (human gate—TL08 §7 dữ liệu trẻ). Workflow: draftComment → confirm. Student & parent see **only confirmed** comment. Draft never exposed to LMS. |
| **Invariant** | `QualitativeAssessment.status: draft|confirmed`. Confirm action restricted to `giao_vien` role (TL19 §6, TL08 §7). Draft comment **cannot be fetched by LMS** (`submission.listForChild` sees confirmed only). |
| **Edge Cases (Test MUST Cover)** | (1) Non-GV tries to confirm (should fail auth). (2) Parent/student sees draft comment (should not). (3) Confirm twice (idempotent or error?). (4) AI generates offensive draft, GV rejects/edits before confirming (editor UI not in scope per TL19, but confirm gate exists). (5) Concurrent confirm attempts → only one wins. (6) Confirmed comment immutable (GV cannot re-edit after confirm—**check if allowed or locked**). |
| **Coverage Gap** | **FLAGGED: TL19 does not specify if confirmed comment is immutable, or if GV can edit-then-re-confirm.** UI spec (TL06) needed. No explicit concurrency guarantee. |

### **P2-08: SessionEvidence—"Gửi ảnh & tóm tắt buổi cho PH"**
| Aspect | Detail |
|---|---|
| **Business Rule** | GV publishes per-session evidence: `summary` (public), `internalNote` (staff-only, NEVER to parent/LMS), photos (child images). Status: draft → published (stamps `publishedAt`, `publishedById`). **Parent sees published summary + photos of own child ONLY.** Other facilities/students' photos NEVER leak. `internalNote` is server-side staff-only. |
| **Invariant** | One `SessionEvidence` per `classSessionId`. `internalNote` field **not serialized** to LMS. Photos filtered by `getApprovedChildren` (TL17 §5 boundary). Published evidence immutable (no re-edit). |
| **Edge Cases (Test MUST Cover)** | (1) **Cross-facility leak**: Parent A (facility X) tries to fetch class session evidence from facility Y (should 403). (2) **Cross-student**: Parent A linked to students X and Y; can view photos of both, but NOT of Z (other parent's child). (3) `internalNote` in API response (should omit, never serialize). (4) Publish then unpublish (state machine: is draft→published one-way?). (5) Concurrent publishes on same session. (6) Parent tries to edit/reject evidence (should forbid). (7) Photos exist but exercise marked `absent` (TL17 §6 says "buổi absent không hiện khối ảnh"—gate in LMS query, not API). |
| **Compliance Risk** | Child image data (GDPR/local) — `internalNote` leak = data breach. Cross-facility leak = access control violation. Both are **P0 test assertions**. |
| **Coverage Gap** | **FLAGGED: Photo visibility gate described in TL17 LMS perspective but NOT in API spec. Test must verify API layer filters by `getApprovedChildren`**, not UI-only. |

### **P4-01: Rewards—"Đổi quà bằng sao"**
| Aspect | Detail |
|---|---|
| **Business Rule** | Learner redeems accumulated stars for gift. Workflow: `Reward` (pending → approved → delivered | rejected). On reject, stars refunded via `StarTransaction` type `gift_rejected_refund`. Gift stock decrements (or stays ∞ if `-1`). Learner can **request**, but **must be approved** by system/manager before fulfillment. |
| **Invariant** | `Reward.status: pending|approved|delivered|rejected`. Star balance = sum of all `StarTransaction` entries. Cannot redeem if stars < `Gift.starsRequired`. If `Gift.stock ≠ -1`, stock ≥ 0 post-redeem (no overbooking). |
| **Edge Cases (Test MUST Cover)** | (1) **Insufficient stars**: request 100 sao when balance 50 (reject immediately or queue?—TL20 §5 does not specify gating). (2) **Stock exhaustion**: last gift taken while second request pending (second gets rejected or bumped to waitlist?—**ambiguous**). (3) **Double redeem**: same `Reward` id approved twice (prevent via idempotent state or reject 2nd?). (4) **Refund idempotency**: reject gift twice → refund stars twice? (3) **Star balance underflow**: system credits/debits incorrectly (audit via transaction log). (5) **Race: approval + delivery**: both issued concurrently, state becomes inconsistent. |
| **Coverage Gap** | **FLAGGED: TL20 silent on whether pending request is gated at creation (insufficient stars immediately reject) or queued. Stock-exhaustion behavior (reject vs. waitlist) not specified.** |

### **P4-02: Gift Catalog—"Cấu hình quà đổi sao"**
| Aspect | Detail |
|---|---|
| **Business Rule** | GĐ (only) creates/updates gift: `name`, `imageUrl`, `starsRequired`, `stock` (-1 = unlimited), `minLevel` (tier req), `isActive` (boolean). Student sees only `isActive=true` gifts with `minLevel` ≤ current level & `stock > 0` (or `-1`). Archive (set `isActive=false`) removes from student view immediately. |
| **Invariant** | `Gift.starsRequired` ≥ 0. `Gift.stock` is int (≥ 0 or -1). `minLevel` aligns with curriculum tier (Tier A/B enum). Only `super_admin` or `giam_doc_*` can upsert (role check). |
| **Edge Cases (Test MUST Cover)** | (1) **Role boundary**: sale or giao_vien tries to create gift (should 403). (2) **Active→inactive mid-redemption**: GĐ archives gift while student has pending reward request (request approved with archived gift?—state?). (3) **Stock race**: two students redeem simultaneously, stock → 0; both succeed or one rejected (concurrent enforcement). (4) **Negative stock**: edit gift from stock=5 to stock=-1 mid-redemption (allowed, changes semantics to unlimited). (5) **minLevel boundary**: student at level Tier A tries to redeem Tier B gift (gate at view? at redeem?)—**ambiguous**. (6) **Historical redemptions after archive**: completed reward references deleted/archived gift (referential integrity—do we cascade delete or soft-delete?). |
| **Coverage Gap** | **FLAGGED: minLevel filtering (view vs. redeem gate) not explicitly specified. Stock race-condition during concurrent redeems not specified.** Cascade/soft-delete on archive not documented. |

---

## Remaining Workflows (22) — One-Liner Rules & Edge Cases

| WF ID | Business Rule | Key Edge Case / Coverage Gap |
|---|---|---|
| **P1-01** | Opportunity stage pipeline (O1→O5); sale moves cards in kanban; close=O5. | Cross-role edit (who can drag?); concurrent drag races. |
| **P1-02** | Create receipt from opp: prefill buyer, amount, dates per TL19 §2 code-gen. | Prefill from deleted opp; duplicate receipt from same opp. |
| **P1-03** | Receipt approval gate: notSelf + over-20M→GĐĐT + permission check (ADR-B). | Cross-facility approval leak; negative/zero netAmount edge case. |
| **P1-04** | Provision account idempotent on phone key (atomic INSERT…ON CONFLICT). | Duplicate phone provision races; phone format normalisation (84xxx). |
| **P1-05** | Enroll: reserved→active transition triggered by receiptApprove (ADR-A). | Concurrent receipt approve + enroll state race; revert if receipt cancelled. |
| **P1-06** | GuardianLinkRequest: PH requests link, staff approves (gate chống nhầm). | Parent requests link to unrelated child (auth check?); concurrent approve/reject. |
| **P1-07** | Parent login: email+OTP or SĐT+OTP per product-decision 2026-07-07. | OTP expiry/reuse (🚨 **blocked-on-comms**: email OTP non-functional—ConsoleTransport stub). |
| **P1-08** | Receipt cancel→refund: revert O4 if single receipt (I3); netAmount frozen. | Cancel already-approved receipt (state?); refund > payment edge case. |
| **P1-09** | Finance reconciliation (read-only MCP audit by GĐKD/agent). | Cross-facility data visibility; no mutation → low risk. |
| **P2-01** | Class batch auto-gen sessions: class code per QĐ 0036, sessionEndUtc ICT-based. | DST boundary (ICT has no DST); session count mismatch semester length. |
| **P2-02** | Attendance mark: gate = session exists + not cancelled + enrollment active + session.facilityId server-derived. | Mark absent then uncancel session (state?); facilityId spoofing via client (must server-derive). |
| **P2-03** | Exercise open gate: published + Tier A (full batch when sessionEndUtc passed) OR Tier B (makeup + present status). | Makeup session for absent student (Tier B open gate = makeup + attended?); concurrency of session end. |
| **P2-04** | Exercise publish: GĐĐT/LMS uploads basePdfRef, status draft→published (soft gate per TL19 §3). | Publish unpublished exercise; PDF URL expiry/corruption. |
| **P2-05** | **[Priority—see above]** | — |
| **P2-06** | **[Priority—see above]** | — |
| **P2-07** | **[Priority—see above]** | — |
| **P2-08** | **[Priority—see above]** | — |
| **P3-01** | Checkin: client IP vs. FacilityNetwork CIDR/IP; match=auto, no match=manual (QĐ 0034). | IP spoofing (trust proxy header?); IPv6 CIDR support. |
| **P3-02** | Manual punch (checkin method=manual): only direct manager approves (no self-approval per QĐ 0034). | Manager's manager approves (role chain?); concurrent reject+approve. |
| **P3-03** | Shift registration: SINGLE (sale) vs. MULTIPLE (GV) selection per ShiftGroup.selectionMode. | Cross-group misregistration (sale tries MULTIPLE); ticket-lock 1 draft+1 pending. |
| **P3-04** | Shift approval: managerId then fallback to GD by group (GĐKD/GĐĐT). | Missing managerId (no fallback?); circular managerId chain. |
| **P3-05** | Payroll finalize: penalty 500đ/min late (post-tax), bucket by ICT month; reopen recalc from live punch. | DST boundary (ICT no DST, so clean); double-finalize (prevent or idempotent?). |
| **P3-06** | KPI: auto-score + override per tree, feed into lương cap kpiMax. | Circular override chain; concurrent score+approve. |
| **P4-01** | **[Priority—see above]** | — |
| **P4-02** | **[Priority—see above]** | — |
| **P4-03** | Parent meeting: schedule + complete (lifecycle); Communication agent sends reminders (TL4). | Past-date schedule (validation?); concurrent complete + cancel. |
| **P4-04** | Test appointment: entrance (O3) or periodic; link CRM + assessment tracking. | Appointment after enrollment ends; no-show idempotency. |
| **P4-05** | After-sale: sale owns case (cskh role gác per ADR-D); only GĐ sets student lifecycle via `setStudentLifecycle`. | Sale tries lifecycle change (should 403); closed case re-open. |

---

## Flagged Ambiguities & Spec Gaps (for audit focus)

| WF | Issue | Severity | Source |
|---|---|---|---|
| P2-05 | Idempotency of submit (can retry or 2nd attempt = error?) | HIGH | TL19 §3 silent; code behavior TBD |
| P2-06 | Concurrent grade race (last-write-wins vs. conflict?) | HIGH | TL19 §6 silent |
| P2-07 | Confirmed comment immutability (re-edit allowed post-confirm?) | **MEDIUM** | TL08 §7 · UI spec gap |
| P2-07 | Concurrency: two GVs confirm same comment | MEDIUM | TL19 §6 silent |
| P2-08 | Photo visibility gate at API layer (not UI-only filter) | **HIGH** | TL17 §6 describes LMS view only; API spec must clarify `getApprovedChildren` boundary |
| P2-08 | Absent session photo hiding (LMS query gate documented; API edge?) | MEDIUM | TL17 §6 conditional ("buổi absent không hiện khối ảnh") |
| P4-01 | Stock exhaustion + pending queue behavior | **HIGH** | TL20 §5 does not specify: reject immediately or waitlist? |
| P4-01 | Insufficient-stars gating (at request creation or queue?) | HIGH | TL20 §5 silent |
| P4-02 | minLevel filtering: at view-time or redeem-time? | MEDIUM | TL20 §5 does not distinguish |
| P4-02 | Stock race during concurrent redeems | MEDIUM | No concurrency spec |
| P4-02 | Archive cascade/soft-delete on gift deletions | MEDIUM | Not documented |

---

## Recommendation

**High-priority test specs to write first:**
1. P2-08 (session evidence): API cross-facility/cross-student leak tests + internalNote omission.
2. P2-05/P2-06: Concurrency (race on submit/grade).
3. P4-01/P4-02: Stock exhaustion + race during redeem; minLevel boundary.
4. P2-07: Concurrency + immutability post-confirm.

**Blocked questions for stakeholder:**
- P2-05: Idempotent submit, or reject 2nd attempt?
- P2-06: Concurrent grades: last-write or conflict?
- P2-07: Post-confirm edit allowed?
- P4-01: Insufficient stars / stock-exhaust: fail immediately or queue?
- P4-02: minLevel: view-time filter or redeem-time gate?

---

**Sources:** TL19 (business rules P1), TL20 (business rules P2), TL17 (role-workflow linkage), TL25 (traceability matrix), TL08 §7 (child data governance), TL21 (coverage gaps).

**Status:** Report defines audit criteria. Next phase: scan code + test files to collect evidence for each rule.
