# Brainstorm — Odoo Search OS next step

**Date:** 2026-08-06  
**Skill:** `/ak:brainstorm`  
**Context:** After Search OS dissection (Filters · Group By · Favorites); decide whether to cook.

---

## Contract

| Field | Value |
|-------|--------|
| **Outcome** | Clear go/no-go for next delivery on Odoo design parity; staff admin remains professionally usable without opening a multi-week SearchModel rebuild. |
| **Constraints** | Solo + AI ops; no OWL/SearchModel port; ListPage host only; design3 admin still in **validation** (CI/runtime residual); YAGNI/KISS first. |
| **Non-goals** | Favorites/`ir.filters`, Group By platform, DomainSelector, SearchPanel, full CP L/C/R rebuild, class rename `ck-*`→`o-*`. |
| **Acceptance** | Written decision with evidence; phase-02 research closed or cook scoped; uncommitted research either committed or explicitly held. |

---

## Current evidence (not intent)

### Shipped (design3 / dissection)

| Area | Evidence |
|------|----------|
| Shell + navbar stacking | SHIPPED; audit `menuCoveredCount=0` |
| ControlBar densify + form dual-sheet | phase-01 **Done** |
| Form statusbar sticky, float toast/dialog | SHIPPED |
| Layout xia (7 surfaces) | Done 2026-08-06 |
| Search OS research | Report + map + VIEW-GRAMMAR §3.1 **Done** (this session) |

### Not shipped (Search OS code)

- Zero matches for `SearchChrome` / facet / favorite / groupBy primitives in `packages/ui` + `apps/admin`.
- `FilterBar` only: text | select | date → URL or controlled state (~110 LOC).

### Filter complexity in production pages

Scout of admin FilterBar definitions (2026-08-06):

| Page | Typical filters |
|------|-----------------|
| schedule | 1× text |
| students | 1× text (`q`) |
| receipt-list | 1× select + 1× text |
| reconciliation | 1× select (+ more local form?) |
| aftersale / meetings / rewards | 1× status select |

**No list currently has ≥3 named presets.** Odoo’s three-column mega-menu is solving a problem CMC lists do not have yet.

### Portfolio pressure

- `plans/260805-1920-design3-admin-rollout` status = **validation**; note: runtime green on CI still open.
- Dissection plan acceptance: research boxes checked; cook P1 explicitly **optional**.
- Original phase 5 already **Accept partial** for search/facets.

### Workspace dirt (this session)

Uncommitted research-only edits on `develop`:

- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`, `VIEW-GRAMMAR.md`
- plan/phase/report under `plans/260806-odoo-ui-component-dissection/`

---

## Options

### A — Cook full SearchChrome P1 now (chips + Filters menu; pilots finance/CRM)

| | |
|--|--|
| **Pros** | Highest visual “Odoo ops” jump; system-wide if host is shared. |
| **Cons** | Platform surface without demand (1–2 filters/page); risk of redesigning ListPage mid-validation; favorites/groupBy still unresolved if scope creeps. |
| **Effort** | Multi-day cook + migration + tests; not a drive-by. |

### B — Minimal FilterBar polish only (active-value chips / clear-all; no mega-menu)

| | |
|--|--|
| **Pros** | Small; improves removable-condition visibility; reuses existing FilterDef. |
| **Cons** | Still not Odoo menu grammar; easy to half-ship and stop. |
| **Effort** | ~0.5–1 day if product feels real pain. |

### C — **Close research wave; park cook** (Recommended)

| | |
|--|--|
| **Pros** | Matches YAGNI evidence; preserves dissection capital; frees capacity for design3 validation / product flows; phase-5 already accepted partial. |
| **Cons** | Admin still “FilterBar lite”, not Odoo SearchBar — acceptable while lists stay simple. |
| **Effort** | Commit docs + mark phase research done; no UI code. |

### D — More research (`/ak:xia` search surface)

| | |
|--|--|
| **Pros** | Pretty side-by-side report. |
| **Cons** | Diminishing returns — deep source report already exists. |
| **Effort** | Half day, low decision value. |

---

## Decision (recommended)

**Choose C now. Do not open Search OS cook.**

### Why (brutal)

1. **Demand is thin:** real admin lists use 1–2 simple filters — not Filters+GroupBy+Favorites density.
2. **Wave already accepted partial:** plan phase 5 + 5b research acceptance are satisfied; cook was never blocking.
3. **Design3 validation is the active product risk**, not missing facet chips.
4. **Cooking SearchChrome now is architecture theater** until a page needs ≥3 named presets or sticky multi-condition UX fails UAT.

### Immediate next actions (ordered)

1. **Commit research docs** on a focused branch (or develop if that is local policy) — conventional commit, no AI trailer:
   - design-system map/grammar
   - plan phase-02 + search report + plan.md/AGENT map
2. **Close phase-02 research** (`status: done` for research todos); leave optional cook unchecked as backlog with **re-open triggers** (below).
3. **Next delivery attention** → design3 validation residual (CI/runtime green) **or** highest product/UAT gap — **not** another Odoo chrome component unless a trigger fires.
4. **Do not** run xia-search-only (option D) unless a stakeholder needs a slide deck.

### Re-open cook triggers (any one)

- A ListPage needs **≥3 named presets** or multi-field free-text that confuses staff.
- UAT feedback: “không thấy đang lọc gì” / cannot clear conditions.
- Product explicitly prioritizes Odoo SearchBar visual parity for a pilot module.
- A list API grows **server-side groupBy** with UI demand.

If a trigger fires → start with **option B** (chips on existing FilterBar), not full menu + favorites. Promote to menu only when presets ≥3.

### Explicitly parked

| Item | Until |
|------|--------|
| Group By chrome | List API + product need |
| Favorites / saved views | Storage ADR (local vs server) |
| Selection replaces search | After chips exist (if ever) |
| SearchPanel left rail | Inventory-like module request |
| Domain custom filter | Never for staff (SKIP) |

---

## Handoff

| Next | Action |
|------|--------|
| Git | Commit research-only files (user-approved) |
| Plan | phase-02 research closed; cook stays backlog |
| Product work | design3 validation / UAT — not SearchChrome |
| If cook later | `/ak:plan` thin phase for FilterBar chips → `/ak:cook` |

**Status:** DONE (decision)  
**Summary:** Research complete; **do not cook Search OS now**; commit docs; re-open only on demand triggers; prefer design3 validation next.
