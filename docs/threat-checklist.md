# Threat Checklist (TL30 High-Priority)

Status legend: ✅ has negative test | ⚠️ partial | ❌ missing

| ID | Threat | Status | Test evidence |
|----|--------|--------|---------------|
| T2 | Unauthenticated access to protected procedures | ✅ | `requirePermission` + `protectedProcedure`/`lmsProcedure` gates on every non-public procedure; negative cases exercised throughout all module tests (e.g. `crm/list.test.ts` — hr role FORBIDDEN) |
| T4 | Cross-facility data read (RLS bypass) | ✅ | `apps/api/src/security/rls-enforcement.test.ts` — six assertions proving RLS blocks cross-facility reads/writes/raw queries at DB layer; `cleanupFacility` isolation per test in all integration suites |
| T9 | Self-approval of receipt (>20M threshold) | ✅ | `apps/api/src/finance/approve.test.ts` — "forbids self-approval above the threshold"; "double-approve concurrent race serialisation" |
| T12 | Student/assessment data exposed to wrong guardian | ✅ | `apps/api/src/assessment/draft-confirm.test.ts` — "parent without Guardian link → FORBIDDEN" for both `listForChild` and `reportCard.getForChild` |
| T13 | IP clock-in spoofing via client-controlled header | ⚠️ | `apps/api/src/checkin/ip-match.test.ts` — app-level CIDR gate tested; raw Node HTTP server reads `x-forwarded-for` naively (no framework trust-proxy setting); nginx/caddy MUST strip client-supplied `x-forwarded-for` before the app sees it — see `docs/trusted-proxy.md` |
| T16 | Double-redeem star exploit (concurrent race) | ✅ | `apps/api/src/rewards/redeem-refund.test.ts` — "concurrent race — only one succeeds when exactly 1 unit of stars available"; "concurrent reject calls produce exactly one refund" |
| T18 | Privilege escalation via role enum mutation | ✅ | No direct role-mutation endpoint exists; roles come from session context only; `@cmc/auth` `can()` registry is the single authority; `facility.test.ts` + `user/app-user.test.ts` verify role-gated paths |
| T19 | Concurrent finalize TOCTOU on payslip | ✅ | `apps/api/src/payroll/penalty-posttax.test.ts` — `payslip.finalize` locks via `status:'draft'` WHERE guard; assemble-after-finalize rejected BAD_REQUEST |
| T21 | Guardian-provisioning race (duplicate ParentAccount) | ✅ | `apps/api/src/provisioning/idempotent.test.ts` — two concurrent provisions resolve to exactly one ParentAccount; `guardian-provisioning.test.ts` — concurrent Guardian row race |
| T22 | Double email send (outbox relay race) | ✅ | `apps/api/src/worker/relay-email-outbox.test.ts` — "two concurrent drains never double-send the same row (atomic claim)" |
| T23 | cmc_app DB role has superuser privilege (RLS ineffective) | ⚠️ | `apps/api/src/boot-checks.ts` — startup assertion that `current_user` is not superuser; check is wired into `server.ts`; no automated test yet for the check itself |

## TODOs for ❌ / ⚠️ items

- **T13**: Confirm reverse proxy (nginx/caddy) config strips client-supplied `X-Forwarded-For` header before reaching the Node process. See `docs/trusted-proxy.md` for required proxy configuration.
- **T23**: Add a unit test for `assertCmcAppNotSuperuser` that asserts it throws when `is_superuser = true` and passes when false (can be done with a mocked `$queryRaw`).
