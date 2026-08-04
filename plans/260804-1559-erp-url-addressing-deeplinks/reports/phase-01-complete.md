# Phase 1 Complete — ReturnTo Login Redirect

**Date:** 2026-08-04  
**Branch:** `feat/erp-url-addressing-deeplinks` (from `origin/develop` @ 7c33d37)  
**Worktree:** `/home/manhquy/Downloads/cmc_edu_erp_deeplinks`

## Delivered

- `safe-return-to.ts` — centralized capture/restore policy with open-redirect hardening (control-char path reject, `new URL` same-origin check, no double-decode of searchParams values)
- `RequireAuth` captures `?returnTo=` for product paths
- Login + change-password restore via `safeReturnTo`
- `seedStaffWithPassword` / `seedStaffMustChangePassword` e2e helpers
- `deeplink-return-to.ui.spec.ts` — 3 positive-URL cases
- GitHub issue [#58](https://github.com/manhquydev/cmc_edu/issues/58) for server-side mustChangePassword enforcement

## Validation

| Check | Result |
|-------|--------|
| Unit safe-return-to + login | 16/16 green after hardening |
| Admin typecheck | green |
| E2e deeplink-return-to | 3/3 green |
| Code review | 7.5/10 → H1/H2 fixed in-session |

## Not yet

- Full `ui-e2e` suite / CI required checks (prove on PR)
- Phases 2–4

## Next

Phase 2a: PermissionGate on 4 detail routes + student-detail fetch-by-id
