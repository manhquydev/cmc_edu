# Gate review — design-lab/system (pre-bridge)

**Date:** 2026-08-14  
**Scope:** Living gallery `design-lab/system/` before any `@cmc/ui` / `apps/admin` bridge wave  
**Mode:** Four independent read-only rounds, then synthesis  
**Production edits:** none authorized

## Round verdicts

| Round | Agent | Verdict |
|-------|-------|---------|
| 1 Finish (contract + comp-c) | [Finish review](8803a3aa-11b8-47d4-bbda-e1947b33efba) | **READY-WITH-FIXES** |
| 2 A11y + responsive | [A11y audit](4160155f-9329-4f7f-87c4-3121d91e0c00) | **FAIL** (focus; contrast) |
| 3 UX critique + IA | [UX critique](330a2bce-1bdd-4a74-8497-df92ff4e33a0) | **SHIP-WITH-FIXES** (~8.0/10) |
| 4 Code + token architecture | [Code review](5f84973e-49f7-4e64-8437-11b1528ab2b7) | **MERGEABLE-WITH-FIXES** |

## Gate decision

### **READY-WITH-FIXES — do not start the bridge wave yet**

Lab is Ruled Ledger–faithful enough to keep as the visual SoT. It is **not** bridge-ready until P0/P1 below land and a short re-audit confirms focus + `--space-5` + status-tone purity.

Cross-round consensus: shared shell, hairline tables, rationed purple, Vietnamese workflow copy, and module grammar should **stay**. Do not dilute for “prettier” chrome.

## Consensus P0 (must fix before bridge)

| # | Issue | Cited by | Fix |
|---|-------|----------|-----|
| P0.1 | `var(--space-5)` undefined — metrics / sheet / toast padding collapse | Finish, Code | Alias `--space-wide: var(--_p-space-5)` in Layer 2 **or** replace six call sites with `--space-loose` / `--space-base` |
| P0.2 | Focus visibility | A11y (B1) | Rule exists (`:focus-visible` + `--focus-ring` box-shadow in `system.css` / `tokens.css`). **Re-verify with real Tab** (CDP programmatic focus often skips `:focus-visible`). If overrides wipe `box-shadow` on `.btn`/inputs, restore ring on those selectors. Do not ship bridge until Tab shows 2px purple ring. |
| P0.3 | Flat-By-Default leaks: `.palette` uses `--shadow-overlay`; `.sticky-actions` uses gradient | Finish | Toast-only shadow; sticky actions → flat `--surface-default` + top hairline |
| P0.4 | Token layer holes: Layer 3 reads `--_p-*`; print remaps raw `#fff`/`#999` | Finish, Code | `--btn-pad-x → --space-snug`; add `--surface-action-muted`; print via primitives |
| P0.5 | Danger badge contrast ~4.41:1 (`#dc2626` on `#fef2f2`) | A11y (S2) | Darken ink (e.g. red-700) or tint until ≥4.5:1 |
| P0.6 | `--text-faint` (#a1a1aa) at 2.56:1 used as readable text | A11y (S3), Code | Restrict faint to decorative/disabled; body meta → `--text-muted` |

## Consensus P1 (fix before treating gallery as production grammar)

| # | Issue | Cited by | Fix |
|---|-------|----------|-----|
| P1.1 | Audit `data-density-default="compact"` overridden by `localStorage` | Finish, Code | Prefer page default, or key storage per page, or persist only after explicit click |
| P1.2 | Status vocabulary leakage (subject colors, KPI “Đạt” as warning, role chips as brand/danger) | UX | Categorical `data-category` ≠ status; KPI map; roles = muted/neutral; ban 7th tones |
| P1.3 | SoD shown as prose more than paired content | UX | Role preview toggle (sale vs GĐKD) on Patterns list + Finance |
| P1.4 | Empty states only on Foundations | UX | One empty demo per module (or Patterns subsection linked from contracts) |
| P1.5 | Freeze column ignores selected/current row bg | Code | Remap `.freeze-col` under `aria-selected` / `aria-current` |
| P1.6 | Incomplete `aria-sort` on sortable headers | A11y | `none` / `ascending` / `descending` on every sortable `<th>` |
| P1.7 | Hard-coded px gaps (6px / 10px) + funnel `color-mix(... white\|black)` | Code, Finish | Tokenize or allowlist; mix against semantic surfaces; `@supports` fallbacks |
| P1.8 | Breakpoints drift from DESIGN.md (≤1100 / ≤860 / ≤640) | Finish | Align mobile rail collapse |
| P1.9 | Inter weight 550 never loaded | Finish | Load variable axis or explicit 550 |
| P1.10 | Attendance C/V vs Audit RBAC C/V/! collision | UX | Keep C/M/V for attendance; RBAC → Có/Không/Bypass or icons |

## P2 (lab hygiene / bridge later)

- Unicode ledger marks → SVG (Finish craft floor)
- `<dialog>` polyfill or hide search when unsupported / missing on print (Code)
- `shell.js` → module/IIFE before prod bundle (Code)
- Collapse long module demos behind “Xem mẫu” (UX)
- Blocked CTAs: `aria-disabled` + `aria-describedby` reason (UX)
- Persistent row overflow `⋯` at Chuẩn density (UX)
- Do **not** port lab statusbar clip-path / funnel trapezoids into existing `console.css` chrome — alias semantics, restyle production statusbar (Code bridge risk)
- Remove unused `gallery.js` (Code)

## What to keep

- Shared shell across all modules (Shared-Chrome Rule)
- Ruled metrics + hairline tables + sticky funnel topology (comp-c)
- Three-layer token intent + density remapping size/space only (type ramp untouched)
- Vietnamese action / error / gate copy; second-eyes threshold pattern
- Module grammar as separate layer (`modules.css` + `modules/*.html`)

## Re-audit checklist (before authorizing bridge)

1. Tab through `patterns.html` — focus ring visible on chips, filters, sort headers, rows, bulk bar, pager  
2. Metrics band / toast / sheet padding not collapsed (`--space-5` gone)  
3. Danger badge + any remaining faint text contrast ≥4.5:1  
4. Visit Audit after visiting Foundations — still opens compact unless user toggled density on Audit  
5. Spot-check Teaching legend / HR KPI / role chips — no status-tone misuse  
6. No raw `#hex` in print remaps; Layer 3 does not read `--_p-*`

## Authority

- Living gallery remains SoT until bridge wave is explicitly authorized  
- OpenEduCat visual contract still owns production list/form/statusbar until that wave  
- Do not edit `apps/admin` or `packages/ui` runtime CSS from this report
