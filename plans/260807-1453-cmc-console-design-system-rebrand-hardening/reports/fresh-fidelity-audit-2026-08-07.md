# Fresh Fidelity Audit — CMC Console (post Phase 1–2 rebrand)

**Date:** 2026-08-07  
**Plan:** `plans/260807-1453-cmc-console-design-system-rebrand-hardening/` Phase 3  
**Branch:** `feature/cmc-console-design-system-rebrand`  
**Scope:** time-boxed (validation decision 2026-08-07) — pin reconciliation + surfaces touched by Phases 1–2; not a full seven-surface re-walk.

---

## 1. Pin reconciliation (Step 0)

### Candidates

| Commit | Where recorded | Evidentiary weight |
|--------|----------------|--------------------|
| `5568f6e472e2e53bc2931e744421015b0f0f3550` | Was in `console.css` header, `docs/design-system-console.md`, `console-tokens.test.ts` assertion | Tracked, **but self-referential** — the test only checks the header string is present |
| `7de220c941c77d4fffdc270a7862c69475fa4577` | `plans/260806-odoo-ui-component-dissection/ODOO_PIN.txt` (gitignored local), dissection report, **local sparse clone HEAD** at `/home/manhquy/Downloads/odoo-src` | Clone + dissection process authority |

### Derivation evidence (not count-of-mentions)

1. **Local clone:** `git rev-parse HEAD` → `7de220c941c77d4fffdc270a7862c69475fa4577`. Object `5568f6e4…` is **not present** in the sparse clone (`git cat-file -t` fails). No ancestry relation can be established without a network fetch of full history.
2. **Value match against `7de220c` source files** (read directly from clone, not from prior audit summaries):

| Our token / rule | Our value | Odoo source @ 7de220c | Match |
|------------------|-----------|------------------------|-------|
| `--console-navbar-height` | `46px` | `$o-navbar-height: 46px` in `navbar/navbar.variables.scss:3` | Yes |
| `--console-kanban-card-width` | `320px` | `$o-kanban-default-record-width: 320px` in `kanban/kanban.variables.scss:2` | Yes |
| `--console-kanban-card-width-sm` | `300px` | `$o-kanban-small-record-width: 300px` in same file:3 | Yes |
| `--console-kanban-color-bar-width` | `3px` | `$o-kanban-color-border-width: 3px` in same file:8 | Yes |
| `--console-statusbar-arrow-width` | `1em` | `$o-statusbar-arrow-width: 1em` in `fields/statusbar/statusbar_field.variables.scss:1` | Yes |
| Root shell class `.o_web_client` | kept as-is | `.o_web_client` in `webclient/webclient.scss` + layout | Yes (deliberate DOM mirror) |

3. **Phases 1–2 value drift check** (`main:packages/ui/src/odoo.css` vs current `console.css`): all 38 comparable token **values** match after accounting for the `--odoo-*` → `--console-*` rename. The only mechanical “mismatch” is `kanban-bg: var(--odoo-gray-100)` → `var(--console-gray-100)` (reference rename, not a colour change).

### Decision

**Authoritative pin for tracked attribution:** `7de220c941c77d4fffdc270a7862c69475fa4577` (branch `19.0`).

**Rationale:** shipped CSS values match that commit’s SCSS defaults; the clone used for dissection is that commit; `5568f6e4…` cannot be re-verified in the available clone and its only “guard” was a circular string assertion.

**Tracked files updated in this phase:**
- `packages/ui/src/console.css` header (LGPL-3 + new hash + reconciliation note)
- `packages/ui/src/console/console-tokens.test.ts` (asserted hash)
- `docs/design-system-console.md` (source commit + path fixes for renamed files)

**Not moved forward:** pin is not advanced to upstream HEAD; only reconciled among existing recorded candidates (plan non-goal).

---

## 2. Surfaces in this pass (Phase 1–2 touchpoints)

