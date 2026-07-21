---
phase: 3
title: "Data cutover local-sim → VPS"
status: pending
priority: P1
dependencies: [2, 4]
---

# Phase 3: Data cutover local-sim → VPS

## Context links
- backup/restore scripts: `scripts/backup-db.sh`, `scripts/restore-drill.sh`
- DR caveat (tạo role cmc_app trước restore trên host mới): `docs/runbook-deploy.md:79-86`, phase-02 golive:128
- Restore drill PASS local-sim (49 bảng, RT-13, escrow verify): phase-02 golive:74-84

## Overview
- **Date:** 2026-07-10 · **Priority:** P1
- **Description:** Chuyển dữ liệu pilot từ local-sim `cmc_prod` sang VPS: encrypted backup R2 → restore
  vào `cmc_prod` VPS TRỐNG. Đây chính là **restore với host thật ≠ backup host** (RT-13). Verify 49 bảng +
  RLS smoke + super_admin login. Định điểm cutover + freeze window + rollback path; local-sim giữ nguyên
  tới khi VPS ổn định X ngày.
- **Implementation status:** pending (blocked-by Phase 2 + Phase 4 — dump phải chứa migration index của P4)
- **Review status:** not reviewed

## Key Insights
- **[C1] Role `cmc_app` do MIGRATION tạo, KHÔNG phải compose init**: `CREATE ROLE cmc_app LOGIN
  NOSUPERUSER NOBYPASSRLS ...` nằm trong `20260706054322_p1_remediation_wave1_schema_rls/migration.sql:151-152`
  (guard `IF NOT EXISTS`), password set out-of-band `ALTER ROLE cmc_app WITH PASSWORD` (:148). pg_dump của
  1 DB **không** dump role cluster-global → dump có GRANT tham chiếu `cmc_app` nhưng KHÔNG có CREATE ROLE.
  Trên VPS host mới, role phải **tồn tại TRƯỚC `pg_restore`** (GRANT fail nếu role thiếu — runbook:79-86).
  → DR path: (1) tạo DB `cmc_prod` trống, (2) tạo role `cmc_app` (+ password khớp `APP_DATABASE_URL`) nếu
  chưa có, (3) restore, (4) `prisma migrate deploy`.
- **[C2] Ordering P2/P3 (quyết)**: P2 deploy stack + verify healthy nhưng **KHÔNG migrate/seed `cmc_prod`
  thật** (smoke P2 dùng throwaway DB, drop sau). `cmc_prod` VPS ở P3 là **DB TRỐNG mới tạo**. P3 restore
  **full dump (ACL + `_prisma_migrations`)** vào DB trống — `pg_restore --no-owner` (giữ ACL), **KHÔNG
  `--clean`** (DB đã trống, không cần drop). SAU restore chạy `prisma migrate deploy` để cuốn migration
  mới hơn dump nếu có (P4 index nằm trong dump nhờ M4 ordering → thường no-op, nhưng vẫn chạy để chắc).
- Dump chứa **PII trẻ em + tiền** → luôn encrypted (AES-256) khi qua R2; giải mã chỉ trên VPS trong `/tmp`
  với `trap rm` (scripts đã có trap `:40,:51`).
- `.env.prod` DATABASE_URL có `?schema=public` → backup script tự strip (`backup-db.sh:45`). Đã đóng.
- **[H4] DB không map port CẢ local-sim LẪN VPS** (compose:124-134, cố ý) → backup/restore trên VPS
  KHÔNG reach DB trực tiếp từ host shell. Phải qua **socat sidecar** (pattern `cmcv2-pgfwd:15432`) HOẶC
  chạy trong **container attach `cmcv2-prod-net`** — giống P5 cron. Không có luồng "reachable trực tiếp".
- **[C3] KHÔNG rotate `BACKUP_ENCRYPTION_PASSPHRASE` trước cutover**: dump cutover dùng passphrase **hiện
  hành** (đã escrow M0). Rotate passphrase chuyển sang **P5** (sau khi cutover verified); escrow giữ **CẢ**
  passphrase cũ (giải mã backup pre-cutover) lẫn mới. → P2 sinh mới session/DB secrets nhưng GIỮ passphrase.
- **[H5] Rollback = TIẾP TỤC pilot trên local-sim** theo phương thức truy cập trước cutover (không phải
  "trỏ DNS về local-sim" — local-sim là máy dev Windows sau nginx local, không phục vụ public domain).
  Local-sim **không teardown** tới khi VPS ổn định X ngày (P6 tuần đầu). **Hạ DNS TTL thấp trước cutover**
  để switch/revert nhanh. Cutover không có đường quay lại pilot = **stop-condition**.

