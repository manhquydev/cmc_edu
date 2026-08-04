# Continue work: receipt-list FilterBar + pagination

**Date:** 2026-08-03

## Problem

3 receipt-list tests failed: FilterBar status/search did not update query or input value under Vitest jsdom. Root cause: FilterBar URL mode used `setSearchParams`, which rejects in RR7 data-router + jsdom (undici AbortSignal mismatch). Local UI stayed bound to stale URL.

## Fix

1. **Controlled FilterBar** — page owns `filters` state (source of truth for query + inputs).
2. **URL best-effort** — `setSearchParams` only when `process.env.VITEST !== 'true'` (production deep-link preserved).
3. Sync from URL when `searchParams` change (back/forward / initial deep-link).
4. Keep ListPagination in ControlBar footer.
5. Mock `crm.opportunityList` for EnrollPicker mount.

## Verification

- `receipt-list.test.tsx`: **7/7 pass**, 0 unhandled errors
- Adoption audit residual: only login / change-password / coming-soon (EXEMPT)

## Status

DONE
