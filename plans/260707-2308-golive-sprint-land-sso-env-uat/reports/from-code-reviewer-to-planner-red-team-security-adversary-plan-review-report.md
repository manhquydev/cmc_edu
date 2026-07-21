# Red-Team Review — Security Adversary lens (delta 2026-07-08)

Reviewer: rt-security (Fact Checker role). Scope: today's delta — Phase 3 (flow-audit),
Phase 2 R2/seed edits, Phase 4 G7 deferral. Baked 17 findings + RT-α..ε excluded per brief.
Every finding is grep/read-verified with file:line.

---

## Finding 1: R2 backup dumps are unencrypted child-PII+money, and the drill leaks them to /tmp on failure
- **Severity:** High
- **Location:** Phase 2, step 7 "Backup + restore drill (target Cloudflare R2)"
- **Flaw:** The delta activates R2 as the off-box target but adds no confidentiality control for the dump. `backup-db.sh:34` writes a plain `pg_dump --format=custom` (no client-side encryption); `.env.prod.example:72-76` holds the R2 endpoint/access/secret in plaintext with no SSE/encryption var; the plan step only says "Ghi vị trí + retention" — nothing about bucket-private / block-public-access, object encryption, or token scope. Worse, `restore-drill.sh` downloads the FULL production dump to `/tmp` on the dev box (`:51`) and only removes it on the success path (`:94`); under `set -euo pipefail` any failure at list/download/restore (`:38,:55,:70`) aborts before `:94`, leaving a complete children+money dump on the WSL2 filesystem. The plan itself predicts R2/S3 incompatibility failures here ("script có thể lộ lỗi tương thích").
- **Failure scenario:** Drill fails on the R2 endpoint quirk the plan anticipates; an unencrypted dump of every child record + every receipt/payment sits in `/tmp` on the shared dev machine indefinitely. Or the R2 bucket is created public-read (never checked) and the same PII is world-downloadable with only the object key.
- **Evidence:** `scripts/restore-drill.sh:51`, `:70`, `:94`; `scripts/backup-db.sh:34`; `.env.prod.example:72-76`.
- **Suggested fix:** Encrypt the dump client-side (age/gpg) before upload and decrypt only inside the drill; add a `trap 'rm -f "$DUMP_FILE"' EXIT` to both scripts; add a drill assertion that the bucket blocks public access; document retention/rotation and that R2 creds in `.env.prod` are pilot-secret class.

## Finding 2: Phase 3 audit walks forward from permission keys, so it structurally cannot find a mutation gated with no key — the "0 mutation thiếu gate" criterion is unprovable by the stated method
- **Severity:** High
- **Location:** Phase 3, step 1 "Trace tự động quyền ↔ router" + Success Criteria "0 mutation thiếu gate"
- **Flaw:** Step 1 enumerates "mọi key trong `PERMISSIONS` ↔ call-site `requirePermission`/`can(`". A mutation built on bare `protectedProcedure` (session-only, no registry key) never appears in a key-driven walk. The plan asserts "procedure mutation không key = lỗ hổng gate" but gives no mechanism for that reverse direction. Proof it matters: `shift.cancel` (`shift/router.ts:267`) is a `protectedProcedure.mutation` with only an inline owner-or-director array — no `requirePermission`. A key-forward audit reports the surface "clean" while an actually-ungated mutation is invisible to it. `requirePermission` (`trpc.ts:129-136`) is the ONLY registry gate, so anything not using it is off the audit's radar.
- **Failure scenario:** A mutation whose inline check is missing or wrong (privilege escalation / cross-role write) is never surfaced, because the audit only follows known keys; it ships behind a green "audited, 0 ungated mutations" verdict.
- **Evidence:** `phase-03-flow-audit.md` step 1 + Success Criteria bullet 1; `apps/api/src/shift/router.ts:267-298`; `apps/api/src/trpc.ts:129-136`.
- **Suggested fix:** Invert step 1 — enumerate every `.mutation(`/`.query(`, resolve each to its procedure base, and assert the base ∈ {`requirePermission(...)`, `lmsProcedure`+explicit `requireLmsParent/Student`, `publicProcedure` on an allowlist}. Every `protectedProcedure.mutation` gets flagged for manual inline-check review.

