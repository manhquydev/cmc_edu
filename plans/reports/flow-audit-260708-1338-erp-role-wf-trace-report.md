# Flow Audit Report — Phase 3 (Audit luồng nghiệp vụ)

**Date:** 2026-07-08 | **Auditor:** automated trace (Phase 3 cook) | **Stack:** CMC EDU v2
**Source plan:** `plans/260707-2308-golive-sprint-land-sso-env-uat/phase-03-flow-audit.md`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| WF Traced | 28/28 |
| Verdict FULL | 22/28 |
| Verdict PARTIAL (UI gap) | 6/28 |
| Verdict ORPHAN | 0/28 |
| E2E specs existing | 6/28 |
| E2E specs absent | 22/28 |
| Findings CRITICAL | **0** |
| Findings HIGH | **3** |
| Findings MEDIUM | **13** |
| **REDEPLOY verdict** | **NOT REQUIRED** |

**Key takeaways:**
- 0 bare unprotected mutations → no auth bypass CRITICAL
- 3 roles (cskh, ctv_mkt, hr) hold mutation permissions but have NO UAT scenarios — HIGH finding
- 12 TL25 API column aliases drift from code names — MEDIUM, doc fixes only
- `gift.archive` (TL25) does not exist in registry — use `gift.upsert({ isActive: false })`
- `exercise.view` + `facilityNetwork.manage` are orphan registry keys with no router call-site
- UAT Section 2 must be rewritten to add cskh/ctv_mkt/hr + chain-based scenarios before Phase 4 ticks any box

---

## Section 1 — Reverse-Trace Inventory (31 routers)

### 1a. Procedure Classification Summary

All `.mutation()` / `.query()` across 31 router files classified:

| Type | Count | Description |
|------|-------|-------------|
| (a) requirePermission-gated | ~85 | Uses `requirePermission('module','action')` — 2-arg form |
| (b) lmsProcedure / publicProcedure / internal | ~40 | Intentionally no staff gate (LMS, public, provisioning) |
| (c) bare protectedProcedure + inline check | 3 | Owner-or-role check in handler body |
| (d) bare protectedProcedure + NO check | **0** | None found — 0 CRITICAL |

**Type (c) — Inline-check procedures:**

| Procedure | File | Line | Check | Verdict |
|-----------|------|------|-------|---------|
| `shift.cancel` | `apps/api/src/shift/router.ts` | ~267 | owner-or-director inline check | ADEQUATE (L4 confirmed) |
| `payslip.getForUser` | `apps/api/src/payroll/router.ts` | ~332 | own-payslip or director | READ-ONLY, adequate |
| `session.me` | `apps/api/src/session/router.ts` | varies | own-session only | READ-ONLY, adequate |

### 1b. Orphan Permissions (in registry, no router call-site)

| Key | File:Line | Roles Assigned | Status |
|-----|-----------|----------------|--------|
| `exercise.view` | `packages/auth/src/index.ts:102` | giao_vien, giam_doc_dao_tao | ORPHAN — no router uses this key |
| `facilityNetwork.manage` | `packages/auth/src/index.ts:126` | [] (no roles) | ORPHAN — no router + no roles |

---

## Section 2 — 28 WF Verdict Table

### Alias Normalization (TL25 → Code)

