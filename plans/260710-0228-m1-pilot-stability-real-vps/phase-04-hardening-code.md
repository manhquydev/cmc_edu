---
phase: 4
title: "Hardening tồn đọng (code)"
status: completed
priority: P1
dependencies: []
---

# Phase 4: Hardening tồn đọng (code)

## Context links
- Sweep HIGH + outbox MEDIUM findings: `plans/reports/brainstorm-260710-0215-...-report.md:18`
- receipt-get fixture pre-existing fail: same report §1 (bảng gate, 524/525)
- Sweep hiện tại: `apps/api/src/worker/relay-email-outbox.ts:72-82`
- EmailOutbox model (0 index): `packages/db/prisma/schema.prisma:902-920`
- RLS test helper: `apps/api/src/test/db.ts:81` (`testDbBypass`), `packages/db/src/index.ts:57` (`withFacility`)

## Overview
- **Date:** 2026-07-10 · **Priority:** P1
- **Description:** Đóng 3 nợ kỹ thuật: (a) sweep write-amplification HIGH; (b) EmailOutbox retention +
  index MEDIUM; (c) fixture RLS receipt-get pre-existing fail. Chỉ chạm `apps/api/src/**` +
  `packages/db/**` (không đụng VPS/env/docs).
- **[M4] Ordering**: P4 chạy trên **local-sim** (gates đầy đủ), độc lập P1/P2, nhưng **PHẢI LAND TRƯỚC
  P3 dump** — migration index (b) phải nằm TRONG dump cutover để không drift (P3 restore rồi `migrate
  deploy` sẽ no-op thay vì phải áp index sau). → P4 song song P1–P2, xong trước P3. P3 blocked-by P2 + P4.
- **Implementation status:** ✅ **LANDED on main 2026-07-10 — PR #31 merged (merge commit `179c158`)**.
  Rebased onto main `97a1bc0` (48-commit drift from merged Astryx UI migration; 0 in-scope conflicts
  except `receipt-get.test.ts` which main had already fixed via `withFacility` — kept main's version,
  dropped the duplicate `testDbBypass` variant). CI green (typecheck-and-test + e2e both pass — CI's
  clean unit run confirms the local `assessment/draft-confirm.test.ts` failures were env-flakiness, not
  regressions). Worktree + branch removed. Migration `20260710040000_emailoutbox_index` is now in main's
  history → will be inside the P3 cutover dump (M4 ordering satisfied).
