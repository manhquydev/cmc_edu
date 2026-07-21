---
title: "Go-live sprint: land SSO stack, cmcv2-prod env, UAT go/no-go"
description: "Hướng A từ brainstorm 260707-2308: land khối SSO uncommitted (gates đã xanh) qua PR + adversarial review, dựng cmcv2-prod local giả lập VPS (task #8), UAT e2e 2 lần xanh + người thật + biên bản go/no-go (task #9). Sửa drift trạng thái plan 260707-2128."
status: in-progress
priority: P1
branch: "main"
tags: [go-live, sso, entra, env-prod, uat, docker]
blockedBy: [] # nac2 done; lms-gap-closure done (OTP email thật KB1 bước 7); astryx-ui-migration DONE (PR #28 merged main 2026-07-10, cả 6 AC đạt, CI xanh) → Phase 4 UAT giờ chạy được trên UI Astryx mới
blocks: []
supersedes-partial: "project:260707-2128-staff-sso-golive-roadmap (phase 3 Env-Prod + phase 4 UAT chưa thực chạy — execution chuyển sang plan này)"
created: "2026-07-07T16:32:31.745Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260707-2308-production-readiness-assessment-and-golive-direction-report.md"
---

# Go-live sprint: land SSO stack, cmcv2-prod env, UAT go/no-go

## Overview

Đóng nốt 10–15% cuối tới vận hành pilot. Trạng thái verify 2026-07-07 23:23 trên working tree:
typecheck 26/26 · test 462 passed/13 skipped · build 14/14 — khối SSO (22 files, ~682 dòng) là
**code hoàn chỉnh chưa land**. Blocker RT-CRITICAL: production tắt dev-header, staff không login
được nếu SSO chưa lên main.

**Quyết định đã chốt (user 2026-07-07):**
- Hướng A go-live sprint; P4 còn thiếu + P5 agent build SAU khi GO (hướng C).
- Prod env = **full local setup giả lập VPS** (không phải VPS thật đợt này); Azure app registration đã cấu hình; S3/MinIO đã chốt.
- Kế thừa toàn bộ red-team findings RT-α..ε + protocol của plan `260707-2128`.

