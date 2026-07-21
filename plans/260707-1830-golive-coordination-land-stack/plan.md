---
title: >-
  Go-live coordination: land 4-PR stack + env reconcile + close stubs + sync
  tracker + UAT
description: >-
  Land stack tuyến tính vào main qua #16, khớp hợp đồng .env↔code (loại SSO
  tạm), đóng integration còn stub (LLM/S3/Graph/RT-3), đồng bộ tracker, chạy UAT
  + go/no-go. Plan-only, không implement.
status: superseded
priority: P1
branch: feat/uat-session-injection
tags:
  - go-live
  - coordination
  - stacked-pr
  - env-contract
  - integrations
  - uat
blockedBy: []
blocks: []
supersedes:
  - 'project:260707-1450-golive-production-readiness'
created: '2026-07-07T11:42:42.297Z'
createdBy: 'ck:plan'
source: skill
sourceReport: >-
  plans/reports/brainstorm-260707-1830-golive-coordination-safe-landing-report.md
---

# Go-live coordination: land 4-PR stack + env reconcile + close stubs + sync tracker + UAT

## Overview

Code PD-1/PD-2/ENV/UAT **đã commit** trên stack tuyến tính `feat/uat-session-injection`
(pd1 ⊂ pd2 ⊂ env ⊂ uat) + 2 fix chưa push. 4 PR (#13-#16) đều e2e-RED trên CI vì fix e2e
ở đỉnh stack. Việc còn lại KHÔNG phải "viết feature" mà là **điều phối land an toàn +
đóng khoảng trống ẩn**: hợp đồng `.env`↔code lệch, nhiều integration vẫn stub, tracker lệch code.

Nguồn: `plans/reports/brainstorm-260707-1830-golive-coordination-safe-landing-report.md`.
**Supersedes** `260707-1450-golive-production-readiness` (phase cũ mô tả work đã commit; plan này
phản ánh thực tế sau khi code đã đáp đất).

**Quyết định user (2026-07-07):** gộp qua #16 · loại SSO khỏi test tạm · LLM dùng
`https://router.clawcmc.io.vn/v1` model `ag/gemini-3.5-flash-low` · mục tiêu đồng bộ tracker + land → go-live.

**Bất biến:** không commit secrets (.env đã gitignore) · RLS `withFacility`+`cmc_app` · `can()` ·
zod + 5 mã lỗi · AI draft-only + che PII + consent ảnh trẻ · timestamptz/ICT.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Land-Stack](./phase-01-land-stack.md) | Completed |
| 2 | [Env-Reconcile](./phase-02-env-reconcile.md) | Pending |
| 3 | [Close-Integrations](./phase-03-close-integrations.md) | Pending |
| 4 | [Sync-Tracker](./phase-04-sync-tracker.md) | Pending |
| 5 | [UAT-GoNoGo](./phase-05-uat-gonogo.md) | Pending |

Thứ tự: P1 → P2 → P3 → P4 → P5 (tuần tự). P2 (env) chặn P3 (verify integration cần env đúng) và P5 (UAT cần env prod). P3 chặn P5 (UAT chạy integration thật).

## Dependencies

- Supersedes `project:260707-1450-golive-production-readiness` — plan cũ chuyển `status: superseded`, không thực thi song song.
- Ngoài repo: VPS cho `cmcv2-prod` (P5); credentials S3 bucket (P2/P3); LLM key đã có trong `.env`.

## Acceptance (toàn plan)
- main xanh typecheck+unit+e2e; #16 merged; #13/#14/#15 đóng; 3 nhánh con xoá.
- Mọi biến code đọc có mặt trong `.env`/`.env.example` (trừ SSO tạm off); env-check pass fail-closed.
- LLM gọi router thật (verify 1 draft round-trip); S3 put/get bucket thật; email Brevo gửi thật; Graph có quyết định (impl thật hoặc tắt rõ ràng); RT-3 blobRef ownership đóng.
- Tracker (task list + plan cũ + ui plan + changelog) khớp code-reality.
- UAT: e2e critical 2 lần xanh liên tiếp + restore-drill pass + biên bản go/no-go ký.

## Gate results
- Red-team: xem `## Red-team findings` cuối file (đã chạy inline, fix áp vào phase).
- Validate: xem `## Validation` cuối file.

