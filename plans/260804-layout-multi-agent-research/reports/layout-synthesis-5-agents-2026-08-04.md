# Layout knowledge synthesis — 5 agents (2026-08-04)

**Project:** CMC EDU admin (facility ERP + LMS)  
**Method:** 5 parallel research agents → controller synthesis  
**Authority:** `design-system/cmc-edu/*` + `packages/ui` tokens (beats external chrome)

## Agents

| # | Focus | Status |
|---|--------|--------|
| A1 | ERP admin shell / list / detail (Carbon·Ant·Odoo map) | DONE |
| A2 | Dashboard / multi-role cockpit | DONE |
| A3 | List · Detail · Form frames + VIEW-GRAMMAR | DONE |
| A4 | Grid · density · radius · keyline | DONE |
| A5 | Education surfaces (schedule, attendance, LMS split) | DONE |

## Unified OS (synthesis)

```text
AppFrame + SideNav (248) + Topbar (60)
  └── exactly one page frame:
        DashboardPage | ListPage | DetailPage | FormPage
```

Modules change **data, permissions, tabs** — never invent full-page chrome.

## Shell locks (A1)

| Element | CMC |
|---------|-----|
| SideNav | ~248px fixed left |
| Topbar | ~60px, blur, **1** primary CTA + ghost logout |
| Content pad | default 24×28 · ops 18×22 |
| Frames | **4 only** |

## Cockpit hierarchy (A2)

```text
Greeting → shortcuts (3–5) → metrics (0–4)
  → primary WorkInbox (1.4fr) | secondary context (1fr)  ≥1040px
```

Same `DashboardPage` for every role — only slot content changes.

## Frame recipes (A3)

| Frame | Sticky chrome | Identity |
|-------|---------------|----------|
| ListPage | ControlBar top (header → filters → pager/bulk) | PageHeader title |
| DetailPage | — | **EntityHeader h1 only**; breadcrumbs without dual title |
| FormPage | Actions bar bottom sticky | PageHeader |
| Dashboard | — | Title slot |

## Density (A4)

| Tier | Row | Use |
|------|-----|-----|
| Comfortable / default | 48 | cockpit, detail, forms |
| Ops compact | 40 | lists, tables, week cells |
| Touch floor | ≥44 hit | attendance — not a visual density fork |

**Radius:** control 12 ≤ card 16 ≤ dialog 20  
**Keyline-x:** 20px all heads/rows  
**Elevation:** sticky xs · raised sm · float md · modal lg · **rows never shadow**

## Education (A5)

- **List-ops** = finance/CRM entities; **Agenda + SessionCard** = teacher day path  
- **WeekSchedule** = conflict/room (toggle), not GV default  
- SessionCard P0 = time · title · status · CTA; P3 tooltip only  
- Admin dense shell vs LMS mobile shell; **shared tokens**, no second DS

## Steal vs skip (cross-agent)

| Steal | Skip |
|-------|------|
| Carbon table/filter/empty grammar | IBM gray chrome, radius 0 product-wide |
| Ant list→detail IA, 8-grid | Ant ProLayout brand look |
| Odoo list/form *concepts* | OWL, purple, chatter everywhere |
| Polaris index density cues | Forest green dual accent |
| — | Airbnb/Cal sparsity on ops screens; shadcn second stack |

## 21 layout laws (merged, non-negotiable)

### Product OS
1. One shell + one of four frames  
2. Modules swap data only  
3. One primary CTA per chrome context  

### Structure
4. Shared raised recipe + keyline-x 20  
5. Nested radius 12 ≤ 16 ≤ 20  
6. Two row heights only: 48 / 40 (+ touch hit ≥44)  
7. No magic px outside tokens  

### List
8. ControlBar sticky = title · filters · pager/bulk  
9. FilterBar only inside ListPage  
10. EmptyState = title + desc + action  

### Detail / form
11. EntityHeader owns entity h1  
12. Detail order: header → entity → summary? → tabs? → body  
13. Form actions sticky bottom  

### Cockpit
14. Fixed slot order (never rearrange by role)  
15. ≤4 metrics · 3–5 shortcuts  
16. Empty queue teaches next step  

### Education
17. Grain matches job (session vs entity)  
18. Agenda does work; week shows conflict  
19. SessionCard P0 always visible  

### Feedback / a11y
20. Commit → toast; irreversible → ConfirmDialog  
21. Status never color-only; VN labels on badges  

## Adoption checklist (new screen)

- [ ] Named frame from {Dashboard, List, Detail, Form}  
- [ ] No dual title / no second DS  
- [ ] Density tier declared (default vs ops)  
- [ ] One primary CTA  
- [ ] Empty + loading + error placed  
- [ ] Tokens only (keyline, radius, row-h)  

## Presentation

Live on admin Design Lab: `#layout-knowledge` (`design-lab-layout-knowledge.tsx`).
