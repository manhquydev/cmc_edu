---
title: "HR module remediation: KPI auto-score lifecycle, payroll correctness, shift reject/list, nav 5-role, shift-config UI"
description: "TDD remediation of HR cluster: fix double-penalty manual-punch, CompensationPolicy rates, KPI auto-score (sale revenue + GV teaching-hours with 24h/48h decay), session-done engine + auto-reschedule, shift reject + list procedures, nav for 5 roles, real shift-config UI."
status: completed
priority: P1
branch: "feat/hr-remediation"
completedAt: "2026-07-12T02:20:00.000Z"
tags: [backend, payroll, kpi, shift, attendance, session-done, tdd, admin-ui]
blockedBy: [260711-1720-premium-erp-screen-buildout]
blocks: []
created: "2026-07-11T12:35:41.770Z"
createdBy: "ck:plan"
source: skill
---

# HR module remediation: KPI auto-score lifecycle, payroll correctness, shift reject/list, nav 5-role, shift-config UI

## Overview

Input: `plans/reports/brainstorm-260711-1752-hr-kpi-shift-attendance-remediation-report.md` (9 quyết định gốc) + red-team 4 reviewer (2026-07-11, xem `## Red Team Review`) + validation session (6 quyết định bổ sung, xem `## Validation Log`).

**Roles (5 active):** `giao_vien`, `sale`, `giam_doc_dao_tao` (GĐĐT), `giam_doc_kinh_doanh` (GĐKD), `super_admin`. "Quản lý" = attribute `managerId`. KHÔNG dùng role gác.

**KPI lifecycle (user-designed):** `draft` (hệ thống sinh lazy + tự tính) → `submitted` (nhân sự Nộp — **guard từ NGÀY 3 tháng kế tiếp ICT**, validate s3) → `confirmed` (GĐ thẩm định; **payslip.assemble lấy `value` phần-nhân từ confirmed trở lên**) → `approved` (tất toán: bulkApprove theo branch-scope ROLE, chỉ phiếu có payslip finalized). Override: nguồn `submitted|confirmed` → đích `confirmed`; `approved` bất biến; procedure `kpi.approve` đơn lẻ BỎ (approved chỉ qua bulkApprove). Anti-self trên override + bulkApprove (loại phiếu của caller). Chặn confirm/override khi payslip kỳ đó đã finalized.

