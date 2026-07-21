---
phase: 1
title: "Tool Audit + Env Baseline"
status: pending
priority: P1
dependencies: []
effort: "1.5d"
---

# Phase 1: Tool Audit + Env Baseline

## Overview

Trả lời "tool acceptance có nói dối không" (mini-A) + dựng nền cho Phase 2–5: DB synthetic, teardown mở rộng, signed-auth mode, coverage matrix spec→flow, contract `proveFlow()` + evidence reporter.

## Requirements

- Functional: mutation-test scanner; audit manifest history; spot-check handler; env e2e chạy được; evidence contract dùng được; teardown phủ mọi bảng Phase 2–5 sẽ ghi.
- Non-functional: mọi mutation revert sạch (scratch branch); KHÔNG trỏ DB prod; secret ký cookie/token là throwaway riêng, không bao giờ dùng secret prod.

## Architecture

### Signed-auth mode (R2-1 — QUYẾT ĐỊNH CHUẨN, thay Mode-B NODE_ENV=production)

<!-- Updated: Red Team R2 - R2-1, supersede V2 -->
Codebase cố tình khoá mọi test-seam khỏi `NODE_ENV=production` (dev-gate `lms-auth/router.ts:39-40` + boot denylist `boot-checks.ts:176-178`) và boot-check prod đòi BREVO/TRUSTED_PROXY_CIDRS/CORS/storage. KHÔNG chống lại kiến trúc đó:

- Server e2e spawn ở **dev-env** (`NODE_ENV` ≠ production). Signed cookie/token được server validate GIỐNG HỆT prod ở mọi env (verified R3: `context.ts:217,243` unconditional; `DEV_AUTH_ENABLED` chỉ gate fallback x-dev-user `:234,244`; secrets mint↔verify cùng env var `staff-session.ts:47`/`session-injection.ts:143`).
- <!-- Updated: Red Team R3 - R3-1; R4 - R4-1 --> **Enforcement bằng cờ dương, không phải quy ước (R3-1 Critical, tinh chỉnh R4-1):** selector auth hiện key theo `NODE_ENV==='production'` (`trpc-client.ts:102,120,135`, `global-setup.ts:108-114`) — dưới dev sẽ rơi về `x-dev-user` trong khi authPath tự khai "signed". Fix bắt buộc: gate cờ `E2E_AUTH_MODE=signed` (độc lập NODE_ENV) đặt Ở TẦNG PRIMITIVE — `createStaffClient` (`trpc-client.ts:26`) và `createLmsClient` (`:43`) THROW khi cờ bật (R4-1: gate ở wrapper là chưa đủ vì primitive vẫn export, gọi trực tiếp sẽ né throw mà server dev vẫn chấp nhận dev-header `context.ts:234,244`). Wrappers `createE2e*` + bootstrap flip theo cùng cờ. Nhờ flip tầng dưới, 11 specs cũ tự động chuyển signed — không rewrite per-spec; baseline step 9 chạy dưới cờ signed = re-verify end-to-end (R3-2).
- Evidence `authPath` KHÔNG tự khai: reporter dập từ `E2E_AUTH_MODE` của run + globalSetup assert cờ bật trước khi test chạy (cả api LẪN ui invocation phải set cờ — globalSetup fail-closed nếu thiếu). Verdict `proven` chỉ cấp khi authPath=signed.
- Guard: grep theo TÊN HELPER (`createStaffClient|createLmsClient`) trong `apps/e2e/tests/` = 0 (R4-1 — grep string `x-dev-user` vừa mù với direct-call vừa false-positive trên comment, vd `kind-isolation.spec.ts:10` có comment stale chứa string; sửa comment đó khi annotate).
- <!-- Updated: Red Team R4 - R4-2 --> UI enforcement leg (ghi rõ, không ngầm định): ui-chromium dùng preview build = prod build (`import.meta.env.PROD`) nên browser client KHÔNG THỂ phát dev-header; login qua trang thật cấp session thật. Bổ sung: UI specs assert cookie `cmc_staff_session`/LMS token ký hợp lệ hiện diện tại điểm assert trước khi screenshot.
- Hệ quả tốt: `TEST_OTP_SEAM` hoạt động native (dev-gate thoả) → P1-07 prove qua OTP thật; LLM stub hoạt động native (không key → stub, không bị `LLM_STUB_PROD_FORBIDDEN`) → **KHÔNG cần seam LLM_TEST_STUB, không sửa packages/llm**.
- Residual gap (ghi trung thực vào final report + legend ledger): các nhánh `if NODE_ENV==='production'` NGOÀI auth (trusted-proxy, CORS, boot-checks) không được exercise bởi suite này.
- Guard LLM egress (R2-7): `global-setup.ts` STRIP `LLM_API_KEY` khỏi env forward cho server spawn; đồng thời fail-closed nếu `LLM_API_KEY` có trong process.env khi chạy e2e (throw với message hướng dẫn unset) — chặn dev có key sẵn trong shell vô tình egress thật.

