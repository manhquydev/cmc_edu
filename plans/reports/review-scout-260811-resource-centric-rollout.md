# Review + Scout — Resource-centric rollout

**Date:** 2026-08-11  
**Scope:** KPI shared workspace + shifts form-depth business review; next ERP modules  

## A. Business review (đã triển khai)

### A1. KPI shared workspace — domain check

| Rule (docs/20 + router) | Implementation | Verdict |
|-------------------------|----------------|---------|
| `approved` only via bulkApprove | Form has no single-approve; board bulk only | **OK** |
| confirm = managerId (not track) | Server confirm unchanged; form calls same mut | **OK** |
| override = branch director + reason | Form uses `kpi.approve` key + override mut | **OK** |
| anti-self confirm/override | Server; UI hides when `isOwner` | **OK** |
| payslip finalized blocks | Server only (UI may 403) | **OK** (same as board) |
| list branch scope GĐ | Unchanged for directors | **OK** |
| list self for staff | Non-director → `appUserId = caller` | **OK** (test updated) |
| get cold-start ACL | owner \| managerId \| branch GĐ \| super | **OK** for read |

**Residual UX (not domain regression):**  
Form/board show **Xác nhận** for any role with `kpi.confirm`, not only `managerId` match. Non-manager GĐ click → server FORBIDDEN. **Pre-existed on board**; form copied.  
**Fix later (S):** hide Xác nhận unless `data.appUser.managerId === me.appUserId` (needs session/appUser id on me or include in get for “viewerIsManager” flag from server).

**Residual dual surface:** Board still has Xác nhận/Ghi đè shortcuts + form. Acceptable secondary; form is share path.

### A2. Shifts form-depth — domain check

| Rule | Verdict |
|------|---------|
| ticket-lock / track GĐ / no manager chain | Unchanged on mutations |
| shift.get ACL | owner \| track director \| super |
| submit → form URL | e2e green |
| approve only submitted | Server |
| Dual list tabs + list-row Duyệt | **UX residual bloat**, not domain break |

### A3. Test evidence (last cook)

- links 30 · kpi API 83 · admin kpi/nav/detail 48+ · shift journey e2e local green (prior)

---

## B. System map (form-depth maturity)

### Already resource-centric (list + form UUID + links)

| Module | Paths | links |
|--------|-------|-------|
| Opportunity | `/crm` · `/crm/opportunities/:id` | opportunity |
| Receipt | `/finance` · `/finance/:id` | receipt |
| Student | `/admin/students/:id` | student |
| Class | `/admin/classes/:id` | classBatch |
| Session | `/teaching/sessions/:sessionId` | (workspace qs partial) |
| Shift registration | `/hr/shifts` · `/new` · `/:id` | shiftRegistration |
| **KPI score** | `/hr/kpi` · `/hr/kpi/:id` | **kpiScore** |

### Workspace (keep — not document form)

| Module | Why stay workspace |
|--------|-------------------|
| Check-in | Self punch, not multi-record share |
| Payroll | period × user; path form only if slip UUID HITL proven |
| Attendance / grading / session-evidence | Query workspace by class/session |
| Salary tiers | Config grid |
| My HR | Hub (links out to KPI form) |
| Cockpit / reports / recon | Aggregate |

### Next form-depth candidates (scout)

| Priority | Module | Today | Gap | Est | Why next |
|----------|--------|-------|-----|-----|----------|
| **P1 hygiene** | Shifts list de-bloat | Dual tab + list Duyệt | Demote list HITL; filter scope | **S** | Finish pattern; low domain risk |
| **P1 polish** | KPI confirm button accuracy | canDo only | Server flag or managerId on session | **S** | Avoid false 403 UX |
| **P2** | **Aftersale case** | list + dialogs; `caseId` on muts; **no get** | get + form route + links + Mở phiếu | **M** | Case-centric CSKH; UUID exists |
| **P2/P3** | Parents | list only | get + `/admin/parents/:id` | **M** | Contact deep link |
| **P3** | Refund | partial UI | get + path vs `/finance/:id` collision | **M–L** | Money risk; route ranking |
| **P3** | Session deep link | route exists | links.session + go entity | **S** | Complete teaching pack |
| **P4** | Gifts / rewards | list | optional form | **S–M** | Low HITL |
| **Skip now** | Payroll path form | query workspace | product decision first | — | — |

### Aftersale readiness (detail)

- Model: `AfterSaleCase` with UUID `id`  
- API: list, create, advance, resolve, close — **no `get`**  
- UI: table + dialogs on list  
- Permission: single `afterSale.manage` (shared board natural)  
→ **Best next document module** after KPI hygiene.

---

## C. Recommended next work sequence

```
1) P1 polish KPI confirm visibility (optional same PR as 2)
2) P1 shifts list de-bloat (S) — one list, form primary HITL
3) P2 aftersale form-depth (M) — get + /crm/aftersale/:id + links
4) P3 parents OR refund (choose by UAT pain)
5) Teaching links.session hygiene (S) anytime
```

**Do not** open payroll form-depth or Search OS or kanban KPI in this wave.

## D. Checklist reuse (authority)

From `docs/ux-resource-centric-structure.md` + phase-05 matrix:

1. TL06 path  
2. links + go  
3. get by id  
4. routes list + :id  
5. List → form navigate  
6. Tests  
7. CopyLinkButton  

## E. Open questions for owner

1. Next module after polish: **Aftersale** (recommended) or Parents?  
2. Accept residual board shortcuts on KPI/shifts, or force form-only HITL in de-bloat PR?  
3. Push KPI commit to PR #109 / develop now?

