# Scout — AppUser mutation paths for Phase 4A

## Mutation inventory

| Procedure | Guard | Existing transaction / state notes | Phase 4A event(s) |
|---|---|---|---|
| `user.create` | `requirePermission('user', 'manage')`; non-super-admin cannot create `super_admin` | `withFacility`; manager validation, employee-code counter, AppUser insert, optional inline audits | `created {}`; plus `roles_updated {roles[]}` only when roles supplied; `password_reset {}` only when temp password supplied |
| `user.update` | `user.manage`; director cannot mutate a super-admin target | `withFacility`; same-facility target, manager/self/A↔B validation, update | diff-derived `profile_updated {fields[]}`, `activated {}` / `deactivated {}`, `manager_changed {managerId|null}`; suppress all if no effective change |
| `user.updateRoles` | `user.manage`; director cannot grant/revoke super-admin; self-demotion and last-active-admin blocks | `withFacility`; no-op returns without write/audit | `roles_updated {roles[]}` only on actual role-set transition |
| `user.resetPassword` | `user.manage`; director cannot reset super-admin | `withFacility`; target/email checks, hash + rotation state, inline secret-free audit | `password_reset {}` |
| `user.changeOwnPassword` | `protectedProcedure` only | `withFacility`; wrong-password outcome is returned then thrown **after commit** so lockout increments persist | no listed staff event in Phase-4 contract; preserve lockout transaction semantics; do not emit on failure |

## Permission / tenant boundaries

- `requirePermission` composes session, valid-facility, registry `can()`; `scoped(ctx)` forbids missing facility.
- Every mutating admin target lookup includes `id + facilityId`, yielding `NOT_FOUND` for cross-facility UUIDs.
- Directors have `user.manage`; target super-admins are read-only: update/reset blocked; role grant/revoke blocked; create super-admin blocked.
- Timeline must mirror `user.get`: `user.manage`, authorize parent AppUser inside `withFacility`, hardcode entity `AppUser`; never accept entity from client.

## Transaction boundary

`withFacility` opens one Prisma transaction, sets transaction-local RLS GUCs, passes `tx`. Event append must accept this exact `tx`; emitting via `ctx.db` splits state/event and risks RLS failure. Exceptions must happen before commit to roll back record plus event. Preserve `changeOwnPassword`'s outcome-after-commit pattern.

## Focused test matrix

Extend `apps/api/src/user/app-user.test.ts`; retain `apps/api/src/user/password-procedures.test.ts` for credential checks.

1. Create/update/updateRoles/reset: assert exact event kind/payload, event `entityId`, safe actor projection; no duplicate logical event.
2. Update field diffs: profile-only `fields[]`; manager change; activation/deactivation; unchanged input produces no event.
3. Password reset: `password_reset {}`; serialized event has no password/hash/token/OTP or secret-shaped keys.
4. Forced failure after event append: mutation rejects; neither domain write nor event commits.
5. Existing super-admin escalation cases: director create/update/updateRoles/reset against super-admin remain `FORBIDDEN` and emit none. Add missing explicit cases if absent.
6. Cross-facility target for every emitter/timeline: `NOT_FOUND`, no event, no leakage.
7. Timeline: same-facility director allowed; ordinary staff forbidden; cursor order/pagination; unknown/cross-facility IDs `NOT_FOUND`; response hardcodes AppUser and actor omits raw `userId`/credentials.
8. Regression: `user.updateRoles` no-op has no write/audit/event; wrong-password lockout survives because error is thrown after transaction commit.

## Existing proof / gaps

Existing coverage: CRUD/facility/manager/role guards in `apps/api/src/user/app-user.test.ts`; password hash, lockout, secret-free audit, RBAC, cross-facility reset in `apps/api/src/user/password-procedures.test.ts`. No RecordEvent/timeline coverage exists yet. `update` currently does not test director rejection against super-admin; reset lacks that explicit target guard; create lacks director-super-admin grant rejection; updateRoles lacks director-vs-super-admin target/grant/revoke cases.

Status: DONE
Summary: Mapped all AppUser mutation paths, guards, transaction constraints, Phase 4A event seams, focused test matrix. No files modified outside this report.
Concerns/Blockers: `updateRoles` last-admin count plus update has documented READ COMMITTED TOCTOU window; Phase 4A event insertion must not widen it.
