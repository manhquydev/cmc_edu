# R2 — Admin page FilterBar migrations

**Lane:** R2 Admin pages  
**Scope:** `origin/develop..HEAD` (`939b92f` + docs commit)  
**Reviewer posture:** production-readiness, read-only  
**Status:** **FAIL**

## Scope

| File | Role in cook |
|------|----------------|
| `apps/admin/src/pages/crm/pipeline.tsx` | Search + lost → controlled FilterBar in `filters=` |
| `apps/admin/src/pages/hr/kpi.tsx` | Status + period out of header actions → `filters=` |
| `apps/admin/src/pages/parents/index.tsx` | Per-tab inline controls → FilterBar (body-local) |
| `apps/admin/src/pages/admin/audit-log.tsx` | Draft/apply form → live FilterBar + ListPagination footer |
| `apps/admin/src/pages/engagement/gifts.tsx` | New status filter; default preserves old `includeInactive: true` |

**Authority checked:** `VIEW-GRAMMAR.md` §3 / §3.1, `g1-search-application-playbook.md`, `FilterBar` / `ListPage` / `ControlBar` contracts, page tests.

**Scout findings (edge cases not obvious from happy path):**

1. Gifts bulk selection survives filter change; orphans not in current `allRows`.
2. Audit abandoned draft/apply → every keystroke hits exact-match `actor`/`action`/`entity`.
3. Parents mounts two FilterBars in tab body; sticky ControlBar has no search chrome.
4. Select `hasClear` + forced defaults (`|| 'pending'|'missing'|'exclude'|'all'`) is intentional but differs from playbook “empty = all” on queue defaults.
5. Pipeline/parents lost search `hasClear` + search icon (FilterBar `TextInput` is bare).

---

## Overall assessment

Three pages (**pipeline, kpi, audit, gifts**) correctly host FilterBar in `ListPage` → ControlBar. **Parents does not.**  
Query mapping and defaults are largely preserved where intended (pipeline debounce + page reset; KPI period gate; gifts default “all” = old always-include-inactive).  

Ship is **not** clean: selection hygiene on gifts, live exact-match audit spam, and parents G1 placement are real defects relative to the playbook this cook claims to apply.

---

## Critical Issues (BLOCKER)

_None._ No auth bypass, no silent data loss, no crash path introduced by these page migrations alone.

---

## High Priority (MAJOR)

### M1 — Gifts: filter change does not clear selection
**File:** `apps/admin/src/pages/engagement/gifts.tsx`  
**Evidence:** `onChange` only `setFilterValues` + `setPage(1)`; never `setSelectedIds([])`.  
**Contrast:** playbook §2.3 step 4; students `handleFilterChange` clears selection; receipt-list same.

**Impact:** Staff multi-selects, switches “Đang hiện”, BulkActionBar still shows N selected while checkboxes disappear for rows no longer in `allRows`. “Ẩn đã chọn” can toast `Đã ẩn 0 phần thưởng`.

**Fix:**
```tsx
onChange={(next) => {
  setFilterValues({ active: next.active || 'all' });
  setPage(1);
  setSelectedIds([]);
}}
```

---

### M2 — Audit log: draft/apply → live filters without debounce (behavior change)
**File:** `apps/admin/src/pages/admin/audit-log.tsx`  
**Before:** draft state + primary “Lọc” applied to query.  
**After:** every FilterBar change immediately rebuilds `audit.list` input and resets page.

**Impact:**
- `actor` / `action` / `entity` are **exact** matches on the API (`audit/router.ts` equality, not `contains`). Mid-typing yields empty flashes and N queries per field.
- Super-admin audit table is unbounded platform data — live multi-field filter without debounce is production-noisy.
- Test was rewritten to lock the live behavior (`audit-log.test.tsx` “live via FilterBar”), so CI will not catch this as regression.

