# Build Regression Post-Astryx Merge + Brevo OTP Credential Fix

**Date**: 2026-07-11 01:41 (build finding) · 10:35 (root cause resolved)  
**Severity**: Critical → **RESOLVED (was a false alarm — local env, not code)**  
**Component**: @cmc/lms/@cmc/admin (typecheck+build+test, all local-env only), Brevo OTP delivery  
**Status**: Build/typecheck/test/lint fully green after `pnpm install --frozen-lockfile`. Brevo fix: local applied, live VPS deploy pending.

**Addendum (10:35):** the "admin passes, only lms fails" split and the whole TS2307 cascade described below
was a stale local `node_modules` (147 packages drifted from lockfile, `eslint` never installed) — NOT a real
`@astryxdesign/core` bug, NOT worktree-state divergence. Fresh `pnpm install --frozen-lockfile` → build 14/14,
typecheck 26/26, test 21/21 (527 API tests), lint clean. Independently confirmed via the local self-hosted
`cmcv2-prod` Docker stack: `docker compose -p cmcv2-prod ps` showed `lms` container UP, serving `200` on
`/lms/` — `Dockerfile.lms` does its own clean install per build, so it was never exposed to this machine's
node_modules drift. All 3 "unresolved questions" from the original scout are closed — see
`docs/project-changelog.md` `[2026-07-11]` for the full trail.

---

## What Happened

