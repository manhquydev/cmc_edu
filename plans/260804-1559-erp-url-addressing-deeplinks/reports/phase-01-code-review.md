# Phase 1 Code Review — ERP URL Addressing Deeplinks

**Date:** 2026-08-04  
**Branch:** `feat/erp-url-addressing-deeplinks` (based on `origin/develop`)  
**Score:** **7.5 / 10**  
**Verdict:** Accept with required hardening before Phase 2 reuses `safeReturnTo` as a broader redirect sink. Phase 1 acceptance criteria are met for SPA `navigate()` consumers.

## Scope

| Item | Detail |
|------|--------|
| Files | NEW: `safe-return-to.ts`, `safe-return-to.test.ts`, `seed-staff-password.ts`, `deeplink-return-to.ui.spec.ts`; MOD: `routes/index.tsx`, `login.tsx`, `login.test.tsx`, `change-password.tsx` |
| LOC | ~72 modified + ~378 new |
| Focus | Phase 1 returnTo + open-redirect policy + e2e form-login seed |
| GitNexus | `detect_changes(scope=all)` → risk **low**, 0 affected processes (auth chrome only) |
| Scout findings | Control-char open-redirect via `URL`/`location.assign`; double-`decodeURIComponent` after `searchParams.get`; weak unit assertion on returnTo carry |

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Unit: `//evil.com`, `https://`, `/\\evil`, empty, `javascript:`, `/login`, `/change-password`, nested `/finance?page=2` | **MET** | `safe-return-to.test.ts` |
| E2e (a) deep-link → form login → original URL | **MET** | `deeplink-return-to.ui.spec.ts` + claimed 3/3 PASS |
| E2e (b) `returnTo=//evil.com` → cockpit | **MET** | positive URL assert to `/cockpit` |
| E2e (c) mustChangePassword carries returnTo | **MET** | seed + change-password → original opp URL |
| Open-redirect policy centralized in `safe-return-to.ts` | **MET** | single `RETURN_TO_EXCLUDED`; RequireAuth/login/change-password import it |
| GitHub issue server-side mustChangePassword | **MET** | [#58](https://github.com/manhquydev/cmc_edu/issues/58) OPEN |
| Full `ui-e2e` / CI green | **NOT VERIFIED HERE** | only new spec + admin unit suite re-checked locally |

## Overall Assessment

Phase 1 delivers the planned UX correctly: capture in `RequireAuth`, restore via `safeReturnTo` on login and change-password, form-login e2e infrastructure that later phases need. Listed open-redirect cases are blocked. Business logic outside auth chrome is untouched (GitNexus low risk).

Two defects matter for production readiness of the **shared policy module**: (1) double-decode after `searchParams.get` can corrupt legitimate query payloads; (2) control-character vectors (`/%09//evil.com` → `/\t//evil.com`) pass the regex and resolve to `http://evil.com/` under `new URL` / `location.assign`, even though React Router 7 `navigate()` currently keeps them same-origin via history API. Because this file is explicitly the Phase 2 `/go` + future SSO sink, harden now.

## Critical Issues

**None for current Phase 1 consumers** (React Router `navigate` / `<Navigate>` only; listed AC vectors rejected).

No HARD-GATE business-logic side effects (see below).

## High Priority

### H1 — Control-char / whitespace open-redirect bypass in shared policy

**Where:** `apps/admin/src/lib/safe-return-to.ts`  
**Problem:** Regex only rejects second char `/` or `\`. After `decodeURIComponent('/%09//evil.com')` → `'/\t//evil.com'`, which **passes** and is returned.  
**Impact:**

```text
new URL('/\t//evil.com', 'http://localhost:4173/') → http://evil.com/
```

RR7 `navigate` currently serializes to same-origin `/\t/evil.com` (not protocol-relative). Still unsafe for:

- future SSO `Location` / `window.location.assign` (comment in `login.tsx` points here)
- any Phase 2 consumer that assigns rather than SPA-navigates
- defense-in-depth of the single policy module

**Fix example:**

```ts
export function safeReturnTo(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  // Reject control chars / whitespace that browsers strip before //host
  if (/[\u0000-\u0020\u007f]/.test(decoded)) return '/';
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return '/';
  }
  let url: URL;
  try {
    url = new URL(decoded, 'http://safe.invalid');
  } catch {
    return '/';
  }
  if (url.origin !== 'http://safe.invalid') return '/';
  const pathOnly = url.pathname;
  if (RETURN_TO_EXCLUDED.includes(pathOnly as (typeof RETURN_TO_EXCLUDED)[number])) {
    return '/';
  }
  return `${url.pathname}${url.search}`; // drop hash (plan: out of scope)
}
```

Add unit cases: `/%09//evil.com`, `/%0a//evil.com`, `/%2f%2fevil.com` after partial decode paths.

### H2 — Double `decodeURIComponent` after `searchParams.get`

**Where:** `safeReturnTo` always re-decodes; callers pass `searchParams.get('returnTo')` (already decoded once).  
**Problem:** Captured deep link `/finance?q=100%25off` → after encode → get → decode again → `/finance?q=100%off` (corrupted).  
**Impact:** Silent wrong destination for any returnTo whose query contains `%xx`. Not open-redirect, but breaks deep-link fidelity (the product goal).  
**Fix:** Either:

