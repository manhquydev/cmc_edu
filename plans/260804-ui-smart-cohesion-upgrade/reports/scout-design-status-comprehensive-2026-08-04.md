# Scout Report — Soft Ops design implementation status (comprehensive)

**Date:** 2026-08-04  
**Method:** `ak-scout` · **10 Explore agents in parallel** (no overlap scopes)  
**Measured gates:** `check-ui-frames --json` · `check-ui-a11y-roles` (live)

---

## Executive verdict

| Layer | Maturity (1–5) | One-line |
|-------|----------------|----------|
| **L0 Foundations** (tokens/brand) | **4.3** | Locked Soft Ops; warm canvas; 12/16/20; light-only |
| **L1–2 Components** (`@cmc/ui`) | **3.9** | Full list-ops + detail pack; some atoms untested |
| **L3 Patterns** (frames/grammar) | **4.0** | 4 archetypes + detail tiers named |
| **L4 Adoption admin lists** | **3.2** | Only **3/22** ListPage fully aligned; 8 bulk; 6 FilterBar |
| **L4 Adoption detail** | **3.8** | 9 DetailPages tiered 2/2/3/2; dual-title **0** |
| **L5 Consistency / dual DS** | **3.7** | No shadcn/Tailwind; Astryx+CMC dual residual; lab skins R2 |
| **L6 A11y** | **2.8** | Role smoke 8/8; baseline partial; no CI; SideNav gaps |
| **L7 Ops smart** | **3.5** | Shell/⌘K/cockpit real; bulk mostly clipboard |
| **L8 Docs SoT** | **3.8** | Strong kit; MASTER stale “Toast TO BUILD” |
| **L9 Governance** | **3.5** | CI: dual-title + bulk only; depth/a11y report-local |
| **L10 LMS Soft Ops** | **2.0** | Tokens shared; **zero** Soft Ops frames (YAGNI) |
| **Weighted admin Soft Ops** | **≈ 3.6 / 5** | Productized internal ops OS — same band as multi-scope red-team |

**Stage label:** *Productized admin design OS with measurable list grammar; depth honest but uneven; a11y lite; LMS intentionally out.*

---

## Scout fleet (10 agents)

| # | Scope | Agent focus | Status |
|---|--------|-------------|--------|
| 1 | `design-system/cmc-edu/` | Docs authority | DONE |
| 2 | `packages/ui/src` tokens/CSS | Foundations | DONE |
| 3 | list-ops components | List kit | DONE |
| 4 | detail/form/dashboard atoms | Frame kit | DONE |
| 5 | `apps/admin` pages (lists) | List adoption | DONE |
| 6 | `apps/admin` pages (detail) | Detail tiers | DONE |
| 7 | `design-lab*` | Living lab honesty | DONE |
| 8 | shell + cockpit + feedback | Shell UX | DONE |
| 9 | scripts + CI + plans | Governance | DONE |
| 10 | `apps/lms` vs admin | Multi-surface | DONE |

---

## Live metrics (2026-08-04)

```text
pageCount 47 (excl lab/login)
ListPage 23 · DetailPage 9 · FormPage 7 · DashboardPage 2
BulkActionBar+selectedIds 8 · ListPagination 11 · FilterBar 6
EntityHeader 4 · SettingsShell 3 · HighlightStrip 4 · WorkflowStatusbar 2
detailTiers: full 2 · standard 2 · settings 3 · thin 2
dualTitleReview 0 · bulkListsOk true
a11y role smoke 8/8 (partial baseline, not WCAG)
```

---

## 1. Authority & docs

### Relevant files
- `design-system/cmc-edu/{MASTER,PAGE-FRAMES,VIEW-GRAMMAR,STRUCTURE,A11Y-BASELINE,STYLING-BRIDGE}.md`
- `design-system/cmc-edu/pages/{cockpit,list-ops,attendance}.md`
- `packages/ui/llms.txt`

### Patterns
- Hierarchy: **code tokens > page overrides > domain docs > MASTER > external skills**
- Locked stack: Astryx + `@cmc/ui` — **no** second DS
- Detail tiers (PAGE-FRAMES §C) authoritative: full | standard | settings | thin

### Gaps / stale
| Issue | Severity |
|-------|----------|
| MASTER still says Toast **TO BUILD** / missing — **shipped** | High doc drift |
| STYLING-BRIDGE token typos (transition 140 vs 160; radius-md 12 vs 16) | Medium |
| STRUCTURE lags detail-tier table | Medium |
| README omits STRUCTURE + A11Y from index table | Low |
| Metric size MASTER 34px vs tokens 32px | Low |

---

