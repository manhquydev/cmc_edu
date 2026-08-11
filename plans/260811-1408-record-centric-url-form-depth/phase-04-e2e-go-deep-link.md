# Phase 04 — e2e, /go, deep-link proof

**Status:** in progress (2026-08-11)  
**Risk:** Medium  
**Depends on:** phase 03  

## Goal

Prove cold-start and agent-style links; wire go-resolver; document UAT paths.

## Steps

1. Extend `/go` entity `shiftRegistration` if not done in phase 01.  
   - **Done:** `links.shiftRegistration` + `resolveGo` unit tests.  
2. Playwright: submit as sale → assert URL `/hr/shifts/{uuid}` → GĐ open same URL → approve.  
   - **Partial:** P3 journey source updated for `/new` + form URL; **not re-run green here**.  
3. CopyLinkButton on form.  
   - **Done:** `shifts-detail` header `mode="go" entity="shiftRegistration"`.  
4. Update UAT checklist URLs to include `/:id`.  
5. Delete expand-primary code paths (list shortcuts may keep Duyệt for density).  

## Acceptance

- [ ] e2e green for deep link path  
- [x] `/go/shiftRegistration/{uuid}` resolves (links unit)  
- [x] CopyLinkButton on form  
- [ ] UAT docs updated  

## Rollback

Keep go entity optional; e2e skip if env missing.
