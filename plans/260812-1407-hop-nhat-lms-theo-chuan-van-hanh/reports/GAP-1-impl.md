# GAP-1 — Gap-aware unit progression

**Repo:** `/home/manhquy/Downloads/cmc_edu`  
**Branch:** `feat/lms-curriculum-axis-and-makeup-removal`  
**Date:** 2026-08-12  
**Ownership:** `packages/domain-lms/**`, `apps/api/src/lms-ops/**`  
**Commit:** none (per instruction)

## Brief

`order_global` is a **label**, not a dense sequence. Bright I.G has real holes
(37–59 missing 40, 44, 48, 52, 56). Integer arithmetic (`anchor + floor(k/4)`,
`from + unitCount - 1`, integer walks of ranges) invents non-existent units →
restamp skips stamping → dual-gate / empty roster; grant counts wrong.

## Design

Introduced **`ProgramUnitAxis`** = ascending unique real `order_global` list.

| Operation | Rule |
|-----------|------|
| Advance k units | `axis[anchorIdx + k]` (clamped at last) |
| Count units in range | filter axis where `from ≤ o ≤ to` |
| Package of N units | N steps on axis from `from` |
| Next after grant end | `nextOrderOnAxis(axis, maxExisting)` not `+1` |
| Revoke cut | `previousOrderOnAxis(axis, from)` not `from - 1` |

Helpers: `toProgramUnitAxis`, `contiguousProgramAxis`, `axisIndexOf`,
`nextOrderOnAxis`, `previousOrderOnAxis`, `realOrdersInRange`,
`rangeEndpointsOnAxis`.

`isEntitled(ranges, order)` unchanged (label-in-range check).

## Files changed

### `packages/domain-lms`

| File | Change |
|------|--------|
| `src/unit-progression.ts` | Gap-aware pure math + axis type/helpers |
| `src/package-grant.ts` | `resolvePackageGrantRange` requires `programAxis` |
| `src/index.ts` | Export axis surface |
| `src/unit-progression.test.ts` | Continuous cases kept + Bright I.G cases |
| `src/package-grant.test.ts` | Continuous + Bright grant/renewal |

### `apps/api/src/lms-ops`

| File | Change |
|------|--------|
| `stamp-sessions.ts` | Load full axis → `deriveSessionUnits(anchor, axis, sessions)` |
| `grant-units.ts` | `loadProgramUnitAxis`; package grant uses axis; endpoint-only range assert |
| `router.ts` | addWithUnits/grantPast endpoint assert; **revokeFromNext** gap-aware truncate |

## Tests (required cases)

Bright I.G axis (18 units, holes 40/44/48/52/56):

1. Neo 37, sessions 13–16 → **order 41**, never 40  
2. Range `[37..48]` remaining from 37 → **9** real units (not 12 integers)  
3. Grant 12 units from 37 → **to=51**  
4. Renewal after to=39 → **from=41** (not 40)

Continuous UCREA-style cases (old suite) still pass.

### Commands run

```text
cd packages/domain-lms && npx vitest run
# Test Files  6 passed | Tests  76 passed

cd packages/domain-lms && pnpm exec tsc -p tsconfig.json   # rebuild dist
cd apps/api && npx tsc -p tsconfig.json --noEmit           # 0 errors
```

## Code review

Subagent `ak-engineer:code-reviewer` on owned diff:

- **Verdict:** APPROVE_WITH_NITS → addressed Important `revokeFromNext` in-scope  
- Spec checklist all met for the four pure functions + stamp/grant/router wiring  
- Remaining nits (not blocking): no Bright I.G **integration** test in api int suite;
  duplicated endpoint-assert helpers in grant-units vs router; throw-path unit coverage thin

## Outside ownership (not edited)

| Area | Note |
|------|------|
| `apps/admin/**` | UI may still display integer span lengths; not in scope |
| API int tests synthetic continuous units only | Domain proves gaps; int Bright path recommended later |
| Other packages importing old signatures | Grep: no remaining monorepo callers of broken signatures outside domain-lms + lms-ops |

## Residual risk

1. Stored historical ranges with gap endpoints (if any) are still readable via
   `isEntitled` label semantics; new grants/revokes write real endpoints only.
2. No live DB migrate/seed verification in this agent session.
3. `stamp-sessions` still silently skips missing unitId (pre-existing; should be
   unreachable when stamps come from axis).

## Status

**DONE**

Core gap-aware progression implemented, Bright I.G pure tests green, continuous
regression suite green, apps/api typecheck clean, code-review Important fix
(`revokeFromNext`) applied. No commit.