| Surface | Touched by Phases 1–2 | In this audit pass | Automated value-lock |
|---------|----------------------:|--------------------|----------------------|
| Tokens / attribution header | Yes (rename + pin) | **Yes** | `console-tokens.test.ts` |
| Shell / navbar classes | Yes (`console-navbar`, `.o_web_client`) | **Yes** | `console-shell-stacking.test.ts`, `console-navbar.test.tsx` |
| Control panel / list chrome | Yes (class rename) | **Yes** (value spot-check) | `console-cp-sheet.test.ts` |
| Kanban dimensions | Yes (token rename) | **Yes** | `console-tokens.test.ts`, `console-kanban.test.tsx` |
| Statusbar chevron tokens | Yes (token rename) | **Yes** | value spot-check + Odoo source |
| Float layers (toast/cmd) | Yes (ck→console) | **Yes** (residual + tests) | `console-float-layer.test.ts` |
| Legacy ck/tpl/sh retirement | Yes (Phase 2) | **Yes** (residual scan) | residual greps + float-layer tests |
| Settings form grammar deep dive | No structural change | **Out of pass** | `console-cp-sheet` partial; full re-walk deferred |
| List renderer deep dive | Class rename only | **Out of pass** | `console-cp-sheet.test.ts` |
| Form sheet deep dive | Class rename only | **Out of pass** | `console-cp-sheet.test.ts:62-71` |

---

## 3. Findings

| # | Finding | Severity | Disposition | Rationale |
|---|---------|----------|-------------|-----------|
| F1 | Two pin commits recorded; in-code pin (`5568…`) ≠ clone/dissection pin (`7de2…`) | High | **Accept → fixed this phase** | Derivation above; tracked files updated to `7de220c` |
| F2 | Phase 1–2 rename changed visual token **values** | — | **Reject** | Diff vs `main` odoo.css: 0 value changes among 38 token pairs (only prefix rename) |
| F3 | Stray `.o-*` template classes left after Phase 1 | — | **Reject** | Comment-stripped CSS: hyphen `.o-*` = empty; only `.o_web_client` remains |
| F4 | Stray `.ck-*` / `.tpl-*` after Phase 2 | — | **Reject** | Residual selectors = 0 in `console.css` |
| F5 | `.o_web_client` still sole underscore DOM-mirror class | — | **Already-known / keep** | Plan Naming Decision; matches Odoo `webclient.scss` |
| F6 | 13 `sh-*` SideNav/AppFrame classes remain | — | **Already-known / keep** | Phase 2 carve-out; public export non-goal |
| F7 | Navbar height 46px matches Odoo | — | **Reject (false alarm)** | Matches `$o-navbar-height` @ 7de220c |
| F8 | Kanban card 320/300px matches Odoo variables | — | **Reject (false alarm)** | Matches `kanban.variables.scss` @ 7de220c |
| F9 | Statusbar arrow width 1em matches Odoo | — | **Reject (false alarm)** | Matches `$o-statusbar-arrow-width` |
| F10 | `docs/design-system-console.md` still describes premium/ck era in prose | Medium | **Accept (defer Phase 7)** | Pin + path strings fixed here; full doc rewrite is Phase 7 |
| F11 | Full seven-surface Odoo re-walk not performed | — | **Already-known** | Explicit time-box; stronger automated locks cover value fidelity |

No new fidelity gaps requiring inline production fixes. No follow-up fidelity ticket opened beyond Phase 7 doc cleanup.

---

## 4. Residual class census (post Phase 1–2)

```
.o_web_client     — kept (DOM mirror)
.console-*        — primary family
.sh-* (13)        — SideNav/AppFrame only
.ck-* / .tpl-*    — zero selectors
.o-* (hyphen)     — zero selectors
```

---

## 5. Gates for this phase’s tracked diff

- `pnpm --filter @cmc/ui test` (includes `console-tokens.test.ts` pin assertion)
- `pnpm typecheck` (optional full; ui package sufficient for header/test-only change)

---

## 6. Conclusion

Phase 3’s non-redundant work is **pin reconciliation**. Attribution in tracked files now points at `7de220c941c77d4fffdc270a7862c69475fa4577`, with derivation evidence recorded here. Phase 1–2 renames did not alter computed visual values. Full multi-surface source re-walk remains out of this time-boxed pass; automated value-lock tests remain the continuous fidelity gate.
