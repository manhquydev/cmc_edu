# Cook complete — Cycle 4 Soft Ops governance residual

**Date:** 2026-08-04  
**Plan:** `plans/260804-cycle-4-soft-ops-governance/`  
**Direction (locked):** Option B Soft Ops · no re-skin · no second DS · no OWL  
**Authority for metrics:** re-run commands below — numbers here are a measured snapshot, not a frozen SoT.

---

## Metrics snapshot (2026-08-04)

### Frames (`node scripts/check-ui-frames.mjs --json` + `--strict`)

| Metric | Value | Gate |
|--------|-------|------|
| dualTitleReview | **0** (`[]`) | **strict** |
| bulkCount / bulkListsOk | **8** / **true** | **strict** |
| FilterBar | **6** | report-only |
| ListPagination | **11** | report-only |
| EntityHeader | **4** | report-only |
| SettingsShell | **3** | report-only |
| detailTiers full / standard / settings / thin | **2 / 2 / 3 / 2** | report-only |
| pageCount (excl lab/tests) | **47** | — |

**detailTiers buckets:**

| Tier | Count | Files |
|------|------:|-------|
| full | 2 | opportunity-detail · receipt-detail |
| standard | 2 | class-detail · student-detail |
| settings | 3 | network-ip · shift-config · salary-tiers |
| thin | 2 | my-hr · payroll |

**Tests:** `node --test scripts/check-ui-frames.test.mjs` → **3/3 pass** · `--strict` exit **0**.

### A11y role smoke (`node scripts/check-ui-a11y-roles.mjs`)

| Check | Result |
|-------|--------|
| FilterBar · ListPagination · BulkActionBar · DataTableSelection · PageHeaderBreadcrumbs · CommandPalette · Toast · SettingsShell | **8/8 ok** |
| Baseline status | **partial** (role smoke ≠ keyboard operability ≠ WCAG cert) |
| SoT | `design-system/cmc-edu/A11Y-BASELINE.md` |

---

## Phase board

| Phase | Name | Status |
|-------|------|--------|
| 1 | Close 4a depth report | **completed** (verify-only; 4a already shipped) |
| 2 | A11y baseline lite | **completed** (partial honesty; role smoke) |
| 3 | Governance finalize | **completed** (this report + work-def/advise sync) |

---

## Finding board (MS-1 … MS-5)

| ID | Issue | Cycle 4 status | Notes |
|----|--------|----------------|-------|
| **MS-1** | EntityHeader “under-adopted” | **documented** | settings exempt; thin residual named (payroll · my-hr) |
| **MS-2** | No depth matrix in CI report | **report fixed** | FilterBar / pager / detailTiers in script; **not** strict depth gate |
| **MS-3** | No a11y baseline | **partial** | A11Y-BASELINE + role smoke; **never** “fixed” without human keyboard pass log |
| **MS-4** | Detail recipe two-tier undocumented | **fixed** | tiers full \| standard \| settings \| thin |
| **MS-5** | Clipboard / domain bulk | **deferred** | inventory honesty partial; gifts only multi-mutate; no domain bulk this cycle |

Lab panel: `apps/admin/src/pages/design-lab-redteam.tsx` — H6 fixed · C2 depth report present · MS-3 **partial** · does **not** claim “depth matrix missing”.

---

## Residual risks (accepted, not fixed this plan)

| Risk | Disposition |
|------|-------------|
| **Clipboard bulk privacy** | Selection copy may put PII (email/name/code) on clipboard; honesty label exists; **not** privacy redesign this cycle |
| **`/design` authz** | Lab routes still product-scope residual; **rejected** as must-fix in this plan (separate security work) |
| **A11y partial** | Role smoke green; human keyboard pass **not** logged → MS-3 stays **partial** |
| **Thin detail residual** | payroll · my-hr intentionally thin; optional promote later, not force EntityHeader |

---

## Non-goals still rejected

- Re-skin / dark mode / LMS Soft Ops  
- Full axe CI gate  
- Domain bulk multi-mutate force  
- Force EntityHeader on settings/thin  
- Strict fail on thin DetailPage  
- “WCAG certified” / a11y “fixed” without keyboard pass  

---

## Docs synced this phase

| File | Change |
|------|--------|
| `plans/260804-ui-smart-cohesion-upgrade/reports/advise-ms-p1-detail-governance-2026-08-04.md` | Work checklist all **[x]** + evidence commands |
| `plans/260804-ui-smart-cohesion-upgrade/reports/work-definition-clear-2026-08-04.md` | Cycle 4 rows: tiers · a11y lite partial · MS-5 deferred |
| `plans/260804-ui-smart-cohesion-upgrade/reports/workflow-next-cycle-2026-08-04.md` | Optional next pointer (light) |
| This file | Metrics + finding board |

---

## Validation (re-run)

```bash
node --test scripts/check-ui-frames.test.mjs
node scripts/check-ui-frames.mjs --strict
node scripts/check-ui-a11y-roles.mjs
test -f plans/260804-cycle-4-soft-ops-governance/reports/cook-complete-2026-08-04.md
```

**No product EntityHeader re-implementation. No axe CI.**
