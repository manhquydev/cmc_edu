# Phase 04 — e2e, /go, deep-link proof

**Status:** pending  
**Risk:** Medium  
**Depends on:** phase 03  

## Goal

Prove cold-start and agent-style links; wire go-resolver; document UAT paths.

## Steps

1. Extend `/go` entity `shiftRegistration` if not done in phase 01.  
2. Playwright: submit as sale → assert URL `/hr/shifts/{uuid}` → GĐ open same URL → approve.  
3. CopyLinkButton on form.  
4. Update UAT checklist URLs to include `/:id`.  
5. Delete expand-primary code paths.  

## Acceptance

- [ ] e2e green for deep link path  
- [ ] `/go/shiftRegistration/{uuid}` resolves  
- [ ] UAT docs updated  

## Rollback

Keep go entity optional; e2e skip if env missing.
