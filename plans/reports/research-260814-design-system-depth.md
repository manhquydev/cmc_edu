# Research Report: Design-system depth for CMC EDU v2 (ERP + LMS console)

**Conducted:** 2026-08-14 · **Scope:** what a module-aware design system for a dense, role-gated ERP console must contain, beyond a token file and four page archetypes.
**Method:** 4 web searches (enterprise ERP UX 2026 · design-token layering · data-table UX · school-management module UI), cross-referenced with repo evidence (`PRODUCT.md`, `DESIGN.md`, `design-system/cmc-edu/`, `design-lab/`).

---

## Executive summary

Three findings decide the shape of the next wave.

1. **Token layering is the missing spine.** The lab currently has one flat layer (`--purple`, `--bg`, `--row-h`). The 2026 consensus is three layers: **primitive → semantic → component**. Semantic is the layer product code consumes (`--surface-action-primary`, `--text-critical`); primitives stay private. Without the semantic layer, a bridge into `@cmc/ui` will hard-code hexes into components again and theming/density becomes impossible.

2. **Density is a feature, not a constant.** Every dense-table source says ship **compact / default / comfortable** as named modes, not one row height. The lab pins `--row-h: 40px` (inherited from the OpenEduCat contract). Correct move: keep 40px as the *default* mode token and express the other two as a density context that only remaps semantic sizes.

3. **The gap is module grammar, not more atoms.** Buttons/badges/tables are covered. What a school ERP actually needs and the lab does not yet have: **kanban pipeline**, **week schedule grid**, **attendance matrix**, **gradebook entry grid**, **money ledger + approval gate**, **evidence/upload**, **audit timeline**, **KPI/payroll period table**, **saved views**, **bulk-action bar with select-all-across-filter semantics**. These are the "pattern layer" — between components and pages.

---

## Key findings

### 1. Token architecture (primitive → semantic → component)

Consensus across Martin Fowler's *Design Token-Based UI Architecture*, Atlassian/Carbon/Fluent, and 2026 token-architecture write-ups:

| Layer | Also called | Example | Who consumes it |
|---|---|---|---|
| Primitive | option / core / global | `--purple-500: #71639e` | Only the semantic layer. Keep private. |
| Semantic | decision / alias / system | `--surface-action: var(--purple-500)` | Components. **The public API.** Themeable. |
| Component | pattern | `--btn-primary-bg: var(--surface-action)` | One component. Use sparingly — the exception. |

Consequences for this repo:
- Remap-only theming: switching density, high-contrast, or the OpenEduCat-vs-lab chrome becomes a change to the semantic mapping, not to components.
- `packages/ui/src/console.css` already uses CSS custom properties, so the bridge is a rename/alias exercise, not a rewrite. That is the cheapest possible path.
- Context axes worth reserving now: **theme** (lab / openeducat-contract), **density** (compact / default / comfortable), **surface** (console / print).

### 2. Dense enterprise UI (ERP) patterns

- **Progressive disclosure + master–detail.** Expand a row in place instead of navigating away, where the task is triage. Matches the cockpit's "start the first item without navigating a menu" principle in `PRODUCT.md`.
- **Dense data, generous group spacing.** Density belongs inside a group; air belongs *between* groups. The lab's ruled-metrics band already does this.
- **One status vocabulary for the whole app.** Inconsistent status color is a "hidden usability tax". CMC has real state families: receipt draft/approved, opportunity O1–O5, attendance present/absent/late, submission graded/pending, shift punched/missing, refund requested/approved. They must resolve to one 6-tone scale (danger / warning / success / info / neutral / brand-waiting).
- **Empty states that give a path forward.** "Bạn đã xử lý hết việc" ≠ "Không có dữ liệu". Three distinct empty kinds: first-run, filtered-to-zero, all-caught-up.
- **Governance over library.** A design system for parallel modules is an operating standard: tokens + interaction rules + a11y centralized, so Finance and Teaching don't diverge.
- **Role-based views are part of the design**, not a runtime afterthought — permissions shape content (already `PRODUCT.md` principle 2). SoD must be visible in data, invisible in chrome.

### 3. Data-table specifics (the console's workhorse)

Non-negotiables from the table sources:
- Semantic `<table>/<thead>/<th scope>`; ARIA grid roles only as fallback.
- `aria-sort` on sortable headers; numbers right-aligned with `tabular-nums`.
- **Sticky header** by default for any table exceeding one viewport; frozen first column when horizontal scroll exists.
- **Density toggle** as a named, persisted user setting.
- **Bulk actions:** contextual bar replaces the toolbar on first selection, shows a running count, guards destructive actions, and states whether select-all means *this page* or *all rows matching the filter* ("Đã chọn 20 dòng trên trang. Chọn tất cả 312 dòng khớp bộ lọc?").
- **Saved views:** named bundles of columns + filters + sort. Filter/sort state persisted in the URL so it survives navigating into a record and back.
- **Pagination** (not infinite scroll) for deliberate navigation with a total count; virtualization only past low thousands.
- Hover reveals row actions; don't show them all at rest.

