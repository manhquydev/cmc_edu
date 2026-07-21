---
title: So Nghiem Thu Song - Living Acceptance Ledger
description: >-
  Regenerable acceptance dashboard: docs = danh sách luồng, code = bằng chứng
  tĩnh, app chạy = bằng chứng động. 1 lệnh sinh HTML 2 tab (Nghiệm thu /
  Builder).
status: in-progress
priority: P2
branch: main
tags:
  - acceptance
  - tooling
  - visibility
blockedBy: [260720-1230-independent-runtime-verification-38-flows]
blocks: []
created: '2026-07-17T05:34:37.843Z'
createdBy: 'ck:plan'
source: skill
---

# So Nghiem Thu Song - Living Acceptance Ledger

## Overview

Xây tool `pnpm acceptance:report` sinh 1 file HTML tự chứa, tiếng Việt, 2 chế độ xem:
- **Tab Nghiệm thu** (ban giám đốc CMC, non-dev): mỗi luồng nghiệp vụ 1 thẻ, trạng thái 3 mức, chuỗi screenshot app thật.
- **Tab Builder** (self-audit): symbol thiếu, e2e thiếu, orphan procedures (route/model orphan: v2), evidence cũ.

Mô hình bằng chứng 3 tầng: TL25 (33 luồng P1–P4, có sẵn procedure names + UI routes + test specs per WF) làm **mẫu số**, static verifier trên code thật làm bằng chứng "**đã xây**", Playwright UI screenshot làm bằng chứng "**đã chứng minh chạy**". Chống drift by design: mọi trạng thái tính lại từ code tại HEAD lúc generate.

**Chia đợt (red-team R2):** **v1 = Phases 1–3** — regenerable truth + tab Builder + tab Nghiệm thu, mọi luồng hiển thị tối đa ◐ "đã xây, chưa chứng minh" (trung thực, đủ giá trị cho cả 2 mục tiêu gốc, zero rủi ro DB/dữ liệu trẻ em). **Phase 4 (evidence) GATED** — giữ nguyên scope Dashboard+Evidence Pack user đã chốt, chỉ tái xếp thứ tự ship: khởi động khi v1 đã dùng thật VÀ môi trường DB synthetic-seed tồn tại (hiện CHƯA có — xem Red Team R2).

Nguồn: `plans/reports/brainstorm-260717-1213-so-nghiem-thu-song-report.md` (user approved 2026-07-17).

