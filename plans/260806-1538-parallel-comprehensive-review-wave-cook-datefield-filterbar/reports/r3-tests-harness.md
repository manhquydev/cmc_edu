# R3 — Tests + harness

**Date:** 2026-08-06  
**Lane:** R3 Tests + harness (DateField / FilterBar cook)  
**Scope commits:** `048b65b`, `939b92f` vs `origin/develop`  
**Mode:** read-only review (no test execution in this lane; live results in `r8-live-tests.md`)  
**Status:** **FAIL**

## Scope

| Surface | Path | In cook diff? |
|---------|------|---------------|
| DateField unit | `packages/ui/src/components/date-field.test.tsx` | new |
| FilterBar unit | `packages/ui/src/components/filter-bar.test.tsx` | new |
| Pipeline page | `apps/admin/src/pages/crm/pipeline.test.tsx` | label renames only |
| Audit log page | `apps/admin/src/pages/admin/audit-log.test.tsx` | ICT date + live FilterBar |
| Harness polyfill | `apps/admin/test-setup.ts` | `CSS.escape` |
| KPI page | `apps/admin/src/pages/hr/kpi.test.tsx` | **not updated** (page was) |
| Parents page | `apps/admin/src/pages/parents/index.test.tsx` | **not updated** (page was) |
| Gifts page | `apps/admin/src/pages/engagement/gifts.test.tsx` | **not updated** (page was) |

**LOC reviewed (tests + harness):** ~820 (pipeline ~440, audit ~110, date/filter ~65, setup ~53, consumer skim ~150)

**Scout focus:** coverage gaps, brittle selectors, false confidence, ICT date correctness, polyfill safety, missing negative cases.

---

## Overall assessment

Happy-path unit tests for `DateField` and the date branch of `FilterBar` are thin but correct. Audit-log’s new ICT day-bound assertion is the strongest new contract test in the cook and is **factually correct**. Pipeline lost-filter renames were updated so existing selector-based cases still lock the query payload.

That is not enough for the cook’s blast radius. **Three admin pages were migrated to FilterBar with no new filter-contract tests** (`gifts`, `parents` search/email, KPI status select beyond pre-existing period text). Package-level `FilterBar` tests never exercise `select`, `text`, or the **default URL-synced mode** that the component docs claim is the primary contract. Live suite green (`r8`: 81/81) therefore overstates regression safety: many new behaviors are unasserted, and one consumer mock cannot even observe the filter input.

---

## Findings

### [MAJOR] FilterBar unit tests only cover `type=date` — false confidence on the shared component

**Where:** `packages/ui/src/components/filter-bar.test.tsx` (2 tests)

**Evidence:** Fixture defines `select` + `text` + `date`, but both tests only touch `Từ ngày`. No assertions for:

- `type=select` → Astryx `Selector` value/`onChange` / clear (`hasClear`)
- `type=text` → `TextInput` controlled value
- **Uncontrolled / URL mode** (`value`/`onChange` omitted): read from `useSearchParams`, write via `setSearchParams(..., { replace: true })`, empty value deletes the key
- Half-controlled misuse: `value` without `onChange` (display stuck, writes go to URL) or `onChange` without `value`
- `role="search"` / `aria-label="Bộ lọc"` region (used by student/aftersale tests as the chrome contract)

**Impact:** A regression that breaks URL deep-linking, select clear, or text wiring still leaves the only FilterBar package tests green. The dual-mode API is the highest-risk surface and is completely untested at the package layer.

**Fix:** Add at least: (1) controlled select + text onChange; (2) URL mode round-trip with `MemoryRouter` initial entries; (3) empty value removes query key; (4) search region a11y role.

---

### [MAJOR] Gifts FilterBar → `includeInactive` has zero coverage; mock cannot observe input

**Where:** `apps/admin/src/pages/engagement/gifts.tsx` (cook), `gifts.test.tsx` (unchanged)

**Evidence:**

