# Locked decisions — Record-centric URL + form depth

**Locked:** 2026-08-11  
**Authority:** Product owner delegated (“cho phép bạn chốt thay tôi”)  
**Do not reverse** without new evidence + explicit owner override  

---

## D1 — What we learn from Odoo

**Decision:** Copy **navigation principles**, not the hash grammar.

| Copy | Do not copy |
|------|-------------|
| Every record has a form address | `#action=1486&model=…` |
| List is index; form is work surface | Integer action registry |
| Back leaves form to list | Hash-only SPA state |
| Statusbar + actions on **form** | OWL ActionManager |
| Deep link cold-start | Lộ internal model names |

**Rationale:** Odoo’s strength is record depth. CMC TL06 already rejected hash opacity; Odoo 19 itself moved path-first.

---

## D2 — URL grammar for Work Schedule (pilot)

**Decision:**

```text
/hr/shifts                         # list / workspace (mine | inbox)
/hr/shifts/new                     # compose (submit → redirect to :id)
/hr/shifts/:registrationId         # form chi tiết 1 phiếu (UUID)
/hr/shifts?scope=mine|inbox        # list filter (query)
/hr/shifts?view=table              # optional view mode later
```

**ID:** full **UUID** (same class as `/finance/:id`).  
**Not used:** `/attendance/shifts` (stale TL06 path — code authority is `/hr`).

---

## D3 — List vs form responsibilities

| Surface | Owns |
|---------|------|
| **List** | Tables: Của tôi / Hàng chờ GĐ; filters; navigate to form; shortcut “Soạn mới” → `/new` |
| **Form** | Statusbar (Soạn→Chờ duyệt→Đã duyệt); matrix 3 ca; field groups; Duyệt/Từ chối/Hủy; activity notes |
| **Expand under list** | Optional preview only — **not** primary GĐ path |

---

## D4 — Compose

**Decision:** Dedicated route **`/hr/shifts/new`**.  
After successful `shift.submit` → `navigate(links.shiftRegistration(id))` to the created record form (status Chờ duyệt).

---

## D5 — Links & agent HITL

**Decision:**

```ts
links.shiftRegistration = (id) => `/hr/shifts/${id}`
// LinkEntity extends with shiftRegistration
// resolveGo('shiftRegistration', id) → same path
```

Agent escalate: `/hr/shifts/{id}?flag=pending-approval` (or `/go/shiftRegistration/{id}`).

---

## D6 — API

**Decision:** Add **`shift.get`** (or `shift.registrationById`) if list endpoints are insufficient for cold-start:

- Input: `{ registrationId: uuid }`  
- Facility-scoped; owner **or** approver-eligible roles  
- Returns registration + entries + group meta + templates needed for matrix  

Do not load entire facility list client-side to open one form.

---

## D7 — Business content on form (already domain-locked)

Unchanged from prior domain work:

- Status: draft (client) → submitted → approved | rejected | cancelled  
- No Planned column; no CONFIRMED stage  
- Track filter: sale → KINH_DOANH SINGLE 3 ca; GV → GIAO_VIEN MULTIPLE 3 ca  
- Catalog ensure: `scripts/ensure-shift-catalog.ts`  

---

## D8 — System roll-out order (after pilot)

**Priority matrix (phase 5):** modules that today are expand/query-only and hold HITL decisions.

1. **Done pattern:** finance receipt, CRM opportunity, student, class, session  
2. **Pilot:** shift registration  
3. **Next candidates:** payroll detail path, KPI slip detail, aftersale case, refund  
4. **Later:** pure workspaces (check-in) may stay query-based  

Each module: `list + :id form + links.*` — same grammar.

---

## D9 — UX sync “như Odoo” trong CMC Console

**Decision:** Form chrome uses **CMC Console** components where possible:

- `PageHeader` breadcrumbs with parent `href`  
- `DetailPage` + `EntityHeader`  
- Chevron status (CMC labels, not numbered ProgressSteps if product rejects them)  
- Matrix notebook as form body  

Density/Odoo-like field layout allowed as **page-local CSS** under form route; do not fork global design system.

---

## D10 — Execution discipline

**Decision:** Heavy work → **phase gates**. No phase 3 UI until phase 1 API + phase 2 routes green.  
Each phase: tests + short report in `reports/`.  
Prefer small PRs: `links+api` → `routes+shell` → `form UX` → `e2e`.

---

## Reversal criteria

Only reverse if:

- Deep form URL proven harmful in UAT, **or**  
- `shift.get` security/RLS cannot be made correct, **or**  
- Owner explicitly overrides in writing  

Default: **proceed with path form pilot**.