## Quyết định đã chốt (không mở lại nếu không có bằng chứng mới)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Verifier parse **`appRouter` trong `apps/api/src/router.ts` làm nguồn duy nhất namespace→router** (ts-morph, theo import graph, bất kể tên file); KHÔNG dùng glob tên file, KHÔNG regex-first | Red-team verified: namespace decouple khỏi tên file (`meeting/router.ts`→`parentMeeting`), 1 file export nhiều router (payroll→4 keys), `mergeRouters` (guardian, exercise), ~7 file ngoài pattern `router*.ts` (router.ts:18-46,64,78,93-107) |
| D2 | Flow ID giữ mã `WF-*` (P1-01…P4-05) từ TL25, thêm `displayName` tiếng Việt | Truy vết về workflow spec gốc; TL25 đã liệt kê đủ API+UI+test per WF |
| D3 | Evidence = screenshot, KHÔNG video trong scope này | Screenshot đủ cho giám đốc |
| D4 | Output vào `acceptance-report/` (repo root, **gitignore trước khi viết code capture**); `--inline` xuất **CHỈ tab Nghiệm thu** — Builder tab với raw symbol/route/model KHÔNG bao giờ vào file gửi ra ngoài | File gửi giám đốc bị forward được → không để lộ bản đồ API nội bộ (38 namespaces) |
| D5 | Renderer = TS template literal, zero framework, tự chứa | KISS |
| D6 | Evidence CHỈ chạy trên **DB throwaway seed giả 100%** với **positive gate**: `ACCEPTANCE_EVIDENCE_ALLOW=1` + sentinel row chứng minh synthetic seed + tái dùng `assertNotProdDatabase` trên **cả `APP_DATABASE_URL` lẫn `DATABASE_URL`**. **CẤM chạy trên local-sim** (Postgres local-sim chứa `cmc_prod` thật — dữ liệu trẻ em thật). Check tên DB đơn thuần KHÔNG đủ (socat decouple tên URL khỏi DB vật lý) | packages/db/src/index.ts:27 (APP_DATABASE_URL fallback DATABASE_URL); apps/e2e/src/global-setup.ts:99-100 (guard sẵn có đúng chuẩn); journal 260710:161-166 (local-sim=cmc_prod, socat) |
| D7 | ⬤ "Đã chứng minh chạy" yêu cầu `evidence.commit === HEAD` (working tree sạch); evidence cũ hơn → ◐ kèm nhãn "bằng chứng từ phiên bản cũ (commit, ngày)" | Ngưỡng "gần đây" mờ = cơ chế nói dối im lặng; strict match giữ lời hứa anti-drift |
| D8 | Evidence chụp từ **UI specs** (`*.ui.spec.ts`, `PLAYWRIGHT_UI=1`, project `ui-chromium`) — specs API-only KHÔNG có browser, không chụp được. UI evidence specs phải VIẾT MỚI dần (hiện chỉ có admin-shell + lms-login) | playwright.config.ts:4,37-54,69,73-84; 9/11 specs là API-driven no-browser |
| D9 | Metadata evidence/HTML theo **whitelist** `{flowId, stepLabel, specStatus, capturedAt, commit}` — KHÔNG BAO GIỜ render raw error text (Prisma/tRPC error chứa connection string + password) | apps/e2e/src/session-injection.ts:26,121,143 (secrets trong env) |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Flow Manifest + Static Verifier](./phase-01-flow-manifest-static-verifier.md) | Completed |
| 2 | [Builder Report (HTML tab ky thuat)](./phase-02-builder-report-html-tab-ky-thuat.md) | Completed |
| 3 | [Acceptance View (tab nghiem thu premium)](./phase-03-acceptance-view-tab-nghiem-thu-premium.md) | Completed |
| 4 | [Evidence Collector (Playwright UI screenshots)](./phase-04-evidence-collector-playwright-screenshots.md) | GATED — sau v1 + môi trường synthetic-seed |

Dependency: 1 → 2 → 3 (v1); 4 cần 1+2 + gate (v1 shipped, synthetic-seed env tồn tại).

## Acceptance Criteria

**v1 (Phases 1–3) — DONE 2026-07-17:**
- [x] `pnpm acceptance:report` chạy < 30s, sinh HTML phản ánh đúng code tại HEAD
- [x] Xoá 1 procedure khai trong manifest → hàng luồng đó chuyển đỏ ở lần generate sau (test chống drift) — 2 lần độc lập, cả 2 pass
- [x] Orphan detection cho tRPC procedures (route/model orphan: v2) → lộ trong Builder tab (114 orphans hiện đúng)
- [x] Manifest v1 = cụm P1 (9 luồng) verified end-to-end; các cụm còn lại thêm dần như routine (không phải gate ship)
- [x] Tab Nghiệm thu: zero jargon, desktop-first; mọi luồng built hiển thị ◐ "đã xây, chưa chứng minh" trung thực

**Phase 4 (khi gate mở):**
- [ ] `--evidence` budget ~5-8 phút (PLAYWRIGHT_UI=1 build admin+lms ~4 phút + UI specs) — KHÔNG hứa nhanh
- [ ] Xoá flow khỏi manifest → regenerate → evidence dir + index entry bị prune
- [ ] Spec fail/fixme/skip → flow KHÔNG ⬤; cảnh báo cả 2 tab, không lộ raw error
- [ ] `--inline` không chứa Builder tab / raw symbols
- [ ] Evidence gate: DB không sentinel synthetic-seed → runner từ chối

## Red Team Review

