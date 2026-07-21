---
phase: 4
title: "Evidence Collector (Playwright UI screenshots)"
status: pending
priority: P3
dependencies: [1, 2]
effort: "2 sessions"
---

# Phase 4: Evidence Collector (Playwright UI screenshots) — GATED

<!-- Updated: Red Team Session 2026-07-17 (R1: UI specs only, safety gate, redaction, prune, JSON reporter, Windows spawn) + Session 2 (R2: gate sau v1, guard extract, sentinel qua seed.mjs step, fixme=not-proven, loại admin-shell, JSON ra file) -->

## GATE — điều kiện khởi động (R2-1, không mở lại nếu không có bằng chứng mới)

Phase này CHỈ bắt đầu khi đủ cả 3:
1. ⏳ **PO-side** — v1 (Phases 1–3) đã ship và được dùng thật (builder + ít nhất 1 buổi xem với giám đốc). Ngoài dev scope.
2. ✅ **ĐẠT 2026-07-18** (plan 260718-0519) — DB throwaway synthetic-seed tồn tại + validated: `scripts/synthetic-seed-env.sh` dựng container Postgres riêng (NGOÀI local-sim), migrate + seed + sentinel Facility `code='__SYNTH__'` verify được qua role `cmc_app`. Guard 2 lớp: `SYNTH_SEED_ALLOW=1` positive signal + `assert-not-prod.ts` (extraction R2-8, shared với global-setup) trên cả 2 URL. `--fresh` cold-path + idempotent + negative tests (no-ALLOW/prod-name abort) đều pass.
3. ◐ **BLOCKER CLEARED 2026-07-18** (nhưng CHƯA phải ✅ — R2-10): bug redirect P1-07 đã fix (root cause = LoginPage root guard clobber navigate, capture-proven; fix `<Navigate>` mustChangePassword-aware + 2 guard hygiene), test `correct default-password login redirects to mustChangePassword` hết `test.fixme` và PASS thật dưới PLAYWRIGHT_UI. NHƯNG đây là test student-redirect, KHÔNG phải business-flow evidence target hợp lệ (R2-10/11 cấm lms-login làm target) — target đầu (`acceptance-evidence-p1.ui.spec.ts`) vẫn là deliverable của step 3 phase này.

## Overview

Lớp bằng chứng động: chạy **UI specs Playwright** (browser thật, `PLAYWRIGHT_UI=1`, project `ui-chromium`) chụp screenshot tại bước nghiệp vụ, index cho renderer. Kích hoạt: `pnpm acceptance:report --evidence`.

**D8 (chốt sau red-team):** 9/11 specs hiện có là API-driven KHÔNG có browser (playwright.config.ts:4 — "api — API-driven specs. No browser launched"; testMatch loại `.ui.spec.ts` ở :69) → KHÔNG instrument chúng. Evidence đến từ UI specs: 2 sẵn có (`admin-shell.ui.spec.ts`, `lms-login.ui.spec.ts`) + **viết mới dần** `*.ui.spec.ts` per luồng ưu tiên nghiệm thu.

## Requirements

