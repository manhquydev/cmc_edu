# US-UI-07 LMS app — parent + student mobile web

## Status

done

## Lane

high-risk

## Product Contract

`apps/lms` standalone Vite + React 19 + Mantine v7 app optimised for mobile web.

**Parent flow:** email OTP login → child list → report card, session evidence (photo gallery).
Photo consent enforced: photos are hidden from DOM when `photoConsent = false` OR
`photoConsentRevokedAt IS NOT NULL`.

**Student flow:** phone + password login → home, change-password screen
(`mustChangePassword` enforced — student cannot navigate away until password changed),
homework list.

**Route-level kind guards:**
- `<ParentOnly>` wrapper: redirects to `/login` when session `kind !== 'parent'`.
- `<StudentOnly>` wrapper: redirects to `/login` when session `kind !== 'student'`.

`parseLmsToken` rejects tokens with empty `parentAccountId` for parent kind.

## Relevant Product Docs

- `docs/15-phu-huynh-hoc-sinh-portal.md`
- `docs/19-security-va-privacy.md`

## Risk Flags

- Auth (OTP + password login, session token parsing)
- Authorization (kind guards, `mustChangePassword` gate)
- Audit/security (photo consent — privacy-sensitive data must not leak into DOM)
- Cross-platform (mobile web — touch targets ≥ 44px, viewport meta)

## Acceptance Criteria

- Student session → parent route → `/login` (no flash of protected content).
- Parent session → student route → `/login`.
- `photoConsent = false` → photo elements absent from DOM (not just hidden via CSS).
- `photoConsentRevokedAt IS NOT NULL` → same DOM-absent behaviour.
- `parseLmsToken` throws on token with empty `parentAccountId`.
- `mustChangePassword = true` → student cannot navigate to `/home` until password changed.

## Design Notes

- Commands: `lmsAuth.loginStudent`, `lmsAuth.changeStudentPassword`, `lmsAuth.requestOtpEmail`,
  `lmsAuth.verifyOtpEmail`.
- Queries: `lms.childList`, `lms.reportCard`, `lms.sessionEvidence`, `lms.homework`.
- API: tRPC procedures (see US-UI-01a, US-UI-01b).
- Tables: `ParentAccount`, `AppUser` (student), `SessionEvidence`, `Homework`.
- Domain rules: photo consent check; mustChangePassword redirect; kind-discriminator.
- UI surfaces: `apps/lms/src/` (all routes and kind guard wrappers).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-07 --unit 0 --integration 1 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | `parseLmsToken` — rejects empty `parentAccountId`; kind discrimination. |
| Integration | `pnpm typecheck` passes for `apps/lms`; build green. |
| E2E | `kind-isolation.spec.ts` — kind-guard redirect tests (API-driven token injection). |
| Platform | `pnpm build` green for `apps/lms`. |
| Release | `pnpm typecheck` workspace-wide passes. |

## Harness Delta

Adds `kind-isolation.spec.ts`. Photo consent enforcement is a DOM-absence guarantee,
not a CSS hide — verified by querying the element from the spec.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