## 2. Visual foundation (`@cmc/ui`)

### Relevant files
- `packages/ui/src/tokens.css` (~153)
- `packages/ui/src/astryx-theme-cmc.css` (~122)
- `packages/ui/src/premium.css` (~2275) — **oversized single file**
- `packages/ui/src/index.ts` — rich composite export

### Patterns
- Brand `#0071E3`, canvas `#f5f3ee`, radius 12≤16≤20, whisper elevation
- Systems: `.ck-*` composites · `.sh-*` shell · `.tpl-*` page frames
- Import order locked: tokens → theme → premium

### Gaps
- Magic radii islands in premium (kanban 18px, chips 6px)
- Dual shell export: Astryx SideNav/AppShell **and** CMC AppFrame/SideNav
- Typed `tokens` object incomplete vs full CSS catalog
- Density: tokens define compact; List uses `ops` not full density API

---

## 3. List-ops kit (13/13 present)

| Component | Test | Note |
|-----------|------|------|
| ListPage, ControlBar, DataTable, Bulk, ListPagination, PageHeader | yes | Slot composition |
| FilterBar | **no unit test** | URL or controlled |
| EmptyState | **no unit test** | Thin wrapper |
| Panel, TaskRow, WorkInbox, StageFunnel, FunnelBar | yes | Cockpit family |

**Capability gaps:** no multi-select filter · no column sort · bulk/pager parent-wired only · row-click a11y weak.

---

## 4. Detail / form / dashboard kit

| Surface | Tests | Gap |
|---------|-------|-----|
| DetailPage, FormPage, DashboardPage | yes | density untested |
| EntityHeader, HighlightStrip | yes (thin) | no avatar image URL |
| SettingsShell | yes | — |
| WorkflowStatusbar, StatActions, SectionBlock, KeyValueList, CmcTabs, ResultPanel, SettingsSection | **no** | completeness pack untested |

Tiers are **composition recipes**, not `tier` prop on DetailPage.

---

## 5. Admin List OS adoption (critical)

| Bucket | Count | Meaning |
|--------|------:|---------|
| **Fully aligned** (ops+FilterBar+pager+bulk) | **3** | students · receipts · aftersale |
| Partial ListPage | ~15 | missing FilterBar and/or bulk and/or pager |
| Exempt | 4 | pipeline · schedule · grading · class-placement |
| Missing chrome (DataTable outside ListPage) | 4 | shifts, check-in-out, network-ip table, salary-tiers tables |

**Chrome counts:** FilterBar **6** · ListPagination **11** · Bulk **8**

**Highest-leverage residuals (not exempt):**
1. `admin/audit-log.tsx` — ad-hoc TextInputs + custom pager  
2. `parents/index.tsx` — ad-hoc filters + custom pager  
3. `hr/kpi.tsx`, `hr/payroll.tsx` — header ad-hoc filters  
4. `finance/reconciliation.tsx` — Selector not FilterBar  
5. Optional FilterBar on bulk cohort without filters (users, facilities, …) — only if product needs filters  

---

## 6. Admin Detail adoption

| Tier | Files |
|------|--------|
| **full** | receipt-detail · opportunity-detail |
| **standard** | student-detail · class-detail |
| **settings** | shift-config · network-ip · salary-tiers |
| **thin** | payroll · my-hr |

- Dual-title: **0** on entity pages  
- FormPage product: **6** (receipt-create, attendance×2, session-assessment/evidence, report-cards)  
- DashboardPage: **2** (cockpit, revenue-report)

---

## 7. Design Lab (`/design`, DEV nav)

| Panel | Role |
|-------|------|
| Upgrade · Red team · Layout OS · Wireframes · Styles · Xia | Strategy / explore |
| Inventory + live demos | Product SoT mirror |

**Honesty:** bulk **partial** · detail **partial** with tiers · a11y **missing from matrix**  
**Stale:** inventory footer still lists ⌘K as miss; `#next` still says command palette later  

**R2 residual:** 13-skin gallery vs Soft Ops SoT.

---

## 8. Shell · cockpit · feedback

| Capability | Status |
|------------|--------|
| AppFrame + SideNav + ⌘K | **Wired** |
| ToastProvider | **Root** · success-heavy product use |
| ConfirmDialog | Strong on destructive; unsaved blocker shared |
| StatusBadge soft default | Live ops tables |
| Cockpit empty CTA | Role queues; fallback **`/hr/checkin`** |
| Callout / Avatar | Product thin (Avatar design-lab only) |
| SideNav a11y | **Gap** (no aria-current) |

---

## 9. Governance enforceability

