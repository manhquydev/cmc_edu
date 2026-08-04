---
title: "Curriculum seed ensure"
status: pending
priority: P0
effort: 1h
dependencies: []
---

# Phase 3: Curriculum seed ensure

## Overview

local-sim never ran `seedCurriculumUnits`; exercise path empty. Ensure units on demo seed path.

## Related Code Files

- Modify: `packages/db/prisma/seed.mjs` (export ensure if needed)
- Create or modify: `scripts/ensure-curriculum-units.ts` and/or `scripts/seed-local-sim-demo.ts`
- Header comment: how local-sim gets units

## Implementation Steps

1. Shared ensure: if count=0 insert 2 UCREA units (same as seed.mjs)
2. Invoke from seed-local-sim-demo when DB URL reachable (rewrite postgres→127.0.0.1 if needed)
3. Document one-liner in seed-local-sim-demo header

## Success Criteria

- [x] Running ensure against empty DB inserts units
- [x] Idempotent second run
