# R5 — Accessibility & UX grammar

**Lane:** A11y / UX (DateField · FilterBar · Search OS)  
**Scope:** `048b65b` + `939b92f` (`origin/develop..HEAD`)  
**Date:** 2026-08-06  
**Authority:** `design-system/cmc-edu/{VIEW-GRAMMAR,A11Y-BASELINE,ODOO-COMPONENT-MAP}.md` · G1 playbook  
**Status: FAIL**

No WCAG BLOCKER that makes filters unusable with keyboard/SR, but the cook does **not** earn a clean PASS against Search OS grammar + ops UX. Multiple MAJORs (parents slot, audit live multi-field spam, select-clear vs default-domain, pipeline search chrome regression) need fix or explicit product accept before claiming G1 complete.

---

## Scope reviewed

| Surface | Path | Role in cook |
|---------|------|--------------|
| DateField | `packages/ui/src/components/date-field.tsx` + CSS | New composite |
| FilterBar | `packages/ui/src/components/filter-bar.tsx` | date branch + existing search landmark |
| Pipeline | `apps/admin/src/pages/crm/pipeline.tsx` | Search moved header → filters |
| KPI | `apps/admin/src/pages/hr/kpi.tsx` | period as text, not date |
| Audit | `apps/admin/src/pages/admin/audit-log.tsx` | draft+Apply → live FilterBar |
| Parents | `apps/admin/src/pages/parents/index.tsx` | FilterBar inside tabs |
| Gifts | `apps/admin/src/pages/engagement/gifts.tsx` | select FilterBar |
| Grammar | VIEW-GRAMMAR §3 / §3.1 · A11Y-BASELINE path 2 · G1 playbook | Acceptance bar |

**Not run:** human keyboard pass (A11Y-BASELINE stays **partial**). Role smoke substrings still present in FilterBar source (`role="search"`, `aria-label="Bộ lọc"`).

---

## Overall assessment

| Area | Verdict |
|------|---------|
| DateField labels / focus | Usable; polish issues (dual name, no clear/min/max) |
| FilterBar landmark | Matches A11Y-BASELINE inventory |
| Search OS slot adoption | Pipeline / KPI / audit / gifts improved host; **parents still wrong host** |
| Ops UX deltas | Pipeline search demoted from header affordance; audit Apply removed without debounce |
| Facet / chip parity | Still parked (honest) — multi-active filters silent |

---

## Findings

### BLOCKER

_None._ Controls are labeled; FilterBar remains a search landmark; native `type="date"` is keyboard-reachable with a visible focus ring.

---

### MAJOR

#### M1 — Parents: FilterBar outside `ListPage` `filters` slot (grammar break)

**Evidence:** `apps/admin/src/pages/parents/index.tsx` mounts `ListPage` **without** `filters=`. Each tab body renders its own `<FilterBar>`:

```234:242:apps/admin/src/pages/parents/index.tsx
  return (
    <>
      <FilterBar
        filters={LINK_STATUS_FILTERS}
        value={{ status: filterStatus }}
        onChange={(next) =>
          setFilterStatus((next.status as FilterStatus) || 'pending')
        }
      />
```

```517:527:apps/admin/src/pages/parents/index.tsx
      <ListPage
        density="ops"
        header={
          <PageHeader
            title="Phụ huynh"
            breadcrumbs={[{ label: 'Quản trị' }, { label: 'Phụ huynh' }]}
          />
        }
      >
```

**Violates:**

- VIEW-GRAMMAR §3: *“Do not put FilterBar outside ListPage when using ListPage.”*
- §3.1 rule 1: *one search chrome per ListPage — no page-local filter cards outside ControlBar.*
- G1 playbook anti-pattern: *Filter card / Panel outside ListPage.*

**UX impact:** Filters sit in tab body under sunken standalone chrome (`.o_web_client .o-filter-bar` keeps border), not flat CP band. Sticky ControlBar densify does not apply. Tab switch loses shared filter chrome; pager on “Tất cả phụ huynh” is custom buttons, not `ListPagination` in `controlFooter`.