## Requirements
- **Precondition [M9]**: escrow `BACKUP_ENCRYPTION_PASSPHRASE` (passphrase M0 hiện hành) confirm còn
  recoverable từ password manager TRƯỚC khi bắt đầu — nếu không giải mã được dump = cutover bất khả thi.
- Backup nguồn: chạy `backup-db.sh` trên local-sim (dump `cmc_prod` mới nhất, passphrase hiện hành) → R2
  encrypted. Dump timestamp phải > freeze start (bắt trọn state sau khi đóng writer).
- Restore đích: **DB `cmc_prod` VPS mới tạo TRỐNG** + role `cmc_app` tồn tại trước (C1); `pg_restore
  --no-owner` KHÔNG `--clean` (C2); từ R2 qua socat/container (H4). **VPS `hostname -f` ≠ R2 backup host**
  (RT-13 pass, `backup-db.sh:24-32`). Sau restore: `prisma migrate deploy` (cuốn migration mới hơn dump).
- Verify: 49 bảng (`information_schema.tables`), RLS smoke qua `cmc_app` không lỗi (`restore-drill.sh:118-125`),
  super_admin login thật, spot-check 1 facility scope (RLS isolation).
- **Freeze window [M7] = hard freeze thật**: `docker compose -p cmcv2-prod stop api worker` trên local-sim
  (dừng ghi ở tầng app — không "read-only" hư cấu vì app không có chế độ đó). postgres giữ chạy để dump.
  Thông báo pilot users trước. Ghi giờ stop.
- Cutover point + rollback ghi rõ: DNS switch sang VPS chỉ SAU khi verify pass; DNS TTL đã hạ thấp trước.

## Architecture
```
local-sim cmc_prod (stop api+worker = freeze) ──backup-db.sh (encrypt AES-256, passphrase hiện hành)──▶ R2
                                                          │
                          restore qua socat/container attach net (giải mã /tmp, trap rm)
                                                          ▼
              VPS cmc_prod TRỐNG mới tạo + role cmc_app tồn tại trước ──pg_restore --no-owner (no --clean)──▶
                                                          ▼
                          prisma migrate deploy  →  verify 49 bảng + RLS smoke + super_admin login
                                                          ▼
                          DNS switch → VPS  (rollback = tiếp tục pilot trên local-sim, DNS TTL thấp)
```
DB cutover = full dump/restore (không streaming). Downtime = freeze window (phút–giờ tùy data size).

## Related code files
- `scripts/backup-db.sh` (dump nguồn, encrypt, upload R2)
- `scripts/restore-drill.sh` (verify recoverability; drill target throwaway ≠ cmc_prod) — dùng làm khuôn
  verify; restore THẬT vào `cmc_prod` VPS làm riêng (drill guard chặn `cmc_prod`, `restore-drill.sh:40-44`).
- `docs/runbook-deploy.md:71-116` (restore drill + DR role note)
- Không sửa code (thuần ops); nếu lộ bug script → fix-forward 1 PR.

## Implementation Steps
0. **Precondition [M9]**: verify escrow passphrase M0 recoverable từ PM (giải mã thử 1 dump cũ). Hạ DNS TTL
   thấp (vd 60s) trước ngày cutover để switch/revert nhanh.
1. **Freeze [M7]**: thông báo pilot users; `docker compose -p cmcv2-prod stop api worker` trên local-sim
   (hard freeze — postgres giữ chạy) — ghi giờ.
2. Backup nguồn: `source .env.prod && ./scripts/backup-db.sh` trên local-sim (qua socat sidecar) →
   xác nhận `.dump.enc` mới trên R2 (timestamp > freeze start), passphrase hiện hành (KHÔNG rotate — C3).
3. VPS chuẩn bị đích: tạo DB `cmc_prod` TRỐNG; **tạo role `cmc_app`** (LOGIN NOSUPERUSER, password khớp
   `APP_DATABASE_URL`) nếu chưa tồn tại cluster (C1 — role không nằm trong dump). Reach DB qua socat/container (H4).
4. Restore [C2]: download dump R2 mới nhất → giải mã (`trap rm`) → `pg_restore --no-owner` (giữ ACL),
   **KHÔNG `--clean`** (DB đã trống) vào `cmc_prod` VPS. KHÔNG dùng `restore-drill.sh` (guard chặn cmc_prod,
   `:40-44`) — luồng restore riêng cùng flags. Sau restore: `prisma migrate deploy` cuốn migration mới hơn dump.