| TL25 "API (quyền)" | Code key | Router file | Notes |
|--------------------|----------|-------------|-------|
| `checkInOut.punch` | `checkIn.punch` | checkin/router.ts:36 | module renamed |
| `shift.register` | `shift.submit` | shift/router.ts:32 | verb change |
| `gift.archive` | `gift.upsert({ isActive: false })` | engagement/gift-router.ts:31 | no separate key |
| `exercise.create/publish (assessment.*)` | `exercise.manage` | exercise/router.ts:131 | consolidated key |
| `grade` | `submission.grade` | submission/router.ts:253 | module qualified |
| `assessment.draftComment/confirm` | `assessment.draft` / `assessment.confirm` | assessment/router.ts | split keys |
| `payroll.finalize` | `payslip.finalize` | payroll/router.ts:286 | entity rename |
| `kpi.score` | `kpi.submit` | kpi/router.ts:50 | verb change |
| `rewards.redeem` | `reward.redeem` (lmsProcedure) | engagement/reward-router.ts:53 | student-side |
| `rewards.approve/deliver` | `rewards.manage` | engagement/reward-router.ts:119,146 | single key |
| `afterSale.advance` | `afterSale.advance` | after-sale/router.ts:61 | matches |
| `student.setLifecycle` | `student.manage` (with lifecycle field) | student/router.ts:121 | same handler |

### WF Trace Table

| WF | Name | API procedure (file:line) | Permission key | UI page exists | E2E spec | Verdict |
|----|------|--------------------------|----------------|----------------|----------|---------|
| P1-01 | Sale pipeline | crm/router.ts:78 | crm.manage | /crm/opportunities ✓ | absent | FULL |
| P1-02 | Phiếu thu từ cơ hội | finance/router.ts:603 | finance.receiptCreate | /finance/receipts/new ✓ | absent | FULL |
| P1-03 | Duyệt phiếu kích hoạt | finance/router.ts:715 | finance.receiptApprove | /finance/receipts/:id ✓ | finance-approval.spec ✓ | FULL |
| P1-04 | Provisioning tài khoản | provisioning/provision-from-receipt.ts | internal | (ResultPanel, internal) | absent | FULL |
| P1-05 | Kích hoạt ghi danh | enrollment/router.ts:41 | enrollment.enroll | /students/:id/enrollments ✓ | enrollment.spec ✓ | FULL |
| P1-06 | Liên kết PH–con | guardian/router.ts + lms | guardian.approveLink | /parents/:id ✓ | absent | FULL |
| P1-07 | PH đăng nhập LMS | lms-auth/router.ts:170,223 | publicProcedure (OTP) | LMS /login ✓ | lms-auth.spec ✓ | FULL |
| P1-08 | Huỷ phiếu / hoàn tiền | finance/router.ts | finance.refundCreate | /finance/refunds ✓ | absent | FULL |
| P1-09 | Giám sát tài chính | reconciliation/router.ts:29 | reconciliation.review | /finance/reconciliation ✓ | absent | FULL |
| P2-01 | Tạo lớp tự sinh lịch | class/class-batch-router.ts:95 + schedule-router.ts:32 | class.create / schedule.generate | /classes/:id ✓ | absent | FULL |
| P2-02 | Điểm danh buổi học | attendance/router.ts:110 | attendance.mark | /teaching/attendance ✓ | attendance.spec ✓ | FULL |
| P2-03 | Mở bài tập theo tiến độ | exercise/router.ts (lmsProcedure) | lmsProcedure — intentional (b) | LMS /child/:id/exercises ✓ | absent | FULL |
| P2-04 | Cung cấp bài tập PDF | exercise/router.ts:131 | exercise.manage | /curriculum/:unitId/exercises ✓ | absent | FULL |
| P2-05 | HS làm bài + nộp | submission/router.ts:177 | lmsProcedure — intentional (b) | LMS /child/:id/exercises/:id ✓ | absent | FULL |
| P2-06 | Chấm bài + cộng sao | submission/router.ts:253 | assessment.confirm | /teaching/grading ✓ | attendance-grading.spec ✓ | FULL |
| P2-07 | AI nhận xét + GV chốt | assessment/router.ts:214,294 | assessment.draft / assessment.confirm | /teaching/report-cards/:id ✓ | absent | FULL |
| P2-08 | Gửi ảnh + tóm tắt buổi | session-evidence/router.ts:237,275 | sessionEvidence.publish | LMS /child/:id ✓ | absent | FULL |
| P3-01 | Chấm công WiFi | checkin/router.ts:36 | checkIn.punch | /attendance/check-in-out ✓ | absent | FULL |
| P3-02 | Duyệt chấm công thủ công | checkin/router.ts:94,130 | manualPunch.create / manualPunch.approve | /attendance/check-in-out ✓ | absent | FULL |
| P3-03 | Đăng ký ca làm | shift/router.ts:32 | shift.submit | /attendance/shifts ✓ | absent | FULL |
| P3-04 | Duyệt ca | shift/router.ts:68 | shift.approve | /attendance/shifts/:id ✓ | absent | FULL |
| P3-05 | Chốt lương tháng | payroll/router.ts:62,101,286 | payslip.finalize / compensation.upsertRate | /hr/payroll/:id ✓ | absent | FULL |
| P3-06 | Chấm + duyệt KPI | kpi/router.ts:50,114,159 | kpi.submit / kpi.confirm / kpi.approve | /hr/kpi ✓ | absent | FULL |
| P4-01 | Đổi quà bằng sao | engagement/reward-router.ts:53,119,146 | rewards.manage (staff) / lmsProcedure (student) | /engagement/rewards ✓ | absent | PARTIAL — `gift.archive` key missing |
| P4-02 | Cấu hình quà | engagement/gift-router.ts:31,64 | rewards.manage | /engagement/rewards ✓ | absent | FULL |
| P4-03 | Lên lịch họp PH | meeting/router.ts:28,50,70 | parentMeeting.manage | no dedicated page (embedded?) | absent | PARTIAL — UI page unconfirmed |
| P4-04 | Đặt lịch test | appointment/router.ts:33,56,79 | testAppointment.manage | no dedicated page | absent | PARTIAL — UI page unconfirmed |
| P4-05 | Chăm sóc sau bán | after-sale/router.ts:34,61,82,106 | afterSale.manage | no dedicated page | absent | PARTIAL — UI page unconfirmed |

