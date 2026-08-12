# Brainstorm + Advise — Odoo shared workspace vs role-page bloat

**Date:** 2026-08-11  
**Mode:** brainstorm + --advise  
**Screenshot:** Odoo KPI "Phiếu đánh giá" — columns Draft | Approved, scope My Department  

## Brainstorm contract

| Field | Content |
|-------|---------|
| **Outcome** | CMC modules that are **document workflows** (KPI slip, shift registration, similar) use **one resource workspace** + **record form URL**; different roles see **different record sets and actions**, not separate "Duyệt X" apps. System stays slim as roles grow. |
| **Constraints** | TL06 path grammar (no Odoo hash); server authority (facility RLS, track GĐKD/GĐĐT, ticket-lock); existing pilot form-depth shifts; solo operator + CI gates; Vietnamese staff UX. |
| **Non-goals** | Port Odoo OWL/hash/action IDs; kanban Search OS full parity; rewrite all modules at once; invent manager hierarchy if CMC still uses role-track not org-tree. |
| **Acceptance** | Written principle accepted; inventory of bloated vs shared surfaces; next plan only after Odoo dissection notes for **one** pilot module (KPI or finish shifts list de-bloat). |

## What Odoo is doing (from your KPI screenshot)

1. **One document type = one menu entry** ("Phiếu đánh giá" / evaluation slips).  
2. **Status is a view dimension** (columns Draft | Approved), not a second app.  
3. **Scope filter** ("My Department") narrows *which records*, not *which product*.  
4. **Create** stays on the same board; work continues on **form URL** when depth is needed.  
5. Manager and staff share the **same mental model** — manager is not sent to "Approve KPI app".

Copy **these principles**. Do **not** copy teal theme, left mega-menu, or Import/RESET unless CMC needs them.

## CMC evidence (as-built)

| Surface | Today | Bloat pattern? |
|---------|--------|----------------|
| `/hr/kpi` | Nav **"Duyệt KPI"**; `kpi.list` inbox for GĐ; actions confirm/override/bulk | **High** — role-named page; staff has no shared board |
| `/hr/shifts` | List mine + tab **Duyệt/Từ chối** for GĐ; form `/:id` for depth | **Medium** — form-depth good; dual list tabs still Odoo-anti-pattern residue |
| Receipt / Opportunity | Shared list + form URL | **Low** — closer to Odoo principle |

## Principle (recommended lock)

```
Resource-centric UX, not role-centric apps.

  One resource → one list/board URL
  Role → scope of records + which form actions appear
  Share → form UUID /go/{entity}/{id}
  Never → "Duyệt X" as a separate product for each role
```

## Approaches

| # | Approach | Pros | Cons |
|---|----------|------|------|
| A | **Status quo + form URLs only** | Cheap | Keeps role-page bloat (Duyệt KPI, dual shift tabs) |
| B | **Shared workspace + form depth** (Odoo principle) | Scales with roles; matches your KPI experience; aligns shifts pilot form | Needs scope model + rename nav; careful API list scopes |
| C | **Clone Odoo kanban layout now** | Looks familiar | High UI cost; can skip hard scope/auth work; YAGNI risk |

**Recommend B.** Layout can be table first; kanban is optional later.

## Advise (counsel)

### GO on the principle
Yes — Odoo’s optimization here is real: **multiply roles without multiplying pages**. CMC already feels the pain (nav "Duyệt KPI", shift "Duyệt / Từ chối" tab).

### How far shifts pilot went
- **Done:** form URL, cold-start `shift.get`, share `/go`, GĐ can act on form.  
- **Still bloated:** list still teaches GĐ a second “inbox app” tab. Next slim step: **one list**, filters/columns (status, mine/team), primary CTA open form; demote list-row Duyệt to optional shortcut.

### KPI redesign (not blind Odoo clone)
1. Rename mental model: **Phiếu KPI** / Work Schedule language, not "Duyệt KPI".  
2. **One URL** `/hr/kpi` (board) + `/hr/kpi/:scoreId` (form).  
3. **Scope (server):**  
   - staff → own scores  
   - GĐ → track/facility branch (current list already branch-scoped — reuse, don’t invent manager tree until product owns org chart)  
4. Board view: group by status (table sections or kanban *after* data model clear).  
5. Actions on form: confirm / override / (bulk period remains director tool, can stay board action).  
6. **Do not** keep a second nav item "Duyệt KPI" once board is shared.

### Risks
| Risk | Mitigation |
|------|------------|
| Fake "My Department" without org tree | Use **facility + role track** first; label honestly ("Cơ sở / track của tôi") until managerId graph is product truth |
| Permission explosion | Same page; `canDo` only toggles actions |
| Ticket-lock / period bulk | Keep bulk "Đã trả lương kỳ" as **board toolbar**, not new page |
| Kanban addiction | Table + status filter first; kanban is chrome |

### Sequencing (after form-depth shifts e2e)
1. **Dissect Odoo (1 short research note):** list vs form ownership, domain rules, filters — for KPI *and* work schedule only.  
2. **De-bloat shifts list** (small PR): single list + filters; form remains work surface.  
3. **KPI plan:** shared board + `kpi.get` + form URL — first full application of anti-bloat principle.

### Hard non-goals (protect slimness)
- No new "Duyệt *" nav items.  
- No per-role duplicate modules.  
- No Odoo hash/action registry.  
- No big-bang redesign of all HR in one PR.

## Next 3 concrete steps
1. Accept principle **B** (or state override).  
2. Write `plans/reports/research-odoo-shared-board-kpi-shifts.md` (dissection only, no code).  
3. Open plan `form-depth-kpi-shared-workspace` **or** micro-plan `shifts-list-debloat` first (prefer shifts list de-bloat if KPI domain still fuzzy).

## Handoff
→ After principle accept: `ak:plan` for chosen next module.  
→ Do not cook KPI form URLs until list scope API is explicit.
