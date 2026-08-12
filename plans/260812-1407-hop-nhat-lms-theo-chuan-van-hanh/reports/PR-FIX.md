# PR-FIX — `resolveClassCurrentOrder` program-aware neo fallback

**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Owner:** `apps/api/src/lms-ops/**`  
**Commit:** none  
**Date:** 2026-08-12  

Skills: `/ak:fix` → `/ak:test`

---

## Diagnosis

| Item | Detail |
|------|--------|
| **Symptom** | Grant paths for Bright I.G / Black Hole with missing `currentUnitId` used `currentOrder = 1` |
| **Root cause** | `resolveClassCurrentOrder` (`grant-units.ts`) hardcoded `return 1` / `?? 1` — valid only for UCREA (axis starts at 1). Bright starts at **37**, Black Hole at **61** |
| **Effect** | `resolvePackageGrantRange` built ranges from 1 → `assertRangeOnProgram` / axis checks fail with opaque BAD_REQUEST, or wrong neo semantics |
| **Call sites** | `grantRangeOnEnrollment` (~L140), `grantUnitsFromReceipt` (~L331); also duplicated `let currentOrder = 1` in `lms-ops/router.ts` addWithUnits + revokeFromNext |

---

## Decision: missing neo

**Choice: fall back to first real unit on the program axis; throw only if the program has zero `CurriculumUnit` rows.**

| Option | Pros | Cons |
|--------|------|------|
| **A. First unit on axis** (chosen) | Matches review ask (“thay 1 bằng unit đầu trục”); receipt grant still works for rare null-neo batches; UCREA still gets 1 | Masks corrupt neo until ops notice |
| **B. Always throw if neo null** | Fail-closed; forces repair | Breaks money path for legacy/broken rows until admin sets neo |

**Why A:** `createClassWithUnits` always sets neo, so null neo is exceptional recovery, not the happy path. Hardcoding 1 was the money bug; program-aware `axis[0]` is the correct recovery default. Empty catalog is non-recoverable → clear BAD_REQUEST.

Also: if `currentUnitId` points at a missing or **wrong-program** unit, treat as missing and fall back (same as orphan id).

---

## Code changes

### `grant-units.ts` — `resolveClassCurrentOrder`

```ts
// Signature now requires program
classBatch: { currentUnitId: string | null; program: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE' }

// 1) Prefer currentUnitId when row exists and program matches
// 2) Else first CurriculumUnit for program orderBy orderGlobal asc
// 3) Else throw badRequest(`Program ${program} has no CurriculumUnit rows; ...`)
```

Call sites already pass `enrollment.classBatch` with `program` selected — no further call-site surgery beyond the signature.

### `router.ts`

- Import `resolveClassCurrentOrder` from `./grant-units.js`
- Replace two inline `let currentOrder = 1` blocks (addWithUnits, revokeFromNext) with the shared helper

---

## Tests added (`grant-units.int.test.ts`)

| Test | Asserts |
|------|---------|
| Bright I.G missing neo | order **37**, not 1 |
| Black Hole missing neo | order **61**, not 1 |
| Bright grant without neo | package **[37..41]** for N=4 |
| Orphan `currentUnitId` | falls back to **37** |
| Empty BLACK_HOLE catalog | BAD_REQUEST `/no CurriculumUnit/i`, then re-seed 61 |

Helper `purgeLowOrderUnits` removes harness `ensureProgramUnitAxis` rows with order &lt; real min so first-unit matches CSV spine in shared DBs.

---

## Validation

```text
cd apps/api && npx tsc -p tsconfig.json --noEmit   → EXIT 0
npx vitest run src/lms-ops/grant-units.int.test.ts → 11/11 pass
```

---

## Status: DONE

- Program-aware first-unit fallback; no more hardcoded `1`
- Empty program → clear error  
- Bright + Black Hole missing-neo tests green  
- No commit  