## Finding 3: Router scope is undercounted — the audit's stated path `<domain>/router.ts` matches 26 files, not 31; five `-router.ts` files with 11 mutations are silently skipped
- **Severity:** High
- **Location:** Phase 3, Architecture item 3 + "Related Code Files"
- **Flaw:** Architecture says "routers `apps/api/src/<domain>/router.ts` (31 file)". Globbing that literal pattern (`**/router.ts`) returns 26 files. The 31 count is only reachable with `**/*router*.ts`, which additionally catches `class/schedule-router.ts`, `class/class-session-router.ts`, `class/class-batch-router.ts`, `rewards/reward-router.ts`, `rewards/gift-router.ts`. Those five hold 11 mutations, including sensitive ones: `classSession.cancel`/`addMakeup` (`class-session-router.ts:96,161`) and `reward.redeem` (`rewards/reward-router.ts:53`). An auditor following the written pattern audits 26/31 routers and never sees session-lifecycle or reward-redemption gates.
- **Failure scenario:** A mis-gated session-cancel or reward-redeem (money-adjacent, child-facing) is outside the audited set; the 28-WF trace and the "0 ungated mutation" claim are computed over an incomplete corpus.
- **Evidence:** glob `apps/api/src/**/router.ts` → 26 files; glob `apps/api/src/**/*router*.ts` → 31 files (five `-router.ts` files added); `apps/api/src/class/class-session-router.ts:96,133,161,207`; `apps/api/src/rewards/reward-router.ts:53`.
- **Suggested fix:** Change the stated pattern to `apps/api/src/**/*router*.ts` and list the five `-router.ts` files explicitly in Related Code Files so they are provably in scope.

## Finding 4: The rewritten UAT Section 2 is built from 5 chains that exclude cskh and ctv_mkt — roles holding real child/PII mutation permissions — and the rewrite masks the gap as "checklist complete"
- **Severity:** High
- **Location:** Phase 3, step 4 (five cross-role chains) + step 7 (replace Section 2 with those chains)
- **Flaw:** The five named chains cover sale/GĐKD/GĐĐT/GV/ke_toan/hr/PH/HS but never cskh or ctv_mkt. Yet `cskh` holds mutation grants on child/guardian and PII data: `guardian.approveLink` (`index.ts:58`) and `parentAccount.updateEmail` (`index.ts:106`); `ctv_mkt` holds `crm.opportunityList` (`index.ts:42`) + punch. Step 7 *replaces* Section 2 with the chain scenarios, so authorization UAT for cskh/ctv_mkt is structurally dropped — and because the old itemized Section 2 is overwritten, the omission reads as a finished checklist. There is no success criterion requiring every mutation-holding role to appear in ≥1 scenario. (L2 is baked as a question, but nothing forces the rewrite to answer it with coverage.)
- **Failure scenario:** A mis-scoped cskh grant (e.g., approving guardian links or editing parent emails outside its facility) goes to the pilot untested for authorization, signed off under a "complete" UAT record.
- **Evidence:** `phase-03-flow-audit.md` step 4 chain list + step 7; `packages/auth/src/index.ts:58` (cskh∈guardian.approveLink), `:106` (cskh∈parentAccount.updateEmail), `:42` (ctv_mkt∈crm.opportunityList).
- **Suggested fix:** Add a success criterion: "every role with ≥1 mutation permission appears in ≥1 UAT chain or an explicit negative-authorization test," and keep a role×permission coverage matrix beside the chain rewrite so dropped roles are visible.

## Finding 5: Deferring G7 removes the only independent verification that the prod-config deploy is locked down before the pilot runs
- **Severity:** Medium
- **Location:** Phase 4, step 1 + Overview; `plan.md` line 49
- **Flaw:** G7 = "Runbook: second person executed deploy from scratch successfully" (`uat-checklist-go-live.md:200`). Every security-hardening gate around it — G8/G9 (dev-auth/OTP-seam absent), STAFF≠LMS boot-enforce, STAFF_EMAIL_DOMAIN fail-closed — is self-attested by the single operator who built the stack (`phase-02` steps 5–8). G7's second person is precisely what catches a single-operator blind spot (a leftover seam, a wrong secret). The deferral rationale ("VPS thật = clean-room run") only holds if no real child data or money touches the local-sim stack before the VPS move — but the stack is seeded with a real Entra super_admin and real SSO, i.e. production-configured.
- **Failure scenario:** A hardening miss (e.g., `ALLOW_DEV_AUTH` or `TEST_OTP_SEAM` accidentally present) survives to the pilot because no second party ever re-ran the checks on the actual stack.
- **Evidence:** `docs/uat-checklist-go-live.md:200`; `phase-02-env-prod-cmcv2.md` steps 5-8; `phase-04-uat-gonogo.md` lines 15-17, 37.
- **Suggested fix:** Keep a lightweight GO-blocking G7 — a second person independently re-runs `env-check` + boot-checks + `grep` for dev seams against the actual pilot stack — and defer only the full from-scratch redeploy to M1.

