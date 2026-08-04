# Review Round 1 — H1 student not-found + H2 cold-nav e2e

**Date:** 2026-08-04  
**Branch:** `feat/erp-url-addressing-deeplinks`  
**Score: 9 / 10**  
**Recommendation: Approve**

## Scope

| Change | Files |
|--------|--------|
| H1 | `student-detail.tsx` — query sole source after settle; state only while loading/fetching |
| H1 tests | `student-detail.test.tsx` — 3 cases |
| H2 | `deeplink-detail-gates.ui.spec.ts` — receipt + class cold-nav (4/4 entities) |

## Checks

| Check | Result |
|-------|--------|
| H1: settle null + location.state → EmptyState | **PASS** — unit "shows EmptyState when get settles null…" |
| H1: loading still uses state seed | **PASS** — unit heading "Stale List Name" |
| H1: server wins over state | **PASS** — unit heading "From Server" |
| H1: isFetching races | **OK** — `querySettled = !isLoading && !isFetching`; seed only when `!querySettled` |
| H2: receipt role | **PASS** — sale creates; gdkd opens (`receiptGet`) |
| H2: class role | **PASS** — gddt (`class.create` page gate + `class.read` route gate) |
| Typecheck | **PASS** |
| E2e 4 cold-nav + 403 | **PASS** (prior run; re-run in round 2) |

## Critical / High

**None.**

## Medium (non-blocking)

| # | Note |
|---|------|
| M1 | H1 unit mocks `useParams`/`useLocation` globally in file — fine for this suite; do not import other pages in same file without reset |
| M2 | Class cold-nav needs GĐĐT not GV because page-level `class.create` is narrower than route `class.read` (pre-existing design; e2e documents it) |

## Verdict

H1 and H2 from full-feature review are closed with executable evidence. Ship.
