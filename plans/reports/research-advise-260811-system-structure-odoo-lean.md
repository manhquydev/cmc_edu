# Research + Advise — System structure: Odoo lean ops → CMC architecture

**Date:** 2026-08-11  
**Mode:** research architecture + scout Odoo + --advise  
**Related:** brainstorm anti-bloat, plan form-depth 260811-1408, TL06, system-architecture.md  

---

## 1. Brainstorm contract

| Field | Content |
|-------|---------|
| **Outcome** | CMC có **cấu trúc hệ thống khóa** (7 lớp), quy tắc chống phình, map Odoo→CMC rõ; vận hành document modules (KPI, ca) theo **1 resource / list+form / scope server**. |
| **Constraints** | Solo + AI; facility RLS; RBAC keys; path SPA; Console shell; CI non-bypass; shifts form-depth pilot exists. |
| **Non-goals** | Port OWL, ir.actions registry, hash URL, full Search OS, big-bang 39 màn. |
| **Acceptance** | Owner accept GO structure + non-negotiables; sequencing 90 ngày; KPI/shifts IA target written. |

---

## 2. Scout: Odoo thực tế vận hành tinh gọn

### 2.1 Kiến trúc kỹ thuật Odoo (official 19.0)

Sources: Odoo docs *View records*, *View architectures*, multi-company howto.

| Odoo concept | Meaning | Why lean |
|--------------|---------|----------|
| **Model** | One business object (`hr.employee`, evaluation slip, …) | One object → one mental product |
| **Views** | form / list / kanban / search … on **same model** | Modes of seeing, not separate apps |
| **Form** | Single-record display & edit | Deep work + shareable open |
| **List** | Many records overview | Index only |
| **Search / domain** | Filters applied to current view | Status/scope without new menus |
| **Menu + action** | Opens model in a view mode | Navigation is resource-oriented *in product sense* (even if URL historically ugly) |
| **Access rights (groups)** | Who may CRUD model | Capability |
| **Record rules** | Which **rows** a user sees | Scope without cloning UI |
| **Multi-company** | `company_id` + rules | Tenant isolation |

Odoo form is explicitly: *“Display and edit the data from a single record.”*  
List: *“View and edit multiple records.”*  
Kanban: card visualization of the **same** records — not a second product.

### 2.2 Vận hành người dùng (từ KPI screenshot + grammar)

1. User opens **one board** for the document type.  
2. Columns/filters = **state** (Draft / Approved).  
3. Manager scope (“My Department”) = **record rule / domain**, same board.  
4. Detail work = **form** of that record (URL share).  
5. No second app titled “Approve KPI for managers”.

### 2.3 URL reality (CMC already corrected)

Legacy Odoo hash `#action=&model=&menu_id=` is **opaque and brittle**.  
CMC TL06 **rejects** that; Odoo 19 docs still describe view/model architecture, while CMC uses **path resource grammar**.  
**Adopt Odoo product grammar; reject Odoo legacy URL machine.**

---

## 3. Scout: CMC as-built (technical)

| Layer | CMC implementation | Health |
|-------|-------------------|--------|
| Shell | Console `.o_web_client` + ConsoleNavbar | Good (Odoo-inspired chrome) |
| URL | TL06 path; `@cmc/links` + `/go` | Good for P0 entities |
| Views | ListPage / DetailPage / FormPage / FilterBar | Good frames |
| API | tRPC routers per domain; `requirePermission` | Good |
| Scope | facility + RLS; track on shifts; managerId on KPI | Correct **but multi-axis** — must stay explicit |
| Nav | ~39 leaf paths; some role-named (“Duyệt KPI”) | **Bloat signal** |
| Pilot | shifts list+new+form+get | Form depth OK; list still dual HITL |

---

## 4. GO structure — 7 layers (lock)

