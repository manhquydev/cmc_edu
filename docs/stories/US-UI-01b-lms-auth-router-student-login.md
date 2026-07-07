# US-UI-01b Backend delta — LMS 2-tier auth router + student password login

## Status

done

## Lane

high-risk

## Product Contract

`apps/api/src/lms-auth/router.ts` implements:
- `loginStudent` — PBKDF2-SHA256 password verify, 5-attempt lockout (per student),
  sets `mustChangePassword = true` on provisioning default.
- `resetChildPassword` — parent-only; resets child password + sets `mustChangePassword = true`.
- `changeStudentPassword` — student session; clears `mustChangePassword`.

`LmsSubject.kind` discriminator is enforced throughout: student sessions cannot invoke
parent-only procedures, and parent sessions cannot invoke student-only procedures.

## Relevant Product Docs

- `docs/11-api-contract.md`
- `docs/15-phu-huynh-hoc-sinh-portal.md`
- `docs/19-security-va-privacy.md`

## Risk Flags

- Auth (PBKDF2 verify, lockout counter)
- Authorization (kind-discriminator enforcement, FORBIDDEN escalation)
- Data model (`failedLoginAttempts`, `lockedUntil`, `mustChangePassword` fields)
- Audit/security (no credential leak in error messages)

## Acceptance Criteria

- Wrong password → `"Invalid credentials."` (no username/password leak distinction).
- 5 consecutive failures → account locked; subsequent attempts return lockout error.
- `resetChildPassword` called with student session → `FORBIDDEN`.
- First login with provisioning default password → `mustChangePassword = true` in token payload.
- `changeStudentPassword` clears `mustChangePassword`.

## Design Notes

- Commands: `loginStudent`, `resetChildPassword`, `changeStudentPassword`.
- Queries: n/a.
- API: tRPC procedures under `lmsAuth` router.
- Tables: `AppUser.failedLoginAttempts INT DEFAULT 0`, `AppUser.lockedUntil TIMESTAMP NULL`,
  `AppUser.mustChangePassword BOOLEAN DEFAULT FALSE`.
- Domain rules: lockout threshold = 5, lockout duration = 15 min.
- UI surfaces: none (backend only — consumed by `apps/lms`).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-01b --unit 1 --integration 1 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a (logic covered by integration). |
| Integration | `loginStudent` lockout after 5 failures; `resetChildPassword` kind-guard rejects student token. |
| E2E | `lms-auth.spec.ts` (4 tests); `kind-isolation.spec.ts` (3 tests). |
| Platform | `pnpm build` green; Prisma migration applies cleanly. |
| Release | `pnpm test` + `pnpm typecheck` workspace-wide. |

## Harness Delta

Adds lockout + kind-isolation tests. No harness rule changes.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
