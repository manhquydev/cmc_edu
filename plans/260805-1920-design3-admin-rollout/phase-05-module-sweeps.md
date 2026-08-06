---
title: "Phase 5: Module Sweeps"
status: completed
priority: P1
effort: "5-7w"
dependencies: [4]
---

# Phase 5: Module Sweeps

## Overview

Phủ pattern design3 các module còn lại. **Đúng 1 module = 1 PR (user tái xác
nhận 2026-08-05 sau khi red-team phát hiện bản v1 gộp trái quyết định)** —
~12 PR nhỏ, bisect và revert được thật. Sau Phase 3 mọi trang đã ăn skin qua
template/archetype; sweep lo: control-panel wiring, statusbar/kanban nơi có
state machine thật, dọn layout bespoke, đóng gap ledger Phase 4.

## Requirements

- Functional: hành vi nghiệp vụ không đổi; chỉ UI structure.
- Non-functional: mỗi PR 1 module duy nhất; ui-e2e không tụt so main là gate
  giữa các PR; PR chạm `packages/ui` ngoài phần template đã port (primitives
  dùng chung LMS) → **bắt buộc LMS spot-check + nêu tên primitive trong PR
  description**.
- Gate: PR đổi surface mà `check-ui-frames` assert (receipt-detail full-tier,
  shift-config settings-tier, bulk/filter/pagination counts) → cập nhật gate
  trong cùng PR, không nới ngưỡng.

## Module order (mỗi dòng = 1 PR)

| # | Module | Thư mục | Pattern chính |
|---|--------|---------|---------------|
| 5a | Finance | `finance/` | statusbar chứng từ (receipt-detail có sẵn WorkflowStatusbar — đã chevron từ Phase 3), control panel, revenue-report (DashboardPage đã port) |
| 5b | Teaching | `teaching/` (gồm 3 panels + pdf-annotator + grading MasterDetail) | control panel; giữ soft-ops-fullcalendar, chỉ token hoá màu; MasterDetail restyle nếu cần |
| 5c | Students | `students/` | list + detail sheet |
| 5d | Classes | `classes/` (1.166 LOC — PR riêng là đáng) | list + detail |
| 5e | Courses | `courses/` | list |
| 5f | Parents | `parents/` | list + form |
| 5g | Enrollment | `enrollment/` | statusbar quy trình nếu có state machine thật |
| 5h | Engagement | `engagement/` | list + kanban nếu có pipeline thật |
| 5i | Cockpit | `cockpit.tsx` | DashboardPage đã port từ Phase 3 — dọn phần bespoke còn lại; MetricCard giữ vai trò |
| 5j | Admin/Settings | `admin/` | SettingsShell đã port; `network-ip.tsx` đã mang code geofence (merged `f7bf662`) — chỉ restyle |
| 5k | HR | `hr/` | statusbar duyệt đơn nơi có state thật |
| 5l | Attendance | `attendance/` | geofence đã trên main — chỉ restyle; control panel |

Checklist chung mỗi PR:
1. Scout thư mục + journeys liên quan (`grep -rl <module> apps/e2e/tests`).
2. Wire control panel (search/filter/create) cho list pages — **GIỮ component
   `FilterBar` làm implementation** (gate check-ui-frames text-match tên nó
   trong source, `filterBarCount` margin chỉ 1; bỏ FilterBar = CI đỏ).
3. Statusbar/kanban CHỈ nơi có state machine/pipeline thật — không bịa stage.
4. Dọn CSS/layout bespoke premium; xoá style chết; đóng gap-ledger item của
   module (fix tại `@cmc/ui` nếu là lỗi component).
5. Cập nhật `check-ui-frames` nếu chạm surface được assert.
6. ui-e2e local → PR → CI xanh → merge → module kế.

## Related Code Files

- Modify: từng thư mục module theo bảng; `packages/ui/src/odoo*` cho gap fix;
  `scripts/check-ui-frames.mjs`/`.test.mjs` khi chạm surface được assert.
- E2E: journeys module tương ứng (selector-only nếu có thể).

## Success Criteria

- [x] Module sweeps landed as discrete commits (finance, teaching, classes,
      enrollment) + CRM residual; remaining modules template-covered after
      Phase 3 — status matrix: `reports/phase-05-module-sweep-status.md`
- [x] Shell/list/detail/settings/dashboard use odoo templates (Phase 3);
      residual `ck-*` composites tracked for Phase 6 census
- [x] Phase 4 pipeline empty gap closed (`o-kanban-empty`)
- [x] Teaching calendar rename scoped to admin-only CSS (LMS not affected)
- [ ] Full ui-e2e green vs main (branch merge gate still open)
- [ ] Visual eye-review every module (deferred; not automated)

## Risk Assessment

- **Trôi nhịp:** 12 PR nhỏ giúp dừng/nghỉ an toàn — sau Phase 3 hệ đã coherent
  (template + archetype phủ), sweep dở dang không tạo trạng thái vỡ.
- **Nới gate check-ui-frames cho tiện:** cấm; re-point trong cùng PR.
- **Statusbar bịa stage:** cấm trong checklist — chỉ map state thật backend.
- Rollback: revert PR module khi phase sau chưa merge; sau đó forward-fix.