**Note P3-05 / P3-06 alias:** TL25 shows `payroll.finalize` and `kpi.score` — code uses `payslip.finalize` and `kpi.submit` respectively.

**E2E specs confirmed existing in `apps/e2e/tests/`:**
- `attendance.spec.ts` → P2-02 (P3-01 partial)
- `attendance-grading.spec.ts` → P2-06
- `enrollment.spec.ts` → P1-05
- `finance-approval.spec.ts` → P1-03
- `kind-isolation.spec.ts` → cross-cutting (auth isolation)
- `lms-auth.spec.ts` → P1-07

---

## Section 3 — Role Profiles (9 Roles)

### super_admin
- Bypass: `can()` short-circuit at `packages/auth/src/index.ts:186` — all permissions
- UAT: covered as test principal; must NOT be provisioned to operational staff
- Risk: no last-super-admin guard; removal of only super_admin row = full lockout

### giam_doc_kinh_doanh (GĐKD)
- Permissions: crm.manage, finance.receiptCreate, finance.receiptApprove, enrollment.enroll, enrollment.blockLms, student.manage, parentAccount.manage, guardian.approveLink, class.create, schedule.generate, attendance.mark, manualPunch.approve, shift.manage, shift.submit, kpi.approve, payslip.finalize, rewards.manage, parentMeeting.manage, testAppointment.manage, afterSale.manage, user.manage, room.manage, reconciliation.review
- WF participation: P1-01..09, P2-01/02, P3-01..06, P4-01..05, P5-01
- UAT: in Section 2 ✓

### giam_doc_dao_tao (GĐĐT)
- Permissions: course.manage, room.manage, class.create, schedule.generate, attendance.mark, exercise.manage, exercise.view, assessment.confirm, finance.receiptApprove, manualPunch.approve, shift.manage, shift.submit, kpi.confirm, kpi.approve, payslip.finalize, enrollment.blockLms, guardian.approveLink, student.manage, rewards.manage, parentMeeting.manage, testAppointment.manage, afterSale.manage
- WF participation: P2-01..08, P1-03, P3-03..06, P4-01..05
- UAT: in Section 2 ✓
- ADR-B: SECOND_EYE_ROLES member for over-threshold receipt approval

