---
title: "Phase 3: Dependabot config"
status: todo
priority: P2
effort: "1h"
dependencies: [5]
---

# Phase 3: Dependabot config

## Overview

Bật Dependabot (free, GitHub native) để tự động mở PR cập nhật + vá CVE cho
dependency npm(pnpm) và GitHub Actions.

## ⚠️ RED-TEAM H2 + ADVISOR: file yml KHÔNG đủ để "vá CVE"
- **Version-updates** (file `.github/dependabot.yml` này) ≠ **security-updates**. Mục tiêu "vá CVE" cần **toggle Dependabot security updates** — nằm ở **Phase 5** (settings), không phải file này.
- **ADVISOR đã tìm 2 CVE HIGH đang tồn tại: `fast-uri`, `react-router`** (Trivy live scan). Đừng đợi lịch tuần → **bump thủ công ngay** (Step 0 dưới).
- ⇒ Phase này phụ thuộc Phase 5 (toggle security-updates) để đạt mục tiêu vá CVE.

## Requirements
- Functional: Dependabot theo dõi `pnpm-lock.yaml` + workflow actions; mở PR update theo lịch tuần; group để giảm nhiễu.
- Non-functional: 0 chi phí; không làm ngập PR.

## Architecture
- `.github/dependabot.yml` v2.
- Ecosystem 1: `npm` (Dependabot đọc `pnpm-lock.yaml`) tại `directory: "/"`. Monorepo: dùng `directories: ["/"]` (lockfile ở root vì pnpm workspace 1 lockfile). `versioning-strategy: increase`.
- Ecosystem 2: `github-actions` tại `/` (cập nhật `uses:` trong ci.yml).
- `groups`: gộp minor/patch để giảm số PR (vd nhóm `dev-dependencies`, `production-dependencies`).
- `open-pull-requests-limit`: đặt vừa phải (vd 5) tránh spam.

## Related Code Files
- Create: `.github/dependabot.yml`

## Implementation Steps
0. **Hotfix ngay (không đợi Dependabot):** bump `fast-uri` + `react-router` lên bản vá CVE HIGH; chạy `pnpm install` + `pnpm test` xác nhận không vỡ. Xác minh lại bằng Trivy (Tier 2) hoặc `pnpm audit`.
1. Viết `.github/dependabot.yml`: 2 `updates` block (npm + github-actions), schedule weekly, groups, limit.
2. Xác nhận Dependabot đọc đúng pnpm workspace (1 lockfile root). Nếu nó bỏ sót package con, thêm entry hoặc `directories` glob.
3. Commit → GitHub kích hoạt Dependabot; kiểm Insights → Dependency graph → Dependabot đã chạy.

## Success Criteria
- [ ] `.github/dependabot.yml` hợp lệ (không lỗi trên tab Dependabot của repo)
- [ ] Dependabot mở PR cập nhật đầu tiên (hoặc báo "up to date")
- [ ] PR được group, không quá `open-pull-requests-limit`

## Risk Assessment
- **pnpm monorepo coverage:** Dependabot npm hỗ trợ pnpm nhưng coverage workspace từng hạn chế — xác minh nó thấy dep trong `apps/*`,`packages/*`. Nếu thiếu, dùng `directories` glob hoặc nhiều block.
- **PR noise:** `groups` + `schedule: weekly` + `limit` kiểm soát; điều chỉnh sau tuần đầu.