| Gate | CI? | Strict? |
|------|-----|---------|
| bulk ≥5 + dual-title 0 | **Yes** (`ci.yml`) | **Yes** |
| FilterBar / pager / detailTiers | No | Report + unit floors only |
| a11y role smoke | **No** | Local `pnpm check:ui-a11y-roles` |
| Human keyboard pass | No | Doc only |

Cycle 3–4 claims: **accurate for residual scope** — not “Soft Ops complete forever.”

---

## 10. LMS split

- **Shared:** tokens, Astryx primitives, premium.css load  
- **Admin-only:** Soft Ops frames, ControlBar, bulk, SettingsShell, design-lab gates  
- LMS: local `.lms-*` mobile shell — intentional YAGNI  

---

## Composite radar (from scouts)

```text
Foundations     ████████░░  4.3
Components      ████████░░  3.9
Patterns/docs   ████████░░  4.0
List adoption   ██████░░░░  3.2  ← weakest product spread
Detail adoption ████████░░  3.8
Consistency     ███████░░░  3.7
A11y            █████░░░░░  2.8
Shell/ops UX    ███████░░░  3.5
Governance      ███████░░░  3.5
LMS Soft Ops    ████░░░░░░  2.0  (by design)
────────────────────────────
Admin Soft Ops  ≈ 3.6 / 5
```

---

## Priority residuals (actionable, Option B)

| Pri | Work | Why |
|-----|------|-----|
| **P1** | Fix MASTER/STYLING-BRIDGE stale (Toast shipped, token typos) | Agents re-open dead work |
| **P1** | Design-lab inventory: ⌘K miss callout + #next + a11y row | Lab honesty |
| **P1** | List OS pass: audit-log · parents → FilterBar + ListPagination | Highest ad-hoc residual |
| **P2** | kpi / payroll / reconciliation FilterBar hygiene | Ops tables mid-band |
| **P2** | SideNav aria-current + optional log human keyboard pass | MS-3 lift without axe |
| **P2** | FilterBar package unit test | Kit hole |
| **P3** | Completeness-pack unit tests (KeyValueList, CmcTabs, …) | Regression armor |
| **P3** | premium.css modularization / magic radius cleanup | Maintainability |
| **Defer** | Domain bulk power · LMS Soft Ops frames · dark mode · axe CI | Non-goals / YAGNI |

**Reject still:** re-skin · second DS · force EntityHeader on settings/thin · OWL.

---

## Relevant file index (high signal)

### SoT
- `design-system/cmc-edu/*`
- `packages/ui/llms.txt`, `tokens.css`, `premium.css`, `index.ts`

### Product exemplars (full list OS)
- `apps/admin/src/pages/students/index.tsx`
- `apps/admin/src/pages/finance/receipt-list.tsx`
- `apps/admin/src/pages/crm/aftersale.tsx`

### Product exemplars (detail full)
- `apps/admin/src/pages/finance/receipt-detail.tsx`
- `apps/admin/src/pages/crm/opportunity-detail.tsx`

### Residual lists
- `apps/admin/src/pages/admin/audit-log.tsx`
- `apps/admin/src/pages/parents/index.tsx`
- `apps/admin/src/pages/hr/kpi.tsx`
- `apps/admin/src/pages/hr/payroll.tsx`
- `apps/admin/src/pages/finance/reconciliation.tsx`

### Lab / governance
- `apps/admin/src/pages/design-lab*.tsx`
- `scripts/check-ui-frames.mjs`, `scripts/check-ui-a11y-roles.mjs`
- `.github/workflows/ci.yml` (frames strict step)
- `plans/260804-cycle-4-soft-ops-governance/` (completed residual plan)

---

## Unresolved questions

1. Should FilterBar be **required** on every ListPage with filters, or only high-traffic (current cycle-3 bar)?  
2. Promote thin **payroll** to standard (EntityHeader for pay run) or keep ops hybrid forever?  
3. Wire `check:ui-a11y-roles` into CI as non-blocking report vs never?  
4. Is design-lab multi-skin gallery LOC worth collapsing for R2, or keep for sales demos?  
5. When (if ever) does LMS adopt Soft Ops frames vs permanent mobile YAGNI shell?

---

## One sentence

> Soft Ops is a **real, gated admin design OS** (tokens + frames + CI dual-title/bulk + named detail tiers), with **uneven list adoption** (only 3 fully chrome-aligned lists), **partial a11y**, intentional **LMS non-adoption**, and **doc/lab staleness** still able to mislead agents.

```text
Status: DONE
Agents: 10/10 completed · 0 timeout
Report: plans/260804-ui-smart-cohesion-upgrade/reports/scout-design-status-comprehensive-2026-08-04.md
```