```ts
// gifts.tsx
const includeInactive = filterValues.active !== 'active';
const { data, ... } = trpc.gift.list.useQuery({ includeInactive });
```

```ts
// gifts.test.tsx — no args captured
'gift.list.useQuery': () => queryResult(giftListState.data, { ... }),
```

Tests cover row render, upsert payload, empty, and error only. No spy on list input; no select of “Đang hiện” / “Tất cả”.

**Impact:** Changing default `active: 'all'`, inverting the `includeInactive` boolean, or dropping the FilterBar would not fail CI. This is a classic phantom-safe suite after a chrome migration.

**Fix:** Capture `gift.list.useQuery` input; assert default `{ includeInactive: true }`; change status select → `{ includeInactive: false }`; assert page resets to 1 when filter changes (code does `setPage(1)`).

---

### [MAJOR] Parents FilterBar search + email filter untested after migration

**Where:** `apps/admin/src/pages/parents/index.tsx` (`PARENT_DIR_FILTERS`, debounce 300ms), `index.test.tsx`

**Evidence:** Existing tests lock default `missingEmailOnly: true` on tab switch and email modal flows. They do **not** exercise:

- typing in “Tìm kiếm” → debounced `parentAccount.list({ search })`
- switching “Email LMS” to “Tất cả” → `missingEmailOnly: false`
- page reset on filter change (`useEffect` on `debouncedSearch` / `emailFilter`)
- link-request tab status FilterBar (`LINK_STATUS_FILTERS`)

Contrast: `students/index.test.tsx` and `receipt-list.test.tsx` already set the standard for FilterBar → query contracts.

**Impact:** Debounce wiring, email-filter mapping, and page-reset side effects can break silently.

**Fix:** Mirror pipeline search debounce pattern + receipt-list select pattern for the All Parents tab; optionally one status-select case on the link-request tab.

---

### [MAJOR] KPI status FilterBar path not locked; period tests only prove label still works

**Where:** `apps/admin/src/pages/hr/kpi.tsx` (`KPI_FILTERS` status select + period text), `kpi.test.tsx`

**Evidence:** Pre-existing cases still use `getByLabelText('Kỳ (YYYY-MM)')` for invalid/valid period `enabled` gating — good accidental regression lock for the period **text** field after FilterBar migration. Default query asserts `status: 'submitted'`.

Missing:

- changing status Selector → `kpi.list` input updates (`confirmed` / clear → no status key when empty)
- clearing status to “Tất cả” (`statusFilter = filterValues.status || undefined`)
- empty period fallback `next.period || defaultPeriodICT()` (onChange always re-defaults)

**Impact:** Status filter is the other half of the inbox contract; only the default is asserted.

**Fix:** One select interaction + one clear/all interaction against `listSpy`.

---

### [MINOR] Audit ICT date test is correct — but negative / edge cases missing

**Where:** `apps/admin/src/pages/admin/audit-log.test.tsx`, `audit-log.tsx` `toCreatedFromIso` / `toCreatedToIso`

**Correctness check (PASS for the asserted case):**

| Wall (ICT) | Expected ISO | Asserted |
|------------|--------------|----------|
| `2026-08-06T00:00:00+07:00` | `2026-08-05T17:00:00.000Z` | yes |
| `2026-08-06T23:59:59.999+07:00` | `2026-08-06T16:59:59.999Z` | yes |

Implementation uses fixed offset `+07:00` + `DATE_ONLY` guard — matches inclusive ICT day bounds and API `z.string().datetime()` consumers. This is a real improvement over prior `new Date(dateText)` (UTC-midnight ambiguity).

**Missing negatives:**

| Case | Expected | Tested? |
|------|----------|---------|
| empty date | omit `createdFrom`/`createdTo` | no |
| invalid / non-`YYYY-MM-DD` | omit (DATE_ONLY fails) | no |
| clear after set | params drop bounds | no |
| from > to | still sends both (server accepts; product may want UI guard) | no |
| page reset when date changes while page>1 | `setPage(1)` in onChange | no |

