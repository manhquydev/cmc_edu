# R7 — Docs / plans accuracy vs shipped code

**Lane:** R7 (docs accuracy)  
**Date:** 2026-08-06  
**Mode:** Read-only  
**Baseline commits:** `048b65b` (docs wave) + `939b92f` (DateField + FilterBar cook)  
**Scope artifacts:** evergreen design-system + G1/G2 wave reports + Search OS brainstorm

---

## Verdict

| Field | Value |
|-------|--------|
| **Status** | **FAIL** |
| **Why** | Evergreen `ODOO-COMPONENT-MAP.md` still states **FilterBar 7/23** and **G2 top gap = date/datetime** after `939b92f` shipped DateField and expanded FilterBar to **12/23**. Wave plan reports remain historical snapshots without a post-cook refresh note. |
| **Block merge of docs claims as current truth?** | Yes for evergreen map numbers. Plan reports may stay as dated research **if** clearly snapshot-dated and not treated as live inventory. |

---

## Evidence method

| Check | Result |
|-------|--------|
| `packages/ui` DateField | `packages/ui/src/components/date-field.tsx` exported from `index.ts`; CSS `.o-date-field*`; tests present |
| FilterBar `type: 'date'` | `filter-bar.tsx` renders `DateField` for `type === 'date'` |
| Admin FilterBar consumers (non-test) | **12 files** import+render FilterBar (see census) |
| ListPage denominator | **23** files still render `<ListPage` (unchanged vs audit) |
| DateField form adoption | **0** admin FormPage/DetailPage imports of `DateField`; only `audit-log` uses `type: 'date'` via FilterBar |

### Live FilterBar census (post-`939b92f`)

| # | Page | Pre-cook (audit) | Post-cook |
|---|------|------------------|-----------|
| 1 | `crm/aftersale.tsx` | ✓ | ✓ |
| 2 | `crm/post-sale-meeting.tsx` | ✓ | ✓ |
| 3 | `finance/receipt-list.tsx` | ✓ | ✓ |
| 4 | `finance/reconciliation.tsx` | ✓ | ✓ |
| 5 | `engagement/rewards.tsx` | ✓ | ✓ |
| 6 | `teaching/schedule.tsx` | ✓ | ✓ |
| 7 | `students/index.tsx` | ✓ | ✓ |
| 8 | `admin/audit-log.tsx` | inline body filters | **FilterBar** (`filters=`; 5 defs incl. 2× date) |
| 9 | `crm/pipeline.tsx` | custom `filters=` | **FilterBar** |
| 10 | `engagement/gifts.tsx` | none | **FilterBar** |
| 11 | `hr/kpi.tsx` | period in header | **FilterBar** |
| 12 | `parents/index.tsx` | none | **FilterBar** (tab body, **not** `ListPage.filters=`) |

**Rate:** **12 / 23 = 52.2%** (was **7 / 23 = 30.4%**).  
Same methodology as audit: non-test page TSX that import+render `FilterBar`.

---

## Claim matrix

Severity: **BLOCKER** | **MAJOR** | **MINOR** | **NIT**

### Evergreen — `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`

| Claim (location) | Shipped reality | Severity | Notes |
|------------------|-----------------|----------|-------|
| date / datetime → `DateField` **SHIPPED** (date only; datetime later) — form fields table | **True** for package primitive | — | Accurate post-cook. Date only; no datetime widget. |
| Coverage: FilterBar **7/23** lists (30.4%) — § Form fields / audit blurb L130 | **False as current** → **12/23 (52.2%)** | **MAJOR** | Evergreen still quotes pre-cook audit. Misleading for agents using map as authority. |
| Last status refresh L189: FilterBar 7/23; **G2 top gap = date/datetime** | **Stale** | **MAJOR** | DateField shipped; datetime still open; form-page DateField adoption still 0. Refresh must distinguish primitive vs form adoption. |
| Search OS: chips / Group By / Favorites **MISSING**; mega-menu cook **parked** | **True** | — | No SearchChrome / facets / favorites code. Matches brainstorm C. |
| Free-text / select FilterBar **PARTIAL** | **True** | — | Still lite Search OS. |
| Form sheet / statusbar / char-selection **SHIPPED** | **True** (unchanged) | — | Not re-audited in depth; no contradicting cook. |

### Evergreen — `design-system/cmc-edu/VIEW-GRAMMAR.md` §3.1

| Claim | Shipped reality | Severity | Notes |
|-------|-----------------|----------|-------|
| One search chrome per ListPage via FilterBar; chips/presets/groupBy/favorites are parity targets | **Still correct grammar** | — | Rules, not census. |
| Points to G1 playbook as apply authority | File exists | — | Playbook content partially stale (below). |
| No hard FilterBar count or DateField MISSING | N/A | — | **No numeric staleness** in §3.1. |

