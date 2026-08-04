# Quy trình verify kết quả thực tế nghiệp vụ (business-logic verification)

Status: Phase 1 in progress (framework + gate + honest baseline). Phases 2–3 backlog.

## Outcome

Một stage kiểm chứng đứng ở cuối pipeline (`ak-brainstorm → ak-research → ak-advise
→ scout → ak-plan/red-team/validate → cook → ak-test → ak-debug → **verify**`) trả
lời được câu hỏi mà ledger hiện tại KHÔNG trả lời: *"tính năng này chạy ĐÚNG số học
nghiệp vụ chưa"*, không chỉ *"màn có mở được và không nổ exception chưa"*.

## Vì sao cần — gap đã chứng minh bằng code

Ledger `acceptance-report` (`pnpm acceptance:report`) đã rất tốt ở 2 tầng:

- **built** — scan tĩnh: procedure tRPC / route UI / model Prisma mà flow khai báo
  có tồn tại trong code ở HEAD (`scripts/acceptance-report/scanners/*`).
- **proven** — journey Playwright của flow thực sự CHẠY và XANH ở đúng SHA HEAD,
  và flow đã built (`flow-evidence.ts`, quy tắc một-đường-duy-nhất tới `proven`).

Nhưng `proven` = **reachable-and-green**, không phải **arithmetically-correct**.
Bằng chứng cụ thể (`apps/e2e/tests/journeys/crm-receipt.journey.ui.spec.ts`): journey
nhập `Học phí = 5000001`, submit, rồi assert DUY NHẤT là banner *"Đã tạo phiếu thu"*
hiện ra. Nó KHÔNG assert số tiền phiếu thu tạo ra `=== 5000001`, không assert bất kỳ
giá trị tính toán hạ nguồn nào. Mọi assertion trong journey là `toBeVisible()` /
`toHaveURL()` — hiện diện & điều hướng, không phải số nghiệp vụ.

Đây đúng là ghi chú memory của dự án: *"chạy thông ≠ đúng số học nghiệp vụ; UAT người
thật chưa chạy ⇒ chưa được mô tả là production-ready"* và pattern *"CI green, prod
broken"*.

## Nguyên tắc thiết kế (KISS + tái dùng tối đa)

1. **KHÔNG sửa đường tới `proven`.** `flow-evidence.ts` / `verify.ts` là đầu vào của
   required-check `ui-e2e` trên `main`. Tầng correctness là một LỚP đọc-thêm bên
   cạnh, không phải phẫu thuật vào lõi. Rủi ro với required-check = 0.
2. **Tái dùng nguyên máy ingest.** `ingest-playwright-results.ts` đã gom sẵn
   `SpecFacts.annotations: string[]` — mọi annotation ĐÃ THỰC THI của từng spec. Tín
   hiệu "một assertion nghiệp vụ có chạy thật" đã nằm sẵn trong artifact; chỉ cần một
   quy ước để phát ra nó.
3. **Cùng triết lý "chứng minh bằng chạy, không bằng tồn tại trong source".** Một flow
   chỉ đạt `verified-correct` khi journey của nó thực thi ≥1 assertion gắn nhãn
   `business-invariant` VÀ đã `proven`. Không có nhãn → tụt hạng trung thực về
   `reachable-only` (smoke), y như ledger phân biệt `vacuous` / `passed-not-built`.

## Ba tầng chứng cứ (state machine)

| Tầng | State | Ý nghĩa | Nguồn |
|------|-------|---------|-------|
| 0 | `built` | procedure/route/model tồn tại | acceptance scan (đã có) |
| 1 | `proven` | journey chạy xanh ở HEAD | flow-evidence (đã có) |
| 2 | `verified-correct` | proven + journey khẳng định ≥1 số/trạng thái nghiệp vụ | **business-verify (mới)** |
| — | `reachable-only` | proven nhưng journey chỉ smoke (0 invariant) | **business-verify (mới)** |
| 3 | `uat-confirmed` | người thật đối chiếu 1 mẫu, có ngày + chữ ký | thủ công, có kiểm soát |

## Wiring vào pipeline ak-*

- **ak-plan / ak-scenario**: khi lập kế hoạch một flow, liệt kê các *business
  invariant* cần chốt (số tiền, tổng lương, số dư sao, hành vi bị-cấm-vẫn-cấm) trong
  acceptance criteria — đây là đầu vào cho assertion tầng 2.
- **cook / ak-cook**: khi implement, journey của flow phải nhúng
  `assertBusinessInvariant(...)` cho từng invariant đã chốt.
- **ak-test**: chạy `PLAYWRIGHT_UI=1` journeys như cũ.
- **verify (stage mới)**: `pnpm acceptance:report` → `pnpm business:verify`. Gate đỏ
  nếu một flow nằm trong tập "money/state-critical" mà chỉ đạt `reachable-only`.
- **ak-debug**: khi `business:verify` báo lệch số, đây là đầu vào chẩn đoán (giá trị
  kỳ vọng vs thực tế đã in ra sẵn).

## Phases

- [phase-01](phase-01-framework-and-gate.md) — Convention + gate composer + baseline
  trung thực. **In progress.**
