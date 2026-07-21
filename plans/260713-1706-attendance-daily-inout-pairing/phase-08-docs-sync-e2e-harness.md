---
phase: 8
title: "Docs sync + e2e + harness"
status: completed
priority: P2
dependencies: [5, 6, 7]
---

# Phase 8: Docs sync + e2e + harness

## Overview
Chốt sau cùng: viết lại spec chi tiết sang mô hình mới (bỏ banner SUPERSEDED-PENDING),
flip ADR 0043 status → implemented, e2e attendance-lifecycle, harness story + trace.

## Requirements
- Functional:
  - e2e `attendance-lifecycle.spec.ts`: within-network punch → payroll tính công;
    offsite → phiếu → GĐ track duyệt → payroll tính; reject → resubmit.
  - Docs khớp code (không còn drift).
- Non-functional: harness Done Definition (docs current, trace recorded, story verify).

## Architecture / Docs cần cập nhật
- `docs/27-workflow-spec-p3.md`: viết lại WF-P3-01 (punch trong/ngoài mạng, cặp
  vào/ra, 10s), WF-P3-02 (phiếu tự sinh từ offsite, duyệt GĐ track, resubmit, bỏ
  chấm bù ngày tùy ý). Gỡ banner ⚠️ SUPERSEDED-PENDING. Sửa URL `/hr/checkin`.
- `docs/10-data-model-v2.md`: TimePunch.withinNetwork; ManualAttendanceTicket
  checkInAt/checkOutAt.
- `docs/11-api-contract.md`: `checkInOut.punch({reason?})`, `manualPunch.approve/
  reject/list/resubmit` (bỏ `create`), appCode OFFSITE_REASON_REQUIRED.
- `docs/19-quy-tac-nghiep-vu-chi-tiet.md` + `docs/20-quy-tac-nghiep-vu-van-hanh.md`:
  quy tắc cặp vào/ra, muộn/sớm 1 lần/ngày, phiếu offsite, duyệt track.
- `docs/decisions/0043-attendance-daily-inout-pairing.md`: Status → Accepted +
  "IMPLEMENTED 2026-..."; cập nhật bảng "code hiện tại vs đích" → đã đồng bộ.
- Nếu có ADR mới cho authorization managerId→track: cân nhắc ADR 0044 (đổi ủy quyền
  duyệt phiếu) — hoặc gộp vào 0043. Chốt ở Red Team.

## Related Code Files
- Create: `apps/e2e/tests/attendance-lifecycle.spec.ts`
- Modify: `apps/e2e/src/db.ts` (seed helper punch/ticket nếu cần)
- Modify: docs kể trên
- Harness: `scripts/bin/harness-cli story add/update/verify`, `trace`, `decision`
  refresh cho 0043.

## TDD / Validation Plan
1. e2e attendance-lifecycle: các bước trên, assert payslip số đúng + phiếu status.
2. `pnpm --filter e2e test -- attendance-lifecycle` (Mode-B secrets — memory
   `cmc-localsim-ops-quirks`).
3. Full suite: `pnpm typecheck && pnpm test` xanh.
4. Harness: `scripts/bin/harness-cli story add --id US-ATT-01 ... --verify "<cmd>"`;
   `story verify US-ATT-01`; `trace`.

## Implementation Steps
1. Viết e2e trước (RED nếu backend chưa xong — nhưng phase 8 chạy sau 5/6/7 nên xanh).
2. Cập nhật toàn bộ docs khớp code cuối.
3. Flip ADR 0043 status; refresh durable decision.
4. Harness story + verify + trace.
5. `npx gitnexus analyze` refresh index (PostToolUse hook tự chạy sau commit).

## Success Criteria
- [x] e2e `attendance-lifecycle.spec.ts` viết đầy đủ (within + offsite + reason-gate +
      wrong-track + self-approve + reject→resubmit→approve + R1 freeze + payroll credit)
      và **chạy thật xanh** — xem "Verification note" bên dưới.
- [x] Docs TL27/10/11/19/20 khớp code; banner SUPERSEDED-PENDING gỡ. Sweep thêm:
      docs/14, docs/22, docs/25, docs/codebase-summary.md, docs/uat-checklist-go-live.md,
      docs/system-architecture.md (mọi tham chiếu `assignPunchesToShifts`/`shortSpan`/
      `manualPunch.create`/managerId-cho-ticket đã xử hoặc xác nhận ngoài phạm vi).
