---
title: "Nghiệm thu toàn diện — journey 38 luồng ERP + LMS, sổ trạng thái máy-chứng"
description: >-
  Quét toàn bộ 38 luồng manifest bằng journey theo trình tự vai thật (Q5), mở
  sang LMS (parent OTP + student activation), nâng sổ nghiệm thu lên trạng thái
  per-flow do MÁY chứng nhận (ingestion kết quả Playwright — đóng lỗ
  fabrication). Quét-hết-rồi-sửa: luồng đỏ ghi fixme + lý do, KHÔNG sửa app
  trong plan này.
status: pending
priority: P1
branch: main
tags: [acceptance, e2e, journey, lms, ledger, tdd]
blockedByNote: >-
  GIẢI TỎA 2026-07-24: baseline đã land main tại 9dabc76 (journeys/, ops-smoke,
  ledger journey coverage, CI ui-e2e job) — verify local trước merge: typecheck
  27/27, lint sạch, 1491 test pass, 0 code sản phẩm bị chạm. Plan chạy được
  ngay trên branch mới cắt từ main.
  Lịch sử: RT-7 phát hiện baseline chỉ tồn tại uncommitted; validate V2 chốt
  ship branch trước — đã thực hiện.
blocks: [260717-1213-so-nghiem-thu-song]
created: '2026-07-24T05:12:00.000Z'
createdBy: 'ak:plan --tdd'
source: skill
sourceReport: 'plans/reports/brainstorm-260724-1158-journey-38-lms-forks-decisions-report.md'
---

# Nghiệm thu toàn diện — journey 38 ERP + LMS

## Overview

Advise 260724 (user-confirmed): dự án cần bức tranh sống/chết trung thực của
TOÀN BỘ nghiệp vụ trước khi ký nghiệm thu. Khuôn đã có (10 journey xanh, luật
§4.2/§4.3, 3 tầng đo của `260723-1422`); plan này nhân rộng: 38/38 luồng ERP có
trạng thái, LMS được phủ lần đầu, và trạng thái "xanh" chỉ có thể do máy ghi
nhận. Kế tục sứ mệnh ledger của `260717-1213` (plan đó bị block bởi plan này vì
cùng sửa `scripts/acceptance-report/`).

## Quyết định đã chốt (user 2026-07-24, phê duyệt thật trong phiên — không mở lại)

| # | Quyết định | Nguồn |
|---|---|---|
| D0 | Kế thừa nguyên advise 260724: per-flow expansion (không Ngày-0), quét-hết-rồi-sửa, ERP→LMS, UAT M0 người thật vẫn là lần ký cuối | advise 260724 |
| D1 (F-A) | **A2**: login UI thật (OTP từ `EmailOutbox.payload`) CHỈ trong journey mà login/kích hoạt LÀ nghiệp vụ; journey LMS khác inject session. **Hiệu chỉnh red-team (RT-1, user 2026-07-24):** token LMS ĐÃ ký HMAC (`apps/api/src/lms-auth/session-token.ts:50,78`) và helper mint ĐÃ có (`mintParentToken`/`mintStudentToken`, `apps/e2e/src/session-injection.ts:41,61`) — `mintLmsSession()` chỉ là wrapper ghi session vào browser storage, GỌI helper sẵn có; `session-injection.ts` là chủ sở hữu duy nhất của định dạng token. **RT-6 (user 2026-07-24):** wrapper parent bơm cache `children` từ DB (carve-out tường minh — `parent/home.tsx:124` render từ cache login) | brainstorm F-A + red-team |
| D2 (F-B) | Ngưỡng lỏng **60–90 phút** cho tổng runtime; đo trước (Phase 1); vượt → nightly trước, shard sau, per-worker facility là cuối cùng | brainstorm F-B |
| D3 (F-C) | **C1 ingestion**: trạng thái `xanh` per-flow CHỈ từ kết quả Playwright JSON; thiếu kết quả → "declared, unproven"; `statusReason{code,detail}` cho fixme/no-UI-path. **Hiệu chỉnh red-team (RT-2/3/4, user 2026-07-24):** threat model trung thực — ingestion NÂNG CHI PHÍ tự lừa, không chống giả mạo chủ động; (a) results ghi git SHA + metadata run; lệch SHA hoặc thiếu tập spec đã khai → unproven/"partial run"; (b) **nguồn chính danh cho sổ v1 = artifact job `ui-e2e` chạy FULL `ui-chromium` MỖI PUSH** (validate V1, user 2026-07-24 — chọn per-push thay nightly, chấp nhận chi phí runner; nếu job vượt ngưỡng D2 thì lùi theo thang F-B: nightly → shard; warn-first, không nâng gate), run local chỉ advisory; (c) json reporter gate theo `PLAYWRIGHT_UI` để run api không ghi đè | brainstorm F-C + red-team + validate |
| D4 (F-D) | Đợt viết journey theo nhóm nghiệp vụ: tiền → ghi danh/vận hành lớp → HR → rewards/admin. **Hiệu chỉnh red-team (RT-8):** field `cluster` manifest là nhãn phase build (P1/P2/P3/P4/ADMIN), KHÔNG phải nhóm nghiệp vụ — Phase 2 sinh cột `flow→đợt` làm khóa chia đợt và gán chủ sở hữu P1-06/P1-07 (LMS) cho Phase 4/8 | advise + red-team |