**Bất biến:** RLS `withFacility`+`cmc_app` · `can()` registry 9-role (ADR-D, không thêm role) ·
zod + 5 mã lỗi · không commit secrets · dev-header chỉ non-prod · timestamptz/ICT.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Land-SSO-Stack](./phase-01-land-sso-stack.md) | **Completed** (PR #24 merged `00ca207`, 2026-07-08) |
| 2 | [Env-Prod-Cmcv2](./phase-02-env-prod-cmcv2.md) | **Completed** (2026-07-09) — stack healthy, isolation/env-check/SSO-smoke PASS, seed super_admin done, restore drill PASS (R2 + escrow decrypt verified); 6 fix-forward bugs. Còn user-action: escrow passphrase + Azure MFA hardening |
| 3 | [Flow-Audit-Business](./phase-03-flow-audit.md) | **Completed** (2026-07-08: 0 CRITICAL / 3 HIGH / 13 MEDIUM; REDEPLOY NOT REQUIRED; Section 2 rewritten; TL25 P1-03 fixed) |
| 4 | [UAT-GoNoGo](./phase-04-uat-gonogo.md) | In progress — phần tự động xong (e2e 2/2 xanh Mode-B, G1/G5/G6/G8/G9/G10 tick). lms-auth-two-tier stub **đã resolved** (xoá, commit `8a0f8f2`, 2026-07-09). Blocker còn lại: UI Mantine→Astryx migration (đang làm, branch `feat/astryx-migration`) chặn UAT chạy trên UI mới; chờ UAT người thật + GO/NO-GO |

Phụ thuộc: P1 → P2 (image build cần code SSO trên main) → P3 (audit cần stack + code trên main) →
P4 (UAT cần stack healthy + kịch bản chuỗi liên vai từ P3, 0 CRITICAL audit mở).

**Cập nhật 2026-07-08 (brainstorm `plans/reports/brainstorm-260708-0906-m0-close-to-go-flow-audit-report.md`):**
- Chèn Phase 3 audit luồng nghiệp vụ trước UAT (user chốt phương án A — GO lùi ~1 ngày, UAT test đúng chỗ rủi ro).
- Restore drill: user cấp creds **Cloudflare R2** ngay — hết trạng thái HOÃN.
- Gate **G7 → G7-nhẹ trước GO** (chốt lại sau red-team F-S5, user duyệt 2026-07-08): người thứ hai
  ~15 phút chạy env-check + boot-checks + grep dev-seam theo checklist, ký xác nhận; full-redeploy G7
  gốc deferred sang M1.
- Mailbox **Graph licensed đã sẵn sàng** (user xác nhận) — hết trạng thái "cần xác nhận".

## Dependencies

- `project:260707-2128-staff-sso-golive-roadmap` — kế thừa quyết định Q1–Q3, RT-α..ε, protocol; phase 3+4 của plan đó thực thi tại đây (drift trạng thái sửa trong Phase 1 bước cuối).
- `project:260707-1830-golive-coordination-land-stack` — status pending nhưng P1–P3 đã land (PR #16–#23); không chạy song song, chỉ đối chiếu.
- Ngoài repo (stop-conditions — cần chốt trước phase liên quan):
  - **Backup Cloudflare R2 creds** (Phase 2 bước 7): user chốt cấp ngay (2026-07-08) — dạng **S3
    keypair** (`BACKUP_S3_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY`, R2 API Token S3-compatible — không
    phải bearer token); restore-drill RT-13 FAIL với localhost/minio → host backup thật ≠ deploy host.
    MinIO compose = app-storage, KHÔNG dùng cho backup. Stop-condition nếu creds chưa tới khi cần drill.
  - **Email Entra thật cho seed super_admin** (Phase 2 bước 8): user cung cấp — unresolved.
  - **WSL2** (hoặc Git Bash + vá `hostname -f`) trên host Windows (Phase 2 bước 0): runbook/scripts là bash, `hostname -f` fail native win32.
  - **Azure redirect URI thật** đã đăng ký khớp origin local-sim (Phase 2 bước 6 smoke bắt sớm AADSTS50011).
  - mailbox Graph licensed: **ĐÃ SẴN SÀNG** (user xác nhận 2026-07-08). Lịch + người UAT thật (Phase 4
    bước 1b — số người chốt sau khi Phase 3 ra khuyến nghị).

## Acceptance (toàn plan)

- Main chứa SSO stack, CI xanh; adversarial review code auth hoàn tất; changelog cập nhật.
- `cmcv2-prod` healthy trên máy local giả lập VPS; isolation-check + restore-drill (RT-13, target R2,
  dump mã hoá client-side + trap cleanup) pass; gate G1–G10 checklist tick đủ (G7 = G7-nhẹ PASS có chữ
  ký người thứ hai; full G7 deferred M1, ghi trong biên bản).
- Audit luồng nghiệp vụ (Phase 3): 28/28 WF verdict + hồ sơ 9 role + ≥5 chuỗi liên vai + danh sách
  mâu thuẫn tài liệu; 0 CRITICAL code-fix mở (CRITICAL sản-phẩm phải có quyết định user); Section 2
  UAT checklist viết lại theo chuỗi liên vai (1 PR, đối soát G2); verdict REDEPLOY ghi rõ.
- UAT: e2e critical 2 lần xanh liên tiếp (prod-config, staff Mode-B cookie + LMS Mode-B bearer); email live ≥1 Brevo + ≥1 Graph; UAT người thật PASS theo kịch bản chuỗi (gồm staff Entra login + role nav); biên bản go/no-go ký.
- Tracker #8/#9/#10 chuyển completed nếu GO; drift plan 260707-2128 đã sửa.

## Execution protocol (kế thừa 260707-2128)

Branch `feat/<phase>` từ main · gates xanh (typecheck/test/build) trước PR · adversarial review
cho code auth (Phase 1) · merge → xoá branch → changelog · cap review-fix 2 vòng ·
stop-conditions: creds sai, migration mất dữ liệu, thao tác phá huỷ ngoài repo, e2e nghi trỏ DB thật,
**CRITICAL từ audit Phase 3 cần quyết định sản phẩm chưa pre-resolved (escalate user; stall >1 ngày
→ park stack `compose stop` giữ volume — red-team F-FM6)**.

## Red-team findings kế thừa (đã CONFIRMED ở plan 260707-2128 — verify lại khi review Phase 1)

- **RT-α**: `x-facility-id` override — non-super_admin phải khớp `AppUser.facilityId` (FORBIDDEN nếu lệch); super_admin set facility bất kỳ.
- **RT-β**: staff Mode-B session-injection cho e2e prod-config (mint cookie bằng `STAFF_SESSION_SECRET`).
- **RT-γ**: `user.manage` roster rỗng → chỉ super_admin gán role (đúng ý định).
- **RT-δ**: alias `Role as DbRole` khi import cả Prisma lẫn `@cmc/auth`; role-drift test giữ đồng bộ.
- **RT-ε**: roles = snapshot lúc login (maxAge ~8h) — chấp nhận, không xây revocation (YAGNI).

## Red Team Review (3 reviewer thù địch, 2026-07-07 — findings verified bằng code)

> Lưu ý đánh số (2026-07-08): mọi tham chiếu "Phase 3" trong session này (H1, H6, M4, M7) trỏ tới
> UAT-GoNoGo — sau khi chèn Flow-Audit, UAT là **Phase 4**.

17 findings dedup, tất cả ACCEPT (đã bake vào phase files). Ranking:

**CRITICAL (code, đóng trong Phase 1 trước merge):**
- **C1 — Thiếu OAuth `state`/CSRF** (`sso-routes.ts:88-123`, verified): login không sinh state, callback không so state → login-CSRF/session-fixation. Comment dòng 14 sai. → Phase 1 gap + review blocking.
- **C2 — e2e staff specs vẫn dùng dev-header** (`~25 call site`, `trpc-client.ts:25-30`): dưới NODE_ENV=production mọi staff spec 401 → gate Phase 3 bất khả thi. → Phase 1 bước 7 refactor mode-switching.
- **C3 — Runbook không chạy được trên host Windows** (`restore-drill.sh:27` `hostname -f`, verified fail): chết dưới `set -e`. → Phase 2 bước 0 pin WSL2.

**HIGH:**
- **H1 — e2e `mintStaffCookie` forge super_admin + prod-secret sprawl** (`session-injection.ts:141-159`, không re-check DB) → Phase 3 bước 2 throwaway/rotate.
- **H2 — `STAFF_EMAIL_DOMAIN` fail-open** (`sso-routes.ts:132-140`; `boot-checks.ts:169-175` thiếu) → Phase 1 fail-closed boot-check.
- **H3 — off-box mâu thuẫn RT-13** (`restore-drill.sh:29-33` fail localhost/minio) → cần R2/S3 remote (Dependencies).
- **H4 — không có seed super_admin** (`seed.mjs` dev-only, chỉ Facility+CurriculumUnit) → Phase 1 bước 8 bootstrap script.
- **H5 — `sso-routes.ts` zero test** → Phase 2 bước 6 SSO smoke curl 302.
- **H6 — không có teardown NO-GO** (compose `restart: unless-stopped` giữ 80/443 + Entra seed) → Phase 3 bước 8 teardown.
- **H7 — `isolation-check.sh` chỉ soi cmcnew-*** (`:14,26,48-53`) bỏ lọt IIS/HTTP.SYS local → Phase 2 bước 2 host-port probe.

**MEDIUM:**
- **M1 — RT-α wording sai** (`context.ts:200-204` verified: silent-ignore, KHÔNG FORBIDDEN) → Phase 1 sửa wording + test ignore path.
- **M2 — migration unique-index dup email** (`migration.sql:18-22`) → Phase 1 bước 2 pre-flight query.
- **M3 — G10 STAFF≠LMS chưa boot-enforce** (`boot-checks.ts:104-141`) → Phase 1 boot-check.
- **M4 — e2e reset loop vô hạn** → Phase 3 bước 4 cap 4 cặp-Run/1 ngày.
- **M5 — commit staging không allowlist** → Phase 1 bước 1 pin 22-file + `git diff --cached` audit.
- **M6 — drift edit frontmatter mơ hồ** → Phase 1 bước 10 chốt `status: superseded` + cơ chế.
- **M7 — 13 skipped = lms-auth adversarial suite tối** (`lms-auth-two-tier.test.ts:14`) → Phase 1 bước 6 / Phase 3 un-skip trước Run 1.

## Validation (chốt với user 2026-07-07)
- **Backup R2/S3**: CHƯA có creds, cấp sau → Phase 2 bước 7 (restore drill) HOÃN đến khi có creds remote; các bước Phase 2 khác vẫn chạy. Drill là stop-condition cho hoàn tất task #8, không chặn dựng stack. **[Superseded 2026-07-08: user chốt cấp creds R2 ngay — drill un-hoãn, xem "Cập nhật 2026-07-08".]**
- **Exec shell**: **WSL2** — Phase 2 bước 0 chạy runbook/scripts trong WSL2 (bash đầy đủ, aws/psql/pg_restore native); không cần vá `hostname -f`.
- **Triển khai**: dừng ở plan, user review sau — KHÔNG cook trong phiên này.

## Red Team Review — Session 2 (2026-07-08, delta audit-phase)

3 reviewer thù địch (Security Adversary · Assumption Destroyer · Failure Mode Analyst) soi delta
2026-07-08 (Phase 3 mới + edits Phase 2/4). 20 findings thô → 15 sau dedup, **15/15 Accept**
(finding G7 là user-decision, user chốt phương án G7-nhẹ). Reports: `./reports/from-code-reviewer-to-planner-red-team-*.md`.

**Severity:** 1 Critical · 7 High · 7 Medium

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| 1 | Stale-image race — fix land main nhưng stack chạy image cũ; e2e xanh giả tín hiệu | Critical | Phase 3 bước 8 + Phase 4 bước 0 |
| 2 | Trace xuôi mù mutation gate-inline (`shift.cancel` :267) + false-CRITICAL trên lms/public/internal + requirePermission 2-arg | High | Phase 3 bước 1 (đảo chiều) + L4 |
| 3 | Router glob sót 5 file `-router.ts` (11 mutations) | High | Phase 3 Architecture |
| 4 | Cột "API (quyền)" TL25 drift — không grep 1:1 | High | Phase 3 bước 2a + L5 |
| 5 | UAT rewrite rớt coverage cskh/ctv_mkt (mutation PII) | High | Phase 3 bước 7 (ma trận role×perm) |
| 6 | 3 phase sửa chung uat-checklist + rewrite mồ côi G2/pointer | High | Phase 3 bước 7 (kỷ luật 1 PR) + Phase 4 bước 1 |
| 7 | Không lối đi CRITICAL-sản-phẩm; stall = stack squat + seed Entra sống | High | Phase 3 bước 6 + plan stop-conditions |
| 8 | Dump R2 = PII không mã hoá; /tmp kẹt dump khi fail; creds plaintext | High | Phase 2 bước 7 |
| 9 | aws-cli-v2 ↔ R2 checksum deterministic fail | Medium | Phase 2 bước 7 (pre-pin env) |
| 10 | Contract creds R2 sai dạng (keypair, không phải token) | Medium | Phase 2 bước 7 |
| 11 | Cột Test TL25: 6/28 tồn tại; "& pass" ngoài budget | Medium | Phase 3 L3 + bước 2b |
| 12 | Seed super_admin thiếu MFA/deactivation note | Medium | Phase 2 bước 8 |
| 13 | NO-GO teardown bỏ quên dump remote + R2 token | Medium | Phase 4 bước 8 |
| 14 | Plan 260708-0504 còn ghi "Phase-3 UAT" (stale sau đổi số) | Medium | Consistency sweep |
| 15 | G7 defer bỏ kiểm chứng độc lập → G7-nhẹ trước GO (user chốt) | Medium | Phase 4 Overview + bước 1 + plan.md |

Ghi chú fact-check: 39/41 claim verified; 1 FAILED (router glob — đã sửa, finding 3); nuance TTL
mintStaffCookie 1h (không phải 8h) — đã sửa wording Phase 4 bước 2.

### Whole-Plan Consistency Sweep — Session 2 (2026-07-08)
- Files reread: plan.md · phase-01..04 · cross-plan `260708-0504-roadmap-m1-m4-execution/plan.md`.
- Decision deltas checked: 8 (đổi số phase UAT 3→4 · G7-nhẹ · R2 keypair+mã hoá+checksum-pin ·
  phương pháp audit đảo chiều · test=tồn-tại · kỷ luật Section 2 · verdict REDEPLOY · TTL 1h).
- Reconciled stale references: 7 (Dependencies "API token"→keypair · Acceptance CRITICAL-code-fix+REDEPLOY ·
  Validation log note superseded drill-HOÃN · note đánh số Session-1 · note đánh số phase-01 ·
  phase-02 SC "Phase 3"→"Phase 4" · 260708-0504:45 "Phase-3 UAT"→Flow-Audit+Phase-4).
- Unresolved contradictions: **0**.

## Validation Log — Session 2 (2026-07-08, sau red-team delta)

3 câu hỏi (verification pass miễn — Red Team Session 2 đã verify 39/41 claim):

| # | Câu hỏi | Quyết định user | Propagated |
|---|---------|-----------------|------------|
| 1 | Escrow khoá mã hoá backup R2 | **Password manager** (bản sao passphrase ngoài máy dev; verify giải mã thử từ bản escrow) | Phase 2 bước 7 |
| 2 | L1 roster duyệt phiếu (pre-resolve chống stall F-FM6) | **Code đúng** — giữ [GĐKD, GĐĐT, Kế toán]; TL25 P1-03 là doc lỗi thời, audit sửa TL25 (PR doc MEDIUM) | Phase 3 L1 + bước 5 + SC |
| 3 | Retention backup R2 | **30 ngày** + lifecycle rule tự xoá trên bucket | Phase 2 bước 7 |

### Whole-Plan Consistency Sweep — sau Validation Session 2
- Files reread: plan.md + phase-01..04. Deltas: 3 (escrow · L1 pre-resolved · retention).
- Reconciled: Phase 3 SC bỏ nhánh "escalate L1"; bước 5 chuyển L1 từ "điều tra" sang "thực thi sửa TL25".
  Stop-condition CRITICAL-sản-phẩm GIỮ NGUYÊN (vẫn cần cho finding chưa lường trước ngoài L1).
- Unresolved contradictions: **0** → plan sẵn sàng thực thi (Phase 2 tiếp tục, Phase 3 execute khi Phase 2 xong).

### Whole-Plan Consistency Sweep — Session 1 (2026-07-07)
- Wording "FORBIDDEN" (RT-α cũ) đã đổi thành "silently ignore" ở plan.md + phase-01 (M1) — khớp code `context.ts:200-204`.
- "off-box = ổ khác" (phase-02 bản cũ) đổi thành "R2/S3 remote thật" nhất quán Requirements + Dependencies + Risk (H3).
- Prerequisite e2e mode-switching (C2) + lms-auth un-skip (M7) xuất hiện đồng bộ ở phase-01 (tạo) và phase-03 (tiêu thụ).
- Seed super_admin: phase-01 bước 8 tạo bootstrap script, phase-02 bước 8 dùng — không còn tham chiếu `seed.mjs` như thể đã có AppUser (H4).
- Không còn mâu thuẫn mở.
