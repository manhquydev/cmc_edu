# URL structure audit — 2026-08-13 (authority corrected 2026-08-14)

**Question:** Is the project on one URL grammar?
**Answer:** The **as-built** grammar is one recipe (list + `:uuid` / workspace query / `/go`) with three mount styles. TL06 is a July paper map, not the target. The gate (`pnpm check:url-structure`) now fails only when router, `@cmc/links`, or nav disagree with the catalog.

## Surfaces compared

| Surface | Role |
|---|---|
| `packages/links` + `/go` | Machine-readable entity URLs |
| `apps/admin/src/routes` + LMS router | As-built registration |
| `apps/admin/src/shell/nav-registry.ts` | Menu paths |
| TL06 §3 | July paper map — advisory `paperNotes` only |

Existing `nav-route-resolution.test.ts` only proves nav ⊆ router.

## As-built families (accepted; not defects)

| Family | TL06 | As-built |
|---|---|---|
| Academic | `/students`, `/classes`, `/courses`, `/parents` | `/admin/students`, `/admin/classes`, … (`/classes` has a redirect; `/students` does not) |
| Finance | `/finance/receipts`, `/finance/receipts/:id` | `/finance`, `/finance/:id` |
| CRM list | `/crm/opportunities` | `/crm` (detail *is* `/crm/opportunities/:id`) |
| Ops | `/finance/revenue-report`, `/finance/reconciliation` | `/ops/revenue`, `/ops/recon` |
| Engagement | `/engagement/rewards` | `/admin/engagement/rewards` |
| Report cards | `/teaching/report-cards` | `/admin/report-cards` |
| Check-in | `/attendance/check-in-out` | `/hr/checkin` |
| LMS | `/child/:id/…` | `/parent/…` and `/student/…` |

Aligned pockets: `/teaching/schedule|attendance|grading`, `/hr/shifts` (+ `/new` + `/:id`), `/hr/kpi`, `/hr/payroll`, `/cockpit`, `/admin/facilities|users|network-ip|shift-config`.

23 TL06 rows are still unbuilt (contacts, curriculum, certificates, `/hr/staff`, `/search`, …).

## Gate deployed

```
pnpm check:url-structure
pnpm test:url-structure
pnpm check:url-literals
pnpm test:url-literals
```

- Catalog: `scripts/url-structure-contract.ts` (closed world)
- Engine: `scripts/check-url-structure.ts` (router + links + nav + flow-manifest)
- Literals: `scripts/check-url-literals.mjs` (quoted paper/stale paths)
- Wired: root package scripts, `typecheck-and-test` CI step, `verify:system` L2e/L2f
- QA run 2026-08-14: `plans/reports/test-260814-0836-url-structure.md`

Fails when: a new route is not catalogued, `@cmc/links` or nav points at an unregistered path, a catalog `asBuilt` disappears, or a stale path (`/login/otp-phone`, `/attendance/shifts`, …) is registered. Paper-only TL06 rows do **not** fail.

Does **not** migrate URLs. Adding a screen requires a catalog row (`asBuilt` + `family`). `/admin/students` → `/students` stays a product decision, not a gate target.