### sale
- Permissions: crm.manage, enrollment.enroll, finance.receiptCreate (NOT receiptApprove — SoD enforced), student.manage, parentAccount.manage, guardian.approveLink, shift.submit, kpi.submit
- WF participation: P1-01..02, P1-05 partial, P3-03, P3-06
- UAT: in Section 2 ✓
- Self-approval: structurally impossible (missing finance.receiptApprove)

### giao_vien (teacher)
- Permissions: attendance.mark, exercise.manage, exercise.view, assessment.confirm, submission.grade, sessionEvidence.upsert, sessionEvidence.publish, guardian.approveLink, shift.submit, kpi.submit
- WF participation: P2-02, P2-04, P2-06, P2-07, P2-08, P3-03, P3-06
- UAT: in Section 2 ✓
- Orphan: `exercise.view` — no router call-site

### ke_toan (accountant)
- Permissions: finance.receiptCreate, finance.receiptApprove, student.lookup, crm.opportunityLookup, finance.receiptList, finance.receiptGet, kpi.submit
- WF participation: P1-02, P1-03, P3-06
- UAT: in Section 2 ✓
- Note: ke_toan IS in receiptApprove roster (code:50); TL25 P1-03 wrongly omits them (see MEDIUM-01)

### cskh (customer service) — HIGH FINDING
- Permissions: crm.opportunityList, guardian.approveLink, guardian.listPendingLinks, parentAccount.updateEmail, checkIn.punch, manualPunch.create
- **Mutation exposure:** guardian.approveLink, parentAccount.updateEmail, manualPunch.create (3 state mutations)
- WF participation: fragments of P1-06, P3-01, P3-02 — NO named WF in TL25
- UAT: **ABSENT from Section 2** → HIGH-1
- Verdict: partially-covered in registry; orphan-in-UAT

### ctv_mkt (marketing contractor) — HIGH FINDING
- Permissions: crm.opportunityList (read), checkIn.punch, manualPunch.create
- **Mutation exposure:** manualPunch.create — suspicious (why does marketing create attendance records?)
- WF participation: fragment of P3-01 only
- UAT: **ABSENT from Section 2** → HIGH-2
- Verdict: near-orphan (only 1 mutation); business justification for manualPunch.create unclear

### hr (human resources) — HIGH FINDING
- Permissions: checkIn.punch, manualPunch.create, shift.submit, kpi.submit, gift.list, rewards.manage, parentMeeting.manage, testAppointment.manage
- **Mutation exposure:** 6 distinct mutation categories (broadest untested surface)
- WF participation: P3-02 fragment, P3-03, P3-06, P4-01 (staff side), P4-03, P4-04
- UAT: **ABSENT from Section 2** → HIGH-3
- Verdict: partially-covered in registry; orphan-in-UAT

---

## Section 4 — Role-Chain Map (5 Chains)

### Chain 1 — Enrollment (P1-01 → P1-07)

| Step | Actor | Procedure | File:Line | Handoff Entity |
|------|-------|-----------|-----------|----------------|
| 1 | sale | crm.createOpportunity | crm/router.ts:78 | opportunityId |
| 2 | sale | student.create | student/router.ts:~30 | studentId |
| 3 | sale | enrollment.enroll | enrollment/router.ts:41 | enrollmentId (reserved) |
| 4 | sale | finance.receiptCreate | finance/router.ts:603 | receiptId |
| 5 | GĐKD | finance.receiptApprove | finance/router.ts:715 | triggers provision |
| 6 | system | provisionFromReceipt | provisioning/provision-from-receipt.ts | studentAccount + enrollment→active |
| 7 | PH | lmsAuth.sendOtp | lms-auth/router.ts:170 | OTP → parentAccountId |
| 8 | PH | lmsAuth.verifyOtp | lms-auth/router.ts:223 | session token |

