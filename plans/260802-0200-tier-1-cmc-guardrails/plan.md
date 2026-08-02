---
title: "Tier 1 CMC Guardrails"
description: "Free/local + GitHub-native guardrails for AI-written code. Repo now public → native security toggles are the keystone."
status: pending
priority: P1
effort: "~5h code + 1h settings + decisions"
tags: [ci, security, tooling, guardrails]
created: 2026-08-02
---

# Tier 1 CMC Guardrails

## Overview

Bộ guardrail free/local cho CMC EDU v2 (code phần lớn AI-viết). **Cập nhật sau
red-team + advisor:** keystone KHÔNG phải mấy config file, mà là **bật GitHub-native
settings (free vì repo vừa public)** — nếu không có branch protection thì mọi gate
"blocking" chặn con số 0. Không thêm SaaS. Tier 2 (Semgrep/Trivy vendor từ vinsoc) =
plan riêng.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | **Bật native settings** (branch protection, secret scanning + push protection, Dependabot security updates) — keystone | P1 |
| 2 | Secret history sweep + rotate (repo public) | P1 |
| 3 | Vá 2 CVE HIGH (`fast-uri`,`react-router`) ngay + Dependabot version-updates | P1 |
| 4 | Pre-commit hook nhanh (eslint scoped + gitleaks-staged) | P2 |
| 5 | Quyết định đúng ui-e2e (bất khả thi tới khi giải M1 + Phase 5) | P3 |

## Phases (thứ tự THỰC THI, không theo số file)

| Thứ tự | Phase | Status | Dep | Song song? |
|---|-------|--------|-----|-----|
| **1st** | [P5: GitHub native settings foundation](./phase-05-github-native-settings-foundation.md) | Pending | — | keystone, chạy TRƯỚC |
| 2nd | [P1: Gitleaks history sweep + pre-commit role](./phase-01-start.md) | Pending | — | ∥ với P3 |
| 2nd | [P3: Dependabot + CVE hotfix](./phase-03-dependabot-config.md) | Pending | 5 (toggle) | ∥ với P1 |
| 3rd | [P2: Husky + lint-staged pre-commit](./phase-02-husky-lint-staged-pre-commit.md) | Pending | 1 | sau P1 |
| 3rd | [P4: ui-e2e required-check — giải M1](./phase-04-ui-e2e-blocking-promotion-runway.md) | Pending | 5 | ∥ với P2 |

**Song song hoá (ak-cook):** P5 trước → rồi P1 ∥ P3 (khác file) → P2 ∥ P4 (sau P5/P1).

## Success Criteria

- [ ] native: secret_scanning + push_protection + dependabot_security_updates = enabled
- [ ] branch protection `main` require ít nhất `typecheck-and-test` (nếu user chọn PR flow)
- [ ] history sweep sạch; secret lịch sử (nếu có) đã rotate
- [ ] `fast-uri` + `react-router` đã bump vá CVE; `pnpm test` xanh
- [ ] pre-commit: eslint scoped chạy đúng (KHÔNG chặn commit ngoài scope — fix C1), gitleaks-staged hoạt động
- [ ] `.github/dependabot.yml` hợp lệ, PR đầu mở
- [ ] P4: quyết định ghi rõ; không lật flag khi prerequisites chưa đạt

## Decisions (user 2026-08-02)

1. ✅ **Phase 5:** BẬT TOÀN BỘ native + CodeQL (branch protection + PR flow + secret scanning + push protection + dependabot security updates + CodeQL default setup). Outward-facing — thực thi có xác nhận, ghi lệnh gh để rollback.
2. ✅ **Tier 2:** CHỈ vendor Semgrep/Trivy wrappers (plan riêng). **BỎ (b) dogfood-benchmark** (ceremony theo bằng chứng vinsoc). Không góc authz-corpus.
3. ✅ **Phase 4:** giải M1 ngay trong Tier 1 (tách vai ledger/PR gate) — xem phase-04.

## Open Questions còn lại (giải khi cook)

- **Secret history sweep (P1):** nếu tìm thấy secret đã public → mặc định **chỉ rotate** (rewrite BFG phá gitSha/ledger, chỉ làm nếu user yêu cầu).
- **gitleaks CI job:** sau khi bật native push protection (P5) → **bỏ CI job gitleaks trùng**, giữ history-sweep + pre-commit (DRY).

## Ghi chú nguồn
- Red-team: `plans/reports/red-team-260802-0200-tier1-cmc-guardrails.md` (C1 lint-staged, C2/H1/H2 settings, M1 trigger — đều proven live).
- Advisor vinsoc: `plans/reports/advisor-260802-0150-vinsoc-cmc-dogfood-benchmark-fit.md` (Tier 2 vendor scanners; 2 CVE HIGH; (b) dogfood là ceremony trừ góc authz-corpus).

<!-- slug: tier-1-cmc-guardrails -->
