---
title: "Phase 2: Staff Authorization and API Contract"
status: done
---

# Phase 2: Staff Authorization and API Contract

## Overview

**Priority:** P0 · **Depends on:** Phase 1

Make Staff/AppUser cold-startable and fully manageable at the API boundary before adding UI.
Preserve `user.manage`; make target guards and returned fields explicit.

## Context links

- `apps/api/src/user/router.ts`
- `packages/auth/src/index.ts`
- `packages/db/prisma/schema.prisma` (`AppUser`)
- [D2 Staff authorization](./decisions.md)

## Requirements

- [ ] Add `user.get({ appUserId })`, facility-scoped with `APP_USER_SELECT`.
- [ ] Include safe manager identity needed by the form; never credential columns.
- [ ] Directors/super admin can read same-facility targets under D2.
- [ ] Cross-facility and unavailable targets return `NOT_FOUND`, not existence-leaking `FORBIDDEN`.
- [ ] Directors receive a read-only same-facility `super_admin` profile; update/roles/reset remain
  forbidden and manager-picker eligibility excludes that target.
- [ ] Existing update/create/updateRoles/resetPassword super-admin guards remain.
- [ ] No ordinary staff access; self-service stays in `/hr/my`.

## Architecture

`user.get` uses `scoped(ctx)` + `withFacility`. It selects only browser-safe fields and joins only
safe manager/subordinate summaries. UI authorization is a duplicate safety boundary, not authority.
Do not introduce `staff.read/manageProfile/manageAccess` keys in this plan; they would change the
as-built business contract without need.

## File inventory

| Path | Action | Test impact |
|---|---|---|
| `apps/api/src/user/router.ts` | modify | get procedure + shared target guard/select + Staff manager-picker eligibility |
| `apps/api/src/user/app-user.test.ts` or existing user tests | modify/create | actor-target matrix |
| `packages/auth/src/index.ts` | verify, no intended semantic change | permission drift assertion |
| `apps/api/src/test/db.ts` | modify only if cleanup fixture needs it | integration cleanup |

## Implementation Steps

1. Write failing tests for safe serialization, same-facility director read and cold-start fetch.
2. Add negative tests: ordinary role, cross-facility, director targeting super admin for sensitive
   actions; add positive read-only super-admin profile proof.
3. Extract a small target loader only if it removes duplicated facility/super-admin checks.
4. Implement `user.get`; keep `APP_USER_SELECT` as the serialization authority.
5. Run all user-router and auth permission tests.
6. Run API package typecheck/test before Phase 3.

## Test scenario matrix

| Actor / target | Expected |
|---|---|
| GĐKD → ordinary same facility | get/update allowed |
| GĐĐT → peer director same facility | allowed per as-built D2 |
| director → super admin | list/get read-only; update/roles/reset forbidden; absent from manager options |
| ordinary staff → any staff | forbidden |
| director → other facility UUID | not found |
| super admin → same facility | allowed |
| response serialization | no passwordHash, attempts, lockout internals |

## Success Criteria

- `user.get` cold-starts one staff record without list cache.
- D2 matrix is executable proof, not only UI logic.
- No browser response contains credential fields.
- Focused API tests and typecheck pass.

## Risks

- **Permission widening:** no new roster; use current `user.manage`.
- **PII leakage:** central safe select; test keys recursively.
- **Cross-facility enumeration:** use facility-filtered lookup and `NOT_FOUND`.

## Security considerations

Passwords are never returned. Reset remains a separate mutation. Directors cannot grant, revoke,
reset or mutate a `super_admin`. Nav changes in Phase 3 do not change these rules.