**Fix (pick one):**
1. Debounce text keys (~300ms) like pipeline/parents; apply dates immediately; or  
2. Restore apply/commit UX if ops prefer intentional filter commits.

ICT day bounds (`toCreatedFromIso` / `toCreatedToIso`) are a **good** fix vs old `new Date(dateText)` (UTC midnight, non-inclusive end). Keep that mapping.

---

### M3 — Parents: FilterBar is tab-body-local, not ControlBar `filters=`
**File:** `apps/admin/src/pages/parents/index.tsx`  
**Evidence:** `ListPage` has no `filters` prop. Both `LinkRequestsTab` and `AllParentsTab` render `<FilterBar>` above `DataTable` inside tab content.

**G1 rules violated:**
- VIEW-GRAMMAR §3: “Do not put FilterBar outside ListPage when using ListPage” / filters live under ControlBar.
- Playbook one-liner: search mounts in `ListPage` → `ControlBar.filters`.
- Anti-pattern: page-local filter chrome outside the sticky band → filters scroll away with body.

**Impact:** Dual tab-local filters are understandable (different FilterDefs per tab) but this cook did **not** complete G1 for parents — only swapped Selector/TextInput for FilterBar in place.

**Fix options:**
1. Preferred: `filters={activeTab === 'requests' ? <FilterBar …/> : <FilterBar …/>}` on parent `ListPage`, lift state or pass callbacks; keep tab content as table only.  
2. Document as explicit multi-tab exception in VIEW-GRAMMAR if product accepts non-sticky tab filters (still weaker than (1)).

Debounce + page reset on AllParentsTab remain correct (`useEffect` on `[debouncedSearch, emailFilter]`).

---

### M4 — Gifts: `value: 'all'` option duplicates clear semantics
**File:** `apps/admin/src/pages/engagement/gifts.tsx` (`GIFT_FILTERS`)  
**Playbook anti-pattern:** “Duplicate ‘Tất cả’ option + empty clear — Options = real values only; clear/empty = all.”

Current:
```ts
options: [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hiện' },
],
placeholder: 'Tất cả',
// onChange: next.active || 'all'
```

**Impact:** Two “all” paths; `hasClear` and option “Tất cả” fight for the same meaning. Works, but trains staff inconsistently vs aftersale/rewards.

**Fix:** options = `[{ value: 'active', label: 'Đang hiện' }]` only; empty/`''` → `includeInactive: true`; default `active: ''`.

---

## Medium Priority (MINOR)

### m1 — Pipeline / parents: search UX regression (clear + icon)
FilterBar text controls have no `hasClear` / search icon. Pipeline previously had both; parents AllParents search had both. Function preserved; discoverability of clear is weaker. Fix belongs in shared FilterBar (or optional FilterDef flag), not per page.

### m2 — Pipeline lost label shortened
`Hiển thị cơ hội đã mất` → `Hiển thị`. Tests updated. Acceptable density tradeoff; slightly less self-explanatory.

### m3 — Parents email option copy shortened
`Chưa có email (bị khoá LMS)` → `Chưa có email`. Warning still appears in table badge; filter option loses the lock hint.

### m4 — Audit FilterBar density (5 controls)
Playbook caps routine chrome at ~1–2 fields; audit has 3 text + 2 dates. Acceptable for a rare super-admin tool, but ControlBar is crowded. Future chips/collapsible range would help; not a functional bug.

### m5 — KPI / pipeline / parents: select clear snaps to ops default, not “all”
| Page | Clear result |
|------|----------------|
| KPI status | `''` → omit status (true “all”) — playbook-correct |
| KPI period | empty → `defaultPeriodICT()` — correct required field |
| Pipeline lost | `''` → `exclude` |
| Parents link status | `''` → `pending` |
| Parents email | `''` → `missing` |

Queue defaults (`pending` / `missing` / `exclude`) are product-correct; `hasClear` then acts as “reset default,” not “show all.” Prefer `hasClear={false}` on required-default selects if FilterBar gains that, or omit clear via component change — otherwise staff may think clear means “all statuses/emails.”