- Phase 2 (IN PROGRESS) — Retrofit journey các flow money/state-critical với
  `assertBusinessInvariant`. **Pilot P1-02 crm-receipt DONE 2026-08-04**: manager-role
  tRPC readback (`finance.receiptList` by code) assert `netAmount === 5000001`; journey
  xanh (33.7s), `business:verify` → `verified-correct 1/38` (đã lật reachable-only →
  verified-correct). Còn 10 luồng: P1-03, P2-06, P3-02/04/05/06/08/09, P4-01/02 —
  scout per-flow invariant + readback trước, rồi cook theo batch. Mỗi flow một PR nhỏ.
- Phase 3 (backlog) — Tầng UAT người thật: bảng mẫu có ngày/chữ ký cho tập luồng
  không-có-UI-path (7 luồng `no-ui-path`) nơi journey không chạm tới được.

## Phase 2 measured result (full ui-chromium run, HEAD 559755b, 2026-08-04)

`business:verify` → **verified-correct 6/38** (từ 0), reachable-only 11, not-proven 21.

- **6 verified-correct** (money/state flows chứng minh đúng số): P1-02 phiếu thu, P1-03
  duyệt phiếu, P3-05 lương totalNet, P3-09 KPI draft state, P4-01 số dư sao, P4-02 giá quà.
- **P2-06 grading — assertion BẮT ĐƯỢC BUG THẬT rồi ĐÃ SỬA**: nhập 8.5 → lưu 8 (Int
  column vs float input). Fix 3 tầng (quyết định PO: chặn điểm không nguyên): input
  `submission.grade` thêm `.int()` + unit test reject 8.5 (16/16 pass); UI grading
  `step={0.5}→1`; journey gõ 8 + assert `score===8`. Re-run P2-06 riêng: XANH (33.1s) →
  verified-correct. Combined ⇒ **7 money/state flows verified-correct**.
- **P3-02, P3-04, P3-06/08 not-proven vì lỗi CÓ SẴN trên branch develop** (UI refactor):
  journey fail ở click UI (`+ Thêm mẫu ca` bị `tpl-wrap tpl-detail` overlay chặn) /
  setup `createStaffViaAdminUi` timeout — TRƯỚC khi tới readback tôi thêm. Cùng lỗi này
  làm hỏng 9 journey khác tôi KHÔNG đụng (admin-shell, enrollment, entrance-test,
  exercise-publish, session-evidence, parent-link, shift-config, user-admin...). 27/40 pass.
- Prereq đã sửa để chạy được UI e2e: rebuild `@cmc/ui` (stale dist).

## Phase 2b (2026-08-04): +3 money flows retrofitted → verified-correct

Retrofitted 3 reachable-only money/state flows (each passed pinned-cli standalone, 3/3):
- P1-09 recon: `reconciliation.listFlags` flag `detail.netAmount === 25000001` matched by receiptId
  (worker flagged the right receipt with the right number).
- P1-05 enrollment: getDb() readback — exactly 2 enrollments, class-A `active` + class-B `reserved`
  (avoided tautological `student.lifecycle` which defaults active).
- P1-04 activation: getDb() — StudentAccount→ParentAccount linkage (student-keyed select, parent-keyed
  assert, non-circular; avoided `mustChangePassword` which a later reset falsifies).
Two use the sanctioned getDb() RLS-bypass (no staff read-proc exposes enrollment status / SA linkage).

## Definitive full-suite (pinned cli, clean, 2026-08-04): 30 passed / 10 failed

Up from 27/40 baseline. Thread B overflow fixes recovered shift-config (ADM-05), shift-register
(P3-04), checkin-offsite (P3-02).

**Regression from the P2-06 `.int()` guard — FOUND & FIXED:** `lms-stars-redeem-cycle.journey`
graded with `fill('8.5')` (line 110); the new integer guard rejected it → journey broke. My
earlier impact grep searched `score: 8.5` and missed the UI `fill('8.5')` pattern. Fixed →
`fill('8')` (only fractional grade fill in the whole e2e suite; lms-grade-parent-view already
grades `9`). Lesson: when tightening an input validator, grep the UI-driver patterns
(`fill('N.5')`), not just the API-shape literals.

Remaining 10 failures (for the UI-refactor workstream / follow-up, NOT verify-tier blockers):
overflow fixes landed the CLICK (errors changed from "intercepts pointer events" to later
`toBeVisible` on success banners), so enrollment (P1-05), entrance-test (P4-04),
session-evidence (P2-08), parent-link (P1-06) now fail at a downstream step — each needs its own
probe. ADM-02 = role-not-displayed (separate). exercise (P2-04) suspected DataTable-width.
lms-parent-evidence (P2-08 PH) had no matching HStack. admin-shell = safety net.

## Acceptance criteria (Phase 1)

- [ ] `assertBusinessInvariant` tồn tại, có kiểu, có nhãn `business-invariant`.
- [ ] `pnpm business:verify` chạy được, đọc ledger + journeys.json, in tổng kết + ghi
  `acceptance-report/business-verification.json`.
- [ ] Baseline trung thực: báo đúng "0 flow verified-correct, N reachable-only" trên
  code hiện tại (chưa flow nào có invariant) — đó là sự thật cần phơi ra.
- [ ] Không đụng `flow-evidence.ts` / `verify.ts`; required-check không đổi.

## Non-goals

- Không retrofit toàn bộ 38 journey trong Phase 1 (đó là Phase 2, từng PR).
- Không thay `proven` bằng `verified-correct` trong required-check khi coverage tầng 2
  còn thấp — sẽ khiến CI đỏ hàng loạt vì lý do đúng nhưng chưa tới lúc siết.
