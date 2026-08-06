---
title: ConfirmDialog float z-contract (xia leftover)
description: >-
  Mark Astryx ConfirmDialog with .ck-dialog / .ck-dialog-root, style chrome +
  backdrop in odoo.css, document native showModal top-layer above toast/cmd.
status: completed
priority: P2
branch: feat/design3-admin-rollout
tags:
  - design3
  - float
  - dialog
blockedBy: []
blocks: []
created: '2026-08-06T05:02:33.589Z'
createdBy: 'ck:plan'
source: skill
---

# ConfirmDialog float z-contract (xia leftover)

## Overview

Xia float leftover: ConfirmDialog had no stacking authority. Astryx uses native
`<dialog>.showModal()` (browser **top layer** — above all `z-index` fixed layers).

Contract:
1. Mount markers `.ck-dialog-root` + `dialog.ck-dialog`
2. CSS chrome + `::backdrop`; optional `z-index: 1150` for non-top-layer / docs band
3. Document: top-layer > cmd 1200 > toast 1100 > navbar 1000

Authority: `plans/reports/xia-compare-260806-odoo-float-layers.md`

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [RED stacking asserts for dialog band](./phase-01-red-stacking-asserts-for-dialog-band.md) | Completed |
| 2 | [GREEN odoo.css dialog z authority](./phase-02-green-odoo-css-dialog-z-authority.md) | Completed |
