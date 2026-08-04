---
title: "UI Shell Settings Command Bulk Rollout"
description: "SettingsShell, CommandPalette ⌘K, bulk selection rollout. Store cmc_edu/260803-1601."
status: completed
priority: P1
effort: "1 session"
tags: [ui, shell, settings, command-palette, bulk]
created: 2026-08-03
---

# UI Shell Settings Command Bulk Rollout

## Delivered

1. **SettingsShell** — rail + main; pilot `shift-config`
2. **CommandPalette** + `useCommandPaletteHotkey` — shell topbar Tìm + ⌘K/Ctrl+K
3. **Bulk selection** on gifts, users, classes
4. Design Lab: SettingsShell + ⌘K demos

## How to try

```bash
pnpm --filter @cmc/admin dev
# Login admin
# Topbar: Tìm or ⌘K / Ctrl+K
# /admin/shift-config — SettingsShell rail
# /engagement/gifts | /admin/users | /admin/classes — checkbox + bulk bar
# /design — sections Settings + ⌘K palette
```

## Tests

- settings-shell, command-palette unit
- shift-config, users, classes, gifts page tests
