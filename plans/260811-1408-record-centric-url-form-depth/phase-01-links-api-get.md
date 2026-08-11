# Phase 01 — Links + shift.get

**Status:** done (2026-08-11)  
**Risk:** Medium  
**Depends on:** phase 00  

## Goal

Machine-readable deep links + server-side read of one registration for cold-start form.

## Steps

1. `@cmc/links`: add `shiftRegistration: (id) => `/hr/shifts/${id}``; extend `LinkEntity` + `resolveGo` tests.  
2. API `shift.get` (name TBD):  
   - input `{ registrationId: uuid }`  
   - auth: owner OR can approve that group type OR super_admin  
   - return: registration + entries + shiftGroup {name,type,selectionMode} + templates for matrix  
3. Tests: owner ok; other facility deny; wrong track GĐ deny if applicable.  
4. Do **not** change UI routes yet.

## Files

- `packages/links/src/index.ts` + tests  
- `apps/api/src/shift/router.ts` + new test file  
- `apps/admin` typecheck if links types flow  

## Acceptance

- [ ] `links.shiftRegistration(uuid)` pure unit  
- [ ] `shift.get` green tests facility + RBAC  
- [ ] No UI regression  

## Rollback

Remove procedure + link key; no route depends yet.