**MÔ HÌNH LƯƠNG (user chốt validate session 3 — THAY công thức cũ):**
```
totalNet = baseSalary(bậc) + PHẦN NHÂN − phạt muộn/sớm (QĐ0025)
PHẦN NHÂN = %côngca × %chỉ-số-role × đơnGiá(bậc)     [cap 100% CẢ HAI %]
%côngca      = côngCaThực / côngCaYêuCầu(bậc)          — áp dụng CẢ sale + GV
%chỉ-số-role = GV: giờDạyThực / giờYêuCầu(bậc)  |  Sale: doanhThuPhêDuyệt / quotaDT(bậc)
```
- **GREENFIELD (validate s4):** dự án CHƯA triển khai — không tương thích ngược với "cơ chế lương cũ"; gán bậc là bước onboarding bắt buộc (runbook), assemble thiếu tier → FORBIDDEN là guard đúng, KHÔNG cần fallback/backfill lương legacy.
- **Payslip + phiếu KPI + tier CHỈ dành cho sale/giao_vien (validate s4):** lương 2 GĐ ngoài hệ thống; super_admin không có payslip. `assignTier` target chỉ role sale/GV → chuỗi tier-self-enrichment không tồn tại; bỏ nhánh phiếu KPI của GĐ.
- **Bậc lương = bảng `SalaryTier`** per-facility (tên bậc, `type KINH_DOANH|GIAO_VIEN`, baseSalary, đơnGiá, côngCaYêuCầu, metricYêuCầu, audit updatedById); `SalaryRate` thu gọn thành bảng gán (`tierId`); **BỎ `compensation.upsertRate`** + nullable-hóa 3 cột cũ (`baseSalary`/`variablePayRate`/`kpiMax`). Phiếu KPI snapshot `unitRate`+`tierId` lúc refresh (đổi tier giữa kỳ = cho phép + audit, phiếu đã nộp giữ snapshot — QĐ docs/20).
- **Công ca THỰC (validate s4 — ngữ nghĩa user):** ca được ghi nhận khi có **chấm VÀO** (punch sớm nhất trong [start−2h, midpoint)) **VÀ chấm RA** (punch muộn nhất trong [midpoint, end+2h]); sớm/muộn KHÔNG làm mất ca — phạt phút xử (late = in−start nếu dương; early = end−out nếu dương, **tính PER-CA** thay per-ngày). Punch không tái dùng giữa 2 ca (pool loại dần theo thứ tự ca). Ca thiếu 1 trong 2 chấm = ca vắng (không công, không phạt phút, đếm vào unpunched). Span < 50% thời lượng ca → flag trên phiếu KPI cho GĐ soi (chống gaming — trade-off chấp nhận có kiểm soát). Ngày có `ManualAttendanceTicket` approved = đủ chấm cho MỌI ca đăng ký ngày đó. Đăng ký không chấm = 0; chấm không đăng ký = 0.
- **Payslip cột cũ:** `kpiBonus` TÁI DỤNG chứa phần-nhân (UI/docs đổi nhãn "Phần KPI"); `variablePay` ghi 0 (deprecated). `KpiScore.kpiMax` nullable, không dùng; override KHÔNG cap (≥0, audit).
- **Catalog ca cố định (seed)**: Sale (group KINH_DOANH, SINGLE — 1 ca/ngày): ca1 8:30-18:00, ca2 10:00-20:00, ca3 13:00-21:00 (nghỉ trưa/giữa ca chỉ ghi docs — penalty dùng first/last punch nên không cần model break). GV (GIAO_VIEN, MULTIPLE tối đa 3): ca1 8:00-12:00, ca2 13:00-17:00, ca3 17:00-21:00.
- **Sale metric**: SUM `Receipt.netAmount` approved trong kỳ ICT (gross "doanh thu phê duyệt"). Attribution `createdByAppUserId` (= `AppUser.id`) — backfill + write path (hiện 0 writers); KHÔNG so `createdById` (namespace userId).
- **GV metric**: tổng GIỜ dạy = Σ `(endTime − startTime) × creditFactor` các buổi `done` trong tháng ICT thuộc batch có `teacherAppUserId`. creditFactor ≤24h→1.0, ≤48h→0.5, >48h→0.
- **Phiếu KpiScore** giữ nguyên lifecycle 4 bước; giờ mang: `shiftActual/shiftRequired`, `metricValue/metricRequired`, `value` = PHẦN NHÂN đã tính (tiền). GĐ override `value` như cũ. `payslip.assemble` đọc `value` từ phiếu confirmed+.
- **2 GĐ + super_admin**: metric null — refresh sinh draft value 0 để GĐ kia/super_admin override.

**Session-done engine (quyết định user, tinh chỉnh sau red-team R2):** buổi tự chuyển `done` khi đủ 3 điều kiện: (1) ≥1 HS điểm danh `present`, (2) mọi HS present có `QualitativeAssessment` confirmed của buổi (**màn nhận xét per-buổi build mới ở phase 5** — hiện chưa tồn tại trong sản phẩm), (3) `SessionEvidence` published ≥1 ảnh (**thêm guard publish ≥1 ảnh**). `doneAt` = timestamp muộn nhất, snapshot đóng băng. **Marking = worker SWEEP-ONLY** (bỏ event-hooks — race crossed-tx + không có consumer real-time); sweep chỉ đánh giá buổi đã qua `endTime` (time gate chống gian lận). Buổi quá `endTime+24h` 0-present → auto `cancelled` + **buổi bù tự nối đuôi khóa** (cùng slot, `makeupForSessionId @unique` idempotent, room-conflict → flag chờ người — full-auto theo yêu cầu user). Buổi pre-activation: one-time backfill done, creditFactor miễn. Chấm bài tập KHÔNG thuộc done. Buổi `done` không hủy được.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [DB schema & migrations](./phase-01-db-schema-migrations.md) | Done |
| 2 | [Payroll correctness (TDD)](./phase-02-payroll-correctness-tdd.md) | Done |
| 7 | [Session-done engine & auto-reschedule (TDD)](./phase-07-session-done-auto-reschedule.md) | Done |
| 3 | [KPI auto-score & lifecycle (TDD)](./phase-03-kpi-auto-score-lifecycle-tdd.md) | Done |
| 4 | [Shift reject & list procedures (TDD)](./phase-04-shift-reject-list-procedures-tdd.md) | Done |
| 5 | [UI nav & HR screens](./phase-05-ui-nav-hr-screens.md) | Done |
| 6 | [E2E specs & docs sync](./phase-06-e2e-specs-docs-sync.md) | Done |