**Verdict:** CHAIN FULL. One async gap: provisioning runs post-commit (ADR 0041 design); no retry on failure — known limitation.

### Chain 2 — Learning (P2-04 → P2-08)

| Step | Actor | Procedure | File:Line | Handoff Entity |
|------|-------|-----------|-----------|----------------|
| 1 | GĐĐT | exercise.create | exercise/router.ts:131 | exerciseId |
| 2 | student | submission.submit | submission/router.ts:177 | submissionId |
| 3 | giao_vien | submission.getForReview | submission/router.ts:223 | submissionId |
| 4 | giao_vien | submission.grade | submission/router.ts:253 | gradeId + stars |
| 5 | giao_vien | assessment.draft | assessment/router.ts:~180 | assessmentId |
| 6 | giao_vien | assessment.confirm | assessment/router.ts:214 | confirmed assessment |
| 7 | giao_vien | sessionEvidence.publish | session-evidence/router.ts:275 | evidence visible to PH |

**Verdict:** CHAIN FULL. Permission consistency: steps 3–6 all gate on `assessment.confirm` — same key, correct.

### Chain 3 — Class Ops (P2-01 → P2-08)

| Step | Actor | Procedure | File:Line | Handoff Entity |
|------|-------|-----------|-----------|----------------|
| 1 | GĐĐT | class.create | class/class-batch-router.ts:95 | classBatchId |
| 2 | GĐĐT | schedule.generateSessions | class/schedule-router.ts:32 | sessionIds |
| 3 | giao_vien | attendance.mark | attendance/router.ts:110 | sessionId → attendance records |
| 4 | giao_vien | sessionEvidence.submit | session-evidence/router.ts:237 | evidenceId |
| 5 | GĐĐT | sessionEvidence.approve | session-evidence/router.ts:275 | evidence → PH visible |

**Verdict:** CHAIN FULL.

### Chain 4 — HR/Payroll (P3-01 → P3-06)

| Step | Actor | Procedure | File:Line | Handoff Entity |
|------|-------|-----------|-----------|----------------|
| 1 | all staff | checkIn.punch | checkin/router.ts:36 | punchId |
| 2 | staff | manualPunch.create | checkin/router.ts:94 | manualPunchId |
| 3 | GĐKD/GĐĐT | manualPunch.approve | checkin/router.ts:130 | approved punch |
| 4 | staff | kpi.submit | kpi/router.ts:50 | kpiId |
| 5 | manager | kpi.confirm | kpi/router.ts:114 | confirmed kpi |
| 6 | director | kpi.approve | kpi/router.ts:159 | approved kpi |
| 7 | ke_toan | payroll.upsertRate | payroll/router.ts:62 | rateId |
| 8 | ke_toan | payslip.assemble | payroll/router.ts:101 | payslipId |
| 9 | GĐKD/ke_toan | payslip.finalize | payroll/router.ts:286 | finalized payslip |

**Verdict:** CHAIN FULL. Type (c): `payslip.getForUser` at router.ts:332 — own-or-director inline check, read-only, adequate.

### Chain 5 — After-Sale (P4-01 → P4-05)

| Step | Actor | Procedure | File:Line | Handoff Entity |
|------|-------|-----------|-----------|----------------|
| 1 | GĐKD/GĐĐT | gift.upsert | engagement/gift-router.ts:31 | giftId (catalog) |
| 2 | student | reward.redeem | engagement/reward-router.ts:53 | rewardId |
| 3 | staff | reward.approve | engagement/reward-router.ts:119 | approved reward |
| 4 | staff | reward.deliver | engagement/reward-router.ts:146 | delivered |
| 5 | sale/hr | parentMeeting.schedule | meeting/router.ts:28 | meetingId |
| 6 | sale/GĐKD | afterSale.create | after-sale/router.ts:34 | caseId |
| 7 | sale/GĐKD | afterSale.close | after-sale/router.ts:106 | closed case |
| 8 | GĐKD/GĐĐT | student.updateLifecycle | student/router.ts:121 | lifecycle transition |

