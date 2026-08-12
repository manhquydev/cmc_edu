# Phase 02 — Routes: list + form shell

**Status:** done (2026-08-11)  
**Risk:** Medium–High  
**Depends on:** phase 01  

## Goal

React Router tree matches decisions: list workspace, `/new`, `/:registrationId` form shell that loads `shift.get`.

## Steps

1. Split pages (recommended ownership):  
   - `shifts-list.tsx` — tables + scope query  
   - `shifts-new.tsx` — compose (can re-export SubmitTab initially)  
   - `shifts-detail.tsx` — form shell: header, statusbar, load by id, actions placeholders  
2. `hr.routes.tsx`:  
   - `shifts` → list  
   - `shifts/new` **before** `:registrationId`  
   - `shifts/:registrationId` → detail  
3. List: row action / Chi tiết → `navigate(links.shiftRegistration(id))`.  
4. Breadcrumbs: Nhân sự → Đăng ký ca (href list) → mã ngắn.  
5. Keep old expand temporarily as “Xem nhanh” optional OR remove if timeboxed.  
6. Unit tests routes + detail loading/empty/error.

## Acceptance

- [ ] `/hr/shifts/{uuid}` cold-start renders title from `shift.get`  
- [ ] Invalid uuid → empty/error, not crash  
- [ ] Back from form lands list  
- [ ] Existing submit tests still pass (new page or re-export)  

## Rollback

Restore single `shifts` route; feature-flag form route off.
