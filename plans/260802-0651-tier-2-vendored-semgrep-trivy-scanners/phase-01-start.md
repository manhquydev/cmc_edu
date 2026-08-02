---
title: "Phase 1: Vendor scanners + flattened TS ruleset"
status: todo
priority: P2
effort: "0.5d"
dependencies: []
---

# Phase 1: Vendor scanners + flattened TS ruleset

## Overview
Đưa wrapper scanner + ruleset TS đã flatten/checksum vào CMC. Quyết Open Question #1
trước (vendor wrappers vs GitHub Action trực tiếp) — vì đã bỏ (b), report ở lại repo.

## Requirements
- Quyết định: vendor `run-semgrep.sh`/`run-trivy.sh` (nặng, có redaction) HAY dùng `semgrep`/`trivy` GitHub Action (nhẹ, đủ cho (a)). advisor Q3: nếu (b) drop hẳn → Action trực tiếp là "simpler correct answer".
- Nếu vendor: TS ruleset phải flatten thành 1 `.yml` + CHECKSUMS.txt (wrapper assert `check_id ∈ 1 ruleset file`, sai thì exit 9).

## Related Code Files
- Create: `scripts/security/` (nếu vendor) — `run-semgrep.sh`, `run-trivy.sh`, `redact-report.sh`, `write-status.sh`, `image-pins.env` copy từ `/home/manhquy/Downloads/vinsoc/scanners/` + PROVENANCE note.
- Create: `scripts/security/rulesets/ts-security.yml` (mirror p/typescript + owasp rules đã chọn) + `CHECKSUMS.txt` + `VERSION.txt`.
- (nếu chọn Action) chỉ cần ruleset + không vendor script.

## Implementation Steps
1. Chốt vendor-vs-action (Open Q#1). Khuyến nghị: **GitHub Action trực tiếp** vì (b) đã bỏ → KISS/YAGNI; giữ redaction chỉ khi thật cần.
2. Nếu Action: pin `semgrep`/`aquasecurity/trivy-action` theo SHA; chuẩn bị ruleset config.
3. Nếu vendor: copy 5 script + flatten ruleset + CHECKSUMS + VERSION + provenance; test wrapper không exit 9.
4. Loại `.claude/skills/**` lockfiles khỏi target (nhiễu tooling) hoặc report riêng.

## Success Criteria
- [ ] Quyết vendor-vs-action ghi rõ
- [ ] Ruleset TS chạy được (semgrep ra ~36 hygiene finding như advisor đo, không exit 9)
- [ ] `sha256sum -c CHECKSUMS.txt` pass (nếu vendor)

## Risk Assessment
- **Ruleset flatten collision** (advisor risk): check_id trùng khi merge pack → test trước.
- **Over-engineering:** vendor full wrapper cho (a) đơn thuần là thừa; nghiêng Action trực tiếp.