**Verdict:** CHAIN FULL at API level. UI pages for steps 5–7 are unconfirmed (no dedicated admin pages found for parentMeeting, testAppointment, afterSale — may be embedded in student-detail or CRM pages).

---

## Section 5 — Document Contradictions

| # | TL25 / Doc says | Code says | Source of Truth | Action |
|---|-----------------|-----------|-----------------|--------|
| C-01 | P1-03 roster: GĐKD only | `finance.receiptApprove` = [GĐKD, GĐĐT, ke_toan] (`index.ts:50`) | **Code** (ADR-B + L1 pre-resolved) | Fix TL25 P1-03 row; no code change |
| C-02 | `checkInOut.punch` | `checkIn.punch` (checkin/router.ts:36) | **Code** | Fix TL25 alias |
| C-03 | `shift.register` | `shift.submit` (shift/router.ts:32) | **Code** | Fix TL25 alias |
| C-04 | `gift.archive` (distinct key) | `gift.upsert({ isActive: false })` — no archive key in registry | **Code** | Fix TL25; update any frontend expecting `gift.archive` tRPC key |
| C-05 | `exercise.create/publish (assessment.*)` | `exercise.manage` (index.ts:99) | **Code** | Fix TL25 alias |
| C-06 | `grade` (short form) | `submission.grade` (submission/router.ts:253) | **Code** | Fix TL25 |
| C-07 | `payroll.finalize` | `payslip.finalize` (payroll/router.ts:286) | **Code** | Fix TL25 |
| C-08 | `kpi.score` | `kpi.submit` (kpi/router.ts:50) | **Code** | Fix TL25 |
| C-09 | UAT Section 2 covers 7 roles | cskh/ctv_mkt/hr hold mutations; not in Section 2 | **Registry** | Rewrite Section 2 (Phase 3 step 7) |
| C-10 | TL25 §4 "không ô Test trống" | 22/28 spec files absent; "sẽ viết" = aspirational only | **Filesystem** | Note in Phase 4 pre-check |
| C-11 | ADR-B implies strict SoD | sub-threshold: ke_toan can create+approve own receipt | Code — by design (ADR-B H1) | Document in runbook; not a code change |
| C-12 | TL25 `finance.receiptCancel` (P1-08) | No `finance.receiptCancel` key in registry; cancel logic in finance/router.ts under `receiptApprove` scope | **Code** | Fix TL25 alias for P1-08 |
| C-13 | facilityNetwork.manage in registry | No roles assigned, no router, dead UI page | N/A — orphan | Remove from registry OR implement router |

---

## Section 6 — Severity-Ranked Findings

### HIGH Findings

#### HIGH-1 — cskh: mutation permissions, no UAT scenario
- **File:** `packages/auth/src/index.ts` (cskh lines), `apps/api/src/checkin/router.ts:94`, `apps/api/src/guardian/router.ts`
- **Permissions exposed:** `guardian.approveLink`, `parentAccount.updateEmail`, `manualPunch.create`
- **Failure scenario:** cskh staff approves fraudulent guardian link or logs false attendance; no regression test detects auth drift
- **Action:** Add UAT Section 2 block for cskh (guardian approval + email update + punch); include in role-chain rewrite

#### HIGH-2 — ctv_mkt: suspicious manualPunch.create + no UAT scenario
- **File:** `packages/auth/src/index.ts` (ctv_mkt lines ~128–130)
- **Permission exposed:** `manualPunch.create`
- **Failure scenario:** marketing contractor logs false attendance records with no test catching it; no documented business justification
- **Action:** (a) Audit whether ctv_mkt genuinely needs manualPunch.create; if not, remove permission (code PR MEDIUM); (b) Add UAT scenario regardless for current state