```
L0 Surface     admin Console | lms portal
L1 Shell/Nav   NAV_MODULES · permission-gated · resource labels
L2 Addressing  /area/resource[/:id|/new] · query filters · @cmc/links · /go
L3 View frames ListPage | DetailPage | FormPage | (Kanban only when pipeline)
L4 Domain      Prisma model + status · tRPC resource router · domain-* pure
L5 Authz       permission keys · row rules (facility|track|managerId|owner|SoD)
L6 Tenancy     facilityId + RLS (always)
L7 Async       workers · audit (optional)
```

### Template một document resource

```
MODEL     ShiftRegistration | KpiScore | …
LIST      /hr/shifts | /hr/kpi          + ?status=&scope=&period=
FORM      /hr/{resource}/:id            statusbar + actions
NEW       /hr/{resource}/new            when compose is heavy
API       list · get · mutate(status)
NAV       resource name (never "Duyệt …")
SCOPE     facility always + domain row rule
LINK      links.* + /go/*
```

---

## 5. Hard rules chống phình (non-negotiable)

1. **1 model / 1 menu leaf** for workflow documents.  
2. **Status = filter**, never new menu.  
3. **Role = row set + form buttons**, never second page named for the role.  
4. **List = index** → navigate to form URL; expand is secondary.  
5. **Form = work surface** + cold-start `get`.  
6. **API routers named by resource**, not by role.  
7. **facility RLS always**; track ≠ managerId (document per module).  
8. **No hash / ir.actions / OWL port.**  
9. **One form-depth module series at a time.**  
10. **Done = CI green** (typecheck-and-test + ui-e2e).

---

## 6. Scope model CMC (honest)

| Axis | Use for | Not for |
|------|---------|---------|
| **facilityId** | All data walls | — |
| **track** (KD/GV from roles) | Shifts, punch, some HR buckets | KPI confirm tree |
| **managerId** | KPI confirm anti-self / tree | Shift approve |
| **owner** | My registrations, my score | Director bulk |
| **SoD money** | Receipt approve list | HR docs |

Do **not** invent a generic “ScopeService” that merges these — wrong defaults leak data.

---

## 7. Target IA

### Shifts (canonical recipe)

`/hr/shifts` → `/new` → `/:registrationId` · `/go/shiftRegistration/:id`  
Row: facility + owner | matching-track GĐ  

Next hygiene: demote list-row approve; prefer form HITL.

### KPI (fix role-page)

Today: nav **Duyệt KPI** = GĐ inbox only.  
Target: nav **KPI** · list board · form `/hr/kpi/:scoreId` · `kpi.get` · staff may enter via same family or `/hr/my` link — **one product**.  
Row: facility + managerId (confirm) + director bulk/override.

### Payroll

Keep period×user **workspace** until product proves UUID slip HITL need.

---

## 8. 90-day sequence (advise)

| Window | Work |
|--------|------|
| D0–14 | Lock this structure doc; optional nav rename Duyệt KPI→KPI |
| D14–30 | Close any residual shifts e2e/CI; list de-bloat optional S PR |
| D30–55 | KPI form-depth plan + cook (`get`, links, form) |
| D55–75 | Aftersale **or** refund form-depth (one) |
| D75–90 | Nav/links census; payroll decision note only |

---

## 9. Advise verdict

| Question | Answer |
|----------|--------|
| Odoo lean principle correct? | **GO** — model/views/rules, not hash/OWL |
| CMC structure clear? | **Yes — lock 7 layers above** |
| Biggest bloat today? | Role-named KPI page; dual HITL on shifts list |
| First implementation after lock? | KPI shared board+form **or** shifts list de-bloat (S); prefer structure rename + KPI plan if share pain is high |
| Research enough to implement? | **Enough to lock structure**; still need short Odoo **KPI domain** note (evaluation slip lifecycle) before coding KPI board columns |

---

## 10. Next 3 steps

1. Owner **accept GO structure** (this file).  
2. Write ADR-lite or plan phase-00 “resource-centric UX law” linked from AGENTS/TL06.  
3. Open `form-depth-kpi-shared-workspace` plan **after** shifts pilot considered closed on develop.

