---
title: "Phase 3: Hardening — image-mode + baseline + action-pinning"
status: todo
priority: P3
effort: "0.5d (later)"
dependencies: [2]
---

# Phase 3: Hardening — image-mode + baseline + action-pinning

## Overview
Sau khi report-only ổn định (hết UAT): nâng Tier-2 thành gate thật + vá hygiene
supply-chain mà Semgrep đã đếm.

## Requirements
- Trivy IMAGE mode trên 4 image `infra/docker`.
- Baseline committed → job fail khi có NEW HIGH so baseline (flip khỏi report-only).
- Pin toàn bộ GH Action mutable tags theo SHA (advisor: Semgrep đếm 10 `mutable-action-tag` → mục tiêu 0).

## Related Code Files
- Modify: `.github/workflows/ci.yml` (image-mode step; flip `security-scan` sang blocking; pin mọi `uses:` theo SHA)
- Create: `scripts/security/baseline/*.json` (baseline finding đã duyệt)

## Implementation Steps
1. Trivy `image` mode trên 4 Dockerfile `infra/docker`.
2. Commit baseline; đổi job sang fail-on-new-HIGH; cần **triage owner** (advisor Open Q2).
3. Pin mọi `uses: org/action@vX` → `@<sha>  # vX` (10 → 0). Dùng Dependabot github-actions (Tier 1) để cập nhật SHA sau.
4. Thêm `security-scan` vào branch protection required checks (khi đã tin cậy).

## Success Criteria
- [ ] Trivy image scan 4 image, 0 HIGH sau triage
- [ ] Job fail đúng khi thêm HIGH mới; baseline không đổi thì xanh
- [ ] `mutable-action-tag` count = 0
- [ ] (tuỳ) `security-scan` là required check

## Risk Assessment
- **Flip blocking mà không có triage owner** → merge bị chặn oan. Chỉ flip khi có người trực FP.
- **Pin SHA làm rối đọc:** giữ comment `# vX` cạnh SHA; Dependabot tự bump.
