# Phase 03 — Form UX + business (Work Schedule surface)

**Status:** done (2026-08-11)  
**Risk:** High  
**Depends on:** phase 02  

## Goal

Form page is the **primary** work surface: matrix 3 ca, CMC statusbar, approve/reject/cancel, track-aware compose on `/new`. Experience synchronized like Odoo form (statusbar + sheet + notebook), content = CMC domain.

## Steps

1. Move Work Schedule sheet/matrix/CSS from monolithic `shifts.tsx` into form + new pages.  
2. Form (`:id`):  
   - EntityHeader: Work Schedule / fullName  
   - Status: Soạn | Chờ duyệt | Đã duyệt (+ rejected/cancelled terminal)  
   - Clickable steps only where actionable (approve on form for GĐ)  
   - Matrix read-only for submitted+; edit only if product allows re-submit (default: no edit after submit)  
3. `/new`: track filter, SINGLE/MULTIPLE, Ca 1/2/3, submit → navigate to form id.  
4. List: mine / inbox via `?scope=`; no giant compose.  
5. Remove Planned / CONFIRMED / expand-as-primary.  
6. Tests: payload, SINGLE, cancel, approve, deep link open.

## Acceptance

- [ ] Sale/GV 3-ca business still correct  
- [ ] GĐ opens form URL → matrix + Duyệt/Từ chối  
- [ ] 17+ unit tests + any new detail tests green  

## Rollback

Keep list-only route behind flag; form behind `/hr/shifts/v2/:id` if needed (prefer not).
