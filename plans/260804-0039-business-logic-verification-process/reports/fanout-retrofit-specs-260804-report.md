# Business-correctness retrofit specs — 10 fan-out flows (260804)

Scope: for each flow, the concrete `assertBusinessInvariant` readback to bolt onto the
existing green journey, following the P1-02 pilot (`crm-receipt.journey.ui.spec.ts`).

Pilot pattern recap (copy exactly):
```ts
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
// ...after UI flow...
const client = createE2eStaffClient(process.env.E2E_BASE_URL!, { userId: `e2e-...`, roles: ['<role>'], facilityId });
const data = await client.<ns>.<proc>.query({ ... });
assertBusinessInvariant('<vn label>', <actualReadBack>, <expected>);
```
LMS-session variant available for student-gated reads: `createE2eLmsStudentClient(baseUrl, { parentAccountId, studentId })`.
DB fallback: `getDb()` in `apps/e2e/src/db.ts`.

## Summary table

| Flow | Journey file (relative) | Invariant (NUMBER/STATE) | Readback proc → field | Read role (holds perm) | Expected from | Difficulty |
|------|------------------------|--------------------------|------------------------|------------------------|---------------|------------|
| P1-03 | `apps/e2e/tests/journeys/receipt-approve-negation.journey.ui.spec.ts` | Approved receipt persists `status='approved'` | `finance.receiptGet.query({ id: receiptId })` → `.status` | `giam_doc_kinh_doanh` (already the approver; `finance.receiptGet` = GĐKD/GĐĐT) | constant `'approved'` | EASY |
| P2-06 | `apps/e2e/tests/journeys/grading-submission.journey.ui.spec.ts` | Graded submission stores the typed score `8.5` and `status='graded'` | `submission.listForGrading.query({ exerciseId, status: 'graded' })` → `items[].score` / `.status` (match `studentFullName`) | `giao_vien` (`submission.grade` + ownership) | constant `8.5` typed in journey | EASY |
| P3-02 | `apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts` | Sale's offsite ticket ends `status='approved'` | `manualPunch.list.query({ scope: 'inbox' })` → row where `appUserId===sale.id`, `.status` | `giam_doc_kinh_doanh` (inbox track = sale) | constant `'approved'` | MEDIUM |
| P3-04 | `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts` | Approved shift reg is `status='approved'` (read after approve, BEFORE cancel) | `shift.myRegistrations.query()` → the `submitted→approved` reg `.status` | sale client (`userId=saleUserId`; self-scoped read) | constant `'approved'` | MEDIUM |
| P3-05 | `apps/e2e/tests/journeys/payroll-assemble-finalize.journey.ui.spec.ts` | Finalized payslip `totalNet = base+kpi−penalty = 10 000 000`, `status='finalized'` | `payslip.my.query({ period })` → `.totalNet` / `.status` | sale client (self) OR `payslip.getForUser` as GĐKD | base `10 000 000` (tier) + `0` kpi + `0` penalty | MEDIUM |
| P3-06 | `apps/e2e/tests/journeys/kpi-submit-confirm-bulk-approve.journey.ui.spec.ts` | Confirmed slip is `status='confirmed'` | `kpi.list.query({ period: '2026-06', status: 'confirmed' })` → sale row `.status` | `giam_doc_kinh_doanh` (director list, track sale) | constant `'confirmed'` | EASY |
| P3-08 | `apps/e2e/tests/journeys/kpi-submit-confirm-bulk-approve.journey.ui.spec.ts` | Bulk-settled slip is `status='approved'` | `kpi.list.query({ period: '2026-06', status: 'approved' })` → sale row `.status` | `giam_doc_kinh_doanh` (director list, track sale) | constant `'approved'` | EASY |
| P3-09 | `apps/e2e/tests/journeys/kpi-refresh-my.journey.ui.spec.ts` | Current-period KpiScore now EXISTS as `status='draft'` (was null) | `kpi.myScore.query({ period })` → non-null, `.status` | sale client (self, `userId=staffUserId`) | period `ictMonthOf(new Date())`; state `'draft'` | MEDIUM |
| P4-01 | `apps/e2e/tests/journeys/lms-stars-redeem-cycle.journey.ui.spec.ts` | Star balance after redeem `= 5−3 = 2` (and/or reward `status='delivered'`) | `gift.listForStudent.query()` → `.starBalance` (LMS student client); OR `rewards.list.query({ status:'delivered' })` → row | LMS student session (`createE2eLmsStudentClient`); OR GĐKD (`rewards.manage`) for reward status | earned `5` − gift cost `3` = `2` | MEDIUM |
| P4-02 | `apps/e2e/tests/journeys/gift-config-nav.journey.ui.spec.ts` | Created gift persists with its star cost | `gift.list.query({})` → row by name `.starsRequired` | `giam_doc_kinh_doanh` (`gift.list`) | NumberInput default `1` (journey leaves it) — see note | EASY |

