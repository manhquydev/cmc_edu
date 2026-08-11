# 0046 — orderGlobal stability for sold unit rights

Date: 2026-08-11

## Status

Accepted.

## Context

Sold unit ranges store **integers** (`fromOrderGlobal`..`toOrderGlobal`). Shifting order under live ranges silently changes who may attend.

## Decision

1. `CurriculumUnit.orderGlobal` is the entitlement identity within a `Program`.
2. Uniqueness: `(program, orderGlobal)`.
3. Changing order under existing ranges requires an explicit remap procedure (out of foundation spike); seeder/CI must not silently renumber sold axes.
4. Spike/test seed: assign contiguous orderGlobals per program (1..N).

## Consequences

Foundation migration backfills existing rows by level/monthIndex order. Product CSV import (later) must assert stability or remap.
