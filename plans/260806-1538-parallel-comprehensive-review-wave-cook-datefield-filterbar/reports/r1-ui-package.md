# R1 — packages/ui DateField + FilterBar

**Lane:** UI package  
**Scope:** `939b92f` DateField extraction + FilterBar `type: 'date'` wiring; exports; `odoo.css`  
**Reviewer posture:** production-readiness / hostile-to-defects (read-only)  
**Date:** 2026-08-06

## Scope

| Path | Role |
|------|------|
| `packages/ui/src/components/date-field.tsx` | New shared date control |
| `packages/ui/src/components/date-field.test.tsx` | Unit tests (3) |
| `packages/ui/src/components/filter-bar.tsx` | Inline date → `DateField` |
| `packages/ui/src/components/filter-bar.test.tsx` | New tests (2, controlled-only) |
| `packages/ui/src/index.ts` | Barrel exports |
| `packages/ui/src/odoo.css` | `.o-date-field*` rules |

**LOC (approx):** +52 DateField, −17/+12 FilterBar date branch, +51 CSS, +65 tests, +3 exports.

**Scout findings (edge cases):**

- Label-derived `id` collides when two instances share a label (or slug to the same string).
- FilterBar dual-mode splits **read** (`value?`) and **write** (`onChange?`) independently → half-controlled footguns.
- `FilterBar` always calls `useSearchParams` (Router required even when fully controlled) — pre-existing.
- Date styles live only in `odoo.css`; barrel exports `DateField` with no compile-time CSS coupling.
- `--cmc-accent` is not a defined design token; focus ring relies on CSS fallback.
- Package tests never exercise URL (uncontrolled) mode for `type: 'date'`.
- `size="md"` has no distinct layout rules; `--sm` width is largely redundant with block flex + input `width: 100%`.

---

## Overall Assessment

Extraction of the former inline filter date control into a shared `DateField` is directionally correct (DRY, exportable, density tokens in CSS). Happy-path controlled wiring for `FilterBar type: 'date'` is straightforward and matches audit-log usage.

The lane is **not ship-clean**: fragile default `id` generation, dual-mode contract ambiguity (pre-existing but untested for the new path), token misuse, and thin tests that do not prove the URL mode or disabled/empty edge contracts. No trust-boundary or data-loss **BLOCKER** inside the UI package itself.

---

## Findings

### 1. MAJOR — Default `id` derived from `label` (collision / association risk)

