# Phase 04 — e2e, /go, deep-link proof

**Status:** done (2026-08-11) — local ui-chromium journey green  
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

- [x] e2e green for deep link path (PLAYWRIGHT_UI=1 shift journey, 1 passed)  
- [x] `/go/shiftRegistration/{uuid}` resolves (links unit)  
- [x] CopyLinkButton on form  
- [x] UAT docs updated (runbook-uat-golive, TL25, WF-P3-03)  

## Rollback

Keep go entity optional; e2e skip if env missing.