**Impact:** Happy path is locked; regression of the guard or of “live apply without Lọc button” for dates is only partially covered (happy path only).

**Fix:** Add empty/invalid omit cases; optional inverted-range documentation test if product chooses to keep server-side only.

---

### [MINOR] Pipeline search selector is placeholder-based; lost filter rename is fine

**Where:** `pipeline.test.tsx`

**What improved:** Lost combobox accessible name updated `Hiển thị cơ hội đã mất` → `Hiển thị` to match `PIPELINE_FILTERS` — necessary and correct. Lost include/only payloads still asserted.

**Brittleness:**

```ts
screen.getByPlaceholderText('Tìm theo tên hoặc SĐT…')
```

Students/receipts use `getByLabelText('Tìm kiếm')` against the same FilterBar text control. Placeholder copy is marketing text; label is the stable a11y name (`label: 'Tìm kiếm'`).

CSS-class funnel/kanban selectors (`.ck-fn-label`, `.o-kanban-col-count`, …) remain brittle but are **pre-existing**, not introduced by this cook.

**Impact:** Placeholder tweak fails the debounce test without a product bug. Prefer label-based queries for FilterBar text fields.

---

### [MINOR] DateField unit coverage is smoke-only

**Where:** `date-field.test.tsx` (3 tests)

Covered: labelled `type=date`, onChange YYYY-MM-DD, `isLabelHidden` + `.o-sr-only`.

Not covered: `disabled`, `size`/`className`, custom `id`, controlled empty → clear, invalid/non-ISO value passthrough, id generation from Vietnamese labels (diacritics / collision if two fields share a label).

`isLabelHidden` asserts class presence, not that the visible label is absent while `aria-label` remains — weak a11y lock.

**Impact:** Low for a thin wrapper; still leaves export surface under-specified.

---

### [MINOR] `CSS.escape` polyfill is safe for the harness; not a full CSS.escape

**Where:** `apps/admin/test-setup.ts` lines 6–15

**Safety (good):**

- Only installs when `globalThis.CSS` is missing, or when `CSS.escape` is not a function — does not clobber a real implementation.
- Node-env logic tests: if `CSS` is undefined, creates a minimal object; no DOM assumption beyond `globalThis`.
- Motivation matches real failure mode: Astryx Dialog layout effects call `CSS.escape` under jsdom; r8 notes monorepo-root runs without this setup break.

**Spec gaps (acceptable for Dialog id escaping, not general CSSOM):**

| Input | Spec `CSS.escape` | Polyfill |
|-------|-------------------|----------|
| `a b` | `a\\ b` | `a\\ b` ✓ |
| leading digit `1x` | `\31 x` style | `1x` (unchanged) ✗ |
| `NULL` U+0000 | U+FFFD | `\\0` / keep ✗ |
| high code points | hex escapes preferred | backslash + char |

**Impact:** Fine for typical element ids used by Dialog. Do not reuse this polyfill as a claimed CSS.escape implementation elsewhere. No unit test of the polyfill itself (NIT).

**Fix (optional):** Document “Dialog id only”; or vendor `css.escape` ponyfill if broader use appears.

---

### [NIT] FilterBar date tests always pass controlled `value` — never prove DateField works in URL mode

Controlled-only tests mean URL-mode date filters (e.g. schedule page using uncontrolled FilterBar) have no package-level proof that `type=date` reads/writes query params as `YYYY-MM-DD`.

---

### [NIT] Live green suite can mask coverage holes

`r8-live-tests.md`: 81/81 pass including gifts/parents/kpi. That validates **existing** assertions still run under the new chrome, not that new filter behavior is proven. Treat r8 PASS as non-regress of old contracts only.

---

## Edge cases found by scout

