# Phase 6 premium census (auto)
Date: 2026-08-06
Scope excludes design-lab pages.

## packages/ui components — premium class tokens referenced
Total unique: 231; total refs: 262

- `ck-week-leg` × 5
- `ck-cmd-kbd` × 4
- `ck-highlight` × 2
- `ck-highlight-value` × 2
- `ck-sc-line` × 2
- `ck-cmd-item` × 2
- `ck-stat-actions` × 2
- `ck-stat-action` × 2
- `ck-pnl-action` × 2
- `ck-inbox-empty` × 2
- `ck-count` × 2
- `ck-smon` × 2
- `ck-smon-block` × 2
- `ck-smon-grid` × 2
- `ck-im` × 2
- `ck-sec` × 2
- `ck-page-btn` × 2
- `ck-kv` × 2
- `ck-kv-row` × 2
- `ck-week` × 2
- `ck-week-toolbar` × 2
- `ck-week-toolbar-title` × 2
- `ck-week-grid` × 2
- `ck-week-col` × 2
- `ck-week-head` × 2
- `ck-week-body` × 2
- `ck-toast-viewport` × 1
- `ck-toast` × 1
- `ck-toast--` × 1
- `ck-toast-body` × 1
- `ck-toast-title` × 1
- `ck-toast-desc` × 1
- `ck-toast-dismiss` × 1
- `ck-av` × 1
- `ck-av--` × 1
- `ck-av-img` × 1
- `ck-av-initials` × 1
- `ck-highlight-item` × 1
- `ck-highlight-label` × 1
- `ck-highlight-value--tabular` × 1
- `ck-meta-item` × 1
- `ck-meta-dot` × 1
- `ck-meta-text` × 1
- `ck-meta-row` × 1
- `ck-sc` × 1
- `ck-sc--` × 1
- `ck-sc-top` × 1
- `ck-sc-time` × 1
- `ck-sc-chip` × 1
- `ck-sc-dot` × 1
- `ck-sc-chip-label` × 1
- `ck-sc-title` × 1
- `ck-sc-secondary` × 1
- `ck-sc-line--p1` × 1
- `ck-sc-line--p2` × 1
- `ck-sc-cta-slot` × 1
- `ck-sc-cta` × 1
- `ck-sc-cta-label` × 1
- `ck-sc-cta-spacer` × 1
- `ck-cmd` × 1
- `ck-cmd-backdrop` × 1
- `ck-cmd-panel` × 1
- `ck-cmd-head` × 1
- `ck-cmd-input` × 1
- `ck-cmd-list` × 1
- `ck-cmd-empty` × 1
- `ck-cmd-group` × 1
- `ck-cmd-group-label` × 1
- `ck-cmd-item-icon` × 1
- `ck-cmd-item-label` × 1
- `ck-cmd-item-meta` × 1
- `ck-cmd-foot` × 1
- `ck-stat-action-count` × 1
- `ck-stat-action-label` × 1
- `sh-sb` × 1
- `sh-brand` × 1
- `sh-nav` × 1
- `sh-item` × 1
- `sh-item-icon` × 1
- `sh-sub` × 1

## apps/admin (excl design-lab) — premium class tokens
Total unique: 2; total refs: 2

- `ck-fn` × 1
- `ck-empty` × 1

## Gate before removing admin premium.css import
Census must reach 0 unported reachable classes under admin render path.
Current admin still references premium tokens (see list). Do **not** drop
`import @cmc/ui/premium.css` from apps/admin main.tsx yet.
`packages/ui/src/premium.css` must remain untouched (LMS consumer).

## Follow-up (2026-08-06)

Admin retired `premium.css` via scoped mirror under `.o_web_client`.
**Exception:** `.ck-toast*` and `.ck-cmd*` are intentionally unscoped in
`odoo.css` because ToastProvider / CommandPalette mount outside the shell.
