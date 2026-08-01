# Red-Team: Tier 1 CMC Guardrails plan

Target: `plans/260802-0200-tier-1-cmc-guardrails/` (plan + phase-01..04)
Date: 2026-08-02 · Mode: adversarial, read-only · Repo: `manhquydev/cmc_edu` (PUBLIC)

Verdict: two CRITICAL defects. Phase 2 as written blocks almost every commit
(proven). The plan spends ~5h on code-y guardrails while skipping three FREE
server-side toggles that dominate them and are all currently OFF. Rank below.

Evidence gathered live:
- `eslint --max-warnings=0 <TS file outside apps/admin,lms>` → EXIT=1 (proven).
- `repos/.../branches/main/protection` → 404 **Branch not protected**.
- `security_and_analysis`: secret_scanning **disabled**, push_protection
  **disabled**, dependabot_security_updates **disabled**.

---

## C1 — CRITICAL — Phase 2 pre-commit blocks nearly every commit (proven)

Planned lint-staged: `"*.{ts,tsx,js,mjs,cjs}": "eslint --max-warnings=0"`.
`eslint.config.js` has NO catch-all config object — every block carries
`files: ['apps/admin/**','apps/lms/**']`. Any staged `.ts/.tsx` OUTSIDE those two
apps (i.e. `apps/api`, `apps/e2e`, `packages/*`, `scripts/*` — the majority of the
repo) matches no config.

Proven behavior (not theory):
```
$ pnpm exec eslint --max-warnings=0 scripts/acceptance-report/verify.ts
  0:0  warning  File ignored because no matching configuration was supplied
✖ 1 problem (0 errors, 1 warning)
ESLint found too many warnings (maximum: 0).   EXIT=1
```
`--max-warnings=0` promotes the ignored-file WARNING to a failure. Result: every
commit touching a TS file outside admin/lms is blocked. `pnpm lint` doesn't hit
this because it passes DIRECTORIES (ESLint skips unmatched extensions when
expanding a dir) — lint-staged passes EXPLICIT paths, which ESLint lints and then
warns-ignored. The plan's own risk note guessed at this and proposed
`--no-error-on-unmatched-pattern`, which does NOT help (that flag is about globs
matching zero files, not a matched file having no config).

Second-order: devs hit this on day one → habitual `git commit --no-verify` →
which ALSO bypasses the `gitleaks protect --staged` guard in the same hook. So the
bug silently defeats Phase 1's local secret guard too. C1 is a security defect,
not just DX.

Fix (proven working, EXIT=0, one-door rule still ERRORs in-scope):
```
"apps/{admin,lms}/**/*.{ts,tsx}": "eslint --no-warn-ignored --max-warnings=0"
```
Use BOTH: scope the glob to the only linted roots AND add `--no-warn-ignored`
(defense in depth if the glob is ever widened). Verified: out-of-scope file →
EXIT=0; banned `@mantine` import in `apps/admin` → EXIT=1 error. Guard intact.

## C2 — CRITICAL — `main` is unprotected; nothing "blocks" anything

`main` has NO branch protection (404). GitHub only PREVENTS a merge when a branch
rule marks a check "required"; `continue-on-error` merely colors a job. So today
even the existing "blocking gate" `typecheck-and-test` does not block a merge — a
red run just shows an X. This makes Phase 4's entire promote/hold debate moot:
removing `continue-on-error` from `ui-e2e` gates nothing while no required-check
rule exists.

Missing highest-ROI Tier-1 item: enable branch protection on `main` requiring
`typecheck-and-test` (and `secret-scan` once Phase 1 lands). Pure Settings/API,
~5 min, zero code, strictly higher ROI than any code in this plan. Recommend a
Phase 0 that does this FIRST.

## H1 — HIGH — Native GitHub Secret Scanning + Push Protection is OFF; plan reinvents it

