---
title: "Phase 2: CI security-scan job (report-only)"
status: todo
priority: P2
effort: "0.5d"
dependencies: [1]
---

# Phase 2: CI security-scan job (report-only)

## Overview
Thêm job `security-scan` vào `.github/workflows/ci.yml` chạy Semgrep + Trivy fs,
**report-only** (không chặn merge), upload report sanitized làm artifact.

## Requirements
- Semgrep (ruleset TS Phase 1) + `trivy fs` (vuln, secret, misconfig) trên source CMC.
- Report-only: `continue-on-error: true` hoặc không thêm vào required checks. RAW report KHÔNG rời runner (chỉ sanitized).
- Wall-clock < 5 phút.

## Related Code Files
- Modify: `.github/workflows/ci.yml` (thêm job `security-scan`)

## Implementation Steps
1. Job `security-scan`: checkout → chạy semgrep (ruleset Phase 1) + `trivy fs --scanners vuln,secret,misconfig`.
2. Redact (nếu vendor) hoặc dùng output Action; upload `*.sanitized.json` artifact; `if-no-files-found: warn`.
3. Loại `.claude/skills/**` khỏi scan hoặc report riêng.
4. Report-only: KHÔNG thêm `security-scan` vào branch protection required checks (giữ warn-first tới P3).

## Success Criteria
- [ ] Job xanh trên PR, < 5 phút, report-only
- [ ] Artifact sanitized upload; RAW không lộ
- [ ] Trivy báo đúng 2 HIGH hiện có (fast-uri đã vá qua Tier 1 override, react-router còn treo)

## Risk Assessment
- **Trivy secret mode nhúng secret literal vào RAW** (advisor risk): không bao giờ upload RAW; chỉ sanitized.
- **Nhiễu từ .claude/skills lockfiles:** exclude ngay từ đầu.
