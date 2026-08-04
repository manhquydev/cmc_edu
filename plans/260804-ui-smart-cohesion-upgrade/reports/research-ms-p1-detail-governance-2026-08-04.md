# Research — Detail recipe tiers + depth metrics (cook prep)

**Date:** 2026-08-04  
**Scope:** How industry + Odoo/Salesforce-style admin UIs treat **record page depth**, and how CMC should measure it without false failures.

---

## Executive summary

Enterprise admin UIs almost never force one detail density. Odoo form has optional statusbar/chatter; Salesforce Lightning has different density per object; settings pages use rail chrome without “entity avatar h1”. CMC already maps this in wireframes (`settings hybrid`, `EntityHeader optional`). Research supports **named tiers + adoption report**, not universal EntityHeader.

Static analysis (AST-light string scan) is the right cost for solo+AI — same family as existing `check-ui-frames.mjs`.

---

## Key findings

### 1. Record page patterns (admin ERP)

| Pattern | Typical chrome | CMC map |
|---------|----------------|---------|
| Money / CRM record | Title + status path + highlights + tabs | **full** EH+HS+WF |
| Master data entity | Title + key facts + sections | **standard** EH+HS |
| Settings domain | Page title + rail + forms | **settings** Detail+SettingsShell, PageHeader title OK |
| Self-service / run ops | Page title + panels, may skip avatar identity | **thin** Detail only (payroll run, my-hr) |

Forcing avatar EntityHeader on IP allowlist or salary tiers is **anti-pattern**.

### 2. Governance metrics (from prior multi-scope research)

- Report **adoption counts** before **strict gates** (Supernova lifecycle: early = adoption/docs; mature = consistency strict).  
- CMC already strict on dual-title + bulk — next step = **report** FilterBar/pager/EH tiers.  
- Avoid strict EntityHeader≥DetailPage — settings would fail forever.

### 3. Local evidence (validated)

```
full:     receipt-detail, opportunity-detail
standard: student-detail, class-detail
settings: shift-config, network-ip, salary-tiers
thin:     payroll, my-hr
```

FilterBar: 6 · ListPagination: 11 · bulk: 8 · dual-title: 0

### 4. Implementation approach for script

Extend report JSON:

```js
filterBarFiles, filterBarCount,
listPaginationFiles, listPaginationCount,
entityHeaderFiles, entityHeaderCount,
detailPageFiles,
detailTiers: { full: [], standard: [], settings: [], thin: [] }
// classification: file has DetailPage →
//   SettingsShell → settings
//   EntityHeader && WorkflowStatusbar → full
//   EntityHeader → standard
//   else thin
```

Human text output lists tier buckets. Metrics optional targets (non-strict):

```js
metrics.filterBarCount,
metrics.listPaginationCount,
metrics.entityDetailWithHeader, // full+standard count
metrics.settingsDetailCount,
metrics.thinDetailCount
```

Keep strict: bulkListsOk + dualTitle only.

### 5. Pitfalls

- String includes false positives in comments — acceptable for current script style.  
- Loading/error branches multiple DetailPage — still “has EntityHeader” if success path has it.  
- Do not mark thin as fail.

---

## Recommendation for cook

1. Docs tiers + classification table  
2. Script report extension + unit test asserts keys exist  
3. Lab inventory + red-team H6 note  
4. No product EntityHeader force this cycle  

---

## References

- Prior: `research-redteam-ds-multi-scope-2026-08-04.md`  
- CMC: PAGE-FRAMES, VIEW-GRAMMAR, design-lab-wireframes settings hybrid  
- Industry: Supernova DS metrics lifecycle (adoption before hard consistency)  