## Bất biến

- `packages/auth/src/index.ts` không đổi; KHÔNG sửa hành vi app nào — luồng đỏ ghi `fixme` + `statusReason`, việc sửa thuộc plan kế tiếp.
- Luật §4.2/§4.3 giữ nguyên: không `page.goto()` màn đích, không truyền id giữa vai; dữ liệu do vai tự tạo qua UI thật (Q5) — ngoại lệ seed chỉ khi có bằng chứng grep "không có UI" **và** user duyệt với ngày thật (bài học `260724-1500-fabricated-approvals`).
- Luật H2: chỉ gắn `journey:` vào flow khi giao procedure/route thật. Luật H5: đuôi spec `.journey.ui.spec.ts`.
- Không email thật; OTP đọc từ outbox DB; không PII vào artifact. Không nâng gate CI nào lên chặn merge trong plan này.
- TDD: mỗi phase có bước falsification đỏ-trước-xanh-sau ghi trong phase file.

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Đo runtime baseline + quyết định F-B](./phase-01-do-runtime-baseline.md) | Pending | — |
| 2 | [Triage 38 luồng](./phase-02-triage-38-luong.md) | Pending | — |
| 3 | [Sổ trạng thái máy-chứng — ingestion vào AcceptanceState](./phase-03-so-4-trang-thai-va-ingestion.md) | Pending | — |
| 4 | [Hạ tầng phiên LMS + 2 journey login/activation](./phase-04-ha-tang-phien-lms.md) | Pending | 2 |
| 5 | [Đợt tiền — finance](./phase-05-dot-tien-finance.md) | Pending | 1,2,3 |
| 6 | [Đợt ghi danh + vận hành lớp](./phase-06-dot-ghi-danh-van-hanh-lop.md) | Pending | 5 |
| 7 | [Đợt HR/payroll + rewards/admin](./phase-07-dot-hr-rewards-admin.md) | Pending | 6 |
| 8 | [Đuôi LMS xuyên suốt + chốt sổ v1](./phase-08-duoi-lms-va-chot-so-v1.md) | Pending | 4,7 |

Phase 1/2/3 độc lập nhau, chạy song song được. Đợt 5→6→7 nối tiếp để helper
tích lũy (đợt sau rẻ hơn đợt trước) và giữ nghi thức 4×green từng đợt.

## Success Criteria (toàn plan)

- [ ] `pnpm acceptance:report`: 38/38 flow có trạng thái máy-chứng (`proven`/`built-unproven`+badge/`not-yet`); 0 flow "không biết"; ≥5 luồng có đuôi LMS được phủ
- [ ] Trạng thái `xanh` chỉ sinh từ results có SHA khớp HEAD + đủ tập spec đã khai; falsification: (a) xoá results → unproven, (b) results SHA lệch → unproven, (c) results thiếu spec ("partial run") → bị flag; sổ v1 chỉ sinh từ artifact CI — job `ui-e2e` full mỗi push, V1 (RT-2/3/4)
- [ ] Khai `journey:` trỏ file không tồn tại hoặc mapping sai H2 → `verify` FAIL; flow đỏ THIẾU statusReason → render "đỏ chưa triage" (không FAIL — RT-13)
- [ ] Nghi thức xanh (RT-9): mỗi đợt = 4× spec-của-đợt + 1× full suite; full suite 4× liên tiếp CHỈ ở Phase 8 với luật retry/reset ghi thành văn; spec đỏ có `fixme` + `statusReason` kèm bằng chứng
- [ ] Mọi ngoại lệ seed có bằng chứng grep + dòng duyệt user ngày thật trong phase file
- [ ] `pnpm typecheck · lint · test` xanh; `git diff packages/auth/src/index.ts` rỗng
- [ ] Quyết định F-B (serial/nightly/shard) được ghi lại Phase 1 với số đo thật

