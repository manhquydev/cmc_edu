---
title: "Phase 5: GitHub native settings foundation (EXECUTE FIRST)"
status: todo
priority: P1
effort: "1h"
dependencies: []
---

# Phase 5: GitHub native settings foundation (EXECUTE FIRST)

## Overview

Red-team đã chứng minh (gh api): `main` KHÔNG có branch protection, và
`secret_scanning` / `push_protection` / `dependabot_security_updates` đều TẮT.
⇒ Mọi gate "blocking" khác hiện **chặn con số 0**. Đây là keystone: các toggle
server-side **miễn phí** (repo public ⇒ GitHub Advanced Security free) có ROI
vượt xa toàn bộ code còn lại. **Chạy phase này TRƯỚC mọi phase khác.**

## Requirements
- Branch protection trên `main`: require status checks pass trước merge (chọn checks: `typecheck-and-test`; thêm `secret-scan` sau Phase 1).
- Bật GitHub native: secret scanning + push protection (chặn secret mới ngay tại push, server-side).
- Bật Dependabot **security updates** (toggle — khác với version-updates yml của Phase 3; đây là cái vá CVE).
- CodeQL default setup (giờ free cho public repo) — tuỳ chọn, ROI cao, zero-maintenance.

## Architecture
- Đây là **settings repo**, không phải code. Thực hiện qua GitHub UI hoặc `gh api`.
- Branch protection: `gh api -X PUT repos/{owner}/{repo}/branches/main/protection ...` hoặc UI Settings→Branches.
- Secret scanning + push protection: Settings→Code security, hoặc `gh api -X PATCH repos/{owner}/{repo}` với `security_and_analysis`.
- Dependabot security updates: Settings→Code security toggle, hoặc `gh api`.

## Related Code Files
- Không có file code. (Tuỳ chọn: lưu lệnh `gh api` đã dùng vào `docs/operations/` để tái lập.)

## Implementation Steps
1. **Xác nhận với user trước khi bật** — branch protection có thể chặn chính workflow push-thẳng-main hiện tại của bạn (repo đang commit thẳng main). Quyết định: bật protection + chuyển sang PR flow, hay giữ push-main? (Open Question mới.)
2. Bật secret scanning + push protection (an toàn, không cản trở dev thường).
3. Bật Dependabot security updates.
4. (Tuỳ chọn) Bật CodeQL default setup.
5. Branch protection `main`: require `typecheck-and-test`; ghi lại lệnh gh api dùng.

## Success Criteria
- [ ] `gh api repos/{owner}/{repo}` cho thấy secret_scanning + push_protection = enabled
- [ ] Dependabot security updates = enabled (PR vá CVE tự mở)
- [ ] Branch protection `main` yêu cầu ít nhất `typecheck-and-test` (nếu user chọn PR flow)
- [ ] (nếu bật) CodeQL default setup chạy

## Risk Assessment
- **Branch protection đổi workflow:** repo hiện commit thẳng main. Bật require-PR-checks buộc chuyển PR flow — đây là thay đổi quy trình, cần user đồng ý (Open Question). Không bật mù.
- **Push protection false-positive:** hiếm; có thể bypass có kiểm soát khi cần.
- **Không tự đảo ngược:** đây là thay đổi cấu hình tài khoản/repo hướng-ngoài — chỉ thực thi khi user chốt, ghi lại lệnh để rollback.