### Session — 2026-07-17
**Reviewers:** Security Adversary (8 findings) + Failure Mode Analyst (10 findings); Assumption Destroyer chết session-limit — 3 giả định còn lại (TL25 quality, @cmc/auth registry, @cmc/ui tokens, route file shape) do controller tự verify: TL25 có đủ API+UI+test per WF (docs/25:19-53) ✅; ROLES/ACTIVE_ROLES export thật (packages/auth/src/index.ts:10,27) ✅; tokens.css tồn tại (packages/ui/src/tokens.css) ✅; route paths là segment TƯƠNG ĐỐI compose bởi parent (finance.routes.tsx:18-40) → route-scanner phải compose prefix.
**Findings:** 18 thu về, dedupe còn 16 (2 cặp trùng: scanner-glob, whitelist) — **16 Accept, 0 Reject** (tất cả có file:line evidence).
**Severity:** 7 Critical, 6 High, 3 Medium.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Guard sai biến env — phải reuse `assertNotProdDatabase` trên APP_DATABASE_URL (+DATABASE_URL) | Critical | Accept | Completed |
| 2 | local-sim = cmc_prod thật (dữ liệu trẻ em) — cấm evidence trên local-sim; loại view cross-facility/super-admin khỏi flows chụp | Critical | Accept | Completed |
| 3 | Check tên DB bypass được (socat) — positive gate ALLOW env + sentinel synthetic seed | Critical | Accept | Completed |
| 4 | Scanner glob `router*.ts` + regex miss ~7 router, mergeRouters, multi-export, namespace≠filename | Critical | Accept (gộp 2 finding) | D1, Phase 1 |
| 5 | Evidence nhắm specs API-only không có browser — phải dùng/viết UI specs, PLAYWRIGHT_UI=1 | Critical | Accept | D8, Phase 4 |
| 6 | Runner spawn lệnh test API-only → 0 screenshot; thiếu budget ~4min build | Critical | Accept | D8, Phase 4, AC |
| 7 | ⬤ "commit gần đây" mờ → false green; phải === HEAD | Critical | Accept | D7, Phase 3 |
| 8 | `--inline` bundle Builder tab = bản đồ recon API nội bộ gửi ra ngoài | High | Accept | D4, Phase 2+4 |
| 9 | Không redaction — raw error chứa DB password vào HTML gửi đi | High | Accept | D9, Phase 4 |
| 10 | `acceptance-report/` chưa gitignore; ảnh trẻ em 1 bước sơ suất là vào git history | High | Accept | Phase 1 step 1 + runner self-check |
| 11 | Orphan chỉ cover procedures — routes/models drift im lặng | High | Accept | Phase 1 (3-way) |
| 12 | Không prune evidence cũ — flow xoá vẫn render thẻ ma | High | Accept | Phase 4 |
| 13 | Không cơ chế specStatus — reporter không machine-readable, ảnh xanh của run fail | High | Accept | Phase 4 (JSON reporter + flowId tag) |
| 14 | Whitelist orphan `auth.*`/`security.*` không khớp namespace nào có thật | Medium | Accept (gộp 2 finding) | Phase 1 |
| 15 | Windows spawn('pnpm') ENOENT; root thiếu tsx + không có precedent script | Medium | Accept | Phase 1+4 |
| 16 | Helpers path sai: `apps/e2e/src/` không phải `apps/e2e/helpers/` | Medium | Accept | Phase 4 |

### Whole-Plan Consistency Sweep (session 1)
- Files reread: plan.md, phase-01…phase-04 (sau khi áp toàn bộ edits)
- Decision deltas checked: 9 (D1 rewrite, D4 rewrite, D6 rewrite, D7/D8/D9 mới, ~30→33 luồng, helpers path, evidence timing)
- Reconciled stale references: regex-first (phase-01), `router*.ts` glob (phase-01), guard DATABASE_URL (phase-04), specs API instrument (phase-04), `<30s` cho evidence (plan AC), whitelist auth/security (phase-01), helpers/ (phase-04), "commit-gần-đây" (phase-03), --inline full (phase-04)
- Unresolved contradictions: 0