Execution order: 1 → (2, 7, 4 song song) → 3 (cần 1+7) → 5 (cần 2,3,4; SAU premium plan) → 6. Tổng effort ước **~58h** (sau validate s3: 6+7+9+10+4+18+4 — mô hình lương bậc + màn nhận xét per-buổi + màn bậc lương).

## Dependencies

**Cross-plan — QUYẾT ĐỊNH USER (validation 2026-07-11, thay quyết định "song song" trước đó): plan này triển khai SAU khi plan `260711-1720-premium-erp-screen-buildout` hoàn tất phần đang build** → `blockedBy` ở frontmatter. Hệ quả:
- Phase 5 build behavior TRÊN các màn đã được premium plan migrate (check-in-out, shifts, kpi, payroll đã ở premium template khi plan này chạy).
- Premium phase-08 (shift-config real build) trở nên redundant — plan này own shift-config; khi cook plan này, ghi chú vào premium plan nếu phase-08 chưa chạy.
- Admin component-test harness ĐÃ TỒN TẠI (`apps/admin/vitest.config.ts`, `src/test/render-with-providers.tsx`, `mock-trpc.ts`) — phase 5 dùng trực tiếp.

## Acceptance criteria (toàn plan)

- [ ] Ngày có `ManualAttendanceTicket` approved → payslip không đếm unpunchedDays, không phạt muộn/sớm ngày đó; duyệt ticket muộn sau finalize → warning.
- [ ] Penalty rates đọc từ `CompensationPolicy` per-facility (fallback 500/1000).
- [ ] KPI lifecycle mới đầy đủ; không còn đường nhập điểm tay của nhân viên; **không role nào tự duyệt/tự tất toán phiếu của chính mình**; branch-scope theo ROLE (không dùng position free-text); phiếu GĐ chỉ GĐ-kia + super_admin xử lý; assemble lấy `value` phần-nhân từ phiếu confirmed+; công thức bậc `base + %×%×đơnGiá − phạt` đúng trong test liên phase; bulkApprove chỉ phiếu có payslip finalized; sửa-sau-approved chỉ super_admin khi payslip reopen.
- [ ] Sale revenue attribution đúng namespace (`createdByAppUserId`, có backfill); doanh thu = 0 chỉ khi thật sự không có phiếu.
- [ ] Session tự chuyển `done` khi đủ 3 điều kiện; creditFactor 24h/48h đúng biên ICT; buổi 0-HS tự cancel + sinh makeup tuần kế.
- [ ] `shift.reject` lý do bắt buộc; ticket-lock (WHERE status='submitted' — KHÔNG mở rộng) giải phóng sau reject; range + overlap validation.
- [ ] 5 role thấy đúng nav; không paste-UUID; shift-config CRUD thật; lỗi checkin đọc qua `shape.data.appCode` (errorFormatter), không string-match.
- [ ] 2 e2e specs (shift-lifecycle, kpi-lifecycle) xanh; toàn suite xanh; typecheck admin chạy từ phase 2 trở đi; build 14/14.
- [ ] Docs TL10/11/20/25 + ADR 0042 (docs/22 numbering) sync; `gitnexus_detect_changes` khớp scope.