Counts: **EASY 5 · MEDIUM 5 · BLOCKED 0.**

---

## Per-flow notes

### P1-03 — Duyệt phiếu kích hoạt học viên  (EASY)
- Journey already captures `receiptId` (last path segment after the approver opens `/finance/:id`) and drives `Duyệt & Kích hoạt`.
- After the approve success banner, mint a GĐKD client and read `finance.receiptGet({ id: receiptId })`.
- `ReceiptDto.status` (`finance/router.ts:117,183`) flips `draft → approved` on approve (`data: { status: 'approved' }`, line 312).
- `assertBusinessInvariant('phiếu thu sau duyệt có trạng thái approved', receipt.status, 'approved')`.
- The approver session already holds `finance.receiptGet` (`packages/auth`: GĐKD/GĐĐT). Optional stronger check: also assert `finance.receiptList` shows it under `status:'approved'`.

### P2-06 — Chấm bài & cộng sao  (EASY)
- `exerciseId` is in test scope (`seedPublishedExercise`); journey types score `8.5` and the graded row leaves the ungraded queue.
- Readback with the SAME teacher role: `submission.listForGrading({ exerciseId, status: 'graded' })` — the enum accepts `'graded'` (`submission/router.ts:53`) and the ownership filter still applies.
- Match the item by `studentFullName === studentName`; assert `.score === 8.5` and `.status === 'graded'` (`SubmissionDto`, lines 90-114).
- The "cộng sao" side (StarTransaction) is a mint side-effect with default `starReward`; the score readback is the reliable typed number. If a star assertion is wanted, it needs `getDb()` on `StarTransaction` (type `homework_completed`) or an LMS balance read — heavier, deferred.