### Session 2 — 2026-07-17 (plan bản revision 2)
**Reviewers:** Assumption Destroyer (6 findings) + Scope & Complexity Critic (7 findings). 13 thu về, merge 1 cặp trùng (checksum 39) → 12 xét.
**Disposition:** 11 Accept, 1 Reject-một-phần.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| R2-1 | Defer Phase 4: 40% effort + 100% rủi ro child-data chỉ để gắn ảnh; ◐ degrade trung thực | Critical | Accept (tái xếp, KHÔNG bỏ — giữ quyết định user Dashboard+Evidence Pack) | Plan overview, phases table, AC, phase-04 gate |
| R2-2 | Manifest 33 luồng trước khi tool chứng minh giá trị = data-entry front-load | High | Accept — v1 = P1 (9 luồng), grow incremental | Phase 1, AC |
| R2-3 | Orphan 3 chiều + 3 whitelist + decay-test = built past need | High | Accept — v1 procedure-only, route/model orphan v2 (đảo V5 validation — new evidence cost/benefit) | Phase 1 |
| R2-4 | Dual render mode Phase 2 cho consumer Phase 4 = premature abstraction | Medium | Accept — single mode v1, split chuyển vào Phase 4 | Phase 2, Phase 4 |
| R2-5 | `--inline` dựa premise chưa kiểm chứng (file có thật sự bị forward?) | Medium | Accept — v1 local-only, --inline ở Phase 4 | Phase 4 |
| R2-6a | "Thử cypher/regex trước ts-morph" | Medium | **Reject** — rt2-assumption verify ngược: ts-morph feasible, appRouter static, no dynamic composition (router.ts:56-117); quay lại lean-parse mở lại rủi ro R1 #4 | — |
| R2-6b | Checksum 38 sai — appRouter có **39 keys** (health + 38 mounted) | Medium | Accept — assert exact key set, không magic number | Phase 1 |
| R2-7 | Mobile 390px = gold plating v1 | Medium | Accept — desktop-first v1, mobile theo Phase 4/--inline | Phase 3 |
| R2-8 | `assertNotProdDatabase` là module-private, không import được từ scripts/ | High | Accept — extract ra `apps/e2e/src/assert-not-prod.ts` (export), global-setup import lại; list file Modified | Phase 4 |
| R2-9 | Sentinel gate đứt kết nối với data path e2e thật (không gì chạy seed.mjs; global-setup bootstrap ephemeral facility) | High | Accept — runner chạy seed.mjs như bước gated tường minh trước capture, verify sentinel sau seed | Phase 4 |
| R2-10 | Spec chủ lực P1-07 (lms-login) success-path đang `test.fixme` (bug redirect đã biết) + parent OTP blocked-on-comms → evidence sẽ là ảnh form login gắn nhãn "đã chứng minh" = false proof | High | Accept — fixme/skip = not-proven (◐); evidence yêu cầu test đạt terminal assertion; chọn flow có UI path pass thật làm target đầu | Phase 4, Phase 3 mapping |
| R2-11 | admin-shell.ui.spec assert EMPTY state by design → ảnh bảng rỗng làm "bằng chứng flow finance" gây hiểu lầm | Medium | Accept — loại admin-shell khỏi business-flow evidence | Phase 4 |
| R2-12 | JSON reporter đọc stdout bị pollute ([e2e:api] prefix + vite build) → JSON.parse fail | Medium | Accept — `PLAYWRIGHT_JSON_OUTPUT_NAME` ghi file, không bao giờ đọc stdout | Phase 4 |

**Held up under attack (rt2-assumption verify):** TL25 procedure names khớp 5/5 spot-check; `--project=ui-chromium` + PLAYWRIGHT_UI=1 đúng; ts-morph feasibility confirmed.