`secret_scanning`, `secret_scanning_push_protection` = disabled. These are FREE
for public repos, run SERVER-SIDE, and cannot be bypassed by `--no-verify` or by a
push from a fork. The plan builds gitleaks as pre-commit + CI job only — the
pre-commit half is bypassable and the CI half runs after the secret is already
pushed to a public repo. For the stated #1 goal ("chặn secret rò rỉ"), the native
push-protection toggle is strictly stronger than the pre-commit gitleaks and
should be enabled in the same Phase 0. Keep the gitleaks CI job (catches patterns
GitHub's providers miss); reconsider whether the pre-commit gitleaks is worth the
per-dev binary install (see M2) once server-side protection exists.

## H2 — HIGH — Phase 3 will NOT meet its "vá CVE" goal as written

Goal #3 is "tự động vá CVE". `dependabot_security_updates` = disabled, and
`dependabot.yml` (version-updates) does NOT enable it — security updates are a
separate repo toggle driven by Dependabot alerts, not by the yml. Writing the yml
alone gives scheduled version bumps, not CVE patches. Must also enable Dependabot
alerts + security updates (Settings/API, free for public). Note `open-pull-requests-limit`
caps version-update PRs only; security-update PRs are uncapped by it — don't expect
that knob to throttle CVE PRs.

## M1 — MEDIUM — Phase 4 targets a gate the trigger model can't deliver

`ui-e2e` is `if: github.event_name == 'push'` — it never runs on `pull_request`.
Required status checks are evaluated on the PR. A push-only job can therefore never
be a required PR check; dropping `continue-on-error` only makes the post-merge push
run red (blocks nothing on the merge). The team's promotion criteria implicitly aim
at a PR gate the trigger cannot provide. Before spending 14 days accumulating runs,
resolve this: either accept `ui-e2e` as evidence-only forever (then the "promote to
blocking" language is misleading), or add a PR-triggered variant (with the merge-SHA/
ledger caveat the comment already documents). The plan's refusal to flip the flag is
otherwise correct and respects a verified team decision — good — but it inherited an
unreachable target.

Middle option the plan missed: add a nightly `schedule:` cron for `ui-e2e` to
accumulate the >=20 runs / >=14 days evidence evenly and independent of push
cadence (pushes may be sparse; billing was interrupted). Branch A's "ensure it runs
each push" is a weaker accelerator.

## M2 — MEDIUM — pre-commit gitleaks assumes a binary every dev lacks

`.husky/pre-commit` calls `gitleaks protect --staged` — a native binary not managed
by pnpm. On a machine without it: `command not found` → either every commit fails,
or someone adds `|| true` and the guard silently no-ops. The plan never addresses
distribution. Given H1 makes secret prevention server-side and un-bypassable,
either (a) drop gitleaks from the hook and rely on native push protection + CI
gitleaks, or (b) commit to a documented install step and fail-closed. Do not ship a
hook that silently no-ops.

## M3 — MEDIUM — rotation is buried; close the rewrite question as "don't"

"Rotate only" is the correct call and the ledger tradeoff is characterized right:
history rewrite gives ZERO security benefit once the repo is public (clones, the
fork network, caches, GHArchive already have every past secret) and it breaks the
gitSha-keyed acceptance ledger. So Open Q#2 should be CLOSED, not deferred: do not
rewrite. But two gaps: (1) rotation is step 2 of a 2h phase with no explicit secret
INVENTORY — enumerate every credential class that ever appeared in history and
rotate before anything else; it is the only irreversible-exposure item here. (2)
Once H1 is enabled, GitHub secret scanning auto-notifies partner providers and
raises alerts — use that alert list as a second rotation checklist for free.

## L1 — LOW — Dependabot pnpm-workspace worry is overblown

Single root `pnpm-lock.yaml` (workspace: `apps/*`,`packages/*`,`scripts`) is fully
covered by one `npm` entry at `directory: "/"`; Dependabot resolves workspace member
deps from the root lockfile. lockfileVersion 9 (pnpm 10) is supported. Don't add
per-package entries or `directories` globs (KISS) — `directory: "/"` suffices.
Phase 3's hedging toward `directories` is unnecessary complexity.

## L2 — LOW — don't add scheduled full-history gitleaks without fingerprint allowlist

If a future full-history / scheduled gitleaks scan is added, it will re-flag the
known already-leaked historical secrets on every run and hold the new blocking gate
red until each is allowlisted by commit fingerprint. PR/push-range scanning (the
plan's design) does not have this problem. Keep gitleaks-action scanning the pushed
range only; if full-history is ever wanted, allowlist historical findings by
fingerprint, not by disabling rules.

## L3 — LOW — node drift

Local node is v24.18.0; CI pins node 22. husky hooks run on the dev's node (24).
husky v9 + lint-staged are fine on 24, but the pre-commit environment differs from
CI — keep hook logic to eslint/gitleaks only (as planned) so this never matters.

---

## Sequencing verdict

Parallel(1,3) + 2-after-1 is acceptable; Phase 2's dependency on Phase 1 is soft
(`gitleaks protect --staged` works with default rules sans `.gitleaks.toml`). But
the ordering optimizes the wrong axis. Insert a **Phase 0 (settings-only, ~15 min,
zero code)** and do it first:
1. Enable branch protection on `main`, require `typecheck-and-test` (C2).
2. Enable secret scanning + push protection (H1).
3. Enable Dependabot alerts + security updates (H2).

These three toggles deliver more guardrail than the 5h of code that follows, and
C2/H1/H2 show all three are currently OFF. Then land Phase 1 (rotate FIRST), the
C1-fixed Phase 2, Phase 3 yml, and treat Phase 4 as evidence-only pending the M1
trigger decision.

Item NOT worth doing as specified: pre-commit gitleaks (M2) once native push
protection is on — it adds a per-dev binary dependency for a weaker, bypassable
version of a control GitHub now runs server-side for free.