### P3-02 — Duyệt phiếu chấm công offsite  (MEDIUM)
- Journey has `sale` (AppUser row via `findAppUserByUserId`, so `sale.id` is known) and drives GĐKD `Duyệt`.
- After the "Đã duyệt yêu cầu chấm công." banner, mint a GĐKD client: `manualPunch.list({ scope: 'inbox' })` returns `ManualAttendanceTicket[]` with `appUserId` (track filter `sale→GĐKD`, `checkin/router.ts:398-441`).
- Find the row `appUserId === sale.id`; assert `.status === 'approved'` (approve sets it, line 293).
- MEDIUM only because you must locate the row among inbox tickets (filter by `appUserId`, or pass `status:'approved'` and assert the sale's ticket is present).

### P3-04 — Duyệt ca  (MEDIUM)
- `shift.approve` sets `status='approved'` (`shift/router.ts:338`). No director-facing read returns an approved reg (`pendingForApproval` = submitted only).
- Read via the OWNER: mint a sale client (`userId=saleUserId`) and call `shift.myRegistrations()` (self-scoped, `include: entries`, line 386-395). Filter to the reg with `status==='approved'` (the resubmitted one; an earlier `rejected` reg is also present).
- **Timing**: the journey then cancels it (P3-03) → `status='cancelled'`. Insert the readback right AFTER the approve assertion (`row disappears from pending`) and BEFORE the sale cancels. `assertBusinessInvariant('đăng ký ca sau duyệt = approved', regs.filter(r=>r.status==='approved').length, 1)`.

### P3-05 — Chốt lương tháng theo bậc lương  (MEDIUM)
- Tier base `10 000 000`; sale has no approved punches and no confirmed KPI in this run → `variablePay=0`, `kpiBonus=0`, `penalty=0`, so `totalNet=10 000 000` (`assembleSlip`, router 453-461; UI asserts "10.000.000 đ").
- Journey uses the current period (default, no explicit period). Compute `const period = ictMonthOf(new Date())` (`@cmc/domain-time`).
- Readback: mint a sale client (`userId=saleUserId`), `payslip.my({ period })` (self-scoped, router 614) → `.totalNet` / `.status`. (Alt: GĐKD `payslip.getForUser({ appUserId, period })` — needs the sale's DB `appUserId`.)
- `assertBusinessInvariant('phiếu lương chốt = base+kpi (VND)', slip.totalNet, 10000000)` and assert `slip.status==='finalized'`.

### P3-06 — Nộp & duyệt phiếu KPI (auto-score)  (EASY)
- Shared journey; `PERIOD='2026-06'` constant. After the confirm step (row moves to "Đã xác nhận"), mint a GĐKD client: `kpi.list({ period: '2026-06', status: 'confirmed' })` (director list, track `sale`, router 411-455).
- Find the sale row (has `fullName`); assert `.status === 'confirmed'` (confirm sets it, line 270).
- Alt self-read: sale client `kpi.myScore({ period })` → `.status`.

### P3-08 — Tất toán KPI hàng loạt  (EASY)
- Same shared journey, after the settle step. `kpi.list({ period: '2026-06', status: 'approved' })` as GĐKD → sale row `.status === 'approved'` (bulkApprove sets it, router 405-407).
- Alternatively assert the mutation's own shape is unnecessary — the list readback is the durable state. Stronger optional: assert exactly one approved row for the period.

### P3-09 — Tính lại điểm KPI tự động  (MEDIUM)
- Before the click there is no slip; `kpi.refresh` creates a current-period `KpiScore` (status `draft`).
- Compute `const period = ictMonthOf(new Date())`. Mint a sale client (`userId=staffUserId`), `kpi.myScore({ period })` (self-scoped, router 460-478).
- Assert non-null and `.status==='draft'`: `assertBusinessInvariant('phiếu KPI kỳ hiện tại được tạo (draft)', score?.status ?? null, 'draft')`.
- MEDIUM: the numeric `value` is auto-scored from (near-empty) seed activity so it is not a stable constant — assert the STATE (row now exists as draft), which is the real "recompute ran" invariant.

### P4-01 — Đổi quà bằng sao  (MEDIUM)
- Cross-app journey: grading mints 5 stars, gift costs 3, student redeems, GĐ delivers. `parentAccountId` and `studentId` are both in scope.
- Primary number: star balance `5−3=2`. Read with an LMS STUDENT client: `createE2eLmsStudentClient(process.env.E2E_BASE_URL!, { parentAccountId, studentId })` then `gift.listForStudent.query()` → `.starBalance` (`gift-router.ts:84-98`). `assertBusinessInvariant('số dư sao giảm đúng giá quà', starBalance, 2)`.
- Complementary STATE (staff side, easier client): GĐKD `rewards.list({ status: 'delivered' })` → row for `giftName` present (deliver sets `status='delivered'`, `reward-router.ts:163`).
- MEDIUM: needs the LMS student session variant (not the staff client) for the balance number, plus the `5−3` computation.

### P4-02 — Cấu hình quà đổi sao  (EASY)
- Journey drives `gift.upsert` via the real form but leaves "Số sao cần" at the NumberInput default (`1`); only the name is typed.
- Readback: GĐKD `gift.list({})` → find row by `name===giftName`, assert `.starsRequired`.
- **Note (weak-expected caveat)**: with the default left in place the expected value is just `1`. To make this a meaningful business assertion, have the journey TYPE a distinct star cost (e.g. `7`) into `getByRole('spinbutton', { name: 'Số sao cần' })` and assert `starsRequired===7` — same pattern the P4-01 journey already uses (`fill('3')`). Field is `starsRequired` (`upsertGiftInput`, `gift-router.ts:19`), not `starCost`.

---

## Cross-cutting implementation notes
- `E2E_BASE_URL` and `E2E_FACILITY_ID` are set by global-setup; every readback client uses `facilityId = process.env.E2E_FACILITY_ID`.
- Self-scoped reads (`payslip.my`, `kpi.myScore`, `shift.myRegistrations`, `manualPunch.list scope:'mine'`) resolve the AppUser from `ctx.subject.userId`, so the readback client's `userId` MUST equal the acting staff's `userId` (the `e2e-...` id already used to mint that actor's cookie) and that staff must exist as an AppUser row (true for the `createStaffViaAdminUi` / `seedAppUser` actors; NOT true for cookie-only director sessions that were never seeded).
- Director list reads (`kpi.list`, `manualPunch.list scope:'inbox'`, `finance.receiptList/Get`) work from a fresh cookie-only GĐKD/GĐĐT client (no AppUser row needed) except where a track/self match is required.
- tRPC v11: `.query()` for the reads above (all are queries).
