---
phase: 2
title: Builder Report (HTML tab ky thuat)
status: completed
priority: P1
dependencies:
  - 1
effort: 1 session
---

# Phase 2: Builder Report (HTML tab kỹ thuật)

<!-- Updated: Red Team Session 2026-07-17 — Builder tab LOCAL-ONLY, không vào --inline -->

## Overview

Renderer HTML tự chứa từ `verification.json` — trước hết tab Builder (self-audit): bảng drill-down per-flow, symbol thiếu, orphans, freshness. Đây là output dùng được đầu tiên của tool.

## Requirements

- Functional: 1 file `acceptance-report/index.html` — header (commit, ngày generate, % tổng), bảng luồng filter theo cluster/status, chi tiết expand per-flow (symbol thiếu highlight), mục orphans riêng.
- Non-functional: zero framework, zero network asset, mở bằng double-click (quyết định D5); render < 2s.

## Architecture

`render.ts` nhận `VerificationResult` → template literal HTML + CSS inline. Tab structure dựng sẵn 2 tab (Nghiệm thu / Builder) nhưng tab Nghiệm thu để placeholder "đang xây" cho tới Phase 3 — tránh rework shell.

**Ranh giới bảo mật (D4, red-team #8):** Builder tab liệt kê procedure/route/model = bản đồ recon API nội bộ (39 namespaces). File `index.html` là **local-only** — v1 không có output nào gửi ra ngoài. **Single render mode ở v1** (R2-4 — mode split `acceptance-only` là premature abstraction khi consumer duy nhất là `--inline` của Phase 4; phase nào thêm consumer thì phase đó own việc tách mode).

## Related Code Files

- Create: `scripts/acceptance-report/render.ts`
- Create: `scripts/acceptance-report/templates/layout.ts` (shell 2 tab + design tokens)
- Create: `scripts/acceptance-report/templates/builder-tab.ts`
- Modify: `scripts/acceptance-report/verify.ts` (gọi render sau verify)

## Implementation Steps

1. `layout.ts`: shell HTML, tab switch bằng vanilla JS vài dòng, design tokens từ premium design language (light mode, Inter, monochrome — tham chiếu `packages/ui` token values, copy giá trị chứ không import runtime).
2. `builder-tab.ts`: summary band (tổng luồng, % built, orphan count) + bảng luồng + expand detail + bảng orphan.
3. Nối vào `verify.ts`: `pnpm acceptance:report` giờ xuất cả JSON lẫn HTML.
4. Kiểm tra thủ công trên browser: filter, expand, hiển thị đúng số liệu với manifest 30 luồng.

## Success Criteria

- [x] `index.html` mở offline, đúng số liệu khớp `verification.json` — verified qua chrome-devtools (visual + a11y snapshot), 0 console error
- [x] Symbol thiếu nhìn thấy được trong ≤ 2 click từ khi mở file — click Builder tab → `<details>` expand = 2 click
- [x] Trả lời "còn nợ gì so với thiết kế" < 5 phút — Builder tab bảng luồng + orphan list hiện ngay khi mở

## Risk Assessment

- **Token design lệch premium baseline** → copy giá trị từ `packages/ui` tokens, ghi chú nguồn trong comment.
- **HTML phình khi 30 luồng × chi tiết** → chi tiết render dạng `<details>` native, không JS framework; nếu >2MB xem lại việc nhúng.