### Bảng env đầy đủ (R2-1 đơn giản hoá — không cần boot vars prod)

| Var | Giá trị / nguồn | Dùng cho |
|-----|-----------------|----------|
| `APP_DATABASE_URL`, `DATABASE_URL` | in ra bởi `synthetic-seed-env.sh` (script CHỈ IN — chạy seed + test CÙNG 1 phiên Git Bash, hoặc source env-file) | globalSetup fail nếu thiếu (`global-setup.ts:49-58`) |
| `SYNTH_SEED_ALLOW=1` | bắt buộc để seed chạy (`synthetic-seed-env.sh:40-43`) | seed |
| `TEST_OTP_SEAM=1` | OTP test seam (`lms-auth/router.ts:39-40` — hoạt động vì dev-env) | P1-07 |
| `STAFF_SESSION_SECRET`, `LMS_SESSION_SECRET` | throwaway sinh riêng cho phiên e2e, share server-spawn ↔ test process; assert ≠ secret prod; không echo log | signed-auth |
| `E2E_AUTH_MODE=signed` | cờ dương ép mọi client helper dùng signed cookie/token; fallback x-dev-user → throw (R3-1) | enforcement signed-auth |
| `PLAYWRIGHT_UI=1` | bật ui-chromium + preview servers | UI evidence |
| (cấm) `LLM_API_KEY` | PHẢI vắng mặt — global-setup fail-closed nếu có | chống egress |

- Sau spawn: assert server đạt `/health` trước khi tuyên bố baseline (nếu không → lỗi env, không phải lỗi flow).
- Helper paths: `mintStaffCookie` (`session-injection.ts:141`), `mintParentToken` (`session-injection.ts:41`); `createStaffClient`/`createSignedStaffClient` (`trpc-client.ts:26,59`).

### Evidence contract (rt#2, rt#6, rt#13, R2-2, R2-5, R2-9)

- **`proveFlow` tại DECLARATION, không phải body (R2-5):** wrapper sinh `test(title, { annotation: [{type:'flow', description:'P1-04'}] }, fn)` — annotation nằm trên TestCase nên test bị serial auto-skip vẫn được reporter nhìn thấy → verdict `blocked`. Unit test reporter: test serial-skipped → entry `blocked`.
- Granularity: 1 flow = 1 `test()` trong `describe.serial`; CẤM 1 test nhiều flow; CẤM 2 spec cùng flowId (reporter fail loud).
- Reporter: đăng ký ARRAY cả 2 nhánh (`playwright.config.ts:62` hiện string đơn); ghi atomic temp+rename; merge theo flowId, precedence `failed` > `blocked` > `proven`; **reset theo BATCH RUN-ID không theo commit (R2-9)**: mỗi lần invoke `pnpm test` sinh run-id (env `E2E_RUN_BATCH` — set 1 lần cho cả api + ui invocation trong run-book); file có run-id khác VÀ đây là invocation đầu batch → reset; cùng batch → merge; flow vắng trong run mới cùng batch → giữ entry. Unit test case: "commit đã tiến, chỉ re-run ui" không được xoá 30 verdicts api.
- Schema: thêm `authPath`, `runBatch`:
  ```json
  { "generatedAt": "...", "commit": "<short-head>", "runBatch": "<uuid>",
    "flows": { "P1-03": { "verdict": "proven", "authPath": "signed", "specs": ["finance-approval.spec.ts > tên test"], "evidence": ["evidence/p1-03.png"], "notes": "" } } }
  ```