1. **FilterBar dual-mode split-brain** if only one of `value`/`onChange` is passed — untested.
2. **Gifts `active: 'all'` vs select clear** — clear may set `''` then `next.active || 'all'` recovers; untested.
3. **KPI empty period onChange** silently re-defaults to current ICT month — can surprise users; untested.
4. **Parents debounce + page reset** race with fast typing — same pattern as pipeline (tested there, not here).
5. **Audit inclusive end `23:59:59.999`** — correct for `lte` server filter; DST not an issue (fixed +07).
6. **DateField default id from label** — two filters with same label collide on `htmlFor`/`id`; no test.
7. **CSS.escape polyfill** incomplete for numeric-leading ids if Dialog ever uses them.

---

## Positive observations (risk calibration only)

- Audit ICT bounds test is the right contract (wall-clock ICT → ISO), with exact expected strings — not a soft regex.
- Removing “Lọc” submit and asserting live FilterBar text filters matches the product change; page stays in `matchObject`.
- Pipeline lost-visibility + debounced search payload tests remain strong end-to-end UI→tRPC locks after FilterBar adoption.
- KPI period `enabled` gating still exercises the migrated period field by label — accidental but valuable.
- Harness polyfill is narrowly scoped and environment-guarded; consistent with existing `HTMLDialogElement` / `matchMedia` stubs.

---

## Severity summary

| Sev | Count | Themes |
|-----|------:|--------|
| BLOCKER | 0 | — |
| MAJOR | 4 | FilterBar unit holes; gifts/parents/kpi filter contracts missing |
| MINOR | 4 | Audit negatives; pipeline placeholder; DateField smoke; polyfill incompleteness |
| NIT | 2 | URL-mode date; live-green false confidence |

---

## Verdict

| Gate | Result |
|------|--------|
| ICT date test correctness | **PASS** (asserted values match ICT inclusive day math) |
| Polyfill safety | **PASS with MINOR** (safe for Dialog; not full CSS.escape) |
| Package unit depth | **FAIL** (date-only FilterBar; smoke DateField) |
| Consumer regression for cook surfaces | **FAIL** (gifts/parents filter paths; KPI status) |
| Brittle selectors | **PASS with MINOR** (pipeline placeholder; pre-existing CSS classes) |
| False confidence risk | **HIGH** — green CI ≠ filter contracts locked |

**Lane status: FAIL** — no production blockers in the tests themselves, but coverage is insufficient to claim the DateField/FilterBar cook is regression-safe. Block merge of “tests done” narrative until MAJOR items are addressed or explicitly accepted as follow-up debt.

---

## Recommended actions (priority)

1. **FilterBar package:** URL mode + select + text + empty-delete-param tests.
2. **Gifts:** spy `gift.list` input; default + active-only filter cases.
3. **Parents:** debounced search + email “Tất cả” → `missingEmailOnly: false`.
4. **KPI:** status select / clear → `listSpy` payload.
5. **Audit:** empty/invalid date omit; optional page-reset with date change.
6. **Pipeline:** switch search query to `getByLabelText('Tìm kiếm')`.
7. **Optional:** one polyfill smoke test or comment that it is Dialog-id-only.

---

## Metrics (qualitative)

| Metric | Assessment |
|--------|------------|
| Type coverage of new tests | Adequate for simple components |
| Behavioral coverage of cook | **Weak** on FilterBar dual-mode + 3 consumers |
| Negative cases | Sparse (audit/gifts/parents) |
| Brittle selector risk | Medium on pipeline chrome; low on label-based audit/kpi period |
| Live execution (r8) | 81/81 pass — does not clear this FAIL |

## Unresolved questions

- Product intent for audit `from > to` (allow vs client-side prevent) — affects whether a negative test is required.
- Whether schedule/rewards uncontrolled FilterBar pages need package URL-mode tests before the next Search OS wave.

---

**Status line for synthesis:** `R3 FAIL — 0 blocker, 4 major (coverage/false confidence), ICT test correct, CSS.escape polyfill safe-enough`
