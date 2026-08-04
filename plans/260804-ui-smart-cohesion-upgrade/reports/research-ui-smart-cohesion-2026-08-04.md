# Research Report: Smart cohesive ops UI for CMC EDU

**Date:** 2026-08-04  
**Skill:** ak-research  
**Scope:** How to upgrade admin UX for *intelligence* + *visual/structural sync* without second design system  
**Recency:** industry patterns 2024–2026 + in-repo authority 2026-08

---

## Executive Summary

For facility education ERP, “smarter UI” industry consensus is **work-centric ops chrome** (sticky control bands, bulk actions, task queues, command palette, deep links)—not marketing redesigns. “Cohesion” comes from **closed frames + tokens + enforcement**, not from exploring 13 skins.

CMC already has the right stack pieces (`ListPage`/`ControlBar`, `DetailPage` recipe, `WorkInbox`, `CommandPalette`, Soft Ops tokens). The gap is **uneven depth**: ListPage ~24 screens vs Detail 8 / Form 7 / Bulk 3 / SettingsShell 1. Red team showed lab presentation oversells completeness.

**Recommendation:** cohesion-first upgrade (Option B): adoption + bulk + cockpit intelligence + honesty gates. Do not retoken production until real-page pilot.

---

## Research Methodology

- Sources: project `design-system/cmc-edu/*`, red-team report, frame adoption scout, prior 5-agent layout synthesis, web_search (ops UI / design-system enforcement)
- Tool budget: ≤5 external probes + local scout
- Key terms: page frames, control bar, bulk selection, work inbox, design system adoption

---

## Key Findings

### 1. Technology / product overview
CMC admin = Vite + React 19 + Astryx + `@cmc/ui` composites. Authority: MASTER tokens + PAGE-FRAMES + VIEW-GRAMMAR. Soft Ops: warm canvas, one blue, radius 12/16/20, density 48/40.

### 2. Current state & trends
- **Ops UIs:** sticky filter/control bands, bulk selection bars, keyboard command palettes, empty states with next action  
- **DS maturity:** “component exists” ≠ “adopted”; teams publish **adoption matrices** and lint  
- **Anti-trend for this product:** consumer sparsity, multi-brand accents, dual design systems (shadcn + custom)

### 3. Best practices (mapped to CMC)

| Practice | CMC implement |
|----------|----------------|
| One product shell | AppFrame + SideNav 248 + topbar 60 |
| Closed view set | Dashboard · List · Detail · Form only |
| Sticky list chrome | ListPage → ControlBar (header/filters/footer) |
| Bulk ops | DataTable selection + BulkActionBar in controlFooter |
| Record identity | EntityHeader single h1; breadcrumbs only |
| Smart home | DashboardPage fixed order; WorkInbox primary |
| Global jump | CommandPalette ⌘K (already wired) |
| Settings | SettingsShell when multi-domain config |
| Token discipline | No magic px; keyline-x 20; raised family |

### 4. Security / safety UX
- Destructive bulk → ConfirmDialog  
- Commit → toast; never silent  
- Children/facility data: no demo PII in lab beyond synthetic names  

### 5. Performance
- Prefer composite reuse over new page CSS  
- Design-lab bloat (~5k LOC) competes with product—cap exploration  
- Sticky ControlBar + virtualize only if lists > hundreds (YAGNI until measured)

---

## Comparative Analysis

| Approach | Sync | Smart | Risk | Effort |
|----------|------|-------|------|--------|
| A Re-skin | Low short-term | Low | High brand/debt | High |
| **B Enforce + depth** | **High** | **High** | Low | Med |
| C Smart widgets only | Lower | Med demo | High fragment | Low–med |

Industry + red team converge on **B**.

---

## Implementation Recommendations

### Quick start (ordered)
1. Freeze production Soft Ops; lab skins exploration-only (banner done)
2. Build **adoption matrix** (script: which page uses which frame)
3. Roll **BulkActionBar + ListPagination** to receipts, students, classes, users, pipeline
4. Audit **DetailPage** routes for EntityHeader + no dual title
5. Cockpit: ensure every role queue has EmptyState + deeplink CTA
6. SettingsShell for remaining admin config tabs
7. Optional: `scripts/check-ui-frames.mjs` in CI

### Code anchors (existing)
- `packages/ui` ListPage, DetailPage, FormPage, DashboardPage, BulkActionBar, WorkInbox, CommandPalette  
- `apps/admin/src/shell/shell.tsx` ⌘K  
- Pilot bulk: gifts / classes / users  

### Common pitfalls
- Adding skins before rollout depth  
- Custom page toolbars outside ControlBar  
- Dual PageHeader title + EntityHeader  
- Inventory greenwashing  

---

## Resources

### Internal
- `design-system/cmc-edu/PAGE-FRAMES.md`, `VIEW-GRAMMAR.md`, `STRUCTURE.md`, `MASTER.md`
- `plans/260804-layout-multi-agent-research/reports/red-team-design-system-lab-2026-08-04.md`
- `packages/ui/llms.txt`

### External themes (pattern only)
- Enterprise admin: sticky control, bulk, empty+action
- DS adoption: measure screens, not Storybook count

---

## Appendices

### A. Glossary
- **Smart ops:** surfaces that advance work (queue, bulk, deeplink), not AI chrome for its own sake  
- **Cohesion:** same frames/tokens/density recipes across modules  

### B. Unresolved
- Exact top-10 list priority if product disagrees with default order  
- CI gate this sprint vs next  

### C. Next
→ Advise report for do/don’t and success metrics