**Fix direction:** Lift per-tab filter defs into `ListPage.filters` keyed by `activeTab`, or split into two routes/ListPages. Do not leave FilterBar as body content.

---

#### M2 — Audit: 5 live fields, no debounce, no Apply (ops + Search OS)

**Before:** draft state + primary **“Lọc”** apply.  
**After:** every keystroke/date change hits `audit.list` immediately.

```102:110:apps/admin/src/pages/admin/audit-log.tsx
        <FilterBar
          filters={AUDIT_FILTERS}
          value={filters}
          onChange={(next) => {
            setFilters({ ...EMPTY_FILTERS, ...next });
            setPage(1);
          }}
        />
```

**Issues:**

1. **Five** controls (3 text + 2 date) exceed G1 *“1–2 fields” / cap ~2* and VIEW-GRAMMAR “active multi-conditions should be chips” (chips parked, so row overload is the real cost).
2. Text fields are **not** debounced (pipeline `q` is 300ms). Intermediate strings (`facil`, `user.up`) spam queries and flash empty tables.
3. Removing Apply without a substitute (debounce or explicit submit) is a **discoverability/control** regression for a forensic super-admin tool: staff previously staged a multi-field query.

**Fix direction (pick one product policy):**

- Debounce text ≥300ms; dates can stay live; **or**
- Keep live FilterBar but add optional “Áp dụng” only when ≥3 fields (heavier); **or**
- Collapse actor/action/entity into one `q` text + date range (2–3 fields).

---

#### M3 — Pipeline: select `hasClear` vs default domain; search chrome regression

**Clear ≠ “all”.** FilterBar always sets `hasClear` on selects. Pipeline maps empty → `exclude`:

```436:441:apps/admin/src/pages/crm/pipeline.tsx
            onChange={(next) =>
              setFilterValues({
                q: next.q ?? '',
                lost: next.lost || 'exclude',
              })
            }
```

Options already include `{ value: 'include', label: 'Tất cả' }`. Placeholder is `'Đang chăm sóc'`, not `'Tất cả'`. G1 says: *empty clear = all; omit duplicate “Tất cả” option.* Here clear resets to **default domain** (exclude lost), which is intentional product-wise but **mis-teaches** the global clear affordance.

**Search move (header → filters):** Grammar win (closes playbook “pipeline hybrid” debt). Ops tradeoffs:

| Before (header) | After (FilterBar) |
|-----------------|-------------------|
| `isLabelHidden` + search icon + `hasClear` | Visible label; **no** `hasClear` on text; **no** startIcon |
| Beside primary CTA | In denser CP filter row with lost select |

**Impact:** Harder to one-click clear search; weaker visual “this is search”; better SR (visible label) and correct OS slot. Acceptable if text clear is added to FilterBar text branch.

**Fix:** FilterBar `text` → pass `hasClear` (and optional search icon prop); pipeline lost: either `hasClear={false}` (needs FilterDef flag) or map clear → `include` and drop option labeled “Tất cả”.

---

#### M4 — Date range: no cross-field validation / clear path

`DateField` has no `min`/`max`/`required` props. Audit `createdFrom` / `createdTo` can be inverted; API may return empty with no inline error. Native date clear is browser-dependent (Chrome shows ×; some WebKit builds do not). FilterBar has no “clear all”.

**Impact:** Staff can construct impossible ranges with silent empty results — worse after live apply (M2).

**Fix:** Page-level check `from <= to` + Banner; optional `min`/`max` on DateField wired from sibling values; consider clear-on-empty for controlled dates (already empty string).

---

#### M5 — Gifts: duplicate “Tất cả” option + clear (playbook anti-pattern)