### Whole-Plan Consistency Sweep (session 2)
- Files reread: plan.md + 4 phase files sau khi áp R2
- Decision deltas checked: 11
- Reconciled stale references: v1/gated split (overview, phases table, AC), 38→39, 3-way orphan→procedure-only v1, dual-mode→Phase 4, mobile→deferred, 33 luồng→P1-first, sentinel qua seed.mjs gated step, assert-not-prod extract
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-07-17 (autonomous, theo ủy quyền user "tự giải quyết câu hỏi phát sinh")

Verification pass: guard skip (Red Team Review đã có verification evidence; 0 tag [UNVERIFIED] còn lại).

| # | Câu hỏi | Quyết định | Căn cứ |
|---|---|---|---|
| V1 | Sentinel synthetic-seed lưu đâu? Schema không có bảng config | Facility row marker (`__SYNTHETIC_SEED__`) tạo bởi seed.mjs | Model list schema.prisma:230-1581 verified — không SystemConfig; seed thật = packages/db/prisma/seed.mjs (packages/db/package.json:26) |
| V2 | Tool đặt root devDeps (tsx, ts-morph) hay workspace package riêng? | Root devDeps + `scripts/acceptance-report/` | KISS; tooling repo không phải package ship; scripts/ đã là chỗ ops tooling; fallback workspace package chỉ khi root devDeps gây xung đột turbo |
| V3 | ⬤ hạ xuống ◐ sau MỌI commit (kể cả docs) — chấp nhận? | Chấp nhận — trung thực hơn giả xanh | D7; buổi nghiệm thu regenerate `--evidence` tại đúng commit demo; nhãn ◐ ghi rõ "bằng chứng từ phiên bản cũ" |
| V4 | Cụm ADMIN không có trong TL25 — nguồn manifest? | Seed từ code + plans/260716-1047-super-admin-completion; structural-only, không evidence (Safety Gate bước 5 loại cross-facility views) | TL25 chỉ P1–P4 (33 luồng); super-admin ship 2026-07-16 |
| V5 | Orphan 3 chiều cần whitelist cho models/routes infra? | Có — *CodeCounter, EmailOutbox, LoginOtp, AuditLog, AppUser (models); ComingSoon/login/shell (routes) | Không phải luồng nghiệp vụ; thiếu whitelist → orphan noise → dev bỏ qua list = decay |

Propagated: phase-01 (V5 — whitelist 3 chiều), phase-04 (V1 — sentinel Facility row, seed.mjs).
> V5 bị đảo một phần ở R2-3 (orphan v1 = procedure-only) — new evidence cost/benefit từ Scope Critic; whitelist models/routes chuyển sang v2 cùng route/model orphan.

### Session 2 — 2026-07-17 (autonomous, sau red-team R2)

| # | Câu hỏi (từ R2 unresolved) | Quyết định | Căn cứ |
|---|---|---|---|
| V6 | Ai chạy seed.mjs cho DB throwaway? (không pipeline nào hiện gọi) | evidence-runner tự chạy seed.mjs như bước gated tường minh, verify sentinel sau seed | R2-9; global-setup.ts:134 bootstrap qua API không qua seed |
| V7 | Spec nhiều test (có fixme) aggregate thế nào thành specStatus per-flow? | Chỉ tính test mang flowId annotation; test đó phải PASS + đạt terminal assertion; fixme/skip/fail → not-proven ◐ | R2-10; lms-login.ui.spec.ts:168 fixme là bằng chứng ngưỡng lỏng sẽ nói dối |
| V8 | Loop red-team→validate dừng khi nào? (reviewer thù địch by design luôn sinh findings) | Dừng: 0 finding Critical/High mới sống sót adjudication TRONG scope v1. R2 đạt: mọi Critical/High còn lại thuộc Phase 4 (gated) hoặc là scope cut đã áp | Tiêu chí chấm dứt khách quan, tránh loop vô hạn |

### Whole-Plan Consistency Sweep (validation session 2)
- Files reread: plan.md + 4 phase files (grep stale terms: 38-namespace, orphan-3-chiều, mobile-390, dual-mode, 33-luồng-AC, lms-login-instrument — 0 match)
- Reconciled: 1 (overview orphan line procedure-only)
- Unresolved contradictions: 0

