# RV-2 — `resolvePackageGrantRange` sold-out vs false overlap

**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Ownership:** `packages/domain-lms/**` only  
**Workflow:** `/ak:fix` → `/ak:test`  
**Commit:** none

---

## Bug (from code review)

**File:** `packages/domain-lms/src/package-grant.ts` (former L45–49)

When `nextOrderOnAxis(axis, maxExisting)` returned `null` (existing grants already reach the **last** real unit on the program axis), the code fell back to:

```ts
from = opts.currentOrder
```

Because `maxExisting ≥ last axis label ≥ currentOrder` in the sold-out case, that `from` is always **≤ maxExisting**, so the computed range **always overlaps** an existing range.

**Concrete scenario:** Black Hole axis ends at 102; student already has `95–102`; class current unit `99`; receipt grants 4 more units.

| Step | Before fix |
|------|------------|
| `nextAfter` | `null` |
| `from` | `99` (fallback) |
| Returned range | `{99, 102}` |
| `grantRangeOnEnrollment` (~`grant-units.ts` L211) | `BAD_REQUEST` **Range overlaps an existing unit range** |

Operators read that as a data/conflict bug; the true cause is **program sold out**.

---

## Fix

**File:** `packages/domain-lms/src/package-grant.ts`

When `nextAfter == null`, **throw immediately**:

```text
no remaining program units after order ${maxExisting}
```

Style matches existing pure-domain errors (`programUnitAxis is empty`, `exceeds remaining program units`, …).

No change to `apps/api` in this task: `grantUnitsFromReceipt` already wraps `resolvePackageGrantRange` errors as `badRequest(String(err.message))`, so the sold-out message surfaces to ops without the overlap path.

---

## Tests

**File:** `packages/domain-lms/src/package-grant.test.ts`

| Change | Intent |
|--------|--------|
| Rewrite “renewal when max is last unit” | Expect `/no remaining program units after order 59/` (not “exceeds remaining…” via false from) |
| Replace “falls back to currentOrder” success | N=1 after sold-out also throws sold-out (not `{59,59}` overlap) |
| **New:** Black Hole `95–102` + current `99` + N=4 | Exact review scenario → `/no remaining program units after order 102/` |

---

## Verification

```bash
cd packages/domain-lms && npx vitest run
```

```
✓ src/package-grant.test.ts (15 tests)
✓ src/unit-progression.test.ts (44 tests)
✓ src/exercise-sequence.test.ts (7 tests)
(+ dist/* mirrors)
Test Files  6 passed (6)
Tests       131 passed (131)
```

---

## Status: DONE

- Root cause fixed at domain boundary (correct error semantics).
- Tests cover Bright end-of-axis and Black Hole review scenario.
- No commit.
