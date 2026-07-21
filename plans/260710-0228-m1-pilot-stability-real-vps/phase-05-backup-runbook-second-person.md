---
phase: 5
title: "Backup định kỳ + runbook second-person"
status: pending
priority: P1
dependencies: [2, 3]
---

# Phase 5: Backup định kỳ + runbook second-person

## Context links
- Cron schedule mẫu (đã có trong runbook): `docs/runbook-deploy.md:263-271`
- backup/restore scripts: `scripts/backup-db.sh`, `scripts/restore-drill.sh`
- G7-light second-person pattern: `plans/260707-2308-.../phase-04-uat-gonogo.md:17-20`

## Overview
- **Date:** 2026-07-10 · **Priority:** P1
- **Description:** Thiết lập backup cron encrypted → R2 verify; lịch restore drill định kỳ; cập nhật
  runbook cho VPS thật; second-person 15' walkthrough theo runbook ký xác nhận (pattern G7-light).
- **Implementation status:** pending (blocked-by Phase 2 + 3)
- **Review status:** not reviewed

## Key Insights
- Runbook đã có cron mẫu (`runbook-deploy.md:263-271`) nhưng **chưa cài thật** — M0 chạy backup thủ công.
  M1 = lần đầu cron chạy tự động trên host thật; phải **verify ≥1 chu kỳ tự động thành công** (không chỉ
  cài crontab rồi tin).
- Cron chạy dưới user nào? `backup-db.sh` cần `pg_dump` reachable DB — trên VPS DB trong docker net,
  postgres không map port. Cron trên host cần reachDB: hoặc chạy backup qua throwaway container attach net,
  hoặc publish port nội bộ tạm. **Ghi rõ luồng reach-DB cho VPS trong runbook** (khác local-sim socat).
- Runbook hiện viết theo local-sim (một số bước giả định host-side DB reach `runbook-deploy.md:49-56`).
  M1 cập nhật thành **second-person walkthrough được**: người thứ hai làm theo mà không cần tác giả giải thích.
- Restore drill định kỳ = `restore-drill.sh` vào throwaway (không cmc_prod) — an toàn chạy cron.

## Requirements
- Cron backup daily encrypted → R2; **verify ≥1 lần chạy tự động** tạo `.dump.enc` mới trên R2 (không thủ công).
- Cron restore drill định kỳ (monthly) → log `=== RESTORE DRILL PASSED ===`.
- Runbook cập nhật cho VPS: luồng reach-DB cho cron (không socat local-sim), path deploy thật, LE cert renewal,
  DR role-create note (đã có :79-86). Second-person đọc-làm-được.
- Second-person 15' walkthrough: người thứ hai theo runbook chạy 1 backup thủ công + xem 1 drill log + xác
  nhận cron cài đúng → ký xác nhận (pattern G7-light, phase-04 golive:17).
- **[C3] Rotate `BACKUP_ENCRYPTION_PASSPHRASE` SAU khi cutover verified**: P2/P3 giữ passphrase M0 (để
  giải mã dump cutover). Ở P5 (sau P3 xác nhận): sinh passphrase MỚI, cập nhật `.env.prod` VPS, escrow giữ
  **CẢ** passphrase cũ (giải mã backup pre-cutover còn trên R2) lẫn mới. Backup cron mới dùng passphrase mới.

## Architecture
```
cron (VPS host) ──daily──▶ backup-db.sh (reach DB qua throwaway container / net) ──encrypt──▶ R2
cron (VPS host) ──monthly─▶ restore-drill.sh ──▶ throwaway DB verify ──▶ PASS log
```
Reuse scripts nguyên trạng (đã fix 6 bug local-sim). Chỉ đổi: crontab entries thật + runbook doc.

## Related code files
- `scripts/backup-db.sh` (cron target daily) — reuse
- `scripts/restore-drill.sh` (cron target monthly) — reuse
- `docs/runbook-deploy.md` (Modify: §1 reach-DB VPS, §5 cron thật, LE renewal, second-person section)
- Không sửa script trừ khi cron trên VPS lộ bug reach-DB → fix-forward 1 PR.

## Implementation Steps
1. Xác định luồng reach-DB cho cron trên VPS (postgres không map port): đề xuất backup chạy qua
   `docker compose exec` hoặc throwaway container attach `cmcv2-prod-net`; ghi lệnh chính xác vào runbook.