- document that input is **already decoded** and only decode when still fully encoded, or
- prefer not decoding when value already matches `/^\/(?![/\\])/`, and only attempt decode as a fallback for defense (`%2F%2Fevil` style).

```ts
// Prefer: treat searchParams-decoded values as canonical
if (/^\/(?![/\\])/.test(raw)) {
  decoded = raw;
} else {
  try { decoded = decodeURIComponent(raw); } catch { return '/'; }
}
```

Unit: `safeReturnTo('/finance?q=100%25off')` must equal `'/finance?q=100%25off'`.

## Medium Priority

### M1 — Unit test for mustChangePassword returnTo carry is weak

**Where:** `login.test.tsx` “carries returnTo onto change-password…”  
**Problem:** `LocationProbe` only renders `pathname`; test explicitly does **not** assert `?returnTo=` content. E2e covers the gap, but unit claim is phantom for the carry contract.  
**Fix:** Probe `pathname + search` and assert  
`/change-password?returnTo=%2Ffinance%3Fpage%3D2` (or decoded equivalent).

### M2 — Full ui-e2e regression not proven in this worktree

Plan success criteria still open: “existing ui-e2e green” / CI gates. Spot-check: no existing admin e2e asserts exact bare `/login` without query (low regression risk). Still require CI `typecheck-and-test` + `ui-e2e` on PR.

### M3 — Missing unit coverage for double-encoded / control-char attacks

Acceptance list is covered; OWASP-adjacent vectors above are not. Add before Phase 2.

## Low Priority

### L1 — Forced rotation always appends `returnTo` even when dest is `/`

`navigate(\`/change-password?returnTo=${encodeURIComponent(dest)}\`)` → `/change-password?returnTo=%2F` when no deep link. Harmless (safeReturnTo('/') → '/'); slightly noisier than bare `/change-password`. Optional: omit query when dest === '/'.

### L2 — `shouldCaptureReturnTo` is exact-match only

`/login/` or `/Login` would be captured. Unlikely with current router; acceptable.

## Edge Cases Found by Scout

| Vector | `safeReturnTo` today | Risk |
|--------|----------------------|------|
| `//evil.com`, `https://…`, `/\\evil`, `javascript:` | → `/` | OK (AC) |
| `/%09//evil.com` → `/\t//evil.com` | **accepted** | High if non-SPA sink |
| `/finance?q=100%25off` | double-decode → `%` lost | High fidelity bug |
| `%252F%252Fevil.com` | double-decode → rejected | OK by accident |
| `/change-password` mid-session loss | not captured | OK (plan-accepted) |
| Existing e2e exact `/login` | none found | Low regression risk |

## HARD-GATE-NO-SIDE-EFFECTS

| Check | Result |
|-------|--------|
| Business logic (CRM/finance/teaching/HR) mutated? | **No** |
| API / DB schema / auth cookie semantics changed? | **No** |
| `mustChangePassword` server enforcement changed? | **No** (tracked #58 only) |
| Public contracts broken? | **No** (client UX only; login URL may gain `?returnTo=`) |
| Unrelated file rewrites / scope creep? | **No** |
| E2e seeds AppUsers via real API | Expected test infra; ephemeral facility |

**Flag: CLEAR** — no hard-gate side effects. Intentional redirect-shape change for unauthenticated deep links only.

## Positive Observations (risk calibration)

- Policy truly centralized (`RETURN_TO_EXCLUDED` shared by capture + restore).
- E2e uses real form login + real `user.create` / `staff-login` / `changeOwnPassword` (no bcrypt shortcut).
- Positive URL assertions (including evil → `/cockpit`), not mere “still on origin”.
- Plan honesty on client-hint `mustChangePassword` + issue #58 filed with evidence paths.
- SSO future-hook comment present without implementing dead SSO code.

## Recommended Actions (priority order)

1. **H1** Harden `safeReturnTo` with control-char reject + `new URL` same-origin check; add unit cases.  
2. **H2** Fix double-decode; unit for `%25` in query.  
3. **M1** Strengthen login unit probe to include `search`.  
4. Open PR; rely on required CI checks for full suite (M2).  
5. Do **not** mark Phase 1 complete in plan until H1/H2 fixed if Phase 2 will import this module immediately after — otherwise ship Phase 1 with H1/H2 as blockers before 2b `/go`.

## Metrics

| Metric | Value |
|--------|-------|
| Typecheck `@cmc/admin` | green (re-run) |
| Typecheck `@cmc/e2e` | green (re-run) |
| Unit `safe-return-to` + `login` | 13/13 pass (re-run) |
| Claimed admin suite | 509/509 (author) |
| Claimed e2e deeplink | 3/3 (author) |
| Full ui-e2e | not re-run in this review |
| Linting issues introduced | none observed |
| GitNexus risk | low |

## Unresolved Questions

- Will Phase 2 `/go` use only SPA `Navigate`, or any full-page / HTTP redirect? (Drives H1 severity to Critical if HTTP.)
- Should `safeReturnTo` drop hash always (plan says hash out of scope) — currently hash is preserved in return value.

---

**Score: 7.5/10** — AC met; harden shared open-redirect policy before wider reuse.
