---
title: "Role scope alignment Nac 2: chan gan role gac + lam sach registry ve 5 role that"
description: "Thu hệ thống sống (registry quyền + gán role + UI) về đúng 5 role thực tế (super_admin, GĐKD, GĐĐT, sale, giao_vien); enum DB giữ 9 giá trị trơ. TDD: khoá ma trận active trước khi xóa role gác. Amendment ADR-D."
status: done
priority: P1
branch: "main"
tags: [rbac, auth-registry, adr-d, role-scope, tdd]
blockedBy: []
blocks: [260707-2308-golive-sprint-land-sso-env-uat]
created: "2026-07-08T15:53:29.419Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260708-2232-role-scope-alignment-adr-d-report.md"
---

# Role scope alignment Nấc 2: chặn gán role gác + làm sạch registry về 5 role thật

## Overview

PO chốt (brainstorm 260708-2232): thực tế chỉ có **sale, giáo viên, GĐKD, GĐĐT + IT (super_admin)**
vận hành ERP; LMS = PH + HS. 2 giám đốc đảm nhiệm toàn bộ việc của role gác (ke_toan/cskh/ctv_mkt/hr).
Hiện registry `@cmc/auth` vẫn ghi quyền dormant cho role gác (ke_toan có `finance.receiptApprove`)
và màn Phân quyền cho gán cả 9 role → rủi ro gán nhầm = có quyền duyệt tiền.

**Mục tiêu:** hệ thống *sống* (quyền + gán + UI) phản ánh đúng 5 role thật. Enum DB `Role` giữ
nguyên 9 giá trị (không migration — xóa giá trị enum Postgres đau, không đáng trước go-live).
`ROLES` (9) trong `@cmc/auth` giữ nguyên để drift-test enum↔TS không đổi; thêm `ACTIVE_ROLES` (5).

**TDD bắt buộc:** Phase 1 viết test khoá ma trận quyền đích (theo TL14 §5 trừ role gác) TRƯỚC,
xanh phần active / đỏ phần deferred-denial → Phase 2 cleanup làm đỏ thành xanh. Chống rơi quyền
giám đốc/sale ngoài ý muốn.

**Bất biến kế thừa (roadmap §3):** RLS `withFacility`+`cmc_app` · zod + 5 mã lỗi · không commit
secrets · timestamptz/ICT. Bất biến "can() registry 9-role" được **amendment** thành "enum 9 giá
trị, registry active 5 role" (Phase 4, ADR-D §sửa đổi).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Baseline-Tests-Lock-Active-Matrix](./phase-01-baseline-tests-lock-active-matrix.md) | Done |
| 2 | [Registry-Cleanup-Active-Roles](./phase-02-registry-cleanup-active-roles.md) | Done |
| 3 | [Assignment-Guard-API-UI](./phase-03-assignment-guard-api-ui.md) | Done |
| 4 | [Docs-ADR-Amendment-Gates](./phase-04-docs-adr-amendment-gates.md) | Done |

Phụ thuộc tuyến tính 1→2→3→4. Phase 1+2 cùng chạm `packages/auth` — không song song.
**[RED-TEAM] Land cả 4 phase trong MỘT PR** — đóng cửa sổ TOCTOU (updateRoles còn nhận 9 role
tới khi Phase 3 land trong khi SSO inject `AppUser.roles` verbatim vào session).

## Acceptance (toàn plan)

- Registry `@cmc/auth` không còn tham chiếu `ke_toan`/`cskh`/`ctv_mkt`/`hr` trong mảng quyền nào
  — **đây là boundary thật** (deny-safe với mọi đường ghi roles), khoá bằng invariant test.
- Endpoint `user.updateRoles` reject role gác (BAD_REQUEST qua zod, defense-in-depth) — áp dụng
  mọi caller của endpoint kể cả super_admin; writer ngoài tRPC (seed script) bypass zod by design.
- `user.updateRoles` chặn gỡ super_admin **cuối cùng** của hệ thống (FORBIDDEN) — đóng lỗ lockout
  (comment cũ hứa guard này trước SSO-wiring nhưng SSO đã live).
- UI Phân quyền chỉ hiển thị/gán 5 role active; user còn mang role gác vẫn Save được (role gác
  bị drop chủ động — không deadlock).
- Hành vi 5 role active **không đổi** (ma trận Phase 1 xanh trước và sau cleanup; riêng `can()`
  sửa 1 dòng widening cast — bắt buộc để typecheck, không đổi hành vi).
