# Security/Threat Docs vs Code Audit

Scope: `docs/30-threat-model-v2.md`, `docs/threat-checklist.md`, `docs/trusted-proxy.md`.

## Verified mismatches

### 1. `docs/trusted-proxy.md` quotes a stale, superseded `resolveIp()` implementation

`docs/trusted-proxy.md:7-13` quotes this as the current code in `apps/api/src/context.ts → resolveIp()`:

```typescript
const forwarded = req.headers['x-forwarded-for'];
if (typeof forwarded === 'string' && forwarded.length > 0) {
  return forwarded.split(',')[0]!.trim();
}
return req.socket?.remoteAddress ?? null;
```

This snippet no longer exists. The actual `resolveIp()` at `apps/api/src/context.ts:161-181` (backed by `isTrustedProxy()` at `context.ts:142-159` and `TRUSTED_PROXY_CIDRS` at `context.ts:123-128`) only trusts `X-Forwarded-For` when the TCP `remoteAddress` itself is in an operator-configured trusted-proxy CIDR allowlist (default `127.0.0.1/32,::1/128`), and then takes the **rightmost untrusted hop**, not the first/leftmost value the doc describes. This is a real app-level trust-proxy mechanism — the doc's framing ("no framework-level trust proxy toggle... the security guarantee depends entirely on the reverse proxy") is now false; the app enforces this independently of proxy config.

Root cause: `docs/trusted-proxy.md` was authored in commit `6374161` (2026-07-07 03:31), and the `resolveIp()` rewrite landed the same day in commit `252f4da` (2026-07-07 17:36, "RT-5: resolveIp() now only trusts X-Forwarded-For when remoteAddress is in TRUSTED_PROXY_CIDRS... Takes rightmost untrusted XFF hop instead of leftmost"). The doc was never updated afterward — confirmed via `git log` showing only one commit touching this file.

Also stale: `docs/trusted-proxy.md:53` and `docs/threat-checklist.md:21` both frame the mandatory fix as "confirm reverse proxy strips X-Forwarded-For" — that's still good defense-in-depth advice, but it's no longer the *only* mitigation; `TRUSTED_PROXY_CIDRS` is also required at boot in production (`apps/api/src/boot-checks.ts:180`, `assertRequiredEnvForProd`).

### 2. `docs/threat-checklist.md` T13 status/description is stale

`docs/threat-checklist.md:11` (T13): "raw Node HTTP server reads `x-forwarded-for` naively (no framework trust-proxy setting); nginx/caddy MUST strip client-supplied `x-forwarded-for` before the app sees it" — status `⚠️` partial.

Code reality: same `resolveIp()`/`isTrustedProxy()` logic as above, plus a dedicated test file `apps/api/src/context.trusted-proxy.test.ts` (6 tests, added in the same `252f4da` commit) covering: no-XFF fallback, untrusted-remoteAddr rejection, trusted-loopback rightmost-hop selection, multi-hop rightmost-untrusted-hop selection, custom `TRUSTED_PROXY_CIDRS`, and undefined-req handling. The "reads naively" characterization is factually wrong for the current code, and the `⚠️` status undersells what's implemented — this threat now has an app-level negative-test suite independent of reverse-proxy config, which is exactly the kind of evidence the checklist's own legend (`✅ has negative test`) would credit elsewhere in the same file (compare T4, T9, T12 entries, which get `✅` for less proxy-dependent guarantees).

Not flagging as a full rewrite recommendation (that's a judgment call for the doc owner — reverse-proxy misconfiguration is still a residual risk worth documenting), but the current text describes code that predates the fix by ~14 hours same day.

## Checked, NOT stale (verified correct)

- `docs/30-threat-model-v2.md:19` T1 mitigation ("Tin `x-forwarded-for` chỉ từ proxy tin cậy") — accurately describes the current `TRUSTED_PROXY_CIDRS` gate. This doc was written 2026-07-05 (commit `528b378`), before the RT-5 fix (2026-07-07) — the text was aspirational/design-intent at the time and happens to match what was later built. No action needed.
- `docs/threat-checklist.md:17` T23 ("no automated test yet for `assertCmcAppNotSuperuser`") — still true. `apps/api/src/boot-checks.test.ts` covers `assertCmcAppRole`, `assertForceRlsOnAllRlsTables`, `assertRequiredEnvForProd` but has no test for `assertCmcAppNotSuperuser` (`boot-checks.ts:64-75`). TODO at `threat-checklist.md:22` is still open.
- `docs/30-threat-model-v2.md` T6 ("Sửa/xoá audit → Audit append-only; không API xoá") — still accurate for the app-facing surface: `AuditLog` has UPDATE/DELETE revoked from `cmc_app` (per comment in `apps/api/src/worker/audit-log-retention-sweep.ts:1-10`), and the only delete path is a separate privileged-connection retention sweep (`sweepAuditLogRetention`, 12-month cutoff) not reachable via any tRPC procedure. Worth noting this retention sweep exists (not mentioned in either doc), but it doesn't contradict the "no API delete" claim since it's not an API.
- PR #34's audit-log feature (`apps/api/src/audit/audit-helpers.ts`, `audit/router.ts`, the `auditLogMiddleware` wired into `trpc.ts:148,176` as `basedProcedure`) is a genuinely new generic audit-everything middleware (replacing an earlier "~25-site hand-written pattern" per `audit-helpers.ts:1-6`), but `docs/30-threat-model-v2.md` T6/T7/T8 don't claim audit "doesn't exist yet" — they describe intended mitigations declaratively and aren't falsified by this change. `docs/threat-checklist.md` doesn't track T6/7/8 at all. No doc update strictly required, though the checklist could optionally gain a T6/T7/T8 row now that there's a single-point, fully-generic implementation to cite as test evidence.

## Unresolved questions

- Should `docs/threat-checklist.md` T13 be upgraded to `✅` given the new `context.trusted-proxy.test.ts` suite, or kept `⚠️` because reverse-proxy misconfiguration remains a residual/operational risk outside the app's control? This is a judgment call for the doc owner, not something I can verify either way from code alone.
- Neither doc mentions the `audit-log-retention-sweep` 12-month auto-delete behavior. Not a contradiction, but potentially worth a line in `docs/30-threat-model-v2.md` T6 for completeness (data-retention posture, not a security gap).

Status: DONE
Summary: Two confirmed stale docs — `docs/trusted-proxy.md` quotes a `resolveIp()` snippet superseded same-day by commit 252f4da, and `docs/threat-checklist.md` T13 describes the same pre-fix "naive" behavior and undersells the now-tested `TRUSTED_PROXY_CIDRS` gate; T23 and the audit append-only claims were checked and remain accurate.