- [x] ADR 0043 status = implemented; durable decision refreshed.
- [x] Harness story verify pass; trace recorded.
- [x] `pnpm typecheck && pnpm test` toàn repo xanh — root `pnpm typecheck` 26/26 task xanh;
      `apps/api` 87/87 file · 759/759 test xanh; `apps/e2e` 20/20 test xanh (1 skip không
      liên quan, `TEST_OTP_SEAM`).

## Verification note (2026-07-13, updated same day sau `/test`)

Phiên trước bị chặn vì DB local-sim không reachable (`localhost:5432` refused; socat sidecar
`cmcv2-pgfwd` forward `15432` đã bị dừng). Phiên `/test` này phục hồi bằng cách:

1. Dựng lại container socat forward (`docker run ... alpine/socat tcp-listen:15432 ...
   tcp-connect:postgres:5432` trên network `cmcv2-prod_cmcv2-prod-net`) — hành động không
   phá huỷ, có thể xoá lại bất kỳ lúc nào.
2. Phát hiện DB `cmc_staging` **đã tồn tại sẵn** trong cùng container postgres (khác
   `cmc_prod` — DB thật sự an toàn để test, không phải bản prod-named mà `global-setup.ts`
   chặn). `prisma migrate status` xác nhận schema đã khớp đủ 30 migration (kể cả migration
   attendance mới của plan này).
3. `pnpm install` (node_modules trống hoàn toàn — session trước bị reset) + `prisma generate`
   + `pnpm turbo run build --filter='./packages/*'` (stale-dist gotcha, lặp lại nhiều lần
   trong plan này) để mọi package built lại.

**Kết quả chạy thật (trỏ `DATABASE_URL`/`APP_DATABASE_URL` vào `cmc_staging` qua
`localhost:15432`):**
- `pnpm --filter @cmc/api test` (toàn bộ): **87/87 file, 759/759 test pass.**
- `pnpm --filter @cmc/e2e test` (toàn bộ, gồm `attendance-lifecycle.spec.ts`): **20/20 pass**
  (1 skip = `requestOtpEmail test seam`, không liên quan attendance).
- `pnpm typecheck` (root, turbo, 26 task bao gồm mọi app/package): **26/26 xanh.**
- `harness-cli story verify US-ATT-01`: **pass.**

**2 lỗi thật phát hiện + sửa trong lúc chạy thật (không phải do môi trường):**
- `apps/api/src/trpc-error-formatter.test.ts` — sót lại từ trước phase 1, còn assert model
  cũ (`appCode: IP_NOT_ALLOWED` cho IP lệch dải, message cooldown "5 minutes"). ADR 0043 đã
  bỏ hẳn việc từ chối IP lệch dải (chỉ còn `OFFSITE_REASON_REQUIRED` khi có ca đăng ký + chưa
  có phiếu) và đổi cooldown 5 phút → 10 giây. Viết lại 2 test theo hành vi thật.
- `apps/e2e/src/db.ts`'s `seedFacilityNetwork` (mới thêm trong phase 8) thiếu wrapper
  `withFacility(..., {bypass:true})` — ghi thẳng qua kết nối `cmc_app` (RLS-scoped) nên bị
  Postgres chặn `"new row violates row-level security policy for table FacilityNetwork"`. Đã
  sửa theo đúng pattern mọi seed helper khác trong cùng file dùng.

## Edge phụ (rà vòng 2)
- [x] **Template ca `end ≤ start`** (ca qua đêm): đã thêm `.refine(endTime > startTime)`
  vào `createTemplateInput` (`apps/api/src/shift/router.ts`) — overnight shift bị
  `BAD_REQUEST` ngay lúc tạo template thay vì tạo khung ca âm phá overlap/late.
  Test: `apps/api/src/shift/create-template-validate.test.ts` (Zod-level, chạy thật, 4/4 pass).
- **Ticket legacy không có giờ vào/ra**: greenfield → không có prod data; nếu tồn
  tại, approved mà thiếu cặp → không công (đã xử ở phase 5 dayValid). Ghi docs.

## Risk Assessment
- **Rủi ro:** docs sót chỗ → drift tái diễn. Mitigation: grep "assignPunchesToShifts",
  "shortSpan", "manualPunch.create", "managerId ... duyệt", "±2h" trong docs/ và xử hết.
- **Rủi ro:** e2e Mode-B secrets/local-sim flaky. Mitigation: theo runbook memory
  `cmc-localsim-ops-quirks`; nếu CI chưa sẵn, chạy local + ghi rõ.