```25:35:apps/admin/src/pages/engagement/gifts.tsx
const GIFT_FILTERS: FilterDef[] = [
  {
    key: 'active',
    label: 'Trạng thái',
    type: 'select',
    options: [
      { value: 'all', label: 'Tất cả' },
      { value: 'active', label: 'Đang hiện' },
    ],
    placeholder: 'Tất cả',
  },
];
```

`onChange` forces `next.active || 'all'`. Same dual-path as playbook anti-pattern *“Duplicate Tất cả option + empty clear”*. Prefer options = real values only (`active` / optional `inactive`), empty + placeholder = all.

---

### MINOR

#### m1 — DateField dual accessible name

```39:46:packages/ui/src/components/date-field.tsx
      <span className={isLabelHidden ? 'o-date-field-label o-sr-only' : 'o-date-field-label'}>
        {label}
      </span>
      <input
        id={inputId}
        type="date"
        className="o-date-field-input"
        aria-label={label}
```

`<label htmlFor>` **and** `aria-label` on the same control. When the label is visible, `aria-label` is redundant and can double-announce in some AT. Prefer: visible/sr-only label only; use `aria-label` only when there is no label association (or drop `aria-label` always and keep sr-only span).

#### m2 — DateField id from label text

`id = date-field-${label…}` — duplicate labels on one page collide; Vietnamese punctuation is fine but unstable. Prefer `useId()` or required `id` from FilterBar key (`date-field-${f.key}`).

#### m3 — Focus ring OK; no `:focus-visible` distinction

`.o-date-field-input:focus { outline: 2px solid var(--cmc-accent); outline-offset: 1px; }` meets baseline. Mouse click also shows ring (not wrong; optional `:focus-visible` later).

#### m4 — Native `type="date"` quirks (accepted lite)

- UI locale vs value `YYYY-MM-DD` — OK for ICT day bounds (audit tests cover mapping).
- No `type="month"` — KPI correctly uses **text** for `YYYY-MM` (see Positive).
- Picker UI differs by browser; no calendar library (design choice, documented).
- `isLabelHidden` exists but FilterBar never uses it — good (visible filter labels).

#### m5 — KPI period text: weak invalid feedback

Period as `type: 'text'` is correct (day DateField cannot express month period). `enabled: isPeriodValid` avoids bad Zod trips, but invalid partial input (`2026-0`) yields a quiet empty table with no `aria-invalid` / helper (“Kỳ phải dạng YYYY-MM”). Bulk CTA still shows whatever string is in state.

#### m6 — Audit live filter: no status announcement

Result count changes without `aria-live` region. Acceptable for lite baseline; note for future SearchChrome.

#### m7 — FilterBar tests thin on a11y contract

`filter-bar.test.tsx` covers date wiring only — not `role="search"`, select clear, or multi-field. Role smoke script still guards substrings in source.

#### m8 — Fixed widths 160/180

Long Vietnamese placeholders may clip inside Astryx controls; labels wrap above so not critical.

---

### NIT

- DateField uppercase 11px label matches Soft Ops meta; slightly different from Astryx TextInput label density — visual grammar drift only.
- Pipeline debounce kept — good; document as FilterBar text recommendation in G1.
- `aria-label="Bộ lọc"` is Vietnamese-only (product is vi-first — OK).

---

## Call-site UX summary

| Page | Change | A11y | Search OS | Ops UX |
|------|--------|------|-----------|--------|
| **Pipeline** | Header search + raw Selector → FilterBar | Better visible labels | **Aligned** (was hybrid) | Lost search icon/clear; clear-on-lost = exclude |
| **KPI** | Ad-hoc period TextInput → FilterBar text + status | Labels OK | Aligned in slot | Period-as-text correct; weak invalid state |
| **Audit** | Body draft form + Lọc → FilterBar in filters + ListPagination | Landmark OK; dates real | Slot OK; **5 fields** over cap | Live spam; Apply removed |
| **Parents** | Ad-hoc inputs → FilterBar **in tabs** | Controls labeled | **FAIL grammar** | Nested card chrome; tab-local filters |
| **Gifts** | → FilterBar select | OK | Slot OK | Duplicate “Tất cả” + clear |

