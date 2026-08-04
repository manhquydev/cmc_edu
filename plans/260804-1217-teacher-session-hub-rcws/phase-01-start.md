---
title: "Phase 1: Scaffold / deep-link prep"
status: todo
---

# Phase 1: Start

## Overview

Lock conventions and route shell placeholders so later phases do not invent chrome.

## Requirements

- [x] Route path `/teaching/sessions/:sessionId` reserved in teaching routes
- [x] Tab query `?tab=` values: overview | attendance | assessment | evidence (default attendance)

## Implementation Steps

1. Add lazy route for session detail page (stub ok until phase 3).
2. Document href target for calendar adapter.

## Success Criteria

- [x] Route resolves without 404 when page exists
