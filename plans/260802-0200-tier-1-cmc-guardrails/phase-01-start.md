---
title: "Phase 1: Gitleaks secret scan + history sweep"
status: todo
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Gitleaks secret scan + history sweep

## Overview

Repo vừa chuyển public ⇒ mọi secret từng commit giờ world-readable. Ưu tiên #1:
quét lịch sử git tìm secret đã lộ (→ rotate). gitleaks free/local (MIT), không SaaS.

## Vai trò sau khi có Phase 5 (native scanning) — tránh trùng lặp (DRY)
- **Phase 5 bật GitHub native secret scanning + push protection** = phòng thủ CHÍNH cho secret MỚI (server-side, zero-maintenance). ⇒ CI job gitleaks thành **tuỳ chọn/dư thừa** một phần.
- **Giá trị riêng còn lại của gitleaks:** (a) **history sweep một lần** (native scanning không tự alert toàn bộ backlog cho bạn theo cách này), (b) **pre-commit hook** bắt secret SỚM hơn (trước cả push) — ăn khớp Phase 2. ⇒ Giữ gitleaks cho (a)+(b); bỏ CI job trùng nếu native push-protection đã bật.
- ADVISOR đã thấy `.env.prod`/`privkey.pem` trong working tree — verify **gitignored, chưa commit** (không lộ), nhưng history sweep vẫn cần để chắc.

## Requirements
- Functional: phát hiện secret trong (a) toàn lịch sử git, (b) mọi PR/push qua CI.
- Non-functional: 0 chi phí; false-positive kiểm soát được (allowlist cho `.env.example`, fixtures).

## Architecture
- `.gitleaks.toml` ở root: extend default ruleset + `[allowlist]` cho path mẫu (`**/.env.example`, `**/*.example`, test fixtures) — tránh nhiễu, KHÔNG allowlist secret thật.
- CI job `secret-scan` trong `.github/workflows/ci.yml`: dùng `gitleaks/gitleaks-action@v2` (free cho public repo) chạy trên `pull_request` + `push`. Blocking (không continue-on-error) — đây là gate mới, không đụng gate e2e.
- History sweep (một lần, local): `gitleaks detect --source . --log-opts="--all" --report-path gitleaks-history.json`.

## Related Code Files
- Create: `.gitleaks.toml`
- Modify: `.github/workflows/ci.yml` (thêm job `secret-scan`)
- Artifact (không commit): `gitleaks-history.json` (kết quả sweep, thêm vào `.gitignore` nếu cần)

## Implementation Steps
1. Cài gitleaks local (binary hoặc `brew`/release). Chạy history sweep `--log-opts="--all"`.
2. Phân loại kết quả: secret thật đã lộ → **rotate ngay** (ghi danh sách, không dán secret vào plan/report). False-positive → thêm allowlist `.gitleaks.toml`.
3. Viết `.gitleaks.toml` (extend base + allowlist path mẫu).
4. Thêm job `secret-scan` vào `ci.yml` (blocking, gitleaks-action, fetch-depth 0 để quét đủ).
5. Nếu tìm thấy secret lịch sử: quyết định rewrite lịch sử (BFG) — xem Open Question #2 của plan; mặc định chỉ rotate.

## Success Criteria
- [ ] History sweep chạy, kết quả phân loại xong
- [ ] Mọi secret thật đã lộ được rotate (ghi lại credential nào, KHÔNG ghi giá trị)
- [ ] `.gitleaks.toml` allowlist đúng, sweep lại sạch
- [ ] CI job `secret-scan` xanh trên commit sạch, đỏ khi thêm secret thử

## Risk Assessment
- **Secret đã lộ public:** rotate là bắt buộc; xoá khỏi lịch sử KHÔNG gỡ được bản đã bị clone/cache. Rewrite lịch sử phá gitSha → ảnh hưởng acceptance ledger (khoá theo SHA). Ưu tiên rotate, cân nhắc rewrite riêng.
- **False-positive gây mệt:** allowlist path mẫu ngay từ đầu; không tắt rule, chỉ loại path an toàn.