## Ngoài phạm vi (plan kế tiếp)

- Sửa các luồng đỏ phát hiện được (bug/thiếu-đường-UI) — cần bức tranh toàn cảnh trước.
- Nâng gate CI warn→chặn (điều kiện Q4 của `260723-1422`: ≥2 tuần dữ liệu, báo-giả ~0). Việc chạy full `ui-chromium` trong CI/nightly + upload artifact (RT-3) KHÔNG phải nâng gate — vẫn warn-first.
- Automation Entra SSO/MFA (N3); capture LMS (N4) — journey LMS của plan này KHÔNG thay tầng capture.
- 3 finding sản phẩm từ red-team đưa vào danh sách bàn giao plan-sửa (RT-15): (a) OTP plaintext-at-rest trong `EmailOutbox.payload` không RLS (`router.ts:423`); (b) secrets dev-default committed trong repo — negative RLS/consent chỉ có nghĩa khi env dùng secret riêng (điều kiện Phase 8); (c) `parseLmsToken` client không verify chữ ký (`lms-session.tsx:39` — token server ĐÃ ký, RT-1; sửa dòng doc cũ `docs/system-architecture.md:76` trong Phase 4).

## Red Team Review

### Session — 2026-07-24
**Reviewers:** Security Adversary · Failure Mode Analyst · Assumption Destroyer · Scope & Complexity Critic (4 agent song song, Full tier)
**Findings:** 35 thô → **15 sau khử trùng lặp** (15 accepted, 0 rejected toàn phần; RT-14 reject riêng phần "gộp Phase 1 vào Phase 5" — đo-trước-quyết-sau là quyết định D2 của user, nguồn: brainstorm F-B). Mọi finding có `file:line`; các Critical được orchestrator tự grep xác nhận.
**Severity:** 3 Critical · 9 High · 3 Medium
**User chốt trong phiên (phê duyệt thật):** áp toàn bộ; nguồn sổ v1 = artifact CI/nightly; parent inject bơm `children`.