- **File:** `packages/ui/src/components/date-field.tsx` (L30); call site `filter-bar.tsx` (L71–76)
- **Evidence:**
  ```ts
  const inputId = id ?? `date-field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  ```
  FilterBar never passes `id` (should use stable `f.key`). Two fields with the same label, or two bars both rendering e.g. `"Từ ngày"`, produce duplicate DOM ids. `htmlFor` then associates with the first match; click-label and a11y tree mis-bind.
- **Impact:** Broken label association and invalid HTML when more than one DateField shares a label. Exported public API makes this easy to hit outside the single audit-log pair (`Từ ngày` / `Đến ngày`).
- **Fix suggestion:** Prefer `React.useId()` for the default, and/or require FilterBar to pass `id={\`filter-${f.key}\`}`. Keep optional `id` override for forms. Do not slug from user-visible label text.

### 2. MAJOR — FilterBar controlled vs URL mode is half-split (pre-existing; still the date write path)

- **File:** `packages/ui/src/components/filter-bar.tsx` (L27–47)
- **Evidence:**
  - Read: `externalValue ? externalValue : searchParams…`
  - Write: `if (externalOnChange) externalOnChange(next); else setSearchParams…`
  - JSDoc claims “when `value` and `onChange` are provided they take precedence (fully controlled)” but implementation does **not** require the pair.
  - `value` without `onChange` → UI stuck on props while URL mutates.  
  - `onChange` without `value` → callback fires, URL never updates, UI still reads URL → appears dead.
- **Impact:** Consumer footgun on any filter type including the new `DateField` path. Not introduced by this commit, but this commit is the moment FilterBar date behavior is re-exported as a polished dual-mode control without locking the contract or testing it.
- **Fix suggestion:** Treat modes as exclusive:
  - fully controlled: both `value` and `onChange` required (dev warning if only one);
  - URL mode: neither;  
  or implement write-through (controlled value + optional URL sync) explicitly. Add unit tests for URL set/delete on date clear.

### 3. MAJOR — Tests are happy-path only (phantom coverage for dual-mode + edges)

- **File:** `packages/ui/src/components/date-field.test.tsx`, `filter-bar.test.tsx`
- **Evidence:**
  - DateField: render, onChange YYYY-MM-DD, `isLabelHidden` class presence. No `disabled`, no custom `id`, no empty clear, no duplicate-label case.
  - FilterBar: only controlled `value`+`onChange` date cases. **Zero** assertions for default URL mode (`MemoryRouter` initial entries + `setSearchParams`), select/text regression, or clearing a date (param delete).
- **Impact:** Refactors can break URL deep-link mode (still the default API) without CI red. Package-level confidence is overstated relative to the dual-mode docs.
- **Fix suggestion:** Add at least:
  1. URL mode: mount with `?from=2026-01-15`, assert input value; change date; assert search string; clear → param removed.
  2. DateField `disabled` prevents onChange / sets disabled attribute.
  3. Optional: two DateFields same label with explicit ids do not collide.

### 4. MINOR — Focus token uses undefined `--cmc-accent`

- **File:** `packages/ui/src/odoo.css` (L967–969)
- **Evidence:** `outline: 2px solid var(--cmc-accent, #0071e3);`  
  Tokens define `--cmc-brand`, `--cmc-focus-ring`, `--cmc-accent-soft` — **not** `--cmc-accent`. Fallback keeps color correct today (`#0071e3` == brand).
- **Impact:** Theme/token swaps that redefine brand without the unused name leave this control on a hard-coded fallback; inconsistent with `.o-bc-link:focus-visible` / premium focus which use `--cmc-brand`.
- **Fix suggestion:** `outline: var(--cmc-focus-ring, 2px solid var(--cmc-brand));` or `2px solid var(--cmc-brand)`; prefer `:focus-visible` to match other odoo controls.

### 5. MINOR — Redundant accessible name sources

- **File:** `packages/ui/src/components/date-field.tsx` (L32–48)
- **Evidence:** Wrapping `<label htmlFor={inputId}>` + visible/sr-only label text + always-on `aria-label={label}` on the input.
- **Impact:** Name calculation prefers `aria-label`, so it works, but the pattern is noisy and can confuse future a11y audits; `aria-label` is unnecessary when a non-hidden label is already associated. Comment says hidden label “still sets aria-label” — correct for hidden case only.
- **Fix suggestion:** Set `aria-label={label}` only when `isLabelHidden`; otherwise rely on `<label>` / `htmlFor`. Keep a single name source.

### 6. MINOR — `size` API is mostly cosmetic / JSDoc wrong

- **File:** `date-field.tsx` (L15–16, L28); `odoo.css` (L922–930)
- **Evidence:** JSDoc: “Compact width for filter rows (default true for filter use)” — prop is `'sm' | 'md'`, not boolean. `.o-date-field` is already `display: flex` (block-level); `.o-date-field-input { width: 100% }`; `--sm` only sets parent `width: 100%`. No `--md` rules.
- **Impact:** Callers cannot get a meaningfully different “md” control; API suggests density variants that do not exist.
- **Fix suggestion:** Either implement real md height/typography tokens aligned with Astryx `size="sm"|"md"`, or drop `size` until needed (YAGNI) and size via parent width only.

### 7. MINOR — Styles gated on `odoo.css` while component is a general barrel export

- **File:** `index.ts` (L143–144); `odoo.css` DateField block; package `exports` already includes `./odoo.css`
- **Evidence:** DateField classes are defined only in `@cmc/ui/odoo.css`. Admin loads it; a future form-page or LMS import of `DateField` from `@cmc/ui` without odoo.css gets an unstyled native date input. Component file comment mentions design3/Odoo; barrel does not.
- **Impact:** Silent visual regression / inconsistent density when reused for G2 form fields claimed **SHIPPED** in design docs.
- **Fix suggestion:** Document “requires `@cmc/ui/odoo.css`” next to export (llms.txt / component JSDoc), or move base field chrome to a CSS surface always loaded with the package.

### 8. MINOR — Orphaned `.o-label-upper` after extraction

- **File:** `packages/ui/src/odoo.css` (L1654–1661)
- **Evidence:** Pre-change date branch used `o-label-upper`; post-change grep shows **only** the CSS definition, no TSX consumers.
- **Impact:** Dead CSS weight; label density also shifted (old `o-label-upper` ~12px odoo token vs new hardcoded `11px`).
- **Fix suggestion:** Remove dead rule or reuse `o-label-upper` inside DateField for one uppercase-label system.

### 9. MINOR — No range / form-oriented props on a “shared” date control

- **File:** `date-field.tsx` props surface
- **Evidence:** No `min`, `max`, `name`, `required`, `error` / `aria-invalid`. FilterBar date pairs (from/to) cannot express ordering at the control layer; invalid non-`YYYY-MM-DD` controlled values yield the usual empty native date UI with a stuck React value.
- **Impact:** Acceptable for filter-only YAGNI **if** docs do not claim full form-field ship. Conflicts with design-map “DateField SHIPPED” for form grammar (docs lane), and leaves from>to possible in UI.
- **Fix suggestion:** For filter scope, optional `min`/`max` passthrough is cheap and helps from/to. Defer name/error until form adoption; do not mark form-complete in docs until then.

### 10. NIT — `:focus` instead of `:focus-visible`

- **File:** `odoo.css` L967
- **Evidence:** Mouse click shows focus ring; sibling odoo rules use `:focus-visible`.
- **Impact:** Minor visual noise; not an a11y failure.
- **Fix suggestion:** Switch to `:focus-visible`.

### 11. NIT — `sr-only` uses legacy `clip: rect(0,0,0,0)` and is scoped only under label

- **File:** `odoo.css` L940–949
- **Evidence:** Combined selector `.o-date-field-label.o-sr-only` only; no shared utility. Works for current class pairing.
- **Impact:** Low; pattern is fine if both classes stay coupled.
- **Fix suggestion:** Optional modern clip-path; or shared `.o-sr-only` utility if more composites need it.

### 12. NIT — Export completeness is fine

- **File:** `packages/ui/src/index.ts` L140–144
- **Evidence:** `FilterBar`, `FilterBarProps`, `FilterDef`, `DateField`, `DateFieldProps` all exported from the package root.
- **Impact:** None — call sites can import from `@cmc/ui`.
- **Fix suggestion:** None required for exports.

---

## Edge Cases Checklist (requested)

| Case | Result |
|------|--------|
| Empty date (`value=""`) | OK — controlled empty native date; FilterBar URL mode deletes key when `val` falsy |
| Disabled | Implemented on DateField; **not** exposed on `FilterDef` / FilterBar; **untested** |
| Label collision | **Risk** — default id from label; FilterBar does not pass `f.key` |
| Controlled mode | Works when **both** value + onChange provided (audit-log pattern) |
| URL mode | Code path intact; **no package test** after extraction |
| CSS regression | Inline styles removed; chrome moved to `.o-date-field*`; possible 11px vs 12px label delta; `--cmc-accent` fallback masks token gap |
| a11y landmark | FilterBar still `role="search"` + `aria-label="Bộ lọc"`; per-field labeling present |

---

## Positive / risk-calibration notes

- Native `type="date"` avoids calendar-library weight; value contract stays `YYYY-MM-DD` strings (good for URL + ICT mapping at page layer).
- Moving inline styles into `odoo.css` is the right density approach for design3.
- Barrel export of `DateField` + types is complete for app consumption.
- Extraction preserves FilterBar’s existing select/text branches and search landmark.

---

## Recommended Actions (priority)

1. **Default id via `useId()` + FilterBar `id={\`filter-${f.key}\`}`** (Finding 1).
2. **Lock dual-mode contract** (pair required or exclusive modes) + **URL-mode date tests** (Findings 2–3).
3. Fix focus token to `--cmc-brand` / `--cmc-focus-ring`; prefer `:focus-visible` (Findings 4, 10).
4. Gate `aria-label` on `isLabelHidden` only (Finding 5).
5. Clarify `size` / odoo.css dependency in JSDoc; drop or implement `md` (Findings 6–7).
6. Remove or reuse dead `.o-label-upper` (Finding 8).

---

## Metrics (lane-local, qualitative)

| Metric | Value |
|--------|--------|
| Type coverage | Props fully typed; no `any` in touched files |
| Test coverage | Happy path only; URL mode / disabled / id collision **unproven** |
| Linting issues | Not re-run in this read-only lane |
| Export completeness | **Complete** (`DateField` + `DateFieldProps`) |
| BLOCKER | 0 |
| MAJOR | 3 |
| MINOR | 6 |
| NIT | 3 |

---

## Unresolved Questions

- Is DateField intentionally **filter-only** for this ship, or must it satisfy G2 form-field “SHIPPED” (min/max/error/name)? Product intent changes Finding 9 severity.
- Should FilterBar URL-sync when controlled (write-through) for shareable list URLs on pages that currently keep local state only (e.g. audit-log)? Out of pure component scope but affects dual-mode design.

---

## Status

**Status:** DONE_WITH_CONCERNS  
**Lane verdict:** **FAIL** (no BLOCKER, but 3 MAJORs: fragile default ids, dual-mode contract footgun on the date write path, insufficient tests for the defining URL mode)

Ship of the extraction is acceptable only if call sites stay single-bar + unique labels **and** dual-mode misuse is accepted as pre-existing residual risk. Recommend fix Finding 1 + add URL-mode test before treating `@cmc/ui` DateField as a stable public control.