**§3.1 status:** **PASS** as interaction grammar. Does not need count rewrite for this cook.

### Plan report — `g1-search-application-playbook.md`

| Claim | Shipped reality | Severity | Notes |
|-------|-----------------|----------|-------|
| Chips / preset menu / Group By / Favorites **parked** | **True** | — | SearchChrome not cooked. |
| Archetypes A–C + URL contract + FilterDef shape | **Still match** `filter-bar.tsx` | — | `type: 'text' \| 'select' \| 'date'` correct. |
| Adoption scout: **Pipeline = Hybrid (non-FilterBar)** | **False** post-cook | **MAJOR** | `pipeline.tsx` now controlled FilterBar (`q` + `lost`). Scout table + §5 hybrid warning outdated. |
| “No admin list currently defines ≥3 named presets” | **Still true** (presets ≠ fields) | **MINOR** | `audit-log` now has **5 FilterDefs** (3 text + 2 date), which violates playbook “cap ~2 controls” without documenting exception / cook trigger. |
| Cap ≤2 controls unless cook trigger | **Violated by audit-log** | **MINOR** | Not a doc falsehood about Odoo; docs incomplete vs shipped dense filter row. |
| parents / gifts / kpi / audit not in adoption table | Incomplete after cook | **MINOR** | Snapshot dated 2026-08-06 but no post-cook amendment. |

### Plan report — `g2-form-fields-inventory-map.md`

| Claim | Shipped reality | Severity | Notes |
|-------|-----------------|----------|-------|
| `datetime / date / daterange` → TextInput + regex \| **MISSING** (§4) | **Stale for `date`** | **MAJOR** | `DateField` exists + FilterBar integration. **datetime** still MISSING. Form pages still free-text / `datetime-local` ad hoc. |
| Top gap #1: **No date/datetime field** (§5) | **Partially closed** | **MAJOR** | Primitive closed; form adoption + datetime still open. Ranking should demote pure “no DateField” claim. |
| S1 cook: DateField recommended, not implemented | **S1 date half done** | **MINOR** | Report is research-mode; needs “superseded by 939b92f” banner if kept as inventory. |
| Form usage: “Date/time: free text + regex” (§3.2 summary) | **Mostly still true on forms** | **NIT** | Accurate for FormPage consumers; only FilterBar date path uses DateField. |

### Plan report — `admin-grammar-coverage-audit.md` + `wave-synthesis.md`

| Claim | Shipped reality | Severity | Notes |
|-------|-----------------|----------|-------|
| FilterBar **7/23 = 30.4%** (headline + implications) | **12/23 = 52.2%** | **MAJOR** as *current* truth | Acceptable **historical snapshot** if labeled “as of pre-939b92f research”. Evergreen must not re-export without date. |
| Secondary outliers: audit-log / kpi / pipeline lack FilterBar | **Fixed for those three** | **MAJOR** (if read as live gap list) | gifts + parents also gained FilterBar. |
| Frame **40/55**, routed **40/44** | **Likely still true** (no frame cook in 939b92f) | — | Not re-counted file-by-file; no frame-related files in cook diff. |
| wave-synthesis rank 1: raise FilterBar on 16/23 | Partially done (5 added) | **MINOR** | Rank 2 DateField cook **done** for package; synthesis still “optional cook”. |
| wave-synthesis rank 3: do **not** cook SearchChrome | **Still correct** | — | Parked decision holds. |

### Plan report — `plans/reports/brainstorm-260806-odoo-search-os-next-step.md`

| Claim | Shipped reality | Severity | Notes |
|-------|-----------------|----------|-------|
| Decision **C**: do **not** open Search OS cook (SearchChrome / facets / mega-menu) | **Honored** | — | No SearchChrome implementation. |
| Re-open only on ≥3 presets / UAT / product parity / groupBy API | SearchChrome still parked | — | FilterBar **adoption** cook is orthogonal and was done without violating C. |
| Zero SearchChrome / facet / favorite primitives | **True** | — | |
| FilterBar only text \| select \| date ~110 LOC | **Still roughly true** | **NIT** | Now wires DateField component; LOC slightly higher. |
| Workspace dirt / commit research docs | Historical session note | — | Not a live product claim. |

---

## Cook parked vs cooked (decision integrity)