## Red-team findings (đã chạy inline 2026-07-07)

- **RT-CRITICAL — SSO là blocker cứng của go-live phía staff (KHÔNG optional).**
  `apps/api/src/context.ts` `createContext`: staff `subject` chỉ đến từ `x-dev-user`, gated
  `DEV_AUTH_ENABLED = NODE_ENV !== 'production'`. Entra SSO còn TODO. ⇒ **Trong production,
  `subject=null` → mọi `protectedProcedure` (toàn bộ ERP staff: finance/attendance/HR) từ chối.**
  LMS parent/student vẫn chạy (bearer token, mọi env). "Loại SSO khỏi test" đúng cho e2e Mode B,
  nhưng go-live staff BẮT BUỘC có SSO. → **Quyết định sản phẩm cần user (open question #1).**
  Áp vào plan: P5 staff-side = NO-GO nếu SSO chưa bật; nếu chọn go-live LMS-first thì scope P5 thu về LMS.
- **RT-B — CI e2e có thể vẫn đỏ dù đã fix (P1 pre-merge).** pd2 thêm boot-check "non-superuser" +
  FORCE-RLS. Nếu job CI e2e connect bằng Postgres superuser/owner và KHÔNG tạo role `cmc_app` +
  `APP_DATABASE_URL` → boot-check throw → #16 e2e vẫn RED. Phải verify CI provisions `cmc_app`
  trước khi kết luận merge. (Áp vào P1 step 2.)
- **RT-E — RT-3 ownership cần liên kết blobRef→submission.** Trước khi viết ownership check phải
  xác minh schema có FK/tham chiếu blobRef→submission/exercise; nếu không có → cần bổ sung trước.
  (Áp vào P3 step 5: investigate schema trước.)
- **RT-H — task "landed" ≠ "integration verified".** P4 chỉ đánh completed cho phần ĐÃ LAND (code
  vào main); phần integration thật verify riêng ở P3 — không đánh completed sớm che stub. (Áp P4.)
- **RT-A — RLS table thêm SAU migration 190000 sẽ không auto-FORCE.** Migration hiện quét 1 lần lúc
  chạy. Boot-check bắt được (fail-closed) nhưng nên ghi known-gap: table RLS mới cần FORCE riêng.
- **RT-D — router.clawcmc có thể không OpenAI-compatible.** P3 verify round-trip bắt lệch shape sớm;
  parse `choices[0].message.content` — nếu khác thì chỉnh, không giả định.

## Validation (critical questions — đã chạy inline)

1. **[BLOCKER] Go-live scope staff hay LMS-first?** Do RT-CRITICAL: nếu cần staff ERP → SSO phải vào
   trước P5 (thêm track SSO ở P3); nếu LMS-first → P5 scope LMS, staff hoãn tới SSO. → **cần user chốt.**
2. **Email go-live: Brevo-only đủ chưa hay bắt buộc Graph?** Brevo transport đã hoạt động; Graph.send
   còn throw. Quyết định ảnh hưởng P2/P3. → cần user chốt (mặc định đề xuất: Brevo-first, Graph sau).
3. **Staging DB cho P5 tách prod thật chưa?** e2e P5 phải trỏ staging/prod-config, không prod live.
4. **LLM router shape** đã xác nhận OpenAI-compatible chưa? P3 verify round-trip sẽ kiểm.

> **HANDOFF 2026-07-07 21:xx:** P1/P2/P3 (trừ SSO) HOÀN TẤT — PR #16–#23 merged, main xanh.
> Phần còn lại (P3-SSO, P5-UAT, ENV) chuyển sang plan kế thừa
> `plans/260707-2128-staff-sso-golive-roadmap/` (S1 role substrate → S2 Entra SSO → S3 env-prod → S4 UAT).
> Không thực thi tiếp plan này.

## Whole-plan consistency
- Đã đối chiếu: quyết định "SSO loại khỏi test" (user) ≠ "SSO optional cho go-live" (sai) — plan ghi rõ
  phân biệt test-scope vs prod-go-live-scope để không mâu thuẫn.
- Plan cũ `260707-1450` chuyển superseded (P4 thực thi) — tránh 2 plan go-live song song.