## Verification commands

```bash
pnpm --filter @cmc/api test                 # narrowest per phase
pnpm --filter @cmc/admin typecheck          # gate từ phase 2 (chặn break kpi.tsx giữa chừng)
pnpm --filter @cmc/admin test && pnpm build # 14/14
pnpm --filter @cmc/e2e test                 # phase 6
```

## Red Team Review

### Session — 2026-07-11
**Findings:** 24 sau dedupe từ 38 thô (4 reviewer: Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope Critic — Full tier, 36+ claims verified, 8 FAILED)
**Severity:** 4 Critical, 8 High, 12 Medium — **24 accepted, 0 rejected** (tất cả có file:line evidence)

| # | Finding | Sev | Disposition | Applied To |
|---|---------|-----|-------------|------------|
| 1 | Chuỗi GĐ tự trả thưởng (override no anti-self + bulkApprove quét cả caller + confirmed+ gate) | Critical | Accept | Phase 3 |
| 2 | Sale attribution namespace break (`createdByAppUserId` 0 writers; `createdById`=userId≠appUser.id) | Critical | Accept | Phase 1, 3 |
| 3 | GV metric không có data path (no session teacher, no done state) | Critical | Accept → user redesign (giờ dạy + done engine) | Phase 1, 7, 3 |
| 4 | KPI mutable sau finalize; bulkApprove↔finalize không thứ tự | Critical | Accept | Phase 3 |
| 5 | `error.cause` không qua wire tRPC — cần errorFormatter | High | Accept | Phase 4, 5 |
| 6 | `Receipt.approvedAt` thiếu + không backfill | High | Accept | Phase 1 |
| 7 | Plan viết sai WHERE ticket-lock idx (thực tế submitted-only) | High | Accept — sửa text, KHÔNG mở rộng idx | Phase 1, 4 |
| 8 | `kpi.refresh` thiếu concurrency contract (P2002, đè submitted race) | High | Accept | Phase 3 |
| 9 | Day-1 guard ICT boundary + phase-6 tự mâu thuẫn mock clock | High | Accept | Phase 3, 6 |
| 10 | Bỏ `kpi.submit` phá `getForUser` gate; override-tree.test = rewrite toàn file | High | Accept | Phase 3 |
| 11 | Mâu thuẫn `kpi.approve` đơn lẻ vs bulkApprove-only | High | Accept — BỎ kpi.approve đơn lẻ | Phase 3, 5 |
| 12 | Route guard admin không tồn tại (chỉ login) | High | Accept — sửa criterion | Phase 5 |
| 13 | Ticket duyệt muộn sau finalize → phạt vĩnh viễn | High | Accept — warning + docs | Phase 2 |
| 14 | `manualPunch.list` inbox lệch gate approve (managerId) | Med | Accept | Phase 4 |
| 15 | `kpi.list` lộ doanh thu cross-branch — cần group-type filter | Med | Accept | Phase 3 |
| 16 | CHECK constraint = DROP+ADD+VALIDATE; rollback note sai (mất data) | Med | Accept | Phase 1 |
| 17 | Refund không trừ khỏi "thực thu" | Med | Accept → user chốt GROSS, đổi tên metric | Phase 3, 6 |
| 18 | E2E gold-plating — cắt 5→2 specs | Med | Accept | Phase 6 |
| 19 | `checkInOut.history` + `payslip.list` ngoài scope remediation | Med | Accept — cắt/defer | Phase 4, 5 |
| 20 | Self-read không cần permission key mới | Med | Accept | Phase 4 |
| 21 | ADR convention: docs/22 numbering, không có docs/adr | Med | Accept — 1 ADR 0042 + 2 QĐ docs/20 | Phase 6 |
| 22 | Gộp my-kpi + my-payslip → 1 trang "Của tôi" | Med | Accept | Phase 5 |
| 23 | Effort under-estimated (p3, p5) | Med | Accept — re-estimate, tổng ~45h | plan.md |
| 24 | Phase-5 claim sai "kpi.tsx gọi kpi.submit" + dòng lặp | Med | Accept — sửa inventory | Phase 5 |