- Functional: helper `captureEvidence(page, flowId, stepLabel)` trong UI spec; output `acceptance-report/evidence/{flowId}/NN-{step-slug}.png` + `evidence-index.json` **rebuild từ đầu mỗi run** (không merge); `--evidence` = verify → chạy UI specs → render HTML với ảnh; `specStatus` per-flow lấy từ **Playwright JSON reporter** + annotation flowId trong test (helper chạy giữa test không biết kết quả cuối — red-team #13).
- Non-functional an toàn (3 Critical red-team #1-3): xem Safety Gate. Metadata whitelist D9: chỉ `{flowId, stepLabel, specStatus, capturedAt, commit}` — KHÔNG raw error text (Prisma error chứa connection string + password).

## Safety Gate (bắt buộc, chạy trước mọi capture — thứ tự cứng)

1. Dùng `assertNotProdDatabase` trên **`APP_DATABASE_URL`** (nguồn đọc business thật — packages/db/src/index.ts:27) VÀ `DATABASE_URL`. Guard chỉ trên DATABASE_URL là sai biến (red-team #1). **R2-8: hàm này hiện module-private trong global-setup.ts (không export) — bước bắt buộc: extract ra `apps/e2e/src/assert-not-prod.ts` (export), global-setup.ts import lại từ đó (giữ 1 nguồn guard duy nhất, không copy).**
2. `ACCEPTANCE_EVIDENCE_ALLOW=1` phải set tường minh (positive signal, không phải denylist tên DB — tên DB bị socat decouple khỏi DB vật lý, journal 260710:163-166 — red-team #3).
3. **Sentinel synthetic-seed** (R2-9 — không pipeline nào hiện chạy seed.mjs; global-setup bootstrap ephemeral facility qua API, không qua seed): evidence-runner **tự chạy `seed.mjs` vào DB đích như bước gated tường minh** (sau guard 1-2, trước capture); seed.mjs plant sentinel Facility row (`__SYNTHETIC_SEED__`); runner verify sentinel sau seed — không thấy → abort. Chứng minh "DB này là seed giả" bằng nội dung, không bằng tên.
4. **CẤM local-sim**: Postgres local-sim chứa `cmc_prod` THẬT (dữ liệu trẻ em thật — journal 260710:161, docker-compose.prod.yml:129). Doc trong README tool + guard 1 tự chặn.
5. Flows chụp **loại trừ view cross-facility/super-admin** (`audit`, `facilityNetwork` — router.ts:117,69): các view này render mọi facility, rủi ro lộ dữ liệu ngoài phạm vi seed (red-team #2). Manifest đánh dấu các flow ADMIN này `uiEvidenceSpec: undefined` cố định.
6. Runner tự check `.gitignore` có `acceptance-report/` — thiếu → từ chối chạy (defense-in-depth, red-team #10).

## Architecture

```
UI specs (*.ui.spec.ts, có page thật) ──captureEvidence(page, flowId, step)──→ evidence/
acceptance-report --evidence:
  1. Safety Gate (trên đây) — fail bất kỳ bước nào → abort, không chụp
  2. rm -rf acceptance-report/evidence + index cũ (prune — red-team #12)
  3. spawn UI tests: env PLAYWRIGHT_UI=1, EVIDENCE_DIR set,
     `pnpm --filter @cmc/e2e exec playwright test --project=ui-chromium --reporter=json`
     với `PLAYWRIGHT_JSON_OUTPUT_NAME=<file>` — **đọc JSON từ FILE, không bao giờ từ stdout**
     (R2-12: stdout bị pollute bởi `[e2e:api]` prefix global-setup.ts:111 + vite build của webServer → JSON.parse fail)
     (KHÔNG phải `pnpm --filter @cmc/e2e test` — lệnh đó chạy project api không browser, red-team #6)
     Windows: spawn với shell:true hoặc gọi pnpm.cmd (red-team #15)
     Budget: PLAYWRIGHT_UI=1 build admin+lms ~2min mỗi app + preview servers
     (playwright.config.ts:37-54, timeout 120_000 each) → tổng ~5-8 phút, ghi rõ trong output
  4. đọc JSON file → map test (annotation flowId) → specStatus per flow;
     **aggregate rule (R2-10): flow ⬤ chỉ khi test mang flowId đó PASS và đạt terminal assertion;
     fixme/skipped/failed → not-proven (◐); 1 spec nhiều test → lấy test được annotate, không lấy cả file**
  5. ghi evidence-index.json MỚI (whitelist fields) → render (Phase 2+3)
```

Helper sống ở `apps/e2e/src/capture-evidence.ts` (cạnh session-injection.ts, trpc-client.ts — KHÔNG có dir `apps/e2e/helpers/`, red-team #16). `EVIDENCE_DIR` không set → no-op (11 specs + CI không đổi hành vi).

flowId ↔ test mapping: `test('...', { annotation: [{ type: 'flowId', description: 'P1-07' }] }, ...)` — JSON reporter xuất annotations, runner đối chiếu.

Instrument tăng dần — chọn target đầu theo GATE điều kiện 3 (R2-10): **KHÔNG dùng lms-login.ui.spec.ts làm target đầu** — success-path của nó đang `test.fixme` (bug redirect đã biết, lms-login.ui.spec.ts:157-168) + parent OTP blocked-on-comms (:107); ảnh form login gắn ⬤ = false proof. **Loại `admin-shell.ui.spec.ts` khỏi business-flow evidence** (R2-11 — nó assert EMPTY state by design, :79-89; chỉ được dùng làm evidence "shell renders" nếu label đúng như vậy). Target đầu = viết mới UI spec cho 1 luồng P1 có đường đi pass thật (vd enrollment funnel: lms-login.ui.spec.ts:30-83 đã chứng minh seed runtime course→batch→opportunity→receipt→approve hoạt động — tái dùng pattern đó cho spec màn hình admin CRM/finance). KHÔNG yêu cầu 33 luồng có ảnh — tab Nghiệm thu hiển thị ◐ trung thực.

Ngoài ra phase này own (chuyển từ v1 theo R2-4/R2-5/R2-7): tách render mode `acceptance-only`, flag `--inline` (1 file, base64, không Builder tab), mobile layout cho tab Nghiệm thu.

## Related Code Files

- Create: `apps/e2e/src/capture-evidence.ts`
- Create: `apps/e2e/src/assert-not-prod.ts` (extract guard từ global-setup — R2-8)
- Create: `apps/e2e/tests/acceptance-evidence-p1.ui.spec.ts` (UI spec mới cho luồng P1 có path pass thật)
- Create: `scripts/acceptance-report/evidence-runner.ts` (Safety Gate + seed step + spawn + JSON file parse)
- Modify: `apps/e2e/src/global-setup.ts` — import guard từ assert-not-prod.ts (R2-8)
- Modify: `packages/db/prisma/seed.mjs` (seed script thật — packages/db/package.json:26) — thêm sentinel Facility row synthetic-seed
- Modify: `scripts/acceptance-report/render.ts` + `templates/*.ts` — merge evidence; tách mode `acceptance-only`; `--inline` CHỈ xuất tab Nghiệm thu (D4); mobile layout (R2-7)
- Modify: root `package.json` — flag `--evidence` pass-through

## Implementation Steps

0. Verify GATE đủ 3 điều kiện (v1 dùng thật, synthetic-seed env validated, ≥1 luồng P1 UI path pass) — thiếu → dừng phase.
1. Extract `assert-not-prod.ts` (R2-8), global-setup import lại; verify e2e pass nguyên trạng. Helper capture no-op-khi-thiếu-env; verify 11 specs pass khi không set `EVIDENCE_DIR`.
2. Sentinel row vào seed.mjs; `evidence-runner.ts` với Safety Gate 6 bước + seed step — test từng bước fail đúng (unset ALLOW → abort; DB không sentinel sau seed → abort; .gitignore thiếu entry → abort).
3. Viết `acceptance-evidence-p1.ui.spec.ts` cho luồng P1 pass thật (tái dùng pattern seed runtime của lms-login.ui.spec.ts:30-83): 3-6 bước, label tiếng Việt, flowId annotation. KHÔNG instrument lms-login (fixme) / admin-shell (empty-state) làm business evidence (R2-10/11).
4. JSON reporter ra FILE (PLAYWRIGHT_JSON_OUTPUT_NAME) → parse → specStatus theo aggregate rule; fail/fixme/skip → KHÔNG ⬤, cảnh báo sạch không raw error (D9).
5. Mở rộng 1-2 luồng P1 thêm; chạy full `--evidence` end-to-end.
6. Tách render mode `acceptance-only` + `--inline`: file 1-tab, base64 ảnh; grep output không chuỗi `trpc`/route/model; mobile layout; test mở trên điện thoại.
7. AC test prune: xoá 1 flow khỏi manifest → regenerate → evidence dir/entry biến mất.

## Success Criteria

- [ ] 11 specs cũ pass nguyên trạng khi không bật evidence (kể cả sau extract assert-not-prod)
- [ ] Safety Gate: cả 6 bước chặn đúng khi điều kiện thiếu (test từng bước)
- [ ] ≥ 2 luồng P1 có screenshot story label tiếng Việt, từ browser thật, test đạt terminal assertion
- [ ] Spec fail/fixme/skip → không ⬤, cảnh báo sạch (không secrets/connection string trong HTML — grep output)
- [ ] Prune test pass; `--inline` 1 file < 25MB, không Builder tab, không raw symbols
- [ ] Runner chạy được trên Windows (shell:true / pnpm.cmd)

## Risk Assessment

- **PLAYWRIGHT_UI build ~4min mỗi run** → chấp nhận, evidence là opt-in có chủ đích; output in budget trước khi chạy.
- **UI specs mới flaky** → giữ ít bước, chờ điều kiện rõ ràng (Playwright auto-wait); flaky → specStatus fail trung thực, không retry-ẩn.
- **Seed thiếu cho luồng UI mới** → mở rộng seed theo từng spec; sentinel row luôn đi cùng.
- **Ảnh chứa dữ liệu ngoài seed** (cache, facility khác) → Safety Gate bước 5 loại cross-facility views; seed chỉ 1 facility E2E.