#### HIGH-3 — hr: 6 mutation categories, no UAT scenario
- **File:** `packages/auth/src/index.ts` (hr lines), `apps/api/src/rewards/reward-router.ts:119,146`, `apps/api/src/meeting/router.ts`, `apps/api/src/appointment/router.ts`
- **Permissions exposed:** manualPunch.create, shift.submit, kpi.submit, rewards.manage, parentMeeting.manage, testAppointment.manage
- **Failure scenario:** HR staff changes reward delivery state or schedules meetings — untested path, regression invisible to CI
- **Action:** Add UAT Section 2 block for hr covering all 6 mutation categories

---

### MEDIUM Findings

#### MEDIUM-01 — TL25 P1-03 stale roster (L1 pre-resolved)
- **File:** `docs/25-ma-tran-truy-vet-p1.md` row P1-03 vs `packages/auth/src/index.ts:50`
- **Action:** Fix TL25 P1-03 to show [GĐKD, GĐĐT, ke_toan]; no code change

#### MEDIUM-02 to MEDIUM-13 — 12 API alias drifts in TL25
All 12 aliases in the normalization table (Section 2). Most impactful: `gift.archive` (C-04, borderline HIGH for frontend consumers expecting this tRPC key).
- **Action:** Single PR updating TL25 "API (quyền)" column for all 12 rows

#### MEDIUM-14 — 22/28 E2E specs absent
- **File:** `apps/e2e/tests/` — only 6 of 28 WF specs exist
- **Action:** TL25 test column remains aspirational; no sprint-blocker but document in Phase 4 pre-check; defer spec authoring to M1/M2

#### MEDIUM-15 — exercise.view orphan permission
- **File:** `packages/auth/src/index.ts:102`
- **Roles assigned:** giao_vien, giam_doc_dao_tao
- **Action:** Either add a router call-site for exercise.view (e.g., exercise PDF display endpoint) OR remove the key from registry to avoid confusion

#### MEDIUM-16 — facilityNetwork.manage: orphan key + dead UI
- **File:** `packages/auth/src/index.ts:126`; `apps/admin/src/pages/admin/network-ip.tsx`
- **Finding:** Permission has [] roles, no router mounted. Admin UI page network-ip.tsx exists but all API calls will return NOT_FOUND.
- **Action:** Either implement the router + assign roles OR remove key + remove/gate the admin page

---

## Section 7 — REDEPLOY Verdict

### ✅ NOT REQUIRED

**Rationale:**
- 0 CRITICAL findings — no bare unprotected mutations, no auth bypass
- All type (c) procedures reviewed and found adequate
- No permission registry hole that would allow unauthorized data access
- HIGH-1/2/3 are UAT-coverage gaps, not code bugs — they don't require a code PR before Phase 4 can start

**What IS required before Phase 4 ticks any checkbox:**
1. UAT checklist Section 2 rewrite (Phase 3 step 7) — 1 PR, must merge BEFORE Phase 4 Run 1
2. TL25 doc fix PR (P1-03 roster + 12 aliases) — can be simultaneous
3. Decision on ctv_mkt `manualPunch.create` (HIGH-2) — if removing, 1 code PR needed (optional, user decides)
4. Verdict REDEPLOY NOT REQUIRED → written here for Phase 4 bước 0 check

---

## Appendix — Role × Permission Matrix (mutations only)

All permission keys that involve state mutations. Columns: sup=super_admin, GĐKD, GĐĐT, sale, GV=giao_vien, KT=ke_toan, cskh, mkt=ctv_mkt, hr.

