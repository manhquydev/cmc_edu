# US-UI-01a Backend delta — SO receipt codes + email OTP auth substrate

## Status

done

## Lane

high-risk

## Product Contract

Change receipt code format from `PT-000001` to `SO00001` (`packages/domain-finance/src/receipt-code.ts`).
Add LMS email OTP auth substrate: `ParentAccount.email` field + `lmsAuth.requestOtpEmail` /
`lmsAuth.verifyOtpEmail` tRPC procedures. Prod worker uses `BrevoEmailTransport`;
`ConsoleEmailTransport` is dev/test only. Current prod failure is an invalid `BREVO_API_KEY` (HTTP 401), not "never sent".

## Relevant Product Docs

- `docs/11-api-contract.md`
- `docs/15-phu-huynh-hoc-sinh-portal.md`
- `docs/18-tech-stack-va-chuan-ky-thuat.md`
- `docs/19-security-va-privacy.md`

## Risk Flags

- Public contracts (receipt code format change affects existing receipts)
- Auth (new OTP flow, session token issuance)
- External systems (email transport — Brevo in prod; console forbidden in prod)

## Acceptance Criteria

- `SO`-prefixed codes generate correctly (`SO00001`, `SO00002`, …).
- `requestOtpEmail` returns `{ ok: true }` for a valid parent email.
- `verifyOtpEmail` with test-seam OTP returns `{ sessionToken }` with `kind = 'parent'`.
- Dev/test: ConsoleEmailTransport logs OTP to stdout. Prod: BrevoEmailTransport sends; current prod key is invalid (HTTP 401).

## Design Notes

- Commands: n/a.
- Queries: n/a (OTP verify issues a token, not a query result).
- API: `lmsAuth.requestOtpEmail`, `lmsAuth.verifyOtpEmail` (tRPC 11 + zod).
- Tables: `ParentAccount.email` — unique, nullable pre-migration; required post-migration.
- Domain rules: OTP 6-digit, 10-minute TTL, single-use.
- UI surfaces: none (backend only).

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-01a --unit 1 --integration 1 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | `receipt-code.ts` — `SO`-prefix generation, zero-padding, incrementing. |
| Integration | `lmsAuth.requestOtpEmail` returns `ok: true`; `verifyOtpEmail` with test-seam OTP returns token. |
| E2E | `lms-auth.spec.ts` — `requestOtpEmail` seam test (ConsoleEmailTransport path). |
| Platform | `pnpm build` (turbo) green; Prisma migration applies cleanly. |
| Release | `pnpm test` + `pnpm typecheck` workspace-wide. |

## Harness Delta

Adds `lmsAuth` router to `apps/api`. Adds `ParentAccount.email` field migration.
Email transport swap landed: `BrevoEmailTransport` in prod; remaining ops issue is a valid `BREVO_API_KEY`.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
