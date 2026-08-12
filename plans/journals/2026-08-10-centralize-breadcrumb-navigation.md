---
title: Centralize breadcrumb navigation
date: 2026-08-10
summary: Added safe route-aware breadcrumb fallback for the admin shell with regression coverage.
---

# Centralize breadcrumb navigation

## What happened
Several admin pages rendered parent breadcrumbs as plain text because `PageHeader` only linked a crumb when each caller declared `href`.

## Decision
Keep explicit `href` authoritative, and let the admin shell provide a central route resolver from `NAV_MODULES` plus a small alias set. Labels without a safe destination, such as `Kinh doanh` and `Quản trị`, remain informational.

## Validation
Focused UI and admin breadcrumb tests passed. Static parent-route audit reported zero uncovered static parent crumbs. Admin suite passed 56 files / 568 tests when run independently; admin and UI typechecks, root lint, and both package builds passed.

## Next steps
No commit or PR was created. Required CI checks remain the final merge gate after a PR is opened.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
