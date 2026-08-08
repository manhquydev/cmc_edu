# QA Report — Phase 1 CMC Console Rebrand

**Date:** 2026-08-07  
**Branch:** `feature/cmc-console-design-system-rebrand`  
**Base:** `main@240bec1` (PR #75 merged)  
**Scope:** Phase 1 identifier rebrand only (`--odoo-*`, `.o-*`, paths, `OdooNavbar`)

## Results overview

| Gate | Result | Evidence |
|------|--------|----------|
| `pnpm typecheck` | **PASS** 29/29 tasks | local run post-1d |
| `pnpm test` | **PASS** all packages | ui 142, api 2144, admin 555+, … (~4m53s) |
| `pnpm --filter @cmc/admin build` | **PASS** | after each of 1a–1d |
| Residual identifier scan | **PASS** | 0 `o-*` / `--odoo-` / `OdooNavbar` in live trees excl. `o_web_client` |
| `PLAYWRIGHT_UI=1 ui-chromium` | **PASS 54/54** | ~6.4m against synth DB `cmc_synth` |
| Prod e2e scripts | **not executed** | selectors updated only |

## E2E environment

- `SYNTH_SEED_ALLOW=1 bash scripts/synthetic-seed-env.sh --fresh`
- `APP_DATABASE_URL=postgresql://cmc_app:synth@localhost:55432/cmc_synth`
- `DATABASE_URL=postgresql://postgres:synth@localhost:55432/cmc_synth`
- Playwright Chromium v1234 installed locally for this session
- `journeys.json` backed up before runs; restored from `journeys.json.bak-phase1` after (CI artifact remains authority)

## Critical path specs

- admin-shell (Console navbar + finance nav): pass
- design3-statusbar (receipt + opportunity sticky grammar): pass
- All 31 journey specs + deeplink/LMS suites: pass

## Code review

- Reviewer verdict: **APPROVE_WITH_NITS** (see session notes)
- Critical: none
- Important: docs hybrid state (Phase 7), journeys.json hygiene (fixed)
- Nits: residual “odoo” prose in comments/describes

## Recommendation

Phase 1 ready to proceed to Phase 2 (legacy class retirement). Land via PR when operator wants CI double-confirmation.