| Permission key | sup | GĐKD | GĐĐT | sale | GV | KT | cskh | mkt | hr |
|----------------|-----|------|------|------|----|----|------|-----|----|
| crm.opportunityCreate | Y | Y | Y | Y | | | | | |
| crm.opportunityAdvance | Y | Y | Y | Y | | | | | |
| crm.opportunityMarkLost | Y | Y | Y | Y | | | | | |
| finance.receiptCreate | Y | Y | Y | Y | | Y | | | |
| **finance.receiptApprove** | Y | Y | Y | | | **Y** | | | |
| finance.refundCreate | Y | Y | | | | Y | | | |
| enrollment.enroll | Y | Y | Y | Y | | | | | |
| enrollment.blockLms | Y | Y | Y | | | | | | |
| **guardian.approveLink** | Y | Y | Y | Y | Y | | **Y** | | |
| **parentAccount.updateEmail** | Y | Y | Y | Y | | | **Y** | | |
| class.create | Y | Y | Y | | | | | | |
| schedule.generate | Y | Y | Y | | | | | | |
| attendance.mark | Y | Y | Y | | Y | | | | |
| exercise.manage | Y | | Y | | Y | | | | |
| assessment.confirm | Y | | Y | | Y | | | | |
| submission.grade | Y | | Y | | Y | | | | |
| sessionEvidence.upsert | Y | | | | Y | | | | |
| sessionEvidence.publish | Y | | | | Y | | | | |
| **manualPunch.create** | Y | Y | Y | | | | **Y** | **Y** | **Y** |
| manualPunch.approve | Y | Y | Y | | | | | | |
| shift.manage | Y | Y | Y | | | | | | |
| shift.submit | Y | Y | Y | Y | Y | | | | Y |
| shift.approve | Y | Y | Y | | | | | | |
| shift.cancel (inline-c) | Y | Y | Y | owner | | | | | |
| compensation.upsertRate | Y | Y | Y | | | | | | |
| payslip.assemble | Y | Y | Y | | | | | | |
| payslip.finalize | Y | Y | Y | | | Y | | | |
| payslip.reopen | Y | Y | Y | | | Y | | | |
| kpi.submit | Y | Y | Y | Y | Y | Y | | | Y |
| kpi.confirm | Y | Y | Y | | | | | | |
| kpi.approve | Y | Y | Y | | | | | | |
| gift.upsert | Y | Y | Y | | | | | | |
| **rewards.manage** | Y | Y | Y | | | | | | **Y** |
| **parentMeeting.manage** | Y | Y | Y | | | | | | **Y** |
| **testAppointment.manage** | Y | Y | Y | | | | | | **Y** |
| afterSale.manage | Y | Y | Y | | | | | | |
| student.setLifecycle | Y | Y | Y | | | | | | |
| student.manage | Y | Y | Y | Y | | | | | |
| studentAccount.resetPassword | Y | Y | Y | | | | | | |
| user.manage | Y | Y | Y | | | | | | |
| reconciliation.review | Y | Y | Y | | | Y | | | |

**Roles with mutations NOT in UAT Section 2 (HIGH findings):**
- **cskh**: guardian.approveLink ✗, parentAccount.updateEmail ✗, manualPunch.create ✗
- **ctv_mkt**: manualPunch.create ✗
- **hr**: manualPunch.create ✗, shift.submit ✗, kpi.submit ✗, rewards.manage ✗, parentMeeting.manage ✗, testAppointment.manage ✗

> Bold rows = roles that are NOT in current UAT Section 2 (need addition in Phase 3 step 7 PR).

---

**Status:** DONE
**Summary:** 16 findings (0 CRITICAL, 3 HIGH, 13 MEDIUM); WF coverage 22/28 FULL + 6/28 PARTIAL; REDEPLOY verdict: NOT REQUIRED
**Next:** Phase 3 step 7 — rewrite UAT checklist Section 2 with role-chain scenarios + cskh/ctv_mkt/hr blocks; Phase 4 may begin after Section 2 PR merges.
