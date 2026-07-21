---
phase: 1
title: "Decision gate + provision VPS"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Decision gate + provision VPS

## Context links
- Roadmap M1 row + §4 phụ thuộc ngoài repo: `docs/project-roadmap.md:35,62`
- Runbook prerequisites (VPS riêng, không phải cmcnew-*): `docs/runbook-deploy.md:9-26`
- Ops quirks (dev-host docker qua Git Bash): plan.md → Execution protocol

## Overview
- **Date:** 2026-07-10 · **Priority:** P1
- **Description:** Chốt quyết định hạ tầng (provider/ngân sách/region/domain — USER quyết, không giả
  định), sau đó provision VPS thật: SSH hardening, firewall, docker engine, non-root deploy user.
- **Implementation status:** pending (chặn: M0 GO 2026-07-12 + quyết định user bên dưới)
- **Review status:** not reviewed

## Key Insights
- Runbook giả định "VPS riêng (khác máy cmcnew-*)" (`runbook-deploy.md:11`) nhưng M0 chạy local-sim —
  đây là lần đầu có host thật. `hostname -f` phải ≠ backup host để RT-13 pass (`backup-db.sh:24-32`).
- Provider/region/domain là **business decision** không suy ra được từ repo → phase mở đầu bằng bảng
  quyết định cần user; KHÔNG tự chọn provider.
- `ERP_SSO_REDIRECT_URI` hiện trỏ `erp.cmcvn.edu.vn` (phase-02 golive:70). Domain chính thức phải khớp
  Azure App redirect URI, nếu đổi domain phải cập nhật Azure Portal TRƯỚC deploy (nếu không → AADSTS50011).

## Requirements
- **Quyết định user (bảng dưới) chốt xong** trước mọi bước provision.
- VPS: Docker ≥ 24 + Compose plugin (`docker compose version`); OS Linux (bash đầy đủ, `hostname -f`).
- Non-root deploy user thuộc group `docker`; SSH key-only (tắt password auth); firewall chỉ mở 22/80/443.
- Domain DNS A record trỏ IP VPS; sẵn sàng cho Let's Encrypt (port 80 reachable).
- Backup host (R2) đã tồn tại từ M0 (bucket `cmc-db-backups`, phase-02 golive:76) — chỉ verify reuse.

### Bảng quyết định cần USER (stop cho tới khi có)
| Quyết định | Vì sao cần | Ràng buộc | Trạng thái |
|---|---|---|---|
| VPS provider + ngân sách/tháng | Không suy ra được; chi phí | Linux, Docker-capable, ≠ host cmcnew-* | MỞ (validation 2026-07-10 #1: chốt tại đây) |
| Region | Latency PH/HS VN + tuân thủ dữ liệu trẻ em | Ưu tiên SG/VN | MỞ (chốt cùng provider) |
| Domain chính thức (staff + LMS) | Khớp Azure redirect URI + TLS | **ĐÃ CHỐT** (validation #2): giữ domain đã đăng ký Azure — bước 8 dưới thành no-op | ✅ |
| RAM/CPU/disk | 7 container + pg-data + blob | ≥ tối thiểu chạy stack (ước lượng ở bước 1) | MỞ |

## Architecture
VPS Linux đơn → chạy toàn bộ `docker-compose.prod.yml` (nginx 80/443 · api · worker · lms · admin ·
postgres cmc_prod không map port · minio optional profile). Backup off-box = R2 remote (đã có). TLS =
Let's Encrypt (thay self-signed local-sim). Không đổi topology so với local-sim — chỉ đổi host + certs thật.

## Related code files
- `docker-compose.prod.yml` (đọc — ước lượng tài nguyên; minio profile opt-in `:145,160`)
- `docs/runbook-deploy.md:9-33` (prerequisites + isolation)
- `scripts/isolation-check.sh` (chạy trên VPS — trên host sạch sẽ trivially pass, không có cmcnew-*)
- Không sửa code ở phase này (thuần provision/ops).

## Implementation Steps
1. **[BLOCK] Trình bảng quyết định** cho user; chờ chốt 4 dòng. Không provision khi còn trống.
2. Ước lượng tài nguyên từ compose (7 service + pg-data volume) → khuyến nghị spec tối thiểu kèm bảng.
3. Provision VPS theo provider đã chốt; ghi IP + `hostname -f` (phải ≠ `cmc-db-backups...r2...` host).
4. SSH hardening: tạo non-root user (`deploy`) trong group `docker`; đẩy SSH public key; `sshd_config`
   tắt `PasswordAuthentication` + `PermitRootLogin no`; restart sshd; verify login key-only.
5. Firewall (ufw/nftables): default deny inbound; allow 22 (SSH), 80/443 (nginx). Verify `ufw status`.
6. Cài Docker engine ≥ 24 + Compose plugin; `docker compose version`; `deploy` user chạy `docker ps` OK.
7. DNS: tạo A record domain → IP VPS **với TTL thấp (vd 60s)** (H5 — để cutover switch/revert nhanh ở P3);
   verify `dig +short <domain>` = IP; port 80 reachable (LE HTTP-01).
8. Nếu domain ≠ `erp.cmcvn.edu.vn`: cập nhật Azure App redirect URI + ghi giá trị mới cho P2 `.env.prod`.
9. Clone repo vào `/opt/cmcv2` (hoặc path đã chốt); `git check-ignore .env.prod` (chưa có `.env.prod` — tạo ở P2).

## Todo list
- [ ] User chốt bảng quyết định (provider/region/domain/spec)
- [ ] VPS provisioned + IP ghi lại
- [ ] SSH key-only + non-root deploy user + firewall
- [ ] Docker engine ≥24 verified
- [ ] DNS A record + port 80 reachable
- [ ] Azure redirect URI khớp domain (nếu đổi)

## Success Criteria
- [ ] `docker compose version` OK dưới user `deploy` (non-root, group docker)
- [ ] SSH chỉ key (password auth tắt), root login tắt, firewall chỉ 22/80/443
- [ ] `dig +short <domain>` = IP VPS; `hostname -f` VPS ≠ R2 backup host
- [ ] Azure redirect URI = domain chính thức
- [ ] Repo clone tại deploy path, `.env.prod` chưa tồn tại (tạo ở P2, không commit)

## Risk Assessment
| Rủi ro | L×I | Mitigation |
|---|---|---|
| User chưa chốt provider/domain → phase treo | High×High | Stop-condition rõ; e2e/hardening P4 chạy song song trong lúc chờ |
| Domain đổi nhưng quên cập nhật Azure → SSO gãy | Med×High | Bước 8 bắt buộc trước P2; SSO smoke ở P2 bắt sớm |
| DNS trỏ sai / trỏ domain đang dùng thật khác | Low×High | **Stop-condition**: verify `dig` = IP mới trước LE; không đè domain đang phục vụ |
| Firewall hở DB port | Low×High | postgres không map port (compose:124-134); default-deny; chỉ 22/80/443 |

## Security Considerations
- SSH key-only + non-root: giảm attack surface brute-force.
- postgres không expose ra host (compose không map port) — DB chỉ trong docker net; không mở port DB ở firewall.
- Không commit `.env.prod`/secrets. TLS thật (LE) thay self-signed → HTTPS-only, HTTP→HTTPS redirect (P2).
- `BACKUP_ENCRYPTION_PASSPHRASE` escrow password manager (kế thừa M0; verify còn recoverable).

## Next steps
Sau khi VPS sẵn sàng + quyết định chốt → Phase 2 clean-room deploy (full G7). Ghi domain/IP/deploy-path
cho P2 dùng.
