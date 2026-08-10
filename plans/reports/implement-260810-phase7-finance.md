# Phase 7 — Finance Module Inline-Style Tokenization

Plan: `plans/260809-2040-erp-ui-clean-sync-complete/plan.md` (Phase 7, vertical module slices)

## Files Touched

- `apps/admin/src/pages/finance/receipt-detail.tsx`
- `apps/admin/src/pages/finance/receipt-list.tsx`
- `apps/admin/src/pages/finance/reconciliation.tsx`
- `apps/admin/src/pages/finance/revenue-report.tsx` (inspected, no edit made — see below)

## Violations Fixed (ratchet count, per `node scripts/ui-ratchet.mjs --json`)

| File | Before | After | Change |
|---|---|---|---|
| receipt-detail.tsx | 1 | 0 | `style={{ marginTop: 4 }}` → `style={{ marginTop: 'var(--cmc-space-1)' }}` (Text under "Kiểm soát tiền" note, overview tab) |
| receipt-list.tsx | 1 | 0 | `gap: 8` → `gap: 'var(--cmc-space-2)'` in `controlFooter` wrapper div |
| reconciliation.tsx | 2 | 0 | (1) `fontSize: 12` → `fontSize: 'var(--cmc-fs-meta)'` on the receipt deep-link `<a>` in `FlagCard`; (2) `marginTop: 4` → `marginTop: 'var(--cmc-space-1)'` on the read-only-note wrapper div in `FlagCard` |
| revenue-report.tsx | 1 | 1 | unchanged — see below |

Total: 5 → 1 (4 of 5 violations resolved; the 1 remaining has no exact token match).

## Left Untouched (no exact token match)

- `apps/admin/src/pages/finance/revenue-report.tsx:219` — `padding: '0 22px 20px'` inside the `Panel` body wrapping `RevenueBarChart`. Per side: `0` stays literal (spec: leave 0/negative as-is, not worth `calc()`), `22px` has no spacing token (scale is 4/8/16/24 only), `20px` has no spacing token either. No sub-value in this shorthand has an exact match, so the whole literal is left as originally written.

No other literals in these 4 files matched a family (spacing/fontSize/radius/color) — everything else present is either already `var()`-driven, an exempt property (`fontWeight`, `fontVariantNumeric`, `textTransform`, `letterSpacing`, `display`, `flex*`, `width`/`height`, `position`, `overflow`, `textAlign`, `fontStyle`, `whiteSpace`, `textOverflow` (not in any family/exempt set, so simply not counted), etc.), or a non-family shorthand (`background`, `borderTop`, `borderBottom` — only the exact `backgroundColor`/`borderTopColor`/etc. property names count, not the shorthand form).

## Verification

- `pnpm turbo run typecheck test --filter=@cmc/admin`: **green** — 14/14 tasks successful (12 cached, 2 fresh), 55 test files / 560 tests passed, 0 failures. No test asserted on the old literal values (`revenue-report.test.tsx` and `revenue-report-aggregate.test.ts` both passed unmodified), so no test edits were required.
- `node scripts/ui-ratchet.mjs --json`: confirmed per-file counts above (informational only — `scripts/ratchet-baseline.json` intentionally left untouched for the orchestrator to regenerate after all parallel module slices land).
- No git commands run (no add/commit) — changes left in the working tree per instructions.

## Scope Confirmation

Only style *values* were changed — no JSX structure, no component swaps (CountBadge/MetaRow/Avatar deferred per explicit out-of-scope instruction), no business logic touched, no other files modified.

Status: DONE
Summary: Tokenized 4 of 5 inline-style violations across the 4 finance page files (marginTop/gap/fontSize → existing --cmc-space-*/--cmc-fs-* vars); 1 padding shorthand in revenue-report.tsx left literal because none of its three sub-values (0/22px/20px) has an exact spacing-token match. Typecheck+test green (560/560).
Concerns/Blockers: none.