### m6 — Audit double ISO conversion
```ts
...(toCreatedFromIso(filters.createdFrom)
  ? { createdFrom: toCreatedFromIso(filters.createdFrom) }
  : {}),
```
Calls helper twice per render. Cache locals. NIT-adjacent MINOR.

### m7 — Gifts filter untested
`gifts.test.tsx` has no coverage for FilterBar / `includeInactive` mapping. Phantom risk if someone inverts the boolean.

---

## Low Priority (NIT)

### n1 — Dead import hygiene
Pipeline/kpi/audit/parents cleaned `Selector` / `TextInput` / `LineIcon` appropriately. No dead imports spotted on these five files.

### n2 — Audit `EMPTY_FILTERS` spread
`setFilters({ ...EMPTY_FILTERS, ...next })` is defensive; fine.

### n3 — Pipeline stage still URL-only
`?stage=` not in FilterBar. Pre-existing; out of cook scope. Do not fold into FilterBar without product decision (orthogonal to lost/q).

---

## Page-by-page checklist

### `crm/pipeline.tsx` — **PASS** (with MINOR UX)

| Check | Result |
|-------|--------|
| Filter state | Controlled `{ q, lost }`; invalid lost → `exclude` |
| Debounce | 300ms on `filterValues.q` — preserved |
| Defaults | `q: ''`, `lost: 'exclude'` — preserved |
| Query mapping | `search` only if debounced non-empty; `lost` always |
| Page reset | `useEffect` on `[debouncedSearch, lostFilter, stageFilter]` — preserved |
| Selection | N/A |
| G1 placement | FilterBar in `filters=`; search moved out of header actions — **corrects** playbook scout note on pipeline hybrid |
| Accidental change | Label shorten; lost search icon/clear — MINOR |

Optimistic advance still keys off shared `listInput` — OK.

---

### `hr/kpi.tsx` — **PASS**

| Check | Result |
|-------|--------|
| Filter state | `{ status: 'submitted', period: defaultPeriodICT() }` |
| Debounce | N/A for select; period text same as before (no debounce) |
| Defaults | Inbox default `submitted` + current ICT month — preserved |
| Query mapping | `period` always when valid; status omitted when cleared |
| Period gate | `enabled: PERIOD_PATTERN.test(period)` — preserved; tests still drive `getByLabelText('Kỳ (YYYY-MM)')` |
| Page reset | No pagination — N/A |
| G1 | Filters leave header; primary CTA alone in actions — compliant |
| Accidental change | Clear status now reachable via FilterBar `hasClear` → all statuses (expansion, OK) |

---

### `parents/index.tsx` — **FAIL** (M3)

| Check | Result |
|-------|--------|
| Link tab state | `filterStatus` default `pending`; clear → `pending` |
| All tab state | `searchTerm` + 300ms debounce; `emailFilter` default `missing` |
| Query mapping | Link: `status` as-is. All: `search` if debounced; `missingEmailOnly: emailFilter === 'missing'` |
| Page reset | All tab `useEffect` on debounce/email — correct pattern (reset after debounce, not every keystroke) |
| Dual filters | Two FilterBars, tab-scoped — correct product split, **wrong chrome host** |
| G1 | **Body-local, not ControlBar** |
| Dead imports | `LineIcon` removed with search icon — OK |

---

### `admin/audit-log.tsx` — **FAIL** (M2)

| Check | Result |
|-------|--------|
| Filter state | Single controlled `filters` record (no draft/applied split) |
| Debounce | **None** on text |
| Defaults | All empty — same empty query as before |
| Date mapping | Inclusive ICT start/end ISO — **improved** correctness |
| Page reset | `setPage(1)` on every `onChange` — correct for live mode |
| G1 | FilterBar in `filters=`; pager in `controlFooter` via `ListPagination` — compliant layout |
| Auth gate | `canDo('audit','list')` EmptyState unchanged |