- **Gitignore fix (R2-2 — negation dưới thư mục bị ignore là VÔ HIỆU, đã repro):** thay `/acceptance-report/` bằng:
  ```gitignore
  /acceptance-report/*
  !/acceptance-report/runtime-evidence.json
  ```
  (giữ `evidence/` + html/json khác bị ignore qua wildcard). Bước verify BẮT BUỘC: `git check-ignore acceptance-report/runtime-evidence.json` trả non-zero (không ignore) VÀ `git status` thấy file sau khi sinh.
- `verify.ts` (Phase 6) xác thực spec-refs trỏ tới test thật; refs không resolve → evidence invalid.

### Sentinel gate cho UI screenshot run (rt#9, R2-8)

`assertNotProdDatabase` tự nhận name-check không đủ (`assert-not-prod.ts:6-10`). Bổ sung `global-setup.ts`: khi `PLAYWRIGHT_UI=1`, trước mọi screenshot: (a) allow-flag rõ ràng (semantics như `SYNTH_SEED_ALLOW`), (b) query DB xác nhận sentinel synthetic facility tồn tại (nếu seed chưa tạo marker nhận diện được — kiểm tra khi implement — thì Phase 1 TẠO sentinel marker trong seed). Thiếu 1 trong 2 → fail-closed. <!-- Updated: Red Team R2 - R2-8 --> Ngoài ra UI specs chụp ảnh phải assert facility/studentId ĐANG RENDER thuộc sentinel set (provenance, không chỉ existence) — chốt 2 của quyết định V4-sửa đổi.

### Teardown extension (rt#1, rt#5, R2-3, R2-4, R2-6 — deliverable bắt buộc trước Phase 2)

`cleanupFacility` (`apps/e2e/src/db.ts:121-181`) là allowlist đóng. Mở rộng (privileged connection, mirror thứ tự canonical `apps/api/src/test/db.ts`):
- **Thêm, đúng FK order:** `QualitativeAssessment` TRƯỚC student delete (FK Student — schema.prisma:1012; canonical đã có `test/db.ts:160`; cần privileged — không có cmc_app DELETE grant :979-982); `RefundRecord` trước Receipt (:388); `Reward` trước Gift VÀ trước Student (Reward.giftId RESTRICT — :1508,1509); `SessionEvidence`+`SessionEvidencePhoto` trước ClassSession (:1026); `AfterSaleCase` (privileged — :1546); `Gift`, `ParentMeeting`, `TestAppointment` (bare facilityId :1477,1516,1531); `GuardianLinkRequest`, `ReconciliationFlag`, `StarTransaction`; audit thêm bảng P1-09 ledger khi implement.
- **AuditLog: KHÔNG đưa vào facility-scoped delete (R2-4)** — bảng không có cột facilityId (schema.prisma:962-977), lệnh deleteMany({where:{facilityId}}) là invalid. Chấp nhận residue, ghi chú trong report; mọi assert audit đã per-entityId nên không ảnh hưởng verdict.
- **ParentAccount/LoginOtp (R2-6):** unique system-wide (phone/email — schema.prisma:426,430), ngoài facility scope. Mọi spec tạo chúng (p1-guardian-link, P1-07 OTP) PHẢI track phones và gọi helper sẵn có `cleanupParentAccountsByPhone` (`db.ts:507`) trong afterAll.
- Sau teardown: assert `facility.count === 0` + spot-count các bảng facility-scoped mới = 0 + ParentAccount theo phones của run = 0.

## Related Code Files

- Create: `apps/e2e/src/prove-flow.ts` (declaration wrapper), `apps/e2e/src/flow-evidence-reporter.ts` (+ unit tests: merge precedence, serial-skip→blocked, partial re-run same batch)
- Modify: `apps/e2e/playwright.config.ts` (reporter array), `apps/e2e/src/db.ts` (teardown extension), `apps/e2e/src/global-setup.ts` (sentinel gate UI run; strip + fail-closed LLM_API_KEY; assert /health; assert E2E_AUTH_MODE=signed; bootstrap flip theo cờ), `apps/e2e/src/trpc-client.ts` (R3-1/R4-1: gate cờ `E2E_AUTH_MODE` ở primitives `createStaffClient`/`createLmsClient` — throw khi cờ bật; wrappers `createE2e*` flip theo), `.gitignore` (pattern `/acceptance-report/*` + negation)
- Read-only audit: `scripts/acceptance-report/*` (KHÔNG sửa ở phase này), git history của `flow-manifest.ts`

