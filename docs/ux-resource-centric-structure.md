# UX & System Structure — Resource-Centric (Authority)

**Status:** LOCKED 2026-08-11 (owner)  
**Authority for:** ERP admin document workflows, nav IA, form-depth, anti-bloat  
**Supersedes role-page patterns** such as nav labels “Duyệt X” as separate products  

Related: `docs/06-kien-truc-url-routing.md` (URL grammar) · `docs/design-system-console.md` (chrome) · `docs/system-architecture.md` (as-built) · research `plans/reports/research-advise-260811-system-structure-odoo-lean.md`

---

## 1. Principle (non-negotiable)

```
Resource-centric, not role-centric.

  1 document type  →  1 list/board URL
  Role             →  which rows + which form actions
  Share / HITL     →  /{area}/{resource}/:uuid  (+ optional /go)
  NEVER            →  a second app named “Duyệt …” per role
```

Learn **Odoo product grammar** (model → list/form views → access + record rules).  
**Reject** Odoo hash `#action=&model=`, OWL ActionManager, integer action registry.

---

## 2. Seven layers

| Layer | Responsibility | CMC home |
|-------|----------------|----------|
| L0 Surface | Admin Console / LMS portal | `apps/admin`, `apps/lms` |
| L1 Shell/Nav | Resource menus, permission-gated | `nav-registry`, ConsoleNavbar |
| L2 Addressing | Path list / new / :id, query filters, links | TL06, `@cmc/links`, `/go` |
| L3 Frames | ListPage, DetailPage, FormPage, FilterBar | `@cmc/ui` |
| L4 Domain | Model + status + tRPC resource router | `apps/api/src/*`, `packages/domain-*` |
| L5 Authz | Permission keys + row rules | `@cmc/auth`, procedure gates |
| L6 Tenancy | facility + RLS | `withFacility`, ADR 0042 |
| L7 Async | Workers, audit | `apps/api/src/worker` |

---

## 3. Document resource template

```
LIST   /{area}/{resource}?status=&scope=&period=&q=
NEW    /{area}/{resource}/new          # when compose is heavy
FORM   /{area}/{resource}/:uuid        # statusbar + primary actions
API    list · get · status mutations
NAV    resource name (e.g. “KPI”, “Đăng ký ca”)
SCOPE  facility always + domain row rule (track | managerId | owner | SoD)
LINK   links.{entity}(id) · /go/{entity}/:id
```

List = **index** (navigate to form). Form = **work surface**. Status = **filter**, not menu.

---

## 4. Scope axes (honest — do not merge)

| Axis | Use | Example |
|------|-----|---------|
| facilityId | Data wall | All staff procedures |
| track (from roles) | KD vs GV buckets | Shift approve, KPI list branch |
| managerId | Direct-manager tree | `kpi.confirm` |
| owner | Self | myScore, myRegistrations |
| SoD money | Sale vs approve receipt | finance |

---

## 5. Hard rules (anti-bloat)

1. One workflow model → one nav leaf.  
2. No new “Duyệt *” products.  
3. List uses ListPage + FilterBar; form uses DetailPage/FormPage.  
4. Cold-start form requires `get` by id (facility + row gate).  
5. Routers named by resource, never by role.  
6. One form-depth module series at a time.  
7. Every shareable entity in `@cmc/links` before UI hardcodes paths.  
8. Done only with CI evidence (`typecheck-and-test`, `ui-e2e` as required).

---

## 6. Canonical recipe

**Shifts (pilot):** `/hr/shifts` · `/new` · `/:registrationId` · `shift.get` · `links.shiftRegistration`  

**KPI (target of plan shared-workspace):** `/hr/kpi` board · `/hr/kpi/:scoreId` form · `kpi.get` · nav label “KPI” (not “Duyệt KPI”)

---

## 7. Change control

- Reverse only with new product evidence + explicit owner override.  
- Module plans must cite this file in Authority.  
- TL06 remains URL authority; this file remains **UX structure / anti-bloat** authority.