- **Review status:** reviewed (code-reviewer subagent, DONE_WITH_CONCERNS → resolved). 1 CRITICAL found:
  generated `prisma migrate dev` swept ~121 lines of unrelated pre-existing drift (7 FK action mismatches,
  18 tables' `id`/`updatedAt` DROP DEFAULT, `QualitativeAssessment.confidence` REAL→DOUBLE PRECISION type fix)
  into the migration alongside the 2-line index — stripped via `migrate resolve --applied` +
  hand-authored minimal `migration.sql` so only `CREATE INDEX` lands. Drift itself is pre-existing
  (unrelated to this phase's schema.prisma edit, confirmed schema.prisma diffs main by exactly 1 line)
  and left unfixed at the time — **now resolved**: its own deliberate migration
  `20260710220000_reconcile_schema_drift` (**PR #32 merged `835e4b8`**, user-ratified: 18 tables' inert
  default-drops + 7 inert FK ON-UPDATE aligns + confidence REAL→DOUBLE PRECISION widening + the one
  real change, `QualitativeAssessment.classSessionId` ON DELETE RESTRICT→SET NULL which just matches
  the already-merged optional-relation declaration). CI green; zero residual drift on fresh full-history
  deploy → **schema is now clean for the P3 cutover dump**. 2 MEDIUM non-blocking (prune retention keys off createdAt not termination-time —
  doc comment added; EmailOutbox has no facility scoping — by design, pre-existing). 1 LOW non-blocking
  (relayEmailOutbox's only caller, worker/index.ts, discards the result incl. new `pruned` — no
  operational visibility; out of this phase's file scope).

## Key Insights
- **(a) HIGH — write-amplification vô hạn**: `sweepStaleOtpPayloads` (`relay-email-outbox.ts:72-82`)
  `updateMany WHERE createdAt<cutoff AND payload.path=['kind']=='otp'`. Sau khi scrub, row thành
  `{kind:'otp', scrubbed:true}` — VẪN thỏa `kind=='otp'` → mỗi chu kỳ relay re-UPDATE lại TOÀN BỘ lịch sử
  OTP đã scrub (`SCRUBBED_OTP_PAYLOAD`, :63). DB bloat + WAL vô hạn theo thời gian.
- **[H1] Fix = whole-object inequality**, KHÔNG dùng `NOT path:['scrubbed'] equals true`: `SCRUBBED_OTP_PAYLOAD
  = { kind:'otp', scrubbed:true }` (:63). Row CHƯA scrub **thiếu key `scrubbed`** → Prisma JSON path
  `['scrubbed'] equals true` trả về so-sánh với NULL (missing key), `NOT (NULL)` = UNKNOWN → row chưa-scrub
  bị **loại nhầm khỏi sweep** (NULL-trap → OTP plaintext không bị scrub = đúng lỗ hổng C1 đang vá). Dùng
  `NOT: { payload: { equals: SCRUBBED_OTP_PAYLOAD } }` (so cả object) — row chưa scrub ≠ object đã scrub →
  vẫn vào sweep; row đã scrub = object đó → bị loại. **Empirical check 2' trên live PG trước khi code**:
  chạy cả 2 biến thể trên vài row mẫu (có/không key scrubbed) xác nhận đếm đúng.
- **(b) MEDIUM — seq-scan**: EmailOutbox **0 index** (schema:902-920). Drain
  `findMany WHERE status IN (pending,failed) ORDER BY createdAt` (:132-135) seq-scan. Fix:
  `@@index([status, createdAt])` — phủ drain đầy đủ; reap (`status=sending AND updatedAt<cutoff`, :125-128)
  dùng được **status-prefix** (không phủ range updatedAt, chấp nhận — reap chạy trên tập nhỏ). Retention:
  prune row terminal (`sent`/`dead`) cũ hơn N ngày → bảng nhỏ (khác OTP scrub — đây là xoá row, không scrub payload).
- **[M3] cap-count query GIỮ seq-scan ở pilot** (quyết — YAGNI): bảng nhỏ nhờ retention prune nên seq-scan
  không đáng lo ở 1 cơ sở. **KHÔNG hứa index cover cap-count**; chỉ khi multi-facility (M4 roadmap) mới cân
  nhắc thêm cột `kind` riêng / GIN payload. `@@index([status, createdAt])` KHÔNG nhằm tối ưu cap-count.
- **(c) fixture RLS**: `receipt-get.test.ts:72` `db.receipt.create` naked (không qua `withFacility`) →
  RLS 42501 permission denied cho `cmc_app`. Test đầu (:46) đi qua router (có withFacility) nên pass; test
  hai insert trực tiếp nên fail. Fix: bọc bằng `testDbBypass` (arrange helper chuẩn cho bảng RLS,
  `test/db.ts:81`) — `await testDbBypass(tx => tx.receipt.create({ data: {...} }))`.

## Requirements
- (a) Sweep chỉ chạm row CHƯA scrub → `otpSwept` count giảm dần về 0 khi hết row cũ chưa scrub; không
  re-UPDATE row đã scrub. Hành vi C1 (scrub trong TTL) giữ nguyên — chỉ loại double-work.
- (b) Migration Prisma thêm `@@index([status, createdAt])` trên EmailOutbox; retention prune terminal rows;
  không đổi contract API/worker (nội bộ). Retention window 30 ngày (validated 2026-07-10) +
  configurable env `EMAIL_OUTBOX_RETENTION_DAYS`. Result `relayEmailOutbox` thêm field `pruned: number`.
- **[H2] Test-double sync**: `makeMockDb()` (`relay-email-outbox.test.ts:244`) phải **stub `deleteMany`**
  (prune gọi nó) + cập nhật MỌI `expect` shape của result khi thêm field `pruned` (nếu không → test đỏ
  do mock thiếu method / assert thiếu key). Sweep test (a) cũng qua mock — đảm bảo mock phản ánh
  whole-object filter.
- (c) `receipt-get.test.ts` 2/2 xanh.
- **[L5] Gates**: typecheck 26/26 · build 14/14 · **unit suite xanh toàn bộ (>525 sau khi thêm test mới)** ·
  **e2e Mode-B** xanh (throwaway `cmc_staging`, NODE_ENV=production) — vì chạm worker path + schema.
  Container `cmc-pg` up trước unit (ops quirk).

## Architecture
- (a) sửa 1 `where` clause trong `sweepStaleOtpPayloads`; thêm 1-2 test vitest bắt regression
  (scrub xong → lần sweep sau count row-đã-scrub = 0).
- (b) Prisma migration mới `packages/db/prisma/migrations/<ts>_<name>/` (thêm index). Retention: 1 hàm
  prune gọi trong worker cycle (giống sweep) HOẶC cron — chọn **worker cycle** (KISS, DRY với sweep/reap,
  không thêm cron infra). Env `EMAIL_OUTBOX_RETENTION_DAYS` default 30.
- (c) 1 dòng bọc `testDbBypass` trong test.
- 3 item độc lập nhau → có thể 3 PR riêng hoặc 1 PR gộp (đề xuất **1 PR** — cùng module worker/outbox +
  test, gộp giảm churn; item (c) nhỏ có thể kèm hoặc tách tuỳ reviewer).

## Related code files
- Modify: `apps/api/src/worker/relay-email-outbox.ts:72-82` (a) + thêm hàm prune (b)
- Create: `packages/db/prisma/migrations/<ts>_emailoutbox_index/migration.sql` + cập nhật
  `schema.prisma:920` (`@@index([status, createdAt])`) (b)
- Modify: `apps/api/src/finance/receipt-get.test.ts:72-84` (c) — bọc `testDbBypass`
- Modify: `apps/api/src/worker/relay-email-outbox.test.ts` — sweep no-reamplify test (a) + prune test (b) +
  `makeMockDb()` (:244) stub `deleteMany` + expect shape `pruned` (H2)
- Đọc: `apps/api/src/test/db.ts:81`, `packages/db/src/index.ts:57`, `relay-email-outbox.ts:63` (SCRUBBED_OTP_PAYLOAD)

## Implementation Steps
0. **[H1] Empirical check 2'** trên live PG (`cmc-pg` hoặc cmc_staging): seed 2 row — 1 có `{kind:'otp',
   code:...}` (chưa scrub, thiếu key scrubbed), 1 `{kind:'otp',scrubbed:true}`; chạy thử `NOT equals
   SCRUBBED_OTP_PAYLOAD` vs `NOT path['scrubbed'] equals true` → xác nhận biến thể whole-object đếm đúng
   (row chưa-scrub vào sweep, row đã-scrub bị loại); biến thể path là NULL-trap.
1. (a) [H1] Thêm `NOT: { payload: { equals: SCRUBBED_OTP_PAYLOAD } }` vào `where` của
   `sweepStaleOtpPayloads` (whole-object, tránh NULL-trap). Test: seed row OTP cũ chưa-scrub → sweep
   (count=1) → sweep lần 2 trên cùng data (count=0, không re-update row đã scrub).
2. (b) `schema.prisma` EmailOutbox thêm `@@index([status, createdAt])`; `prisma migrate dev --name
   emailoutbox_index` sinh migration (KHÔNG sửa migration cũ). Thêm hàm `pruneTerminalOutbox(db)` xoá
   `status IN (sent,dead) AND createdAt < now()-RETENTION_DAYS`; gọi trong `relayEmailOutbox` (sau sweep);
   thêm field `pruned` vào `RelayEmailOutboxResult`; env `EMAIL_OUTBOX_RETENTION_DAYS` default 30
   (30 ngày — validated). Test: seed sent/dead cũ → prune xoá; pending/failed giữ.
3. **[H2]** Cập nhật `makeMockDb()` (`relay-email-outbox.test.ts:244`): stub `emailOutbox.deleteMany`
   (prune gọi); cập nhật mọi `expect(result)` shape thêm `pruned`. Chạy suite worker xác nhận không đỏ do mock.
4. (c) `receipt-get.test.ts:72`: đổi `const receipt = await db.receipt.create({...})` →
   `const receipt = await testDbBypass(tx => tx.receipt.create({...}))`; import `testDbBypass` từ test/db.
   Xác nhận counter upsert (:65) không cần đổi (ReceiptCodeCounter không RLS-protected — nếu fail tương tự
   thì cũng bọc bypass).
5. Gates [L5]: `cmc-pg` up → `pnpm --filter @cmc/api test` (unit suite xanh toàn bộ, >525);
   `pnpm typecheck` (26); `pnpm build` (14); `pnpm --filter @cmc/e2e test` Mode-B (throwaway cmc_staging).
6. Fix-forward: mỗi item nếu tách PR thì gates riêng; nếu gộp thì 1 vòng gates. Không nới test.
   **Land trước P3 dump (M4).**

- [x] (0) [H1] empirical check 2' whole-object vs path filter trên live PG — confirmed qua regression test thật (không chỉ live-check thủ công)
- [x] (a) [H1] sweep `NOT equals SCRUBBED_OTP_PAYLOAD` + test no-reamplify
- [x] (b) migration `@@index([status, createdAt])` + prune terminal + field `pruned` + test — migration ban đầu Prisma auto-gen dính ~121 dòng drift không liên quan, đã strip xuống chỉ còn CREATE INDEX (xem Review status)
- [x] (H2) makeMockDb stub deleteMany + expect shape `pruned`
- [x] (c) receipt-get fixture bọc testDbBypass
- [x] [L5] typecheck 26/26 · build 14/14 · e2e Mode-B 17 passed/1 skipped (TEST_OTP_SEAM, đúng) xanh
- [x] Land trước P3 dump (M4) — sẵn sàng, chưa merge/commit vào main

- [x] [H1] `otpSwept` lần sweep thứ 2 = 0; row chưa-scrub VẪN bị scrub (không NULL-trap) — test chứng minh cả 2
- [x] `EmailOutbox` có index `[status, createdAt]` (migration land, scoped); prune xoá terminal rows cũ, giữ pending/failed
- [x] [H2] makeMockDb stub deleteMany + expect `pruned` — suite worker không đỏ do mock
- [x] `receipt-get.test.ts` 2/2 xanh
- [x] [L5] Gates: typecheck 26/26 · build 14/14 · unit suite 524/527 xanh (3 fail = `assessment/draft-confirm.test.ts` LLM/PII, pre-existing trên main không đổi, xác nhận qua reproduce trên main sạch — user chấp nhận 2026-07-10) · e2e Mode-B xanh
- [x] [M4] Land trước P3 dump; không đổi contract API/worker public (chỉ additive `pruned` field); hành vi C1 scrub giữ nguyên

## Risk Assessment
| Rủi ro | L×I | Mitigation |
|---|---|---|
| [H1] NULL-trap: `NOT path['scrubbed']` loại nhầm row chưa-scrub → OTP không scrub | Med×High | Dùng whole-object `NOT equals SCRUBBED_OTP_PAYLOAD`; empirical check bước 0; test cả 2 hướng |
| Prune xoá nhầm row còn cần retry (failed) | Low×High | Chỉ xoá `status IN (sent,dead)` (terminal); pending/failed loại trừ; test |
| [H2] Mock thiếu deleteMany / expect thiếu `pruned` → test đỏ giả | Med×Med | Bước 3 cập nhật makeMockDb + mọi expect shape |
| [M4] Migration drift dump vs code (P4 land sau P3 dump) | Low×High | P4 LAND TRƯỚC P3 dump → index nằm trong dump; P3 `migrate deploy` no-op; deps P3←P2+P4 |
| e2e Mode-B nhầm cmc_prod | Low×High | env-guard assert cmc_staging; ops quirk KHÔNG BAO GIỜ cmc_prod |

## Security Considerations
- (a) đóng đúng vector PII: OTP plaintext không tồn quá TTL (C1 giữ) + không bloat DB chứa payload OTP.
- Prune xoá row terminal — KHÔNG đụng ledger append-only (RefundRecord/AuditLog/ReconciliationFlag);
  EmailOutbox không phải sổ tiền, xoá được. AuditLog của dead/failed vẫn giữ (bảng riêng).
- Không log payload OTP; test dùng cmc_staging throwaway, không PII thật.

## Next steps
[M4] Land P4 trên local-sim (gates đầy đủ) **TRƯỚC khi P3 tạo dump cutover** — index nằm trong dump,
không drift. Gates xanh → item hardening đóng cho P6 exit. P3 sau restore vẫn chạy `migrate deploy` (no-op).
