---
title: "Tier 2 Vendored Semgrep Trivy Scanners"
description: "Vendor vinsoc's Semgrep/Trivy wrappers into CMC CI as a free/local Tier-2 security gate. (b) dogfood dropped by decision."
status: pending
priority: P2
effort: "~1 day (P1+P2); P3 later"
tags: [ci, security, sast, tier2]
created: 2026-08-02
---

# Tier 2 Vendored Semgrep Trivy Scanners

## Overview

Đưa scanner wrappers của vinsoc (Semgrep + Trivy) vào CMC CI làm **Tier-2**
(CVE + secret + misconfig + config-hygiene). Free/local, DRY (dùng lại script đã
viết). **Bỏ (b) dogfood-benchmark** theo quyết định user 2026-08-02 — advisor đã
chứng minh ceremony (verifier vinsoc bị bác, corpus n≈36 vô dụng thống kê).

**Nguồn thiết kế (đọc trước, KHÔNG lặp lại ở đây):**
`plans/reports/advisor-260802-0150-vinsoc-cmc-dogfood-benchmark-fit.md` — mục Q3
(minimal one-directional integration), Q4, Success metrics, Work checklist P1/P1b.

## Decision đã chốt (user 2026-08-02, SAU red-team)

Red-team chứng minh Tier 2 gốc **~70% trùng** native tooling Tier 1 vừa bật (CodeQL/Dependabot/secret-scan). **CẮT theo red-team** (report `plans/reports/red-team-260802-0651-tier2-vendored-scanners.md`):

- ✅ **Bật CodeQL** = đòn ROI cao nhất (native SAST TS, thay Semgrep). Manual UI (API 404).
- ✅ **1 job Trivy-misconfig (IaC) report-only, pin-SHA** = phần DUY NHẤT không trùng (Dependabot lo vuln, secret-scan lo secret).
- ✅ **Pin 4 action SHA** (chore 5', Dependabot github-actions tự maintain sau).
- ❌ **XOÁ Semgrep** (0 injection, 36 hygiene — không thêm gì so CodeQL).
- ❌ **XOÁ vendoring/redaction/CHECKSUMS/ruleset-flatten** (chết cùng (b); dùng `trivy-action` trực tiếp).
- ⏸️ Park fail-on-new-HIGH (cần triage owner; giữ report-only).

## Phases (đã cắt — phase files cũ SUPERSEDED)

| # | Phase | Status | Ghi chú |
|---|-------|--------|-----|
| 0 | Bật CodeQL (manual UI) + note react-router CVE (Dependabot lo) | Blocked (user UI) | phase-01 cũ superseded |
| 1 | Job Trivy-misconfig report-only pin-SHA + pin 4 action SHA | Pending (cook) | thay phase-02 |
| — | ~~Vendor scanners / Semgrep / image-mode / baseline~~ | **Dropped** | phase-01/03 cũ superseded |

## Success Criteria (từ advisor, đo được)
- [ ] CI `security-scan` job xanh trên main, wall-clock < 5 phút, report-only
- [ ] `sha256sum -c CHECKSUMS.txt` pass trong CI; VERSION.txt ghi pack + ngày
- [ ] `trivy fs pnpm-lock.yaml`: 0 HIGH CVE sau triage (hôm nay: 2 HIGH, 1 MEDIUM — react-router còn treo)
- [ ] GH Actions mutable tags: 10 → 0 (pin SHA); meter = Semgrep rule `github-actions-mutable-action-tag`
- [ ] (P3) job fail khi có NEW HIGH so baseline

## Open Questions
1. **Vendor wrappers hay dùng semgrep-action/trivy-action trực tiếp?** advisor: lý do chính vendor là whitelist-redaction cho cross-repo export — nhưng (b) đã bỏ ⇒ report ở lại CMC. Nếu vậy `semgrep`/`trivy` GitHub Action **đơn giản hơn, đúng hơn** cho (a) đơn thuần (advisor Q3 ghi rõ trade-off này). → cân nhắc ở P1.
2. **Block merge hay report-only?** Mặc định report-only tới hết UAT (cần triage owner mới block).

## Ghi chú
- Vendor từ `/home/manhquy/Downloads/vinsoc/scanners/` (provenance-noted).
- Một chiều: chỉ quét CMC; KHÔNG import-report/DefectDojo, KHÔNG DAST/Kong/controller.

<!-- slug: tier-2-vendored-semgrep-trivy-scanners -->
