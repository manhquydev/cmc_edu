# Advise: Odoo-like UX grammar — CMC EDU admin

**Date:** 2026-08-03  
**Skills:** ak-advise (interview confirmed)  
**Evidence:** brainstorm + research + scout + xia compare

---

## Reframing (confirmed)

### Problem

Admin is ~60–70% on page frames; **~30–40% product pages still invent chrome** (PageHeader + ad-hoc body). List chrome is split (header vs FilterBar vs local pager). Without a closed **view grammar** + **ControlBar**, agents and humans re-fragment — the opposite of Odoo muscle memory.

### Exact requirements

1. Write and link **VIEW-GRAMMAR.md** (Odoo concepts → CMC frames).  
2. Ship named **`ControlBar`** in `@cmc/ui`, embedded by **ListPage**.  
3. **Full adoption:** every product page that should be list/detail/form/dashboard uses the matching frame (stubs = min frame + EmptyState).  
4. **Quality gates first:** each phase cluster migrates + tests green before next.  
5. **Pipeline:** ListPage shell + FunnelBar body (no generic KanbanBoard).  
6. **Grading:** keep MasterDetail; normalize PageHeader/chrome only.  
7. **ListPagination** on ≥1 production list (receipt-list reference).  
8. No OWL/Bootstrap second system; no bulk/selection pack in this plan; no widget kit full; no action-stack service.

### Goals

- One product OS feel across admin modules.  
- Agents cannot invent fifth full-page layout without violating law docs.  
- Measurable: off-frame product pages → 0 (except intentional embed: pdf-annotator, design-lab, login).

### Non-goals

Odoo runtime port · bulk selection · kanban engine · SearchModel favorites · LMS redesign · multi-company fake UI.

### Constraints

Solo+AI · React/Astryx/@cmc/ui · brand locked · tests per phase · facility tenancy real.

---

## Verdict

**Do B3 with quality gates — not a greenfield Odoo clone.**  
The abstraction layer already exists; the work is **law + ControlBar + finish adoption**. Choosing full adoption is correct if you accept multi-phase cook and refuse half-migrated clusters. Skipping bulk/selection is correct YAGNI (DataTable has no selection API).

## What you should do

1. VIEW-GRAMMAR + link PAGE-FRAMES / STRUCTURE / llms.txt.  
2. ControlBar + ListPage integration + unit tests + Design Lab.  
3. Migrate clusters: academic lists → finance/CRM shells → HR/settings → stubs/hybrids.  
4. Wire ListPagination on receipt-list.  
5. Final audit grep for bare PageHeader product lists without ListPage.  
6. Cook with subagents per cluster ownership; ak-test each phase.

## What you shouldn't do

- Port Odoo OWL/web client.  
- BulkActionBar without DataTable selection.  
- Rewrite pipeline as new kanban framework.  
- Big-bang one PR for all pages.  
- New design system or shadcn.

## Better / efficient

Cheapest path was B1; you chose B3 for product coherence — mitigate by **cluster phases + gates**.  
ControlBar named component (your choice) is better than CSS-only for agent discoverability.

## My take

Execute plan under `plans/260803-…` with ~7–8 phases. Red-team for adoption scope creep and pipeline regression. Validate that pdf-annotator and login stay out of ListPage force-fit.

## Benefits

- Odoo-grade muscle memory  
- Lower AI layout drift  
- Reuse existing frames investment  

## Trade-offs

- Multi-session cook  
- Risk of visual churn on many pages  
- Pipeline ListPage shell may need careful FunnelBar CSS  

## Work checklist

- [ ] VIEW-GRAMMAR.md + links  
- [ ] ControlBar + ListPage + tests  
- [ ] Design Lab  
- [ ] Migrate students/classes/courses/class-placement  
- [ ] Migrate pipeline shell + revenue-report + refund  
- [ ] Migrate HR list/settings frames  
- [ ] Migrate parents + engagement stubs + grading chrome  
- [ ] ListPagination on receipt-list  
- [ ] Audit + docs + full phase tests  

## Success metrics

| Metric | Target |
|--------|--------|
| Product pages off-frame (excl. login, design-lab, pdf-annotator) | **0** intentional exceptions only |
| ControlBar exported + tested | pass |
| receipt-list uses ListPagination | yes |
| VIEW-GRAMMAR linked from llms.txt | yes |
| `@cmc/ui` + touched admin tests | green |
