---
phase: 4
title: "Docs-ADR-Amendment-Gates"
status: done
effort: "0.25d"
priority: P1
dependencies: [3]
---

# Phase 4: Docs-ADR-Amendment-Gates

## Overview

Đồng bộ docs với thay đổi (quy tắc TL14 §7: enum/registry/docs sửa cùng lúc): amendment ADR-D
trong TL16, cập nhật TL14 + roadmap invariant, changelog. Chạy full gates chốt.

## Requirements

- Functional: docs phản ánh đúng trạng thái mới — registry active 5 role, enum 9 giá trị trơ,
  gán role gác bị chặn.
- Non-functional: docs.maxLoc 800; không đổi quyết định khác trong TL16.

## Related Code Files

- Modify: `docs/16-brief-quyet-dinh-thiet-ke-adr.md` — thêm mục **ADR-D amendment (2026-07-08)**
  dưới ADR-D: từ "giữ quyền trong registry, không build UI" → "registry/UI/gán chỉ 5 role thật;
  enum DB giữ 9 giá trị trơ (tránh migration); bật lại role = thêm ACTIVE_ROLES + quyền + UI +
  ADR mới". Nêu lý do PO: hệ thống sát bối cảnh thực tế; 2 giám đốc đảm nhiệm việc của role gác.
- Modify: `docs/14-danh-muc-vai-tro-phan-quyen.md` — §1: cột "# quyền" role gác → 0, chú thích
  enforcement (`ACTIVE_ROLES`, updateRoles reject); §5: bỏ cột role gác khỏi ma trận; §7 giữ.
- Modify: `docs/project-roadmap.md` §3 — bất biến "can() registry 9-role (ADR-D)" → "enum 9 giá
  trị · registry/gán ACTIVE_ROLES 5 role (ADR-D amendment)".
- Modify: `docs/project-changelog.md` — 1 entry.

## Implementation Steps

1. Viết ADR-D amendment (TL16) — ngắn, kèm link brainstorm report
   `plans/reports/brainstorm-260708-2232-role-scope-alignment-adr-d-report.md`.
2. Cập nhật TL14 §1 + §5 khớp registry mới (đối chiếu bảng Phase 1).
3. Cập nhật roadmap invariant + changelog.
4. Full gates: `pnpm typecheck && pnpm test && pnpm build` — chuẩn baseline 26/26 · suite xanh
   (462+ pass kỳ vọng tăng do test mới) · 14/14. [RED-TEAM] Root `test` script filter
   `!@cmc/e2e` (`package.json:13`) → **chạy thêm e2e riêng**: `pnpm --filter @cmc/e2e test`
   (bắt buộc vì Phase 2 sửa `finance-approval.spec.ts`).
5. [RED-TEAM] Re-run verify DB không user nào mang role gác — lần CUỐI ngay trước merge PR
   (lần đầu là hard precondition Phase 2; đóng cửa sổ TOCTOU vì cả 4 phase land 1 PR).
6. Cập nhật trạng thái plan golive `260707-2308` — ghi chú Phase 4 UAT unblocked.

## Success Criteria

- [ ] ADR-D amendment tồn tại trong TL16, trỏ brainstorm report
- [ ] TL14 §1/§5 khớp 100% registry (không ô lệch — đối chiếu bằng mắt + grep)
- [ ] Roadmap invariant cập nhật; changelog entry
- [ ] Full gates xanh + `pnpm --filter @cmc/e2e test` xanh; DB không có user mang role gác
      (re-check trước merge)
- [ ] Plan golive nhận note unblock UAT

## Risk Assessment

- **Docs lệch code sau này** → invariant test (PERMISSIONS ⊆ ACTIVE_ROLES) là chốt chặn máy;
  docs là chốt chặn người.
- Rollback: revert docs — không ảnh hưởng runtime.
