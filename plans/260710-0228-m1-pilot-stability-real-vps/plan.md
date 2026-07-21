---
title: "M1 — Pilot ổn định + VPS thật"
description: "Chuyển stack cmcv2-prod từ local-sim sang VPS thật (TLS/DNS/backup remote), trả nợ full G7, đóng hardening tồn đọng, vận hành pilot ≥2 tuần không CRITICAL."
status: pending
priority: P1
effort: ~6 engineer-days + ≥2 tuần pilot soak
branch: main
tags: [infra, deploy, vps, backup, hardening, pilot, milestone-m1]
created: "2026-07-10"
blockedBy: [260707-2308-golive-sprint-land-sso-env-uat]
---

# M1 — Pilot ổn định + VPS thật

## Overview
Milestone M1 của roadmap (`docs/project-roadmap.md:35`). Chỉ thực thi **sau khi M0 GO ký (2026-07-12)** —
GO chốt scope pilot 1 cơ sở + kích hoạt chuyển VPS. Mục tiêu: hết local-sim → hạ tầng production thật
(vision đích §3, roadmap:22). Đây là lần **clean-room deploy** đầu tiên = tự nhiên trả nợ **full G7** đã
defer từ M0 (phase-04 golive Overview: "full G7 deferred to M1"). Kèm đóng 2 finding review 260710
(sweep HIGH, outbox index MEDIUM) + 1 fixture RLS pre-existing, và thiết lập vòng vận hành fix-forward.