| # | Finding | Sev | Disposition | Áp vào |
|---|---------|-----|-------------|--------|
| RT-1 | Phase 4 nền sai: token LMS đã ký HMAC, mint helper đã có; `parseLmsToken` chỉ decode client; doc `system-architecture.md:76` cũ | Critical | Accept | Phase 4, plan.md D1 + Ngoài phạm vi |
| RT-2 | "Xanh bất khả viết tay" là claim giả — results.json local sửa tay được; sổ v1 là con trỏ treo | Critical | Accept | Phase 3, 8, plan.md D3 + SC |
| RT-3 | CI không sản xuất bằng chứng: `ui-e2e` chạy 1 spec (ci.yml:266); `continue-on-error` nuốt FAIL | High | Accept | Phase 3, plan.md D3 |
| RT-4 | Reporter config-global: run api ghi đè results của run UI; partial run đầu độc sổ | High | Accept | Phase 3 |
| RT-5 | L-02 viết ngược: `resetChildPassword` xoá cờ `mustChangePassword` (router.ts:637) → gate không thể xuất hiện nơi kịch bản đặt | Critical | Accept | Phase 4 |
| RT-6 | Parent inject thấy 0 con — cache `children` chỉ có từ login OTP thật (parent/home.tsx:124) | High | Accept | Phase 4, 8 |
| RT-7 | blockedBy sai phạm vi — toàn baseline uncommitted trên branch; main có 0 journey | High | Accept | plan.md frontmatter |
| RT-8 | Cơ chế D4 không tồn tại: `cluster` = P1..P4/ADMIN; P1-06/P1-07 chưa có đợt sở hữu; grep call-site ≠ menu-reachability | High | Accept | Phase 2, 5-7, plan.md D4 |
| RT-9 | 4×green toàn-suite mỗi đợt: 12-24h máy, P≈47% ở p=99.5%; luật reset/retry chưa định nghĩa | High | Accept | Phase 5-8, plan.md SC |
| RT-10 | OTP rate-limit (30s + 5/15') đếm theo LoginOtp email mà cleanup chỉ xoá theo phone; ParentAccount reuse-by-phone từ run crash → false red; enqueue câm lặng `{ok:true}` | High | Accept | Phase 4 |
| RT-11 | `read-otp-from-outbox.ts` trùng `readOtpCode`/outbox readers trong db.ts; race với scrub async | High | Accept | Phase 4 |
| RT-12 | Phase 3 bolt chiều thứ 3 trong khi `AcceptanceState`+TODO EvidenceIndex có sẵn (acceptance-tab.ts:17-23); "4 trạng thái" thực là 5; no-ui-path là metadata manifest; fixme/skip/all-fixme chưa định nghĩa (all-fixme có thể thành green); vitest chưa có host trong scripts/ | High | Accept | Phase 3 |
| RT-13 | Hard-FAIL khi đỏ-thiếu-statusReason bricks tool + tạo động cơ gõ đại lý do | Medium | Accept | Phase 3 |
| RT-14 | Phase 1 sai số: 13 spec không phải 17; median lẫn spec capture; runner CI chậm 2-4× → verdict D2 provisional | Medium | Accept (reject phần gộp Phase 1 vào Phase 5 — verified: quyết định D2 user) | Phase 1 |
| RT-15 | Secrets dev-default + OTP plaintext-at-rest + client parse không verify — 3 finding sản phẩm chưa được flag | High | Accept (ghi sổ bàn giao, không sửa app) | Phase 8, plan.md Ngoài phạm vi |

### Whole-Plan Consistency Sweep — 2026-07-24
- Files reread: plan.md + phase-01..08 (grep sweep toàn thư mục)
- Decision deltas checked: 8 (chưa-ký/P0-debt · read-otp-from-outbox · cluster-làm-khóa · 4×full-suite · 17 specs · journey-status/JourneyStatus · "bất khả viết tay" · file DUY NHẤT token)
- Reconciled stale references: 2 (plan.md SC "journey-status" → trạng thái máy-chứng; label Phases row 3)
- Unresolved contradictions: **0** (các mention còn lại của thuật ngữ cũ đều nằm trong ghi chú hiệu chỉnh/bảng finding — chủ đích)

## Validation Log

### Session 1 — 2026-07-24
**Verification pass:** SKIPPED theo guard — `## Red Team Review` đã có bằng chứng verification (4 reviewer, ≥15 claims/role, 3 claim FAILED đã xử). **Failed còn lại: 0.**
**Questions:** 3 (mode=prompt, range 3-8 — plan đã qua 3 gate trước nên chỉ còn 3 decision point genuine).

| # | Câu hỏi | Quyết định (user) | Ghi chú |
|---|---|---|---|
| V1 | Nguồn artifact chính danh: nightly hay full mỗi push? | **Full `ui-chromium` MỖI PUSH** trong job `ui-e2e` (override khuyến nghị nightly của orchestrator) | Trade-off ghi nhận: chi phí runner 60-90'+/push; đường lùi nếu quá chậm = thang F-B (nightly → shard), không âm thầm đảo lại |
| V2 | Ship branch `uat-prep-nav-and-boot-checks` trước khi chạy plan? | **Ship trước**, plan chạy trên branch mới từ main sạch | Khớp RT-7; PR gọn, baseline ổn định |
| V3 | CI main fail ~2s mọi run — xử ở đâu? | **Điều kiện đầu Phase 3**: chẩn đoán + sửa lỗi workflow trước khi dựng job full-suite | Không có bước này thì V1 vô nghĩa |

### Whole-Plan Consistency Sweep — Validation Session 1
- Files reread: plan.md + phase-01..08 (grep "nightly|CI/nightly|schedule")
- Decision deltas checked: 3 (V1 per-push · V2 ship-first · V3 CI-fix-in-phase-3)
- Reconciled stale references: phase-03 (f)/steps, phase-08 nguồn chính danh, phase-01 thang gate — cập nhật cùng session
- Unresolved contradictions: **0**

## Reports

- Research: `plans/reports/research-260724-1153-journey-38-lms-acceptance-ledger-report.md`
- Brainstorm decisions: `plans/reports/brainstorm-260724-1158-journey-38-lms-forks-decisions-report.md`
- Advise (hợp đồng gốc): hội thoại 260724, tóm tắt trong brainstorm report

<!-- slug: nghiem-thu-toan-dien-journey-38-erp-lms -->
