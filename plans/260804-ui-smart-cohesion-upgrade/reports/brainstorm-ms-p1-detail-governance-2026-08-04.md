# Brainstorm — Red-team MS-1/2/4 (detail honesty + governance depth)

**Date:** 2026-08-04  
**Input:** Multi-scope red-team (`research-redteam-ds-multi-scope-2026-08-04.md`)  
**Direction locked:** Option B Soft Ops — **no re-skin**  
**Pipeline:** brainstorm → research → advise → validate work → cook  

---

## Scout (codebase)

| Finding | Evidence |
|---------|----------|
| DetailPage ×9 product | receipt, opportunity, student, class, payroll, my-hr, shift-config, network-ip, salary-tiers |
| EntityHeader ×4 | receipt · opportunity · student · class only |
| Full stack (EH+HS+WF) | receipt · opportunity |
| Standard (EH+HS) | student · class |
| Settings hybrid (Detail+SettingsShell, no EH) | shift · network-ip · salary-tiers |
| Thin Detail (no EH/HS/WF/SS) | **payroll · my-hr** |
| CI script | `check-ui-frames.mjs` counts frames + bulk + dual-title only — **no FilterBar/pager/detail tier** |
| FilterBar product | 6 files; ListPagination 11 files |
| Docs | PAGE-FRAMES says EntityHeader “Nên có” — **no explicit tiers** → agents over-claim “one recipe” |

---

## Problem (problem-first)

**Not:** “UI chưa đẹp / thiếu EntityHeader everywhere.”  

**Real problem:** Soft Ops claims **one detail recipe** while product has **at least three legitimate patterns** (entity full/standard · settings hybrid · thin ops detail). Without named tiers + measurable depth metrics, red-team and agents treat under-adoption as failure **or** force wrong chrome onto settings/payroll. Governance only enforces dual-title + bulk, so **depth regressions are invisible**.

**User-visible outcome if fixed:** Staff still see Soft Ops; maintainers/agents know **which depth is correct per screen class**; CI **reports** depth signals; inventory no longer oversells uniform detail.

---

## Requirements (exact)

1. **Name 3 detail tiers** in PAGE-FRAMES + VIEW-GRAMMAR (+ llms.txt pointer).  
2. **Classify every product DetailPage** into a tier (table in docs).  
3. **Extend `check-ui-frames`** to report FilterBar count, ListPagination count, EntityHeader count, detail-tier file lists — **report always; strict unchanged** (dual-title + bulk only) unless later authorized.  
4. **Lab honesty:** Detail inventory note reflects tiers; red-team H6/MS-1 partial with evidence.  
5. **Non-goals this cook:** force EntityHeader on settings/my-hr/payroll; axe CI; domain bulk; re-skin; LMS.

---

## Approaches (2–3)

### A — Docs-only tiers
- Pros: cheapest, honest  
- Cons: no enforceability; MS-2 stays FAIL  

### B — Docs + script report (no new strict) **← recommend**
- Pros: MS-1/2/4 closed enough; CI visibility without false fail on thin pages  
- Cons: no hard gate on EntityHeader %  

### C — Force EntityHeader 100% DetailPage + strict EH≥N
- Pros: metric looks “solved”  
- Cons: wrong UX on SettingsShell; payroll/my-hr need redesign; violates YAGNI; breaks dual-title logic assumptions  

**Recommendation: B**

---

## Acceptance (done when)

- [ ] Docs define **full | standard | settings | thin** (or full/standard/settings with thin = standard-minus / documented residual)  
- [ ] All 9 DetailPage product files listed with tier  
- [ ] `node scripts/check-ui-frames.mjs --json` includes depth fields  
- [ ] `node --test scripts/check-ui-frames.test.mjs` green  
- [ ] `pnpm check:ui-frames` strict still green (dual-title 0, bulk ≥5)  
- [ ] Lab / red-team notes not claim “one depth for all entity pages”  

---

## Risks

| Risk | Mitigation |
|------|------------|
| Over-strict later breaks CI | Report-only depth metrics now |
| Thin pages forgotten forever | Explicit “thin residual” + optional future promote payroll |
| Doc drift | Classify table next to script output fields |

---

## Next

→ Research patterns for tiered record pages + static audit metrics  
→ Advise locks cook checklist  
→ Validate checklist vs scout  
→ Cook B  
