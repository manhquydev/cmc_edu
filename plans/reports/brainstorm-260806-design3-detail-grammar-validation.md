# Brainstorm — Design3 detail grammar validation (two-layer)

**Date:** 2026-08-06  
**Status:** accepted  
**Parent:** Odoo UI dissection / Design3 admin rollout  
**Related:** `plans/reports/brainstorm-260806-odoo-ui-dissection-refresh.md`, `plans/260806-1045-odoo-grammar-gap-cook/`, thin statusbar ship  

---

## Problem statement

Ops smoke for DetailPage thin statusbar failed not because CSS regressed, but because the script assumed list rows expose `<a href>` to detail URLs. Admin lists use `DataTable` `onRowClick` (div wrapper, no href). CRM detail is `/crm/opportunities/:id`, not `/crm/:uuid`. Ad-hoc smoke scripts and the design3 audit do not share a durable way to open **seeded** detail pages for grammar assertions.

## Requirements (exact)

| Field | Decision |
|-------|----------|
| **Expected output** | Shared e2e helper `openSeededDetail` + thin `smoke-statusbar.mjs` + Playwright UI contract spec |
| **Acceptance** | With seed: sticky statusbar (md+), summary not sticky, exit 0 / CI green. Without seed: hard-fail, clear reason |
| **Scope boundary** | Validation harness only this round — no new Odoo surfaces, no audit route-matrix expansion (phase 2), no API auto-seed |
| **Constraints** | Two layers (ops smoke + CI); hard-fail empty lists; reuse `SUPER_ADMIN_*` from `.env.prod` / CI; click real list/pipeline UX |
| **Touchpoints** | New helper under `apps/e2e/src/`; `apps/e2e/smoke-statusbar.mjs`; new/extend Playwright under `apps/e2e/tests/`; ref `receipt-list`, `pipeline`, shipped DetailPage/`odoo.css` |

## Problem-first (solution-jump decompression)

1. **Solution-jumping diagnosis:** Immediate options were “click row / API seed / cockpit links” — local fix for one failed smoke.
2. **Underlying problem:** No durable **detail-page entry contract** for Design3 grammar proof across ops and CI.
3. **Assumptions challenged:** (a) href scrape works — false (DataTable). (b) empty DB OK — rejected; require seed. (c) one smoke file enough — rejected; need CI layer.
4. **Problem statement:** Maintainers need to prove form grammar on live detail after rebuild and in CI; struggle is unreliable URL discovery; cause is list navigation without anchors + script sprawl; success = one helper, two consumers, seed-required.
5. **Frames:** A click-only mirror · B shared harness (chosen) · C API cold-goto.
6. **Evidence status:** Strong (code paths + failed smoke JSON).
7. **Validation plan:** Implement B → run smoke on seeded cmcv2 → run Playwright locally/CI.
8. **Stakeholder note:** Treat failed smoke as harness debt, not as proof statusbar CSS failed, until helper lands.

## Evaluated approaches

| | Pros | Cons |
|---|------|------|
| **A UI click-only** | Fast, user-real | Duplicated login/nav; drifts between smoke and CI |
| **B Shared harness** | One truth; two layers; seed policy clear | Small extract cost |
| **C API list → goto** | Avoids DataTable | Heavier ops client; skips user path |

**Chosen: B.** Optional later: attach detail routes to `design3-frontend-audit.mjs` (not this round).

## Final design

### Helper API

```ts
// apps/e2e/src/design3/open-seeded-detail.ts (or .mjs if smoke cannot import TS)
loadProdEnv(): Record<string, string>
loginAsSuperAdmin(page, env): Promise<void>
openSeededDetail(page, kind: 'receipt' | 'opportunity'): Promise<{ path: string }>
```

- **receipt:** `/finance` → click first body row → URL `/finance/:uuid` or throw `no seeded receipt row`.
- **opportunity:** `/crm` → click first opportunity card (fallback table row) → URL `/crm/opportunities/:uuid` or throw.

### Consumers

1. **Ops:** `smoke-statusbar.mjs` — login → open both kinds → `getComputedStyle` sticky asserts → exit code.
2. **CI:** Playwright spec — same helper → same asserts (and/or visible `.o-detail-statusbar` + CSS contract).

### Non-goals

- Auto-create fixtures in smoke  
- Full audit matrix for every detail  
- Phase 5 list theater / Settings xia  
- Jules tree commits  

## Risks

| Risk | Mitigation |
|------|------------|
| Seed missing for super_admin facility | Hard-fail message; ops fix seed, not soften assert |
| CRM view mode (kanban vs table) | Prefer card; fallback `?view=table` row |
| Helper shared from `.mjs` smoke vs TS tests | Prefer `.ts` compiled/loaded as e2e already does, or thin `.mjs` re-export — decide in plan |

## Success metrics

- Smoke PASS on rebuild after seed present  
- Playwright contract green in `ui-e2e` path (or tagged design3 suite)  
- No href-scrape heuristics remain for these two surfaces  

## Next steps

1. `/ck:plan` from this report (TDD recommended — locks assert before wiring helper).  
2. Cook → run smoke + targeted e2e.  
3. Later (optional): design3 audit detail append.
