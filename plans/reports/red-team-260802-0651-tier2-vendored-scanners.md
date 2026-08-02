# Red-Team — Tier 2 vendored Semgrep/Trivy scanners (260802-0651)

Read-only adversarial review. Plan: `plans/260802-0651-tier-2-vendored-semgrep-trivy-scanners/`.
Design source: `advisor-260802-0150-vinsoc-cmc-dogfood-benchmark-fit.md`. Tier 1 = PR #39 (3d6b916).
Verified against live repo state today, not just docs.

## Bottom line
**Tier 2 as written is ~70% duplication of tooling Tier 1 already turned on. Do NOT build it as scoped.**
The only parts that earn keep: **Trivy misconfig (IaC/Dockerfile) + Trivy image**, plus finishing the
P0 hygiene. Everything else — Semgrep gate, vendored wrappers, flattened ruleset + CHECKSUMS, redaction,
committed-baseline blocking gate — is either duplicated by CodeQL/Dependabot/secret-scanning or is
over-engineering left over from the dropped (b). The single highest-ROI move is **enable CodeQL default
setup (still pending in UI)** — the free, deeper SAST — which the plan never mentions is OFF while it
proposes building a weaker one.

## Verified facts (ground truth, not doc-copy)
- Only ONE workflow in repo: `.github/workflows/ci.yml`. **4 unique actions, all first-party**
  (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`).
  8 `uses:` lines total. No third-party actions anywhere.
- Dependabot `github-actions` ecosystem is **already configured** (Tier 1) — it will bump these.
- Dependabot `npm` already open (first PR landed). GitHub secret scanning + push protection ON.
- 4 Dockerfiles exist (`infra/docker/Dockerfile.{api,lms,admin,worker}`) — Trivy misconfig/image target.
- CI does **not** build docker images today (no build step in ci.yml) → image mode needs new infra.
- CodeQL default setup: **pending manual UI enable** (per task context) — i.e. the real SAST is OFF.

## Ranked findings

### F1 — CRITICAL(to value): highest-ROI item is missing — CodeQL is still OFF
The plan proposes a Semgrep SAST gate while CodeQL default setup (JS/TS + actions, deeper dataflow
engine, free, GitHub-native, zero-maintenance) sits un-enabled in the UI. This is backwards. CodeQL is
strictly superior to Semgrep registry packs on typed TS for the injection class, and its **Actions**
pack surfaces unpinned/mutable action refs for free (overlaps the one Semgrep rule the plan brags about).
**Fix:** move "enable CodeQL default setup incl. Actions" to step 0. It is the actual Tier-2 SAST.

### F2 — HIGH: Semgrep gate is duplicative AND "too clean to matter" → DROP it
Advisor measured: `p/typescript` → **0 findings**; owasp+secrets → 36, **all hygiene, 0 injection**
(typed Drizzle ORM removes the string-concat patterns Semgrep keys on). So:
- Injection/XSS/path class: CodeQL covers it deeper; Semgrep adds **0**.
- The 36 hygiene findings (18 dynamic-proxy-host, 10 mutable-action-tag, 5 request-host-used, 3 pnpm):
  config-hygiene, one-time cleanups, not a recurring gate need. mutable-action-tag → CodeQL Actions.
A Semgrep CI gate on this codebase is **not worth it**. Drop Semgrep from Tier 2 entirely. If you ever
want the hygiene rules, run Semgrep once locally as a cleanup pass, not as a standing CI job with a
flattened ruleset + CHECKSUMS to maintain.

### F3 — HIGH: Trivy `fs` vuln+secret duplicate Dependabot + secret-scanning; only misconfig/image is new
- **vuln**: Dependabot already reads `pnpm-lock.yaml` and PRs CVEs. Trivy fs vuln = same data, no gate
  advantage worth the machinery (Dependabot owns CVE lifecycle). Keep at most as a free byproduct.
- **secret**: in CI, checkout gets only **committed** files — same visibility as GitHub secret scanning
  + push protection (already ON). The live secrets advisor found (`.env.prod`, `privkey.pem`) are
  **gitignored/untracked** → CI Trivy never sees them either. So CI Trivy secret adds **~0**. The real
  gap (full-history scan on the now-public repo) is a **one-time P0 gitleaks run**, not a standing job.
- **misconfig (IaC/Dockerfile)** and **image**: genuinely non-overlapping. Nothing native scans these.
**This is the entire justified core of Tier 2.** Scope Trivy to misconfig (+image later); treat
vuln/secret as incidental, never as gates.

### F4 — MEDIUM: vendoring wrappers is over-engineering now (b) is dropped → use trivy-action directly
The plan's own Open Q#1 already leans this way; confirmed — go further. The sole justification to vendor
`run-*.sh` + `redact-report.sh` was **cross-repo redaction**, which died with (b). Vendoring 5 scripts +
flattening a ruleset into 1 `.yml` + CHECKSUMS.txt + VERSION.txt + provenance is pure ceremony for a
report that never leaves the repo. **Use `aquasecurity/trivy-action` (SHA-pinned) directly.** Delete
Phase 1's vendoring, ruleset-flattening, CHECKSUMS, and exit-9 risk wholesale. Phase 1 collapses to
"add one pinned trivy-action step."

### F5 — MEDIUM: "10 mutable tags → 0" metric is inflated and low-priority
Actual surface = **4 first-party GitHub/pnpm actions** in 1 workflow. First-party `actions/checkout@v4`
etc. are the lowest supply-chain risk in the ecosystem; the advisor's "10" likely counted `uses:`
occurrences or scanned `.claude/skills`, not the product CI. Pinning them by SHA is fine but it's a
**5-minute chore, not a phase**, and Dependabot (already on) maintains the SHAs with `# vX` comments.
Do it, but stop treating a Semgrep rule count as the "meter" — that reintroduces Semgrep to justify a
trivial task CodeQL Actions already flags.

### F6 — MEDIUM: fail-on-new-HIGH + committed baseline = maintenance tax for a solo/small team
The "needs a triage owner" risk is **real and likely permanent** here. For a solo/small team, a blocking
gate on tools with FPs + a hand-maintained baseline file that drifts on every ruleset bump = self-
inflicted merge friction with no one to adjudicate FPs. **Report-only is correct — keep it indefinitely
for anything Semgrep-class.** If you want ONE deterministic block, gate only on **new Trivy misconfig
HIGH** (low FP, small reviewable count) — never on SAST/CVE noise. Baseline machinery (Phase 3) is
probably YAGNI; delete unless a triage owner materializes.

### F7 — LOW: Trivy image mode has a hidden cost — CI builds no images today
`trivy image` needs built/pulled images; ci.yml has no docker build. Image mode = new build step =
CI time + complexity the plan glosses. **Start with static Trivy config/misconfig scan on the 4
Dockerfiles (no build, cheap, ~most of the value); defer image mode** until images are actually built/
published in CI, as its own decision.

### F8 — LOW: P0 hygiene is higher-ROI than the whole scanner scaffold and one item still hangs
Plan metric admits react-router HIGH CVE "còn treo" (still open). Fixing that + a one-time full-history
secret scan delivers more real risk reduction than any standing job. **Do P0 first, before any CI work.**

## Answer: is Tier 2 worth doing given native tooling is now on?
**Mostly no as written.** ~70% (Semgrep gate, Trivy fs vuln, Trivy secret-in-CI, vendored wrappers,
ruleset flattening, redaction, baseline blocking) duplicates CodeQL / Dependabot / secret-scanning or is
dropped-(b) residue. **Worth doing (the residue):**
1. Enable CodeQL default setup incl. Actions — this IS your Tier-2 SAST (free, deeper than Semgrep).
2. Trivy **misconfig** (static, Dockerfile/IaC) as a report-only job via SHA-pinned trivy-action.
3. Trivy **image** — later, only once CI builds images.
4. Finish P0: full-history secret scan + react-router CVE + pin the 4 action SHAs.
Everything else: cut.

## Recommended plan changes (concrete)
- **New Phase 0 (do first, ~half-day, 80% of value / 10% of work):**
  (a) enable CodeQL default setup + Actions in UI; (b) one-time `gitleaks`/`trivy repo` full-history
  scan, rotate any hit; (c) upgrade react-router (+ confirm fast-uri/hono) CVEs; (d) pin 4 action SHAs
  with `# vX` (Dependabot maintains).
- **Rewrite Phase 1:** delete vendoring, ruleset flatten, CHECKSUMS, VERSION, redaction, Semgrep. Nothing
  to vendor.
- **Rewrite Phase 2:** single `aquasecurity/trivy-action@<sha>` job, `--scanners misconfig` (optionally
  `+vuln` as non-gating byproduct), report-only artifact, `<5min`, exclude `.claude/skills/**`. Drop
  Semgrep step, drop redaction step (report stays in repo).
- **Phase 3:** downgrade to optional/YAGNI. Keep image-mode + blocking gate parked behind an explicit
  "triage owner exists" precondition; if solo forever, this phase never runs. Remove the Semgrep
  mutable-tag meter (folded into F5 chore + CodeQL Actions).
- **Success metrics to drop/fix:** remove "semgrep ~36 hygiene", remove "10→0 via Semgrep rule". Replace
  with: CodeQL enabled & green; Trivy misconfig report-only <5min; 0 open HIGH CVE after P0; 4 actions
  SHA-pinned.

## Second-order effects
- Cutting Semgrep + vendoring removes a standing CHECKSUMS/ruleset-version maintenance surface that would
  rot (advisor's own Semgrep-identity postmortem warns re-baseline on every pack bump).
- Relying on CodeQL means SAST maintenance = GitHub's problem, not a vendored script's.
- Trivy misconfig report-only adds ~1 low-FP signal; if never triaged it becomes ignored-artifact noise
  → assign it the same weekly glance as Dependabot PRs or don't add it.

## Residual risks / open Qs
- Does CodeQL default setup Actions pack actually flag your unpinned first-party tags? Verify after
  enable; if yes, F5 chore is auto-covered.
- Trivy misconfig FP rate on these 4 Dockerfiles unmeasured — run once report-only before any gate.
- Confirm public-repo CI minutes restored (memory: Actions billing died 2026-07-17) before assuming any
  new job runs.