### Whole-Plan Consistency Sweep (R1)
- Files reread: plan.md + 7 phase files (sau khi viết lại toàn bộ)
- Decision deltas checked: 11 — Unresolved contradictions: 0

### Session 2 — 2026-07-11 (Round 2, sau khi plan rewrite)
**Findings:** 21 mới (7 Critical, 6 High, 8 Medium) từ 4 reviewer scoped vào material mới — **21 accepted, 0 rejected** (fact-check 12/12 verified; 4 assumption FAILED có evidence)

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| R2-1 | Done-hook race crossed-tx, không sweep cứu → BỎ hooks, sweep-only marking | Critical | Phase 7 |
| R2-2 | Makeup +7d đụng lịch pre-generated; NULL-slot unique không bảo vệ → tail-append + `makeupForSessionId @unique` | Critical | Phase 1, 7 |
| R2-3 | Buổi pre-activation không bao giờ done → GV KPI≈0 tháng đầu → backfill script riêng | Critical | Phase 7 |
| R2-4 | Điều kiện nhận xét per-buổi KHÔNG có đường sản phẩm → build màn per-buổi (user chốt) | Critical | Phase 5, 7 |
| R2-5 | `ClassBatch.teacherId` NULL toàn bộ, không update mutation → `assignTeacher` + picker UI | Critical | Phase 1, 5 |
| R2-6 | `resolveShiftGroup(position)` sai cho scope tiền (GĐĐT→KINH_DOANH, free-text) → branch-scope theo ROLE + rule phiếu GĐ | Critical | Phase 3 |
| R2-7 | Không time-gate done (điểm danh trước giờ = gian lận credit) → sweep chỉ quét buổi đã qua endTime | Critical | Phase 7 |
| R2-8 | errorFormatter generic leak Prisma P2xxx → AppCodeError/allowlist + negative test | High | Phase 4 |
| R2-9 | manualPunch approve không super_admin bypass; ticket GĐ không ai duyệt → gate + bypass | High | Phase 4 |
| R2-10 | Nộp sớm ngày 1 mất giờ buổi done muộn → submitSlip auto-refresh cùng tx | High | Phase 3 |
| R2-11 | bulkApprove↔finalize không thứ tự + approved không van sửa → chỉ-payslip-finalized + van super_admin-khi-reopen | High | Phase 3 |
| R2-12 | Publish evidence 0 ảnh = dead-end vĩnh viễn → guard ≥1 ảnh | High | Phase 7 |
| R2-13 | SessionStatus widening 11 consumers chưa liệt kê (cancel xóa được buổi done!) → cancel guard + fixtures + UI badge | High | Phase 7, 5 |
| R2-14 | Premium co-located tests sẽ đỏ → liệt kê rewrite targets | Med | Phase 5 |
| R2-15 | approvedAt backfill thực tế chính xác (tin tốt); note `sent` status future-trap | Med | Phase 6 |
| R2-16 | Overrider ≠ bulkApprover cho phiếu GĐ — chấp nhận rủi ro có ghi nhận (5-role, super_admin backstop) | Med | docs (P6) |
| R2-17 | ALTER TYPE invariant note sai trọng tâm + IF NOT EXISTS | Med | Phase 1 |
| R2-18 | Activation constant hardcode domain-time, không env | Med | Phase 7 |
| R2-19 | creditFactor thuộc packages/domain-time (tiền lệ ict-time) | Med | Phase 7 |
| R2-20 | Sweep race với điểm danh muộn → conditional single-statement UPDATE | Med | Phase 7 |
| R2-21 | Effort 45h→52h (nhận xét per-buổi + picker + consumers mới) | Med | plan.md |