---

### `engagement/gifts.tsx` — **FAIL** (M1, M4)

| Check | Result |
|-------|--------|
| Default | `active: 'all'` → `includeInactive: true` — **preserves** pre-cook always-true query |
| Mapping | `includeInactive = filterValues.active !== 'active'` — correct |
| Page reset | `setPage(1)` on change — yes |
| Selection clear | **No** — M1 |
| G1 | FilterBar in `filters=`; BulkActionBar stays in footer — layout OK |
| Grammar | Explicit `all` option — M4 |

---

## Edge cases from scout

1. **Orphan gift selection after filter** — M1.  
2. **Audit exact-match mid-type empty results** — M2.  
3. **Parents filters scroll out of sticky ControlBar** — M3.  
4. **Clear on required-default selects ≠ “all”** — m5.  
5. **KPI partial period disables query** — intentional; still works with FilterBar text.  
6. **Gifts client page slice** after filter: `allRows` from server, then `slice` — page reset avoids empty page; selection not reset.  
7. **Pipeline lost clear** snaps to `exclude` while Selector briefly could show empty if parent failed to normalize — parent normalizes in same `onChange`; OK.

---

## Positive observations (risk calibration only)

- Pipeline finally matches G1 dual-field recipe (text + select in ControlBar) instead of header search + custom lost row.  
- KPI primary action no longer crowded by filter widgets in `PageHeader.actions`.  
- Audit date range now ICT-correct and covered by unit test.  
- Gifts default deliberately keeps previous “include inactive” inventory view.  
- Parents AllParents debounce + page-reset effect is the right controlled-search pattern.

---

## Recommended actions (priority)

1. **M1** — Clear `selectedIds` on gifts filter change (one-liner).  
2. **M2** — Debounce audit text filters (or restore apply); keep ICT date helpers.  
3. **M3** — Lift parents FilterBars into `ListPage.filters` switched by `activeTab`.  
4. **M4** — Drop gifts `all` option; empty = include inactive.  
5. **m7** — Add gifts filter mapping test (`includeInactive` true/false).  
6. **m1** — Follow-up in UI package: optional clear on FilterBar text (not blocking pages).

---

## Metrics (lane-local)

| Metric | Value |
|--------|--------|
| Pages reviewed | 5 |
| BLOCKER | 0 |
| MAJOR | 4 (M1–M4) |
| MINOR | 7 |
| NIT | 3 |
| G1 ControlBar host OK | 4/5 (parents fail) |
| Debounce correct where free-text search hits API | pipeline ✅, parents All ✅, audit ❌, kpi period N/A (gate) |
| Page reset on filter | gifts/audit/pipeline/parents All ✅; kpi N/A |
| Selection hygiene | gifts ❌ |

---

## Unresolved questions

1. Was audit **live** filtering an explicit product choice (test rewritten) or an accidental drop of draft/apply during FilterBar migration? If intentional, still need debounce for exact-match fields.  
2. For multi-tab ListPages, is body-local FilterBar an accepted exception, or must all filters promote to ControlBar (playbook currently implies the latter)?  
3. Should queue defaults (`pending` / `missing`) expose `hasClear` at all?

---

## Lane verdict

| Page | Verdict |
|------|---------|
| pipeline | PASS |
| kpi | PASS |
| parents | FAIL (M3) |
| audit-log | FAIL (M2) |
| gifts | FAIL (M1, M4) |

**Status: FAIL** — fix M1–M3 before treating this wave as production-ready FilterBar migration; M4 with M1.

```text
Status: DONE_WITH_CONCERNS
Summary: R2 reviewed five admin FilterBar migrations; pipeline/kpi look solid; gifts selection, audit live exact-match spam, and parents body-local filters fail production-readiness.
Concerns: 0 BLOCKER, 4 MAJOR — overall lane FAIL until M1–M3 addressed.
```