Quality-gated, không date-gated (roadmap §3). Exit = M1 row roadmap đo được.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Decision gate + provision VPS | pending | [phase-01-decision-gate-provision-vps.md](phase-01-decision-gate-provision-vps.md) |
| 2 | Clean-room deploy = trả nợ full G7 | pending | [phase-02-clean-room-deploy-full-g7.md](phase-02-clean-room-deploy-full-g7.md) |
| 3 | Data cutover local-sim → VPS | pending | [phase-03-data-cutover.md](phase-03-data-cutover.md) |
| 4 | Hardening tồn đọng (code) | ✅ landed (PR #31, merge `179c158`) | [phase-04-hardening-code.md](phase-04-hardening-code.md) |
| 5 | Backup định kỳ + runbook second-person | pending | [phase-05-backup-runbook-second-person.md](phase-05-backup-runbook-second-person.md) |
| 6 | Pilot stabilization ≥2 tuần | pending | [phase-06-pilot-stabilization.md](phase-06-pilot-stabilization.md) |

## Dependencies
- **Chặn toàn plan:** M0 GO ký (plan `260707-2308`, GO/NO-GO 2026-07-12). NO-GO → M1 không khởi động.
- P4 (hardening code) chạm file khác infra (`apps/api/src/**`, `packages/db/**`) → **song song P1–P2**,
  nhưng **PHẢI xong trước P3 dump** (M4: migration index nằm trong dump cutover, tránh drift).
- P2 blocked-by P1 (cần VPS provisioned). **P3 blocked-by P2 + P4** (cần stack VPS + index đã land trước dump).
  P5 blocked-by P2+P3 (cần VPS + dữ liệu). P6 blocked-by P2,P3,P4,P5 (soak trên binary hardened + backup định kỳ).
- Ngoài repo: VPS provider/ngân sách/region (decision-gate P1 — validation #1); domain = **giữ domain
  đã đăng ký Azure redirect URI** (validation #2, không sửa App Registration);
  BREVO_API_KEY verify hoạt động trên VPS (rotate thuộc M0 P-1, M1 chỉ verify — H6).

## Bất biến (không phase nào được nới)
- RLS `withFacility` + role `cmc_app` (non-superuser) + FORCE ROW LEVEL SECURITY mọi bảng.
- `ACTIVE_ROLES` = **5 role thật**, KHÔNG mở/reactivate role mới (role-reality PO 2026-07-10;
  ctv_mkt giữ dormant). Plan M1 không chứa việc mở role.
- zod validate + đúng 5 mã lỗi ở API boundary.
- Không commit secrets/`.env.prod`/token/passphrase. Backup **luôn encrypted** (AES-256) trước khi rời máy.
- `dev-header` / `ALLOW_DEV_AUTH` / `TEST_OTP_SEAM` chỉ non-prod (boot-check + env-check fail-closed).
- timestamptz + ICT; sổ tiền/append-mindset (RefundRecord/AuditLog/ReconciliationFlag không DELETE).
- `STAFF_SESSION_SECRET` ≠ `LMS_SESSION_SECRET`.

## Acceptance (toàn plan = exit criteria M1 roadmap:35)
1. Stack `cmcv2-prod` chạy trên **VPS thật** (không local-sim), tất cả service healthy; TLS/DNS thật;
   `env-check.sh` + `isolation-check.sh` PASS; boot-checks API/worker không FATAL.
2. **Full G7 PASS**: clean-room deploy từ zero theo runbook có chữ ký second-person (không G7-light).
3. Restore drill PASS trên VPS với backup **R2 remote** (host ≠ deploy host, RT-13); cutover verify 49 bảng
   + RLS smoke + super_admin login thật.
4. Backup cron chạy định kỳ (verify ≥1 chu kỳ tự động thành công); restore drill định kỳ có lịch.
5. Hardening đóng: sweep không write-amplify; EmailOutbox có index + retention 30d; receipt-get fixture
   xanh → unit suite xanh toàn bộ (>525 sau khi thêm test); gates typecheck/build/test + e2e Mode-B xanh.
6. **≥2 tuần vận hành pilot không sự cố CRITICAL**; mỗi fix qua 1 PR + gates; runbook cập nhật cho VPS.

## Execution protocol
- **Fix-forward**: mỗi thay đổi 1 branch/PR + gates (typecheck 26 · build 14 · unit · e2e Mode-B);
  không hotfix tay trên VPS (roadmap:24 vòng học hỏi đóng).
- **Ops quirks bake sẵn** (chi tiết trong phase): dev-host docker qua Git Bash (không WSL2); local-sim
  postgres không map port → socat sidecar `cmcv2-pgfwd:15432`; DB pilot local-sim = `cmc_prod`,
  test/e2e = throwaway `cmc_staging` (KHÔNG BAO GIỜ trỏ cmc_prod); `.env.prod` DATABASE_URL có
  `?schema=public` (backup script tự strip); unit test cần container `cmc-pg` up.
- **Stop-conditions** (kế thừa 260707-2128 + thêm M1): creds sai · migration mất dữ liệu · thao tác phá
  huỷ ngoài repo · e2e nghi trỏ DB thật · **cutover không có rollback path = dừng** · **TLS/DNS trỏ sai
  domain đang dùng thật = dừng**.
- Cập nhật cột Trạng thái roadmap:35 khi M1 chuyển pha.

## Red Team Review — 2026-07-10 (2 reviewer thù địch, findings verify bằng code)

15 findings, tất cả ACCEPT + đã bake vào phase files. Infra: 3 Critical · 3 High · 3 Medium. Code: 2 High · 2 Medium · 1 Low.

| # | Finding | Sev | Áp dụng |
|---|---------|-----|---------|
| C1 | Role `cmc_app` do MIGRATION `20260706054322` tạo (:151-152), KHÔNG phải compose init — dump không chứa CREATE ROLE | Critical | P3: tạo role TRƯỚC pg_restore; sửa key-insight + runbook DR |
| C2 | P2 migrate+seed `cmc_prod` rồi P3 restore full dump vào cùng DB = "relation already exists" | Critical | P2 KHÔNG migrate/seed cmc_prod (smoke throwaway drop sau); P3 restore vào DB TRỐNG, `--no-owner` no `--clean`, rồi `migrate deploy` |
| C3 | P2 rotate passphrase → dump cutover mã hoá bằng passphrase cũ, restore VPS fail bad-decrypt | Critical | P2/P3 GIỮ passphrase M0; rotate SAU cutover (P5), escrow giữ cả cũ+mới |
| H4 | "VPS DB reachable trực tiếp" sai — postgres không map port cả 2 host | High | P3 backup/restore qua socat sidecar / container attach net (như P5 cron) |
| H5 | Rollback "trỏ DNS về local-sim" bất khả (self-signed, không routable public) | High | Rollback = tiếp tục pilot trên local-sim (không teardown tới VPS ổn X ngày); DNS TTL hạ thấp |
| H6 | "BREVO verify" nhưng M0 key 401 chưa rotate; env-check chỉ check non-empty | High | P2 gate email-live: 1 API call/1 email thật; ghi rotate thuộc M0 P-1 |
| M7 | Freeze "read-only" không có cơ chế thật | Medium | P3 freeze = `docker compose stop api worker` (hard freeze) |
| M8 | P6 exit không đo được: X phút undefined, template chưa có, alert aspirational | Medium | Rubric (validated: X=30 phút) + incident log docs/journals/ + healthcheck cron VPS |
| M9 | Escrow passphrase M0 chưa xác nhận done, P6 exit phụ thuộc | Medium | Precondition P3 checklist; P5 verify recoverable (cả cũ+mới) |
| H1 | Sweep fix `NOT path['scrubbed'] equals true` = NULL-trap (row chưa-scrub thiếu key → loại nhầm → OTP không scrub) | High | Whole-object `NOT equals SCRUBBED_OTP_PAYLOAD`; empirical check 2' + test 2 hướng |
| H2 | `makeMockDb()` (:244) không stub `deleteMany` → prune crash toàn bộ unit test | High | Stub deleteMany + cập nhật mọi expect shape khi thêm field `pruned` |
| M3 | `[status,createdAt]` không phủ cap-count (query không có cột status) | Medium | Cap-count GIỮ seq-scan ở pilot (YAGNI); không hứa index cover; GIN chỉ khi multi-facility |
| M4 | "P4 song song P1–P3" quá mạnh — P4 ships migration, dump drift `_prisma_migrations` | Medium | P4 LAND TRƯỚC P3 dump (index trong dump); deps P3←P2+P4; migrate deploy no-op sau restore |
| L5 | Gate "525/525" stale khi P4 thêm test | Low | Wording "unit suite xanh toàn bộ (>525)" |

**Xác nhận KHÔNG phải issue (đóng vòng):** 6 fix-forward bug local-sim đã land trên main (nginx resolver,
LMS VITE_API_URL, `?schema` strip, ACL-inclusive dump) — image build từ main tự có · RT-13 host-guard
đúng (R2 host ≠ VPS) · DB port đóng là chủ đích (đúng bảo mật, là *nguyên nhân* H4 không phải lỗi) ·
trap rm dump PII · drill guard chặn cmc_prod + BACKUP_BUCKET_PRIVATE gate fail-closed · session-secret
rotate chỉ invalidate cookie (force re-login, không mất data) · receipt-get `testDbBypass` idiomatic
(Receipt là bypass arrange target, ACT vẫn qua withFacility) · retention prune KHÔNG đụng failed/pending
OTP · task graph acyclic khớp plan.md.

## Validation Log — 2026-07-10 (user chốt)

| # | Câu hỏi | Quyết định | Propagated |
|---|---------|-----------|------------|
| 1 | VPS provider/ngân sách/region | **Giữ decision-gate P1** — chốt khi P1 thực thi (sau M0 GO 12/07) | Phase 1 giữ nguyên bảng quyết định |
| 2 | Domain chính thức | **Dùng domain đã đăng ký Azure redirect URI** — không sửa App Registration, tránh AADSTS50011 | Phase 1/2: bỏ nhánh "domain mới" |
| 3 | Severity rubric P6 | **Confirm, X = 30 phút** (CRITICAL: mất data/RLS phá/auth bypass/down>30'/PII rò → reset đồng hồ 2 tuần) | Phase 6 (đã điền) |
| 4 | `EMAIL_OUTBOX_RETENTION_DAYS` | **30 ngày** (khớp lifecycle R2) | Phase 4 (đã điền) |

Lịch cutover + freeze window: chốt tại P3 execution (phụ thuộc ngày GO + lịch pilot — không quyết trước được).
Mâu thuẫn mở còn lại: **0** (VPS provider là decision-gate chủ đích trong P1, không phải mâu thuẫn) → plan sẵn sàng thực thi khi M0 GO.