### Whole-Plan Consistency Sweep (validation session 1)
- Files reread: plan.md + 4 phase files (grep stale terms sau propagation)
- Decision deltas checked: 5 (V1–V5)
- Reconciled stale references: 2 (seed.ts→seed.mjs, whitelist 1 chiều→3 chiều)
- Unresolved contradictions: 0

## Implementation Log

### v1 (Phases 1–3) — 2026-07-17

**Built:** `scripts/acceptance-report/{types,flow-manifest,verify,render}.ts`, `scanners/{trpc,route,prisma}-scanner.ts`, `templates/{layout,builder-tab,acceptance-tab}.ts`. Root `package.json`: +devDeps `tsx`/`ts-morph`, +script `acceptance:report`. `.gitignore`: +`/acceptance-report/`.

**Manifest note:** 9 P1 flows encode CURRENT REAL code (routes/procedures), not blind copies of TL25 — inline `NOTE` comments in `flow-manifest.ts` flag 4 places TL25 docs are stale vs code (e.g. TL25 says `/finance/receipts/new`, code is `/finance/new`; `/finance/reconciliation` vs real `/ops/recon`). This is the tool doing its documented job (docs = mẫu số, code = sự thật) — a docs follow-up to sync TL25 is recommended but out of this plan's scope.

**Testing (tester-v1 subagent, independent):** `pnpm acceptance:report` exit 0; focused unit assertions on `trpc-scanner.ts` (39 namespaces exact, 0 unresolved, mergeRouters + multi-export + rename cases all resolve); independent drift test (renamed `crm.opportunityCreate`, confirmed degrade + clean revert); route-scanner edge cases reviewed (wildcard, absolute/relative, nested arrays) — no issues; Builder tab HTML content verified against JSON; `tsc --noEmit --strict` clean. Verdict: PASS, ship as-is.

**Code review (reviewer-v1 subagent, independent):** 9/10, no stop-and-ask side effects, all 5 mandated checks (a-e) pass. 2 latent-but-real bugs found and fixed post-review:
- `trpc-scanner.ts` + `route-scanner.ts`: `resolveIdentifierToRouterObject`/`resolveImportedRouteArray` looked up the target file's declaration by the *local* import identifier instead of the *original exported* name — an aliased import (`import { fooRouter as bar }`) would have thrown into `unresolved` silently. Fixed to resolve via `namedImport.getName()`. No aliased router/route imports exist today, so this was latent, not currently triggered — fixed anyway since it's cheap and the failure mode (silent unresolved) is exactly what the tool exists to prevent.
- `verify.ts`: a flow with all three `expected` arrays empty would vacuously compute `totalMissing === totalExpected === 0` → misclassified `built` with nothing verified. Added a startup guard that throws if any manifest flow has zero expected symbols (fail loud, not silent false-green). No current flow triggers this (P1-04 has `models` populated) — defensive fix.
- Also removed a dead `ScanResult` interface in `types.ts` (didn't match actual scanner return shapes, unused).

**Separately, self-caught before review:** `.gitignore`'s original `acceptance-report/` pattern (no leading slash) matched at any depth, silently gitignoring `scripts/acceptance-report/` (the tool's own source) alongside the intended repo-root output dir. Fixed by anchoring to `/acceptance-report/`; verified both directions with `git check-ignore`.

**Visual verification:** Rendered `acceptance-report/index.html` opened via chrome-devtools at 1440×900 — both tabs render cleanly, 0 console errors, tab-switch works, matches premium design language (light, restrained, Inter).

**Post-fix re-verification:** `pnpm acceptance:report` re-run clean (9 built, 0 partial, 0 missing, 0 unresolved), `tsc --noEmit --strict` clean.

## Dependencies

Không blockedBy plan nào đang mở. Các plan chưa đóng không chạm scripts/acceptance-report — không xung đột file ownership.
