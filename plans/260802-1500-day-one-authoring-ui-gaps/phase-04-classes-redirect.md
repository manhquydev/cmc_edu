---
title: "Classes redirect"
status: pending
priority: P1
effort: 15m
dependencies: []
---

# Phase 4: Classes redirect

## Overview

`/classes` hits catch-all ComingSoon; real page is `/admin/classes`.

## Related Code Files

- Modify: `apps/admin/src/routes/index.tsx` — add `path: 'classes'` → Navigate before `*`

## Success Criteria

- [x] `/classes` redirects to `/admin/classes`