2. Cài crontab daily backup (02:00) + monthly restore drill theo `runbook-deploy.md:263-271`, chỉnh path
   deploy thật + luồng reach-DB bước 1; redirect log `/var/log/cmcv2-{backup,restore-drill}.log`.
3. **Verify chu kỳ tự động**: chờ (hoặc trigger sớm) 1 lần cron backup chạy → xác nhận `.dump.enc` mới trên
   R2 timestamp đúng + log không lỗi. Không tin crontab tới khi thấy artifact.
4. Chạy 1 restore drill định kỳ đầu tiên qua cron path → `=== RESTORE DRILL PASSED ===` trong log.
5. Cập nhật runbook: reach-DB VPS, LE cert renewal (certbot renew + reload nginx), DR role note (giữ),
   escrow verify. Đảm bảo second-person đọc-làm-được (không giả định kiến thức tác giả).
6. **[C3] Rotate passphrase** (sau P3 cutover verified): sinh `BACKUP_ENCRYPTION_PASSPHRASE` MỚI → cập nhật
   `.env.prod` VPS → escrow giữ CẢ cũ + mới trong PM. Verify recoverable: giải mã thử 1 dump MỚI (passphrase
   mới) + 1 dump pre-cutover (passphrase cũ) từ PM (không phải `.env.prod`), theo `runbook-deploy.md:100-107`.
7. Second-person 15' walkthrough: người thứ hai theo runbook làm 1 backup thủ công + xem drill log + xác
   nhận cron → ký xác nhận. Ghi vào `docs/uat-checklist-go-live.md` hoặc journal.

## Todo list
- [ ] Luồng reach-DB cron VPS xác định + ghi runbook
- [ ] Crontab daily backup + monthly drill cài (path + reach-DB đúng)
- [ ] Verify ≥1 backup tự động → .dump.enc mới trên R2
- [ ] Verify ≥1 restore drill cron PASS log
- [ ] Runbook cập nhật VPS (reach-DB, LE renewal, DR note)
- [ ] [C3] Rotate passphrase sau cutover + escrow cả cũ+mới + verify giải mã cả 2 từ PM
- [ ] Second-person walkthrough ký

## Success Criteria
- [ ] ≥1 chu kỳ backup **tự động** (cron) thành công — `.dump.enc` mới trên R2, log clean
- [ ] ≥1 restore drill cron PASS (`=== RESTORE DRILL PASSED ===`), RT-13 host thật
- [ ] Runbook second-person đọc-làm-được cho VPS (không giả định kiến thức tác giả)
- [ ] [C3] Passphrase rotated sau cutover; escrow giữ cả cũ+mới; giải mã verify cả 2 dump từ PM
- [ ] Second-person walkthrough ký xác nhận

## Risk Assessment
| Rủi ro | L×I | Mitigation |
|---|---|---|
| Crontab cài nhưng cron không reach DB (không map port) | High×High | Bước 1 xác định reach-DB VPS; bước 3 verify artifact thật, không tin crontab |
| Cron chạy nhưng silent fail (log không đọc) | Med×High | Verify artifact R2 timestamp + đọc log; alert nếu thiếu backup mới |
| LE cert hết hạn giữa pilot → HTTPS down | Med×High | Runbook renewal + certbot auto-renew timer; theo dõi P6 |
| Passphrase VPS mới chưa escrow → mất khoá = mất backup | Low×High | Bước 6 verify recoverable từ PM trước khi P6 tính exit |

## Security Considerations
- Backup luôn encrypted trước rời máy; bucket R2 private; retention 30 ngày lifecycle (đã set M0).
- Passphrase escrow PM ngoài máy — máy chết vẫn restore được (DR path). [C3] Sau rotate, escrow giữ CẢ
  passphrase cũ (giải mã backup pre-cutover còn trên R2 trong retention window) lẫn mới — không mất khả năng
  khôi phục backup cũ.
- Cron log KHÔNG in payload/PII/passphrase (scripts chỉ in tên key + size).
- Restore drill dùng throwaway (không cmc_prod) — guard `restore-drill.sh:40-44`.

## Next steps
Backup định kỳ + runbook xong → điều kiện cho Phase 6 exit (restore drill pass R2 remote + runbook cập nhật).