| Item | Brainstorm / playbook stance | After `939b92f` | Accurate? |
|------|------------------------------|-----------------|-----------|
| SearchChrome / facet chips / Filters·GroupBy·Favorites mega-menu | **Parked** | **Still parked** | Yes |
| FilterBar as-is on ListPages | Apply playbook; optional adoption | **Cooked** on +5 lists | Docs understate progress |
| DateField (G2 S1 date) | Optional next cook | **Cooked** (package + FilterBar date + audit-log) | Evergreen map updated for SHIPPED; inventory report not |
| DateTimeField / form DateField rollout | Later | **Not cooked** | Yes |
| Chips / clear-all (option B) | First re-open step | **Not cooked** | Yes |

**Conclusion:** Park decision for **Search OS mega-menu** remains valid. Calling the whole “Search / fields wave still research-only” is **false** after DateField + FilterBar expansion.

---

## Stale-doc punch list (fix targets)

| Priority | File | Fix |
|----------|------|-----|
| P0 evergreen | `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` L130, L189 | FilterBar **12/23 (52.2%)**; refresh date; G2 top remaining gaps = **datetime**, form DateField adoption, m2o async, monetary, boolean, binary — not “no date field” |
| P1 plan snapshot | `…/reports/admin-grammar-coverage-audit.md` | Banner: metrics as-of pre-`939b92f`; or re-run census table (FilterBar column for audit/kpi/pipeline/gifts/parents) |
| P1 plan snapshot | `…/reports/wave-synthesis.md` | Same banner; mark rank-1 partial + rank-2 DateField package **done** |
| P1 plan snapshot | `…/reports/g2-form-fields-inventory-map.md` | §4 date row → **SHIPPED** (date) / **MISSING** (datetime); demote gap #1; note S1 partial |
| P1 plan snapshot | `…/reports/g1-search-application-playbook.md` | Pipeline → archetype C (or B+text); add audit-log / gifts / kpi / parents; note audit-log 5-control exception |
| P2 | Brainstorm | Optional one-line “post-note: DateField+FilterBar adoption cooked; SearchChrome still parked” — not required for decision validity |
| — | `VIEW-GRAMMAR.md` §3.1 | **No change required** for counts |

---

## Severity rollup

| Severity | Count | Drivers |
|----------|------:|---------|
| BLOCKER | 0 | No security/auth false claim; no broken link to non-existent playbook |
| MAJOR | 5 | Evergreen FilterBar 7/23; evergreen G2 top-gap date; g2 inventory date MISSING; g1 pipeline hybrid; audit/wave 7/23 as live truth |
| MINOR | 4 | Playbook adoption table incomplete; audit-log 5-control vs ≤2 rule; wave ranks not updated; g2 S1 “future” wording |
| NIT | 2 | Form free-text date summary still mostly true; FilterBar LOC note |

---

## What is still accurate (do not thrash)

1. **SearchChrome / facets / Group By / Favorites = MISSING / parked** — confirmed zero platform chrome beyond FilterBar.  
2. **VIEW-GRAMMAR §3.1 rules** — one ControlBar search slot, no DomainSelector, chips as future.  
3. **Frame coverage ~40/55 / ~40/44** — cook did not add frames; prior audit still plausible.  
4. **Brainstorm C** for mega-menu — not violated by DateField or FilterBar adoption.  
5. **DateField SHIPPED (date only)** in ODOO-COMPONENT-MAP form-fields table — correct.

---

## Recommended actions (docs only; this lane does not edit)

1. **Refresh evergreen map numbers** in the same PR that claims design3 Search/fields status — treat FilterBar **12/23** and DateField **SHIPPED** as single source of truth.  
2. **Stamp wave reports** as research snapshot `2026-08-06 pre-939b92f` **or** append a short post-cook delta section (preferred for g1/g2 inventories used by agents).  
3. **Do not** mark Search OS “fully shipped” — chips/presets still parked; FilterBar lite remains the real OS.  
4. **Clarify G2 gap #1:** “datetime + form-page DateField adoption” not “no DateField component”.  
5. Optional follow-up product note: `parents` FilterBar lives in tab bodies (not `ListPage.filters=`) — grammar-lite; `audit-log` 5 controls exceed playbook cap.

---

## Metrics (docs accuracy lane)

| Metric | Value |
|--------|------:|
| Evergreen files reviewed | 2 |
| Plan/report files reviewed | 5 |
| Live FilterBar lists | **12 / 23** |
| DateField package | **SHIPPED** |
| DateField form-page consumers | **0** |
| SearchChrome | **MISSING / parked** |
| MAJOR stale claims | **5** |
| Lane status | **FAIL** |

---

```text
Status: DONE
Summary: Docs accuracy FAIL — evergreen still says FilterBar 7/23 and G2 top gap date/datetime while 939b92f shipped DateField and FilterBar on 12/23 lists; SearchChrome park decision remains true.
```