Routine build-status scout before UAT/Go-No-Go on main @ b81710a revealed a real regression: `pnpm build` and `pnpm typecheck` fail catastrophically at @cmc/lms with ~30 `TS2307 Cannot find module '@astryxdesign/core/*'` errors. The same defect surfaces at runtime during `pnpm test` for @cmc/admin (Vite load failure). Investigation found the root cause: packages/ui/src/primitives.ts and most of packages/ui/src/components/*.tsx import deep subpaths (`@astryxdesign/core/TextInput`, `/Stack`, `/Dialog`) that the installed `@astryxdesign/core@0.1.4` package doesn't expose as typed entry points. Zero changes to pnpm-lock.yaml or packages/ui since the Astryx merge (PR #28/#29, merged main), meaning the "build clean" verification claims recorded in 2026-07-10 docs were likely never true on a clean checkout — cached turbo logs suggest verification ran in a separate git worktree with different node_modules state. Deploy topology anomaly: apps/lms and apps/admin build separately (Dockerfile.lms vs Dockerfile.admin in docker-compose.prod.yml). The 2026-07-11 cmcv2-prod redeploy only explicitly verified "admin SPA 200" — LMS's actual live state is unverified and unknown (could be stale image, failed build, or crashlooping).

In parallel: the 2026-07-10 Brevo OTP blocker ("401 Key not found") was root-caused. User's .env.prod file had a malformed BREVO_API_KEY line — missing trailing newline caused the value to absorb the next line's `GRAPH_TENANT_ID="..."` assignment directly, corrupting the key. A fresh API key was tested; first attempt got `401 unrecognised IP address` (Brevo IP-allowlist security), then `200 OK` after dev IP whitelisting. The key is valid. Fixed locally via surgical sed edit (one-line surgical fix, no other values in .env.prod touched). Not yet applied to live VPS.

Full evidence report: D:\project\vip\CMC\plans\reports\build-status-260711-0141-astryx-typecheck-runtime-break-report.md

---

## The Brutal Truth

This is a jaw-clenching moment. We merged Astryx UI three days ago with claimed "build clean + typecheck passing" verification, and that was either a lie or run in an isolated worktree state that doesn't match a clean main checkout. **Either way, we can't trust the merge verification.** UAT sign-off depends on confirming that LMS is actually building + running correctly on the VPS right now. It's not confirmed. OTP delivery is still broken live because .env.prod hasn't been patched. We're two days before the Go/No-Go decision with unresolved blockers we should have caught before the merge.

The Brevo credential fix is straightforward and local; frustrating but not panic-inducing. The build regression is the real problem — it's blocking the entire LMS feature surface, and we can't confirm whether cmcv2-prod even has a working LMS image.

---

## Technical Details

### 1. Build Regression — TS2307 Cascade at @cmc/lms

**Symptom:** `pnpm build` and `pnpm typecheck` fail with ~30 errors:
```
TS2307 Cannot find module '@astryxdesign/core/TextInput'
TS2307 Cannot find module '@astryxdesign/core/Stack'
TS2307 Cannot find module '@astryxdesign/core/Dialog'
... (10+ more, all from deep subpaths)
```

Error originates from packages/ui/src/primitives.ts and most of packages/ui/src/components/*.tsx. Investigation confirms `@astryxdesign/core@0.1.4` (installed in pnpm-lock.yaml) does NOT expose these deep subpaths as typed entry points. Package only exports a flat API (no `/TextInput` or `/Stack` exports in package.json).

**Evidence of broken merge:** Git log for `97a1bc0..HEAD -- pnpm-lock.yaml packages/ui apps/lms/package.json apps/admin/package.json` returns ZERO changes. The Astryx merge didn't modify dependency versions or entry points. Yet the 2026-07-10 journal claims "build clean." Verified that the verification path was `D:\project\vip\worktrees\CMC-feat-astryx-migration` — a separate git worktree with its own node_modules state. That explains the discrepancy: turbo cache was populated from that worktree and reused locally, giving false green.

### 2. @cmc/admin Anomaly — tsc Silent Pass

**Anomaly:** `@cmc/lms` fails tsc with TS2307. `@cmc/admin` does NOT fail tsc, despite importing from the same broken primitives.ts barrel (Dialog, HStack, Spinner, Stack, Text). **Yet runtime test failure proves the defect is real for admin too** — Vite's bundle-time module resolution fails when trying to load `@astryxdesign/core/Text`.

Inspected tsconfig.json, exports maps, and barrel file — could not explain why tsc is silently not catching the error for admin. **Root cause unknown; flagged as unresolved question.**

### 3. Brevo OTP — Malformed .env.prod Line

**Root cause found:** `.env.prod` BREVO_API_KEY line was missing trailing newline and absorbed the next line:
```
BREVO_API_KEY=xkeysib-...LzF69gryLpDVLie2GRAPH_TENANT_ID="4dd49669-..."
```

Actual runtime value corrupted. Not a wrong/expired key — a malformed env-file line (likely from prior scripted write on 2026-07-09 that didn't preserve newline).

**Fix applied locally:** Surgical sed edit, verified via wc -l + tail. .env.prod is gitignored; fix exists locally only.

**New key validation:** Tested via read-only GET https://api.brevo.com/v3/account with whitelist dev IP:
- First attempt: 401 "unrecognised IP address" (Brevo account has IP-allowlist enabled)
- After dev IP whitelisting on Brevo dashboard: 200 OK
- Account confirmed: cmceduvn@gmail.com, free plan, 300 sends/day cap

**NOT yet applied to live VPS.** Remaining steps: (1) add cmcv2-prod's VPS outbound IP to Brevo's authorised-IPs, (2) redeploy api + worker, (3) verify worker logs show successful send.

**Security note:** User pasted live Brevo SMTP + API keys directly in this session. Both should be rotated on Brevo dashboard after this work completes.

### 4. Pre-existing Noise

- `pnpm lint` completely broken: eslint binary not resolvable (likely needs `pnpm install`, not a code issue)
- 10 pre-existing TS7006 implicit-any errors in apps/lms (login.tsx, parent/report-card.tsx, parent/reset-child-password.tsx, student/exercise.tsx) — trivial, unrelated cleanup
- All other build paths pass: @cmc/db, @cmc/api, @cmc/admin, @cmc/e2e typecheck + build clean; all package tests pass (auth 447/447, domain-* 66/67, api 21/21)

### 5. Deploy Topology Gap

Dockerfile.lms and Dockerfile.admin are separate build contexts in docker-compose.prod.yml. The 2026-07-11 cmcv2-prod redeploy logged "admin SPA 200" explicitly. **LMS was never explicitly checked.** Given local build failure reproduces deterministically, LMS's actual live state on the VPS (stale image? failed build? crashlooping?) is unverified.

---

## What We Tried

### Approach 1: Assume Merge Verification Was Real
**Decision:** Rejected. Traced verification path to separate worktree; turbo cache was stale. Local `pnpm build` on clean checkout fails reproducibly.

### Approach 2: Wait for LMS Build to Self-Heal
**Decision:** Rejected. No code changes since merge; defect is real. Requires @astryxdesign/core entry-point fix or import rewrite.

### Approach 3: Apply Brevo Fix to Production Immediately
**Decision:** Rejected (deferred). Fix is safe (single-line change, gitignored file), but live deploy should wait for explicit go-ahead. Not our call.

---

## Root Cause Analysis

### Why Astryx Merge Verification Failed

**Context:** PR #28/#29 claimed "build clean + typecheck passing." Verification ran in git worktree `CMC-feat-astryx-migration` before merge to main. Turbo cache was seeded from that worktree's build artifacts.

**Root cause:** Worktree node_modules state diverged from main-branch state. Likely causes: (1) worktree ran `pnpm install` with cached node_modules that included transitive deps not in main's pnpm-lock.yaml, or (2) worktree had a different .npmrc or registry configuration. When the cache was reused locally on main, it replayed stale artifacts.

**Why caught late:** Routine pre-UAT scout (this session, 2026-07-11) was the first time `pnpm build` ran on a clean main checkout post-merge.

### Why Brevo Credential Wasn't Validated Before 2026-07-10

**Context:** The credential was provisioned during Phase 2 env setup but never actually tested by calling Brevo.

**Root cause:** Live verification (the first time the relay worker tried to send) was deferred to Phase 4. The deferral wasn't tracked as a blocker, so the work was marked "done" without proof.

**Contributing factor:** The 2026-07-10 journal noted "LMS OTP was manual only, never verified in anger." This was a signal that credential validation was incomplete. The signal wasn't escalated.

---

## Lessons Learned

### 1. Cross-Worktree Verification Is Unreliable
Build artifacts cached from worktree A may not apply to branch B if node_modules state differs. **Future:** Always verify merges on a clean checkout on the target branch, not in a worktree. Turbo cache should be invalidated between branches.

### 2. Pre-UAT Scout Must Happen on Main, Not Worktrees
Waiting 3 days to discover "build clean" was false is too late when UAT is imminent. **Future:** Run build-status scout immediately post-merge, on main, with a clean turbo cache.

### 3. Credential Validation Can't Be Deferred
The code is correct; the credential isn't. "Deferred to Phase 4" became "forgotten until blocker discovery." **Future:** Credential validation is acceptance criteria for any feature using external APIs. Don't mark feature "done" without it.

### 4. Deploy Topology Requires Explicit Per-Service Verification
Separate Dockerfiles mean separate build/deploy paths. Verifying one service doesn't verify the other. **Future:** Go-No-Go checklist must explicitly list every service: LMS ✅, Admin ✅, API ✅, Worker ✅.

---

## Next Steps

### Immediate (Blocking UAT/Go-No-Go)

1. **Resolve TS2307 Cascade for @cmc/lms** (owner: eng, blocker for LMS UAT)
   - Root cause: @astryxdesign/core@0.1.4 doesn't export deep subpaths (TextInput, Stack, Dialog)
   - Options: (a) Downgrade to Astryx version that does export deep paths, (b) Rewrite imports to flat API, (c) Check if Astryx has newer version (0.1.5+) that fixes exports
   - **Estimated:** 1–4 hours depending on Astryx versioning + API compatibility
   - Blocks: `pnpm build`, `pnpm typecheck`, LMS feature validation, cmcv2-prod redeploy

2. **Verify LMS on cmcv2-prod** (owner: ops/qa)
   - Once build passes locally, rebuild + redeploy lms service: `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps lms`
   - Verify lms container status (running, not crashlooping): `docker ps | grep lms`
   - Verify lms responds: `curl -s https://cmcv2-prod/lms/health | jq .`
   - **Estimated:** 15 min once TS2307 is fixed

3. **Apply + Verify Brevo Credential Fix** (owner: ops, blocker for OTP UAT)
   - Add cmcv2-prod's VPS outbound IP to Brevo's IP-allowlist on Brevo dashboard
   - Update .env.prod on VPS with fixed BREVO_API_KEY line (newline preserved)
   - Redeploy worker: `docker compose -p cmcv2-prod --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps worker`
   - Verify worker logs: `docker logs cmcv2-prod_worker_1 | grep "brevo.*sending"` (should see success, no 401)
   - Test via LMS: parent requests OTP email, should arrive within 30 seconds
   - **Estimated:** 30 min
   - **Security:** Rotate Brevo SMTP + API keys after this session (keys were pasted in chat)

### Before Go-No-Go Memo

4. **Why Admin's tsc Passes While LMS Fails** (owner: eng, investigative)
   - Both import from the same broken primitives.ts barrel
   - Both hit TS2307 errors at runtime (Vite proves defect is real)
   - But admin's `tsc --noEmit` passes clean while lms's fails with ~30 errors
   - Unknown root cause; needs tsconfig/exports inspection + tsc trace mode debugging
   - **Estimated:** 1–2 hours (may be a non-issue if both packages rewrite imports at same time, but worth understanding)

### Post-UAT

5. **Brevo API Key Rotation** (owner: ops)
   - Both SMTP and API keys were exposed in this session
   - Rotate on Brevo dashboard after OTP verification confirms new key works
   - Update `.env.prod` with rotated key

---

## Emotional Reality

The frustration: we claimed "build clean + typecheck passing" for the Astryx merge three days ago, and that wasn't verified on main. We're now 48 hours away from Go/No-Go with a broken LMS build that should have been caught immediately post-merge. This feels like a verification ceremony we failed.

The relief: Pre-UAT scout exists and works. We caught this today, not during UAT or live. The build failures are real but fixable (dependency version or import rewrite, straightforward engineering). The Brevo fix is equally straightforward (one-line env file, already done locally).

The nervous part: We still don't know if LMS is actually running on cmcv2-prod right now. That's a huge unknown to carry into UAT sign-off. Could be a stale image from before the Astryx merge, could be a crashloop from the build failure, could be running the right code. We need to verify, not guess.

The pragmatic part: All three blockers have clear remediation paths. TS2307 is dependency-version debugging (standard). Brevo is env-file + redeploy (standard ops). LMS verification is a curl check (standard sanity test). None are architectural surprises. We can move forward if we address all three.

---

## Unresolved Questions

- **Why does @cmc/admin's tsc pass while @cmc/lms's fails, given both import from the same broken primitives.ts?** Runtime proves the defect is real for admin too (Vite load failure in test). tsc is silently not catching it for admin; reason unknown.
- **Is LMS on cmcv2-prod actually running the redeployed Astryx code, or a stale/failed build?** Not verified — needs direct VPS check (docker ps + curl health endpoint).
- **Brevo fix not yet applied to production.** OTP email delivery is still broken live until VPS redeploy steps above are done.

---

**Report path:** D:\project\vip\CMC\plans\reports\build-status-260711-0141-astryx-typecheck-runtime-break-report.md
