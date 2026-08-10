# Phase 7 — HR/ADMIN module inline-style tokenization

Plan: `plans/260809-2040-erp-ui-clean-sync-complete/plan.md`, Phase 7 (vertical module slices).
Scope: tokenize raw literal values in `style={{ ... }}` for the 4 tracked property
families (spacing / fontSize / radius / color) per `scripts/ui-ratchet.mjs`, in the
5 HR/ADMIN page files. No JSX structure, business logic, or component swaps touched.

## Files modified

- `apps/admin/src/pages/admin/facilities.tsx`
- `apps/admin/src/pages/admin/network-ip.tsx`
- `apps/admin/src/pages/admin/users.tsx`
- `apps/admin/src/pages/hr/my-hr.tsx`
- `apps/admin/src/pages/hr/payroll.tsx`

## Per-file violation counts (before -> after, `node scripts/ui-ratchet.mjs --json`)

| File | Before | After |
|---|---|---|
| facilities.tsx | 5 | 0 |
| network-ip.tsx | 6 | 0 |
| users.tsx | 8 | 0 |
| my-hr.tsx | 7 | 2 |
| payroll.tsx | 8 | 2 |

Total: 34 -> 4.

## Substitutions applied

All matched the exact token tables provided (no invented tokens, no snapping):

- `gap: 8` / `marginTop: 8` -> `var(--cmc-space-2)` (facilities.tsx, users.tsx, network-ip.tsx — the recurring `controlFooter` flex wrapper and every dialog-footer `HStack marginTop`/error-span `fontSize` pair).
- `fontSize: 13` -> `var(--cmc-font-size-data)` (every inline error `<span>` across all 5 files; also the "Phạt khấu trừ" / penalty-amount labels in my-hr.tsx and payroll.tsx).
- `fontSize: 16` -> `var(--cmc-fs-title)` (the "Thực lĩnh" net-total amount span in my-hr.tsx and payroll.tsx).
- `padding: '8px 16px'` -> `padding: 'var(--cmc-space-2) var(--cmc-space-3)'` (both sides matched exactly — header/footer strip divs in my-hr.tsx and payroll.tsx).
- `padding: '12px 16px'` -> `padding: '12px var(--cmc-space-3)'` (shorthand partial fix: only the `16px` side has a token; `12px` has none, left literal — NetRow in my-hr.tsx and payroll.tsx).

## Literals left untouched (no exact token match, per instructions)

- `margin: '0 -16px'` — 2 occurrences in **my-hr.tsx** (PenaltyRow bleed margin, NetRow bleed margin) and 2 in **payroll.tsx** (same two spots). Explicitly out of scope per task spec ("0 or negative values... leave as literal — do not wrap in calc(), not worth the complexity"). These are the only 4 remaining counted violations (2 files × 2 each = the "2" shown in the after-column for my-hr.tsx/payroll.tsx).
- `maxWidth: 640`, `width: 130/120/140`, `alignSelf: 'flex-start'`, `display`/`flexDirection`/`flexWrap`/`overflow`/`transform`/`fontWeight`/`fontVariantNumeric` — all permanently exempt families per `ui-ratchet.mjs`, untouched by design.
- `background`, `borderBottom`, `borderTop` shorthand properties (as opposed to `backgroundColor`/`borderColor`/etc.) are not in the ratchet's tracked `color` family set, so their `var(--cmc-surface-2)` / `1px solid var(--cmc-border)` values were left exactly as they already were (already token-driven anyway).
- No `radius` or `color`-family (bare hex/property) violations existed in any of the 5 files — all counts were spacing/typography only, confirmed by both the pre-edit and post-edit ratchet JSON output.

## Tests / verification

- `pnpm turbo run typecheck test --filter=@cmc/admin`: **green** — 14/14 tasks successful, 55 test files / 560 tests passed, 0 failures. No test assertions referenced the old literal values, so no test edits were needed.
- `node scripts/ui-ratchet.mjs --json`: confirmed per-file counts above. Did not touch `scripts/ratchet-baseline.json` (left for orchestrator to regenerate once after all parallel module slices land).
- No git commands run (no add/commit) — changes left in working tree per instructions.

Status: DONE
Summary: Tokenized 30 of 34 inline-style violations across the 5 HR/ADMIN pages (34→4); the 4 remaining are `margin: '0 -16px'` bleed margins with no token equivalent, explicitly left literal per spec. Typecheck+test green (560/560), no ratchet-baseline edits, no git ops.
Concerns/Blockers: none.