### Whole-Plan Consistency Sweep (R2)
- Files reread: plan.md + 7 phase files sau khi áp 21 findings
- Decision deltas: sweep-only marking; tail-append makeup; branch-scope ROLE; màn nhận xét per-buổi; assignTeacher; bulkApprove-finalize ordering; van approved; AppCodeError; approve-gate super_admin; backfill pre-activation
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-07-11 (auto, sau red-team)
Verification: Full tier qua 4 reviewer (36+ claims; 8 FAILED — tất cả đã sửa vào plan). Câu hỏi user: 6 (2 vòng × 3).

| Quyết định | Trả lời |
|---|---|
| Metric GV | **Tổng giờ dạy** × creditFactor 24h/48h/0 theo cơ chế done 3 điều kiện (điểm danh + nhận xét HS present + ảnh evidence; chấm bài tập KHÔNG tính) |
| Buổi done | Hệ thống TỰ chuyển trạng thái khi đủ 3 điều kiện; 0 HS present → auto-cancel + dời tuần kế |
| Auto-reschedule | **Trong scope plan này** (phase 7, worker sweep theo pattern reconcile-* có sẵn) |
| Metric sale | **Gross phiếu thu đã duyệt** — docs đổi tên "doanh thu phê duyệt", không trừ refund |
| Premium plan | **Triển khai plan này SAU premium** → blockedBy (thay quyết định song song cũ) |
| (Vòng brainstorm) 9 quyết định gốc | Giữ nguyên, xem brainstorm report |

### Session 2 — 2026-07-11 (Round 2)
| Quyết định | Trả lời |
|---|---|
| Điều kiện nhận xét trong done | **Build màn nhận xét per-buổi** (roster present → AI draft → confirm từng em/confirm-all) — giữ đúng cơ chế 3 điều kiện |
| "Dời lịch tuần kế" khi lịch pre-generated | **Full-auto: buổi bù tự nối đuôi khóa** (cùng slot, sau buổi cuối; makeupForSessionId idempotent; conflict phòng → chờ người). "Chỉ đưa con người vào luồng thực sự cần" |

### Session 3 — 2026-07-11/12 (làm rõ vướng mắc — 8 quyết định, 2 vòng)
| Quyết định | Trả lời |
|---|---|
| **Mô hình lương** (thay hiểu cũ) | `totalNet = baseSalary(bậc) + %côngca × %chỉ-số × đơnGiá(bậc) − phạt`. BỎ variablePay + kpiBonus/kpiMax cũ. %côngca áp dụng CẢ sale + GV; sale thay %giờ bằng %doanh thu; chỉ số bổ sung cung cấp sau |
| Công ca thực | Đăng ký approved + **chấm đủ vào-ra theo ca** (midpoint rule; ticket approved = tương đương). Catalog ca cố định: sale 3 ca SINGLE, GV 3 ca MULTIPLE (giờ cụ thể trong Overview) |
| Bậc lương | **Bảng `SalaryTier`** per-facility + `SalaryRate.tierId` gán bậc |
| Trần % | **Cap 100% cả hai** (%côngca, %chỉ-số) |
| Màn nhập lương/quota | **Thêm phase 5**: màn "Bậc lương & gán bậc" (SalaryTier CRUD + gán tier) cho 2 GĐ |
| Guard nộp phiếu | **Đổi ngày 1 → NGÀY 3** tháng kế tiếp (cửa 48h đã đóng, hết residual — thay quyết định session 1) |
| Siết confirm nhận xét | **Confirm-all + audit log**; GĐĐT hậu kiểm qua report-card tháng |
| (Hệ quả) | Quyết định session brainstorm "kpiBonus = kpiMax × min(1, đạt/quota)" bị THAY THẾ bởi mô hình nhân bậc lương |

