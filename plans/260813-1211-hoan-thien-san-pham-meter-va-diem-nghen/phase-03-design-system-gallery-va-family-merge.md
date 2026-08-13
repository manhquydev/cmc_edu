---
phase: 3
title: "Design system gallery và family merge"
status: completed
priority: P1
effort: "1.5–2d"
dependencies: [1]
---

# Phase 3: Design system gallery và family merge

## Overview

A+B chỉ pin cascade/CI, gần như không đổi pixel. Chuyên nghiệp = gallery sống rồi gộp bốn họ trên **admin**. LMS giữ primitive + token.

## Requirements

- Functional: `/admin/design` show StatCard, MetricCard, StatusBadge, CountBadge, EmptyState, FilterBar+DataTable (không chỉ DateTime/WorkflowStatusbar).
- Functional: StatCard dùng chrome **không-click**: class `.console-mc.console-mc--static` (không hover lift / ctx brand). MetricCard giữ `Link.console-mc`. 11 StatCard callers (revenue-report ×3, crm/report ×8) **không** truyền `color` hay `href`.
- Functional: FilterBar bỏ 4 inline width. CSS child width = **21 trang** blast (`<FilterBar` 22 mounts). Pin computed trên gallery **và** một ListPage thật (pipeline hoặc students).
- Functional: StatusBadge xóa `appearance="solid"` (0 callers). Size sm/lg = CSS. Pin computed **md** (41 badges / 23 trang), không chỉ gallery sm/lg.
- Functional: EmptyState ops = class tường minh (vd `.console-empty-ops`), **không** restyle `.o_web_client` mọi EmptyState (permission-gate, 404, leaderboard). Command-palette: thay `div.console-cmd-empty` hoặc bỏ dòng success “mount EmptyState”.
- Non-functional: không rename 17 CSS vars; không `console.css` trên LMS; không Storybook.

## Architecture

`.console-mc` (`console.css:534`) là recipe **link** (hover, `:active` scale, ctx brand). StatCard KPI không điều hướng → modifier `--static`. MetricCard = `Link`.

Cook order: gallery → D (filter, 21 trang) → A (card static) → B (badge, pin md) → C (empty ops class) → computed pins.

## Related Code Files

- Modify: `apps/admin/src/pages/design-showcase.tsx` (route `design.routes.tsx` path `design`)
- Modify: `packages/ui/src/components/filter-bar.tsx`, `filter-bar.test.tsx`
- Modify: `packages/ui/src/components/stat-card.tsx` (+ test mới), `metric-card.tsx` nếu cần sibling
- Modify: `packages/ui/src/components/status-badge.tsx`
- Modify: `packages/ui/src/components/empty-state.tsx`, `command-palette.tsx`
- Modify: `packages/ui/src/console.css` (`.console-filter-bar`, `.console-badge-soft--sm/--lg`, EmptyState density, `.console-mc` trên `div`)
- Modify: `packages/ui/src/console/console-precedence.test.ts` hoặc sibling family-proof (inject 3 sheets, `getComputedStyle`)
- Do not: `session-card.tsx`, kanban, panel, CountBadge merge, LMS, rename astryx vars
- Overlap CSS: EmptyState ops class **có thể** đổi visual stub trên `student-detail` (phase 02 TSX). Không sửa TSX student-detail ở phase này.

## Implementation Steps

1. Gallery: bốn họ. Giữ trang (cổng mắt).
2. D: CSS child width; xóa 4 inline. Pin gallery + `crm/pipeline` hoặc `students/index`.
3. A: StatCard `.console-mc--static`; bỏ `fontSize: 24`. Không biến KPI report thành link chết. Bỏ escape `color` (0 callers).
4. B: `--sm/--lg`; xóa `solid` API. Pin padding **md**.
5. C: class ops tường minh; **không** `[data] EmptyState` toàn cục. Palette: thay `console-cmd-empty` hoặc thừa nhận chưa EmptyState.
6. Computed pins 3-sheet. Không mass-convert `readFileSync`.
7. LMS không `console.css`.

## Success Criteria

- [x] `/admin/design` render bốn họ (RTL showcase hoặc e2e nhẹ)
- [x] FilterBar: pin width trên gallery **và** một list ops (pipeline hoặc students)
- [x] StatCard không `fontSize: 24`; có `--static`; 11 report tiles không scale-as-link
- [x] StatusBadge: pin computed **md**; `appearance="solid"` xóa
- [x] EmptyState ops class không đụng `permission-gate.tsx`
- [x] `@cmc/ui` test xanh; ratchet không tăng literal
- [x] Không `apps/lms/**` chrome console

## Risk Assessment

`.console-mc` trên StatCard không `--static` = 11 KPI trông như link chết. Filter width = 21 trang. EmptyState toàn cục = 403/404 bị bóp. CSS EmptyState đụng stub phase 02 — chỉ class ops.