- `apps/api/src/context.ts:33` (session schema) GIỮ 9-role — không narrow (chống staff lockout).
- Drift-test enum↔ROLES giữ nguyên pass; typecheck 26/26 · test suite xanh · build 14/14 ·
  `pnpm --filter @cmc/e2e test` xanh (root test filter bỏ e2e).
- ADR-D amendment + TL14 cập nhật cùng PR (quy tắc TL14 §7: enum/registry/docs sửa cùng lúc).

## Dependencies

- **Blocks** `project:260707-2308-golive-sprint-land-sso-env-uat` **Phase 4 (UAT) only** — UAT
  phải test trạng thái role cuối; Phase 2 (env-prod) của plan đó chạy song song được (không đụng file).
- Nguồn quyết định: `plans/reports/brainstorm-260708-2232-role-scope-alignment-adr-d-report.md`.
- Không phụ thuộc ngoài repo. Không migration DB.

## Out of scope

Xóa giá trị enum DB · đổi URL `/hr/*` (PO chốt giữ) · thay đổi hành vi bất kỳ của 5 role active ·
LMS principals (guardian/student — không nằm trong staff Role enum) · các hạng mục M0 khác.

## Red Team Review

### Session — 2026-07-08
**Reviewers:** Security Adversary · Assumption Destroyer · Failure Mode Analyst (3 subagents,
tier Standard). **Findings:** 11 sau dedup (từ 18 thô) — **11 accepted, 0 rejected**.
**Severity:** 1 Critical, 3 High, 4 Medium, 3 Low.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `PERMISSIONS: ActiveRole[]` làm `can()` fail typecheck (TS2345 `index.ts:191`) — plan tự mâu thuẫn | Critical | Accept | Phase 2 |
| 2 | Modal Phân quyền deadlock cho user mang role gác (pre-load `users.tsx:107-114`); "tự nhiên rửa" sai ngược | High | Accept | Phase 3 |
| 3 | Thiếu guard last-super-admin; comment `router.ts:200-201` stale — SSO đã nối roles | High | Accept | Phase 3 |
| 4 | e2e `finance-approval.spec.ts:135-153` (ke_toan) sẽ pass vì lý do sai — mất coverage second-eye | High | Accept | Phase 2 |
| 5 | e2e ngoài `pnpm test` (root filter `!@cmc/e2e`) — gate phải chạy e2e riêng | Medium | Accept | Phase 4 |
| 6 | Phase 2 step 4 trỏ test không tồn tại (phantom cskh-positive; case thật `index.test.ts:44`) | Medium | Accept | Phase 2 |
| 7 | TOCTOU giữa Phase 2↔3 (updateRoles còn nhận 9 role) → land 1 PR + re-run DB check trước merge | Medium | Accept | plan.md, Phase 2, 4 |
| 8 | `context.ts:33` phải GIỮ 9-role (session schema) — narrow nhầm = staff lockout + vỡ e2e | Medium | Accept | Phase 3 |
| 9 | Zod không phải boundary thật (seed script bypass) — reframe: registry + invariant test là boundary | Medium→wording | Accept | plan.md, Phase 2, 3 |
| 10 | `SECOND_EYE_ROLES` là gate ngoài registry — ma trận Phase 1 không phủ (note giới hạn) | Low | Accept | Phase 1 |
| 11 | Generator test: loại super_admin khỏi assert-false trên key roster rỗng; `.max(9)` + comment stale | Low | Accept | Phase 1, 3 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03, phase-04
- Decision deltas checked: 8 (can() modified · deadlock fix · last-admin guard · e2e inventory+gate ·
  single-PR landing · precondition move Phase 4→2 · boundary reframe · context.ts keep-9)
- Reconciled stale references: 6 ("can() giữ nguyên" gỡ khỏi Phase 2 · "tự nhiên rửa" gỡ khỏi Phase 3
  Risk · acceptance "mọi caller" scoped về endpoint · Phase 4 step 5 đổi thành re-run · Phase 2 step 4
  viết lại · success criteria Phase 3/4 đồng bộ)
- Unresolved contradictions: 0
- Ghi chú mở cho executor: phạm vi đếm last-super-admin (per-facility vs system-wide dưới RLS
  `withFacility`) quyết định lúc implement — test phải phủ ngữ nghĩa "cuối cùng của HỆ THỐNG".
