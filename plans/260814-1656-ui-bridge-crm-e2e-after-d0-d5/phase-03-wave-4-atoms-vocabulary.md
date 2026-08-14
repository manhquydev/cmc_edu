---
phase: 3
title: "Wave 4A atoms vocabulary (badge + category)"
status: pending
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3: Wave 4A atoms vocabulary (badge + category)

## Overview

Extend `@cmc/ui` with lab **status** vocabulary (`brand` waiting tone) and a **separate** categorical chip — under production OpenEduCat capsule pixels. This is **Wave 4A only** (badges/category). Button states and tabs indicator remain Wave 4B (out of this plan).

## Requirements

- Functional:
  - `SoftTone` includes `brand`; waiting-like statuses map to it; optional `tone?: SoftTone` override.
  - New **`CategoryChip`** component `{ category: 'a'|'b'|'c'|'d'; label; size? }` — **forbid** adding `category` onto `StatusBadge`.
- Non-functional: production solid capsules; no shell topology; no `:root` **substring anywhere** in `console.css` (even comments — `console-tokens.test.ts` literal guard).

## Architecture

- `StatusBadge` stays status→tone map + optional tone override.
- `CategoryChip` owns taxonomy styling via `data-category`.
- Export `CategoryChipProps` from `packages/ui/src/index.ts`.

## Related Code Files

- Modify: `packages/ui/src/components/status-badge.tsx` (+ tests)
- Create: `packages/ui/src/components/category-chip.tsx` (+ tests)
- Modify: `packages/ui/src/console.css` (brand soft + category; never write the characters `:root`)
- Modify: `packages/ui/src/index.ts`

## Implementation Steps

1. Add `brand` SoftTone + CSS under `.o_web_client`.
2. Map waiting-like keys (`waiting`, `queued`, `processing` if present in product) → `brand`.
3. Implement `CategoryChip` separately; export types.
4. Unit tests for tone classes and category `data-category`.
5. Document Wave 4A vs 4B in BRIDGE (partial, not “Wave 4 landed”).

## Todo

- [x] SoftTone + brand CSS
- [x] CategoryChip + CSS
- [x] Tests + exports
- [x] BRIDGE: Wave 4A partial note

## Success Criteria

- [x] Distinct classes for brand vs category vs status tones
- [x] Existing StatusBadge tests green
- [x] `console-tokens` / no `:root` substring tests pass

## Risk Assessment

Confusing `info` vs `brand` → JSDoc. Scope creep into buttons/tabs → **cut** (4B).