## Finding 6: Phase 2 step 8 seeds a permanent real-Entra super_admin (full registry bypass, no revocation) with zero stated protection requirements
- **Severity:** Medium
- **Location:** Phase 2, step 8 "Seed super_admin email Entra thật"
- **Flaw:** `can()` grants super_admin an unconditional bypass of the entire permission registry (`index.ts:186`), and roles are a login-time snapshot with no revocation (RT-ε, ~8h). The delta newly requires a *real* Entra identity for this account but treats it purely as an "unresolved input," with no requirement for MFA/conditional-access on that identity, no post-pilot deactivation, and no restriction on where it may log in from. This single identity is the master key to all money and child data, on the same box that (Finding 1) holds the unencrypted PII backup.
- **Failure scenario:** One phished/reused Entra login as the seeded identity yields total gate bypass for up to a session lifetime, with no way to revoke mid-session.
- **Evidence:** `phase-02-env-prod-cmcv2.md:42`; `packages/auth/src/index.ts:186` (super_admin bypass); `plan.md:87-88` (RT-ε no revocation).
- **Suggested fix:** Require the seed Entra account to be MFA/conditional-access enforced, document it as pilot master-key, and add a post-pilot deactivation/rotation step.

## Finding 7: NO-GO teardown disposes local secrets but never revokes the R2 token or deletes the off-box PII dumps
- **Severity:** Medium
- **Location:** Phase 4, step 8 "NO-GO/teardown"
- **Flaw:** Step 8 says rotate `.env.prod` secret and "dọn vị trí backup dump," but that only addresses local artifacts. The delta's R2 path means `.env.prod` now also carries a live R2 API token and the backup itself is a remote off-box PII copy on a third-party bucket. Nothing in the NO-GO path revokes the R2 token or deletes/expires the remote `db-backups/*` objects. A NO-GO (which implies something went wrong) can leave production child+money dumps sitting in R2 under a token that may already have been exposed in logs.
- **Failure scenario:** Pilot is abandoned NO-GO; weeks later the R2 bucket still holds full PII dumps reachable with a never-revoked token.
- **Evidence:** `phase-04-uat-gonogo.md:55` (teardown text — local only); `scripts/backup-db.sh:38-44` (uploads to remote R2); no revoke/delete-remote step anywhere in Phase 4.
- **Suggested fix:** NO-GO must include: revoke the R2 API token, and delete or lifecycle-expire the remote `db-backups/` objects; verify deletion.

---

## Fact Checker — verification table (delta-sampled)

| # | Claim (source) | Result | Evidence |
|---|----------------|--------|----------|
| 1 | `finance.receiptApprove = [GĐKD, GĐĐT, ke_toan]` (phase-03 L1, `index.ts:50`) | VERIFIED | `packages/auth/src/index.ts:50` |
| 2 | `ROLES` 9-role catalog at `index.ts:10-20` (phase-03 Arch) | VERIFIED | `index.ts:10-20` |
| 3 | `PERMISSIONS` registry at `index.ts:41-174` (phase-03 Arch) | VERIFIED | `index.ts:41-174` |
| 4 | `can()` at `index.ts:180-192`, super_admin bypass (phase-03 Arch) | VERIFIED | `index.ts:180-192,186` |
| 5 | `requirePermission` wired in `trpc.ts` (phase-03 Arch) | VERIFIED | `trpc.ts:129-136` |
| 6 | `restore-drill.sh:27` uses `hostname -f` (plan C3/H3) | VERIFIED | `scripts/restore-drill.sh:27` |
| 7 | `restore-drill.sh:29-33` off-box guard rejects localhost/minio (phase-02) | VERIFIED | `scripts/restore-drill.sh:29-33` |
| 8 | MinIO app-storage in compose ~`:140` (phase-02) | VERIFIED (approx) | service at `docker-compose.prod.yml:141-142`; opt-in `--profile minio` `:157` |
| 9 | compose `restart: unless-stopped` `:29,51,...` (phase-04:55) | VERIFIED | `docker-compose.prod.yml:29,51,75,99,115,122,143` |
| 10 | `global-setup.ts:68-73` spawns standalone tsx API (phase-04 Arch) | VERIFIED | `apps/e2e/src/global-setup.ts:68,70-73` |
| 11 | `mintStaffCookie` forges super_admin w/o DB re-check (phase-04:43, H1) | VERIFIED (nuance) | `apps/e2e/src/session-injection.ts:141-159`; default TTL is 1h `:144`, not 8h — the "8h" is the real staff-session snapshot window (RT-ε), not this helper |
| 12 | cskh holds guardian.approveLink + parentAccount.updateEmail (phase-03 L2) | VERIFIED | `index.ts:58,106` |
| 13 | Routers = "`<domain>/router.ts` (31 file)" (phase-03 Arch) | FAILED | `**/router.ts`=26; `**/*router*.ts`=31 — five `-router.ts` files omitted by the stated pattern |

---

Status: DONE_WITH_CONCERNS
Summary: Seven security findings on the delta — three High (audit method can't detect keyless-gated mutations; router scope undercounted 26/31 so classSession/reward mutations skip audit; UAT rewrite drops cskh/ctv_mkt authorization coverage) plus a High on unencrypted/leak-prone R2 PII dumps, and three Medium on G7 deferral, unprotected permanent super_admin seed, and NO-GO not revoking R2 token/remote dumps. One fact-check claim FAILED (router path pattern); the rest verified.