## Implementation Steps

**A. Mutation-test scanner (scratch branch `verify/scanner-mutation`, xoá sau):**
1. Re-run `pnpm acceptance:report` tại HEAD → diff với bản committed 0b3633d; reconcile SỐ FLOW (manifest 40 codes vs verification.json 38) → con số chuẩn dùng toàn plan.
2. Mutation tRPC / route / model → EXPECT `partial` từng cái; cái nào vẫn "built" = false-positive → finding Critical.
3. Revert sạch, re-run xác nhận baseline.

**B. Manifest history audit:**
4. `git log --follow -p scripts/acceptance-report/flow-manifest.ts` — verdict per-commit `hợp lệ | nắn claim | không kết luận được`, đặc biệt 3aff5f3.
5. Spot-check 5 procedure claimed (mỗi cluster 1): handler thật hay stub.

**C. Env + teardown + contract:**
6. Dựng postgres non-prod + seed (cùng phiên Git Bash, đủ env table; xác nhận/tạo sentinel marker).
7. Mở rộng `cleanupFacility` theo danh sách + thứ tự trên; test với data mồi từng bảng; wire `cleanupParentAccountsByPhone` pattern mẫu.
8. Sửa `.gitignore` → chạy verify `git check-ignore` + `git status` như trên.
9. Flip selector `trpc-client.ts` sang `E2E_AUTH_MODE` + fallback-throw (R3-1); global-setup: strip/fail-closed LLM_API_KEY; sentinel gate; assert /health; assert cờ signed. Baseline: chạy 11 specs api DƯỚI `E2E_AUTH_MODE=signed` + ui — vừa là baseline vừa là re-verify 11 specs authenticate signed end-to-end (R3-2); ghi nhận đỏ/flaky từ đầu (dữ kiện xác minh, không sửa cho xanh).
10. Viết `prove-flow.ts` (declaration wrapper) + reporter (array, atomic, batch run-id, precedence) + 3 unit tests; smoke test contract qua `finance-approval.spec.ts` → P1-03.

**D. Coverage matrix (rt#7 — precondition Phase 2–5):**
11. Ma trận spec→flow VERIFIED: test nào assert procedure nào bằng state-assertion thật (headers spec tự nhận WF không tin được). Binary annotate-vs-new. Lưu vào `reports/` của plan.

## Success Criteria

- [ ] 3/3 mutation đỏ đúng chỗ (hoặc finding Critical); số flow chuẩn reconciled.
- [ ] Bảng verdict per-commit manifest history (3aff5f3 có kết luận).
- [ ] Teardown chạy sạch: `facility.count===0`, 0 residue bảng mới, ParentAccount theo run-phones = 0; KHÔNG có lệnh AuditLog-by-facilityId.
- [ ] `git check-ignore acceptance-report/runtime-evidence.json` non-zero; file xuất hiện trong `git status` sau khi sinh.
- [ ] Reporter unit tests pass: precedence, serial-skip→blocked, partial re-run cùng batch không mất verdicts.
- [ ] global-setup fail-closed khi có LLM_API_KEY; server đạt /health; grep tên helper `createStaffClient|createLmsClient` trong tests = 0 (R4-1); unit test R3-1/R4-1: dưới `E2E_AUTH_MODE=signed`, gọi TRỰC TIẾP `createStaffClient`/`createLmsClient` → throw; 11 specs baseline pass dưới cờ signed.
- [ ] Sentinel gate: thiếu allow-flag hoặc sentinel facility → PLAYWRIGHT_UI run fail-closed (test cả 2 nhánh).
- [ ] Coverage matrix verified trong `reports/`.

## Risk Assessment

- Mutation quên revert → scratch branch + re-run xác nhận.
- Teardown sai FK order → test data mồi từng bảng trước Phase 2.
- Secret throwaway lộ log → không echo, chỉ inject qua env spawn.
- Signed-auth mode ≠ literal prod-env → residual gap ghi trung thực (report + legend), không phải che.
