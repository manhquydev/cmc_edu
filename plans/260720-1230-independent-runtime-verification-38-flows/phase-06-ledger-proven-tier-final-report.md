---
phase: 6
title: "Ledger Proven Tier + Final Report"
status: pending
priority: P1
dependencies: [2, 3, 4, 5]
effort: "1d"
---

# Phase 6: Ledger Proven Tier + Final Report

## Overview

Nâng Sổ Nghiệm Thu Sống lên 3 tier đọc từ `runtime-evidence.json` (đã committed — rt#2), và viết report xác minh độc lập tổng hợp findings Phase 1–5.

## Requirements

- Functional: verify.ts merge runtime evidence có xác thực; render tier + tuổi evidence; report tổng xếp finding theo severity.
- Non-functional: evidence file là OUTPUT committed của e2e run — sửa tay sẽ lộ qua git diff + bị verify.ts bắt khi spec-refs không resolve; premium design language giữ nguyên.

## Architecture

**Status ladder (rt#2, rt#12):**
- Static scan tính `built|partial|missing` như cũ (điều kiện cần).
- Flow `built` + evidence `verdict:proven` + `authPath:"signed"` → **`proven`**, hiển thị kèm tuổi: "proven @ commit X (N commit trước)" — commit lệch HEAD KHÔNG silent-downgrade, chỉ hiện tuổi để trung thực về freshness (rt#12). <!-- Updated: Validation Session 1 - V1 --> N = số commit trong `<evidence-commit>..HEAD` SAU KHI loại các commit chỉ đụng `acceptance-report/` (evidence-only — tránh off-by-one vĩnh viễn do chính commit evidence); evidence-commit không còn trong history → coi như invalid.
- Evidence `failed` trên flow `built` → badge đỏ riêng `runtime-fail` — KHÔNG che.
- Evidence `blocked` → badge riêng kèm notes.
- **Xác thực evidence (rt#2):** mỗi entry, verify.ts kiểm spec-refs trỏ đến file test thật trong `apps/e2e/tests/` và tên test tồn tại trong file đó (đọc text, không cần chạy) — ref không resolve → entry invalid, hiển thị cảnh báo đỏ "evidence không xác thực được". Evidence thiếu `authPath:"signed"` không bao giờ render proven (rt#3, R2-1).
- File thiếu ≠ flow thiếu: không có runtime-evidence.json → mọi flow tối đa `built` + warning; có file nhưng flow vắng → flow đó `built` + note "chưa chạy runtime" (rt#13).
- Legend tab Nghiệm Thu (tiếng Việt): "✓ proven = đã chứng minh chạy thật qua đường auth ký (signed cookie/token — đúng đường prod dùng), với identity tin cậy do test cấp (không chứng minh khâu cấp role thật — sec#5; các nhánh if-prod ngoài auth không thuộc phạm vi proof — R2-1 residual gap); ◐ built = có code, chưa chứng minh; ✗ missing = thiếu".
- **Scope note (rt#12):** đây là local tool + committed evidence; CI tự động chạy e2e + refresh evidence = out of scope, ghi vào `docs/HARNESS_BACKLOG.md`.

## Related Code Files

- Modify: `scripts/acceptance-report/verify.ts`, `types.ts`, `render.ts` + `templates/` (blast radius thấp — verification.json không có consumer ngoài verify→render in-process, đã xác minh rt#7-contract)
- Create: `plans/reports/independent-verification-260720-38-flows-final-report.md`
- Modify: `plans/260717-1213-so-nghiem-thu-song/plan.md` + `phase-04-*.md` (disposition: evidence infra delivered ở plan này), `docs/system-architecture.md` (ledger 3 tier + run recipe đầy đủ env), `docs/project-changelog.md`, `docs/HARNESS_BACKLOG.md` (CI wiring backlog)

## Implementation Steps

1. Types + verify.ts: load evidence committed; áp ladder + xác thực spec-refs + tuổi commit; counter proven/built/missing/runtime-fail vào console summary.
2. Render: badge ✓(kèm tuổi)/◐/✗/`runtime-fail`; cột specs + link screenshot (relative, local-only vì evidence/ vẫn gitignore); legend tiếng Việt như trên.
3. Chạy chuỗi đầy đủ: e2e api + ui (signed-auth, cùng E2E_RUN_BATCH) → `pnpm acceptance:report` → soát index.html bằng chrome-devtools (0 console error, đúng design language).
4. Final report: tổng verdict 38 flows (số flow chuẩn sau reconcile Phase 1); bảng finding Phase 1 (scanner trung thực?, manifest history, spot-check); mọi `failed|blocked|runtime-fail` với severity + đường fix đề xuất (fix = plan sau); đối chiếu kết luận với claim "38/38 built" ban đầu; cite coverage sẵn có (unit payroll suite, kind-isolation, rls-negative tests). <!-- Updated: Validation Session 1 - V4; Red Team R2 - R2-8 --> Curate ~10 screenshot đắt nhất (synthetic, mỗi cluster vài cái) copy vào `plans/reports/assets/independent-verification-260720/` — với 2 chốt bắt buộc: (1) USER duyệt từng ảnh trước khi commit (trình danh sách qua AskUserQuestion, ảnh nào chưa duyệt không commit); (2) chỉ nhận ảnh từ specs có assert sentinel-provenance (facility/studentId đang render thuộc sentinel set — chốt Phase 1). Còn lại giữ local trong `acceptance-report/evidence/`.
5. Sync plan 260717-1213 (phase-04 disposition) + docs + backlog CI wiring.
6. `gitnexus_impact` cho verify/render trước khi sửa; `gitnexus_detect_changes` trước commit.

## Success Criteria

- [ ] Không evidence file → degrade built + warning; có evidence → ladder đúng, spec-refs được xác thực, tuổi commit hiển thị.
- [ ] Static-built + runtime-failed → badge đỏ riêng, không bị che.
- [ ] Evidence thiếu `authPath:"signed"` không bao giờ render proven.
- [ ] Final report đủ: verdict toàn bộ flows + findings Phase 1 + severity ranking + đối chiếu claim gốc.
- [ ] Plan 260717-1213 phase-04 disposition rõ; docs + backlog sync xong.

## Risk Assessment

- Evidence committed có thể bị sửa tay trong commit — chấp nhận: git diff lộ, spec-ref validation bắt phần lớn; HMAC/chain-of-custody = overkill cho nội bộ pre-live (ghi nhận trade-off trong report).
- Cám dỗ "làm đẹp" số proven → ladder + xác thực + tuổi commit chặn; report giữ nguyên failed/blocked.
