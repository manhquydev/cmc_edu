# Conflict ledger: lab vocabulary vs production truth

**Date:** 2026-08-14 · **Phase:** D1 of the D0→D5 improvement path
**Measured against:** `packages/ui/src/{console,tokens,astryx-theme-cmc}.css`
**Why this file exists:** the red-team killed the assumption that lab tokens
"alias cleanly" into production. This is the measurement that replaces it.

## Method

All 121 public lab tokens (Layer 2 + Layer 3, excluding `--_p-*` primitives)
were compared by name against every custom property defined in
`packages/ui/src/*.css`.

## Name collisions

| Token | Lab value | Production value | Resolution |
|-------|-----------|------------------|------------|
| `--radius-container` | 8px (`--_p-radius-lg`) | 4px (`var(--console-radius, 4px)`, `console.css:31`) | **Renamed in lab to `--radius-panel`.** One vocabulary can now be aliased onto the other without a same-name/different-value clash. |

After the rename: **0 collisions across 121 tokens.** The rest of the lab
vocabulary uses names production does not define, so an additive alias block is
safe.

## Value divergence (no collision, but a visible delta when bridged)

These are different names holding different values. Nothing breaks, but anyone
aliasing lab semantics onto production values must expect production to keep its
own look. Production wins; see the decision below.

| Role | Lab | Production | Source |
|------|-----|------------|--------|
| brand purple | `#71639e` | `#71639e` | **identical** (`console.css:14`) |
| row height | 40px | 40px | **identical** (`console.css:107`) |
| focus ring | 2px purple outline, 2px offset | `2px solid` purple (`--cmc-focus-ring`, `console.css:49`) | **same mechanism** after D0 |
| control radius | 6px | 4px (`--console-radius`) | contract |
| panel radius | 8px | 4px / 6px (`--console-radius-lg`) | contract |
| page ground | `#f7f7f8` | `#f8f9fa` | contract |
| hairline | `#e4e4e7` | `#dee2e6` / `#e9ecef` | contract |
| body ink | `#18181b` | `#212529` | contract |
| muted ink | `#63636b` (post-D0) | `#6c757d` | contract |
| success | `#15803d` ink tier | `#28a745` | contract |
| shell topology | 240px left rail + 48px utility bar | 46px navbar + ~58px control panel | contract |

## Decisions (derived from repository authority, not preference)

`OPENEDUCAT-VISUAL-CONTRACT.md` is the locked authority for list, form, and
statusbar chrome until a bridge wave is explicitly authorized. Neither of the
open questions has an owner decision on record, so both resolve conservatively
toward the contract, which is also the recoverable direction.

### Q-radius / palette → **production values win**

The bridge aliases lab *semantic names* onto *existing production values*. It
does not repaint production. Consequence, stated plainly so nobody is surprised
later: a component built from lab tokens renders with 4px radii and the
OpenEduCat palette in `apps/admin`, not the near-white 6/8px Ruled Ledger look
of the gallery. The gallery remains the visual direction and the grammar
authority; it is not a promise about production pixels.

Reversing this later is a repaint decision with owner sign-off, and the ledger
above is the list of values it would touch.

### Q-shell → **keep the OpenEduCat top OS**

Production keeps the 46px navbar plus control panel. The lab's 240px rail stays
a lab exploration, and the Shared-Chrome Rule is scoped to the lab. The bridge
wave that proposed per-role admin home shells is descoped until an owner decides
shell topology, because nothing in the repository authorizes replacing a locked
Product OS.

## What bridges, and what never does

| Lab artifact | Bridge action |
|---|---|
| Layer 2 semantic names | Alias onto existing `--console-*` / `--cmc-*` values (additive block) |
| Density contexts | DataTable metrics only; never the type ramp |
| Status vocabulary (6 tones) + categorical ramp | Port as component API |
| Edge-state grammar (empty ×3, deny ×3, confirm, retry) | Port as component props |
| Statusbar chevron geometry | **Never.** Restyle the existing production statusbar. |
| Funnel trapezoids | **Never** as a replacement; existing StageFunnel is restyled if wanted |
| Kanban drag-drop, attendance cycle, gradebook draft, sort, select-all | **Never.** Lab demos, not interaction contracts. Re-implement against real APIs with permission and stage guards. |
| `shell.js` globals | Never; ship as a module if any behavior is ported |
