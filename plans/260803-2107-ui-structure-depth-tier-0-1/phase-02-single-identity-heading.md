---
phase: 2
title: "Single identity heading"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Single identity heading

## Overview

When DetailPage uses EntityHeader, PageHeader must not repeat entity title as a second heading.

## Requirements

- Functional: PageHeader supports `identityMode` or omit title rendering when `title` empty / new prop `chrome="breadcrumbs"`
- Prefer: `title` optional; if empty string or new `hideTitle`, only breadcrumbs + actions show
- Docs: VIEW-GRAMMAR already states rule after phase 1

## Related Code Files

- Modify: `packages/ui/src/components/page-header.tsx`, `page-header.test.tsx`
- Docs: PAGE-FRAMES detail section

## Implementation Steps

1. Make `title` optional on PageHeader; when omitted/undefined, skip Heading.
2. Tests: breadcrumbs-only chrome.
3. Do not mass-migrate pages yet (phase 7).

## Success Criteria

- [x] PageHeader can render without title Heading
- [x] Unit tests pass
- [x] Export types updated