5. Verify: count 49 bảng; RLS smoke qua `cmc_app`; super_admin login thật; spot-check 1 facility (đúng
   scope, không rò cross-facility).
6. **Restore drill chính thức trên VPS** (RT-13 host thật): `restore-drill.sh` vào throwaway (qua socat/container)
   → PASS (`=== RESTORE DRILL PASSED ===`), backup_host ≠ VPS deploy_host.
7. Cutover: switch DNS → VPS (TTL thấp). Verify traffic thật vào VPS (log nginx). **Nếu verify fail bất kỳ
   bước → rollback [H5]**: bật lại api/worker local-sim (`docker compose start api worker`), tiếp tục pilot
   theo phương thức trước cutover; giữ nguyên data VPS chờ post-mortem.
8. Sau xác nhận VPS nhận traffic OK: ghi cutover point vào runbook + journal. Local-sim **giữ nguyên
   (chưa teardown)** làm rollback tới khi P6 soak xác nhận VPS ổn định X ngày (tuần đầu).

## Todo list
- [ ] Escrow passphrase M0 verify recoverable (precondition M9) + DNS TTL hạ thấp
- [ ] Freeze [M7]: `docker compose stop api worker` local-sim
- [ ] Backup nguồn mới → R2 (passphrase hiện hành, timestamp sau freeze)
- [ ] cmc_prod VPS TRỐNG + role cmc_app tạo trước restore (C1)
- [ ] Restore `--no-owner` no `--clean` (C2) qua socat/container (H4) + `prisma migrate deploy`
- [ ] Verify 49 bảng + RLS smoke + super_admin login + facility scope
- [ ] Restore drill chính thức VPS PASS (RT-13)
- [ ] DNS cutover + verify traffic; rollback [H5] = tiếp tục local-sim còn sống
- [ ] Cutover point ghi runbook + journal; local-sim giữ tới P6 tuần đầu

## Success Criteria
- [ ] Restore vào `cmc_prod` VPS TRỐNG: 49 bảng, RLS smoke qua cmc_app không lỗi; `prisma migrate deploy` no-op/clean
- [ ] super_admin login thật trên VPS sau restore
- [ ] Restore drill VPS PASS với backup R2 remote (RT-13: backup_host ≠ VPS host)
- [ ] Freeze [M7] hard (api/worker stop), không mất giao dịch (dump timestamp > freeze start)
- [ ] Rollback path (local-sim còn sống, chưa teardown) tới khi P6 tuần đầu xác nhận
- [ ] Cutover point + rollback ghi runbook; passphrase KHÔNG rotate ở phase này (C3)

## Risk Assessment
| Rủi ro | L×I | Mitigation |
|---|---|---|
| Mất giao dịch phát sinh giữa dump và cutover | Med×High | [M7] hard freeze `stop api worker`; dump SAU freeze; ghi giờ |
| pg_restore fail role cmc_app thiếu (host mới) | Med×High | [C1] tạo role TRƯỚC restore (không nằm trong dump — migration-created); runbook:79-86 |
| `--clean` xoá nhầm / migration drift dump vs code | Low×High | [C2] DB trống + no `--clean`; `migrate deploy` sau restore; P4 index đã trong dump (M4) |
| Cutover không đường quay lại pilot | Low×High | **Stop-condition**; [H5] local-sim giữ sống; DNS TTL thấp revert nhanh |
| DNS trỏ sai domain đang dùng thật | Low×High | **Stop-condition**; P1 đã verify dig=IP; confirm trước switch |
| VPS backup/restore không reach DB (không map port) | Med×High | [H4] socat sidecar / container attach net (như P5 cron) |
| Dump PII rò trên R2/tmp | Low×High | Encrypted client-side; trap rm; bucket private (BACKUP_BUCKET_PRIVATE_CONFIRMED) |

## Security Considerations
- Dump encrypted AES-256 trước rời máy; giải mã chỉ /tmp VPS với trap rm; bucket R2 private access disabled.
- RLS smoke qua `cmc_app` (non-superuser) chứng minh GRANT khôi phục đúng — không app-broken sau restore.
- Không log payload/PII; passphrase từ env không in.
- e2e/test KHÔNG BAO GIỜ trỏ `cmc_prod` — throwaway `cmc_staging` (ops quirk); drill guard chặn cmc_prod.

## Next steps
Cutover xác nhận → Phase 5 backup định kỳ (cron) + runbook second-person; Phase 6 soak bắt đầu đếm ≥2 tuần.