### Session 3 — 2026-07-12 (Round 3, scoped mô hình lương bậc)
**Findings:** 19 thô → 14 sau dedupe (3 Critical, 6 High, 5 Medium) — **14 accepted** (fact-check 18/20 verified, 1 FAILED docs/17, 1 half-verified MULTIPLE cap)

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| R3-1 | Tier self-enrichment chain (GĐ tự tạo/gán/chốt) → GIẢI QUYẾT GỐC bằng QĐ user "lương GĐ ngoài hệ thống" + assignTier chỉ sale/GV + audit tier | Critical | Phase 1,2 |
| R3-2 | Payslip.variablePay/kpiBonus NOT NULL không có write contract → kpiBonus tái dụng "Phần KPI", variablePay=0; UI relabel; penalty-posttax + payroll.test.tsx reclassify REWRITE | Critical | Phase 1,2,5 |
| R3-3 | Day-1 tier deadlock + GĐ không map type → VÔ HIỆU bởi greenfield + GĐ ngoài payslip; onboarding runbook gán bậc | Critical | Phase 2,6 |
| R3-4 | upsertRate vô chủ / 2 nguồn baseSalary → BỎ upsertRate + key; nullable 3 cột SalaryRate | High | Phase 1,2 |
| R3-5 | KpiScore.kpiMax NOT NULL + sót "cap kpiMax" → nullable; override không cap | High | Phase 1,3 |
| R3-6 | Penalty per-ngày "use first entry" sai với MULTIPLE + nondeterministic → rewrite phạt PER-CA | High | Phase 2 |
| R3-7 | Midpoint gaming (số thật: lời khi đơnGiá/ca > 426k) + mâu thuẫn spec/test → rule vào/ra + không tái dùng punch + phạt per-ca + flag span<50% (QĐ user: sớm/muộn không mất ca) | High | Phase 3,2 |
| R3-8 | Entry trùng thổi công (không unique, MULTIPLE không cap) → DISTINCT collector + submit guard dup template/day | High | Phase 3,4 |
| R3-9 | Tier retroactive không snapshot unitRate → snapshot unitRate+tierId vào phiếu + audit updatedById | High | Phase 1,3 |
| R3-10 | Màn bậc lương thiếu nav/route (lặp lỗi #12/#24) → hàng nav + route /hr/salary-tiers | Med | Phase 5 |
| R3-11 | Seed catalog không idempotency key → @@unique ShiftGroup(facilityId,name) + ShiftTemplate(shiftGroupId,name), upsert theo key | Med | Phase 1 |
| R3-12 | Docs sweep thiếu docs/27 + uat-checklist (kpi.submit/approve chết) + docs/17 target sai + phase-06:26 stale | Med | Phase 6 |
| R3-13 | Precision contract %×%×đơnGiá → Number coercion + round half-up 0 lẻ VND trước persist + exact-value tests | Med | Phase 3 |
| R3-14 | Sweep-availability trước submitSlip → submitSlip inline done-evaluate sessions của GV trước refresh | Med | Phase 3 |

### Whole-Plan Consistency Sweep (S3)
- Files reread + edited: plan.md, phase-01/02/03/05/06 — Unresolved contradictions: 0

### Session 4 — 2026-07-12 (validate sau red-team R3 — 3 quyết định)
| Quyết định | Trả lời |
|---|---|
| Quy tắc công ca | **Ngữ nghĩa user giữ nguyên**: có chấm vào + chấm ra quanh ca = có công; sớm/muộn KHÔNG mất ca — phạt phút xử (per-ca). Guardrails kỹ thuật: punch không tái dùng, flag span<50%, phạt per-ca |
| Kỳ đầu chưa gán bậc | **Greenfield** — dự án chưa triển khai, không có cơ chế cũ; gán bậc = bước onboarding (runbook), FORBIDDEN thiếu tier là guard đúng, không fallback |
| Lương GĐ + super_admin | **Ngoài hệ thống** — payslip/phiếu KPI/tier chỉ cho sale/GV; chuỗi tier-self-enrichment triệt tiêu tận gốc |

### Whole-Plan Consistency Sweep (S4)
- Files reread + edited: plan.md, phase-01/02/03/04/05/06 (phase-07 không đổi bởi R3/s4)
- Decision deltas: GĐ ngoài payslip (bỏ nhánh phiếu GĐ); greenfield (bỏ fallback); công ca vào/ra + phạt per-ca; kpiBonus tái dụng; bỏ upsertRate; snapshot unitRate; unique keys seed; nav bậc lương
- Unresolved contradictions: 0
