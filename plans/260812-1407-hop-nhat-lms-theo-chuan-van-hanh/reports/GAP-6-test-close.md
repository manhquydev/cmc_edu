# GAP-6 — domain-lms test close (gap-aware coverage)

**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Owner:** `packages/domain-lms/**` only (no `apps/**`)  
**Commit:** none  
**Date:** 2026-08-12  
**Skills:** `/ak:test` → `/ak:cook` (test-first close of coverage holes)

---

## Baseline → after

| Metric | Before | After |
|--------|--------|-------|
| **Statements** | 78.7% | **97.22%** |
| **Branches** | 68.1% | **94.2%** |
| **Functions** | 93.3% | **100%** |
| **Lines** | 79.5% | **96.59%** |
| package-grant lines | 77.8% (14/18) | **100%** (18/18) |
| package-grant branches | 58.3% (7/12) | **100%** (12/12) |
| unit-progression lines | 76.7% | **95%** |
| unit-progression branches | 68.5% | **92.59%** |
| exercise-sequence | 100% | 100% |

Thresholds in `vitest.config.ts` (`src/**` ≥ 90 all metrics): **PASS**.

Command:

```bash
cd packages/domain-lms && npx vitest run --coverage src
# 3 files, 65 tests, all green
```

---

## package-grant.ts — previously unhit lines 25 / 29 / 54 / 58

| Line | Branch | Test (business meaning) |
|------|--------|-------------------------|
| 25 | `unitCount < 1` | Reject sell 0 / negative packages |
| 29 | empty `programAxis` | Reject grant with empty catalog |
| 54 | `from` not on axis | Reject currentOrder on hole **40** |
| 58 | `toIdx >= axis.length` | Reject oversell past frame (N=12 from 55; N=2 after last unit 59) |
| 48–49 | `nextAfter == null` | Exhausted axis falls back to `currentOrder`; N=1 at 59 OK |

Also added money-path cases:

- First Bright package N=4 from 37 → **to=41** (not 40)
- Renewal after every band hole (43→45, 47→49, 51→53, 55→57)
- Single-unit program: N=1 OK, N=2 throws

---

## Scenarios from GAP-2 covered in pure tests

| GAP-2 id | Scenario | Where |
|----------|----------|--------|
| S1.1 | Neo 37, sessions 13–16 → unit **41** | already + kept |
| S1.2 | Neo 39 → next block 41 | already + kept |
| S1.3 | Neo 41 → 41,42,43,**45** | **new** |
| S1.4 | Orphan neo / wrong order | **new** throw |
| S2.1–S2.2 | Last unit 59 + surplus; no 60/61 | **new** |
| S3.1 | remaining [37..48]=9; full frame 18 | already + full-frame **new** |
| S3.2 | real count excludes hole; isEntitled numeric | **new** (contract clarified) |
| S5.2 / S5.4 | from on hole; oversell | **new** package-grant |
| S6.1 / S6.5 | Renewal joint on hole | already + table **new** |
| S6.4 | Renew past last unit | **new** |
| S10.1 | Single-unit axis stamp + grant | **new** |
| S9.3 partial | resolveReferenceAnchor errors + gap walk | **new** error paths |

Not pure-domain (left for API / e2e): S1.5 freeze done, S4 cancel restamp, S8 revoke truncate, S10.3 default currentOrder=1, S12 dual-gate int.

---

## Files touched

| File | Change |
|------|--------|
| `packages/domain-lms/src/package-grant.test.ts` | 5 → **14** tests |
| `packages/domain-lms/src/unit-progression.test.ts` | 26 → **44** tests |
| Production code | **unchanged** |

---

## Residual uncovered (intentionally)

`unit-progression.ts` lines **89, 92, 99** inside private `orderAfterSteps`:

- empty axis / invalid `fromIdx` — already guarded by `deriveSessionUnits` before call  
- `target < 0` — not reachable with public `floor(k/4) ≥ 0` steps  

No production export of the private helper; no hollow test added only to paint those lines. Package still clears the 90% threshold.

---

## Status: DONE

- package-grant **100%** lines/branches including all throw paths  
- Overall domain-lms **~97% stmts / ~94% branches** (was ~79% / ~68%)  
- Every new test asserts a real money or learning entitlement behavior from GAP-2  
- No commit  