### 4. Education-module UI conventions

- **Timetable/schedule:** day × time grid, subject color-coding, room + teacher chips, drag-drop to reassign.
- **Attendance:** matrix of student × session with a 3-state cell (present / absent / late), fast keyboard entry, monthly calendar summary.
- **Gradebook:** student × assessment grid, type-to-score with auto letter grade, draft autosave, then an explicit **publish** step separating draft from student-visible.
- **Fees/receipts:** invoice + balance + payment recording, **print-ready** receipt view.
- **Role portals:** admin / teacher / accountant / student are separate dashboards over one shell.

Note: most market examples are Tailwind/shadcn stacks. That is a **banned** dependency here (`PRODUCT.md`), so borrow the *patterns*, never the stack.

---

## What this means for CMC EDU (repo-specific)

| Gap in current lab | Why it matters here | Proposed layer |
|---|---|---|
| Flat token layer | Bridge into `console.css` would re-hardcode hexes | Semantic + density tokens |
| No density modes | Compliance-style audit reading vs bulk triage are both real jobs | Density context on semantic sizes |
| No saved views / URL filter state | Every list page in `apps/admin` re-derives filters | Pattern layer |
| Bulk bar lacks select-all-across-filter copy | Finance/students bulk ops are dangerous without it | Pattern layer |
| No money/approval gate pattern | Second-eyes threshold (20,000,000 đ) is a first-class product rule | Module grammar: Finance |
| No pipeline kanban | O1→O5 is the CRM core | Module grammar: CRM |
| No schedule grid / attendance matrix / gradebook | Teaching + LMS are half the product | Module grammar: Teaching |
| No audit/ledger timeline | `AuditLog`/`RefundRecord` are append-only ledgers | Module grammar: Audit |
| No print surface | Receipts must print | Surface context |
| No first-run / filtered-zero / all-caught-up split | Empty state currently one generic block | State grammar |

---

## Implementation recommendation

Build the lab out in **four layers**, general → specific:

1. **Layer 0 — Foundations.** Primitive palette (private) → semantic tokens (public) → density context. Document the mapping table.
2. **Layer 1 — Primitives & states.** Every interactive atom with all seven states (default/hover/focus/active/disabled/loading/error). Skeletons, not spinners.
3. **Layer 2 — Patterns (cross-module).** Table with sticky header + sort + density + bulk bar + saved views + pager; filter bar with URL-state contract; three empty kinds; approval gate; drawer master-detail; toast; command palette.
4. **Layer 3 — Module grammar (per-module).** CRM pipeline, Finance ledger + gate, Teaching schedule + attendance + gradebook, Students profile, HR shift/KPI, Engagement rewards, Audit timeline, Print receipt.

Order matters: Layer 0 must land before Layer 3, or module screens will invent their own values again.

### Common pitfalls to avoid

- Adding a token because one screen needed it once (token sprawl). A token used once is not a token.
- Letting a module invent full-page layout — production pages must stay inside the four archetypes.
- Porting shadcn/Tailwind idioms into the product apps.
- Treating the lab as production authority before the bridge wave: the OpenEduCat contract still governs production list/form/statusbar fidelity.
- Density toggle that changes font size (it should change spacing/row height, not the type ramp).

---

## Resources

- Martin Fowler — *Design Token-Based UI Architecture*: https://martinfowler.com/articles/design-token-based-ui-architecture.html
- Setproduct — *Data table UI design reference guide 2026*: https://www.setproduct.com/blog/data-table-ui-design
- Pencil & Paper — *Enterprise data tables UX patterns*: https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables
- 137Foundry — *Data tables for complex web applications*: https://137foundry.com/articles/ux-patterns-data-tables-web-applications
- Procreator — *Enterprise UX best practices 2026*: https://procreator.design/blog/enterprise-ux-design-best-practices/
- Netvionix — *UX principles for data-heavy enterprise apps*: https://netvionixsolutions.com/blog/ux-design-principles-data-heavy-enterprise-apps
- onething.design — *12 design system examples (Atlassian/Carbon/Fluent token layering)*: https://www.onething.design/post/best-design-system-examples

---

## Unresolved questions

1. Density default: keep 40px rows (OpenEduCat contract) as `default`, or make `compact` the default for triage-heavy roles?
2. Does the bridge wave intend to rename `console.css` custom properties to semantic names, or add an alias layer on top and leave existing names in place?
3. Saved views need persistence — user preference table or URL-only? No repo authority found for a per-user UI preference store.
4. Print surface: is receipt printing an existing production requirement with a defined paper size, or lab-only for now?