---

## Consistency vs VIEW-GRAMMAR Search OS

| Rule (§3.1) | Cook result |
|-------------|-------------|
| 1. One search chrome in ControlBar | Pipeline/KPI/audit/gifts **yes**; parents **no** |
| 2. Multi-active → chips | Still absent (parked) — audit 5-field is the pain |
| 3–5. Presets / Group By / Favorites | Not claimed — OK |
| 6. Selection vs search | Gifts bulk footer unchanged — OK |
| 7. No domain DSL | OK |

G1 playbook scout note that pipeline was a hybrid is **addressed**. Parents remains the highest grammar debt in this wave.

---

## Edge cases (scout)

1. Inverted audit date range → empty, no message.  
2. FilterBar select clear with page `|| default` → clear appears broken or resets domain.  
3. KPI period clear → `defaultPeriodICT()` (cannot empty) — OK; typing invalid → silent pause.  
4. Two DateFields same label → id collision (not current).  
5. Parents: two FilterBars exist in code paths; only one tab content mounted at a time (likely single landmark) — still wrong host.  
6. Uncontrolled FilterBar URL mode not used by these controlled pages — deep-link of filters still absent (pipeline/audit/kpi) — product gap, not a11y-only.

---

## Positive observations (risk calibration only)

- FilterBar keeps `role="search"` + `aria-label="Bộ lọc"` (A11Y-BASELINE path 2 / role smoke).
- DateField always exposes an accessible name; FilterBar uses **visible** date labels (not sr-only).
- Focus ring on `.o-date-field-input` is explicit (accent outline).
- Audit date mapping to inclusive ICT bounds is correct and tested (UX honesty for timezone).
- KPI period as **text** not `type=date` is the right control for `YYYY-MM`.
- Pipeline debounce preserved after move.
- Audit gained `ListPagination` landmark vs ad-hoc pager.

---

## Recommended actions (priority)

1. **Parents:** move FilterBar into `ListPage.filters` (or split routes) — M1.  
2. **Audit:** debounce text filters and/or reduce to ≤3 fields; consider range validation Banner — M2, M4.  
3. **FilterBar:** optional `hasClear` on text; optional `clearResetsTo` / `hasClear` on select FilterDef; pass `id={f.key}` into DateField — M3, m2.  
4. **DateField:** drop redundant `aria-label` when labeled; add optional `min`/`max` — m1, M4.  
5. **Gifts / pipeline:** align select empty semantics with G1 (empty = all **or** disable clear for default-domain filters) — M3, M5.  
6. **KPI:** `aria-invalid` + helper when `!isPeriodValid` — m5.  
7. Log a human keyboard pass for A11Y path 2 on pipeline + audit after fixes (baseline stays partial until then).

---

## Metrics (lane)

| Metric | Value |
|--------|-------|
| BLOCKER | 0 |
| MAJOR | 5 (M1–M5) |
| MINOR | 8 |
| NIT | 3 |
| Role smoke FilterBar | Still green (substring presence) |
| Human keyboard pass | **Not done** — baseline partial |
| Lane status | **FAIL** |

---

## Unresolved questions

1. Product: should default-domain filters (pipeline lost=exclude, parents email=missing) **forbid** select clear, or should clear mean “all”?  
2. Product: audit forensic UX — live filters OK if debounced, or restore explicit apply for multi-field?  
3. Parents multi-tab: one ListPage with tab-dependent filters vs two ListPages — needs UX choice before cook.

---

## Lane result

```text
Status: FAIL
Summary: DateField/FilterBar are basically operable and landmark-correct, but parents FilterBar placement, audit live 5-field UX, and select-clear/default-domain inconsistencies fail Search OS + ops UX bar for this wave.
Concerns: No human keyboard pass; chips still parked (honest). Ship only if M1–M3 accepted as known debt with follow-up cook.
```
