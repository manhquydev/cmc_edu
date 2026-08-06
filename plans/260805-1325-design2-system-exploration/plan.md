# Execution Plan: Design Lab 2 (/design2) - Next-Gen UI Design System Exploration

## Objective
Nghiên cứu và phát triển hệ thống thiết kế giao diện thế hệ mới (Next-Gen UI System - "Aetheria / Neo-Horizon") cho CMC EDU v2. Trình bày toàn bộ nghiên cứu, visual concepts (ảnh thiết kế đã generate), tokens và live components trên trang `/design2` mới (giữ nguyên trang `/design` cũ).

## Execution Steps

### Step 1: Visual Design Mockup Generation (Done)
- [x] Generate `design2_dashboard_mockup` image showcasing Next-Gen ERP/LMS dashboard.
- [x] Generate `design2_tokens_components_mockup` image showcasing design tokens, components, and layout system.
- [x] Copy images into `apps/admin/public/` (`design2-dashboard-mockup.png`, `design2-tokens-mockup.png`).

### Step 2: Component & Styling Infrastructure
- [x] Create `apps/admin/src/pages/design-lab-2.css` containing Next-Gen design tokens, glassmorphism recipe, dark/light theme variables, floating action dock styles, glowing status badges, and interactive sparkline charts.
- [x] Create `apps/admin/src/pages/design-lab-2.tsx` containing the `DesignLab2Page` component with full research overview, image visual gallery, interactive design token explorer, live component playground, and comparison matrix.

### Step 3: Route Integration
- [x] Register `/design2` route in `apps/admin/src/routes/index.tsx`.

### Step 4: Verification & Quality Assurance
- [x] Verify typechecking (`pnpm typecheck` or `tsc --noEmit`).
- [x] Verify route `/design2` functions correctly without breaking `/design` or existing routes.
