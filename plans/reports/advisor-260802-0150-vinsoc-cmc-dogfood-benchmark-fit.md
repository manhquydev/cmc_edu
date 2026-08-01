# Advisor Report — vinsoc↔CMC dogfood-benchmark fit (260802-0150)

Scope per orchestrator: decision (a)+(b) already made — this pressure-tests viability, defines minimal
one-directional integration, gives metrics + checklist. Interview skipped by orchestrator directive
(scope pre-answered; nothing blocking found in scout). Evidence = files read in both repos + two live
probe scans run today (Semgrep 151 rules / Trivy vuln+secret over CMC working tree). Verified vs
believed is marked throughout.

## Verdict

**(a) is real and cheap — do it. (b) as framed ("feed AI-SAST verifier development") is ceremony on
current evidence.** Three facts, all verified in vinsoc's own repo, gut the (b) premise:

1. **The AI-SAST verifier is a documented dead end.** Decision 0020 + plan
   `2026-07-25-ai-sast-inherit-and-upgrade.md`: spike ran, thesis DISPROVEN, "NO verifier module
   ships" (FP-reduction 0, recall floor failed). There is no "verifier development" to feed. The live
   successors are the non-load-bearing annotator (0021: rank-never-drop; deterministic CWE-prior
   preferred where labels exist, LLM only for cold-start) and absence-of-control research (0022–0027).
2. **CMC yields a tiny, homogeneous SAST corpus.** Probe today: `p/typescript` (74 rules) → **0
   findings**; `p/owasp-top-ten`+`p/secrets` (151 rules, 1179 files) → **36 findings**, all
   config/supply-chain hygiene (18 dynamic-proxy-host, 10 mutable-action-tag, 5 request-host-used, 3
   pnpm policy), **zero injection-class**, 33 WARNING. The "raw SAST FP 40–91%" reality does not
   manifest on a typed ORM monorepo. n≈36 cannot produce a usable AUC/precision number (RealVuln
   gives vinsoc n=1,764 labeled findings already).
3. **vinsoc's benchmark machinery doesn't take this input anyway** (details in Q1) — engines are
   Bandit/Metis, corpora are Python/Java with ground-truth labels; CMC findings arrive unlabeled.

The honest shape: do (a) fully; shrink (b) to a half-day byproduct (sanitized findings + hand labels,
published as a "cold-start real-TS sample" with an explicit no-stats caveat); the genuinely valuable
dogfood contribution is a **different corpus class** — a labeled authz/absence-of-control map of CMC
(exactly what vinsoc decisions 0023/0024 say the whole industry lacks: OWASP Benchmark has 0%
authz cases). That is optional Phase 3, its own decision.

**Bonus real finding from the probe (act regardless):** Trivy found 3 live CVEs in the product
lockfile (fast-uri HIGH CVE-2026-16221, react-router HIGH GHSA-qwww-vcr4-c8h2, @hono/node-server
MEDIUM) and live secrets in the working tree (`.env.prod` Sendinblue token, `infra/nginx/certs/privkey.pem`).
Both files are gitignored + untracked (verified), and no `*.env`/`*.pem` was ever committed under
those names (history probe) — but the repo just went public; a full-history secret scan is Phase 0.

## Q1 — Does vinsoc's benchmark accept an external TS codebase?

**No, not as-is. Two separate consumers, neither fits without adapters:**

- `benchmark/` harness: AI-SAST engines (Metis; SAIST blocked) vs OWASP-Java/WebGoat. SARIF →
  `findings.jsonl` (`benchmark/findings/schema.md`; `target` is a free str, so schema itself is
  tolerant). But scoring (`benchmark/scoring/`) is OWASP-Java per-test-case (`BenchmarkTest\d+`
  regex) — meaningless for CMC. Also frozen V0 baseline must not be touched.
- `evaluation/sast-fp-discrimination/`: the live surface. Engine is **hardcoded Bandit (Python)**
  (`run_spike.py`), corpus = RealVuln repos + ground truth `{file, cwe, line, is_vulnerable}` per
  finding, internal finding shape `{rule_id, cwe, file, start_line, severity}` (plain dicts, not
  SARIF). `run_annotate.py` reuses that loader.

**Adapter work to feed CMC findings (all small except labeling):**
1. Semgrep-JSON → internal finding dict: ~30-line converter. Trivial.
2. Corpus entry per their pattern (committed manifest + pinned commit SHA + fetch; CMC is public so
   `fetch.sh`-style shallow-clone-by-SHA works; data gitignored).
3. **Ground-truth labels: the real cost.** Every exported finding needs a human `is_vulnerable`
   verdict or it cannot enter any scored eval. ~36 findings ≈ half a day of triage.
4. Wrapper constraint: `run-semgrep.sh` asserts `check_id ∈ yaml.safe_load(<one ruleset file>)` —
   registry packs must be **flattened into a single .yml** + CHECKSUMS.txt or the wrapper exits 9.

## Q2 — What development metrics would CMC scanning actually produce for vinsoc?

**Realistically obtainable:**
- Zero-shot annotator conformance/refusal-rate + memoized-call cost on a real TS finding set (no
  labels needed). Weak marginal value — already measured at n=1,764 with conformance 1764/1764.
- After labeling: an AUC **point estimate** for the cold-start LLM annotator + severity baseline on
  real TS. With n≈36 (≈30 FP-ish / few TP) the bootstrap CI will span ~±0.15+ — directionally
  interesting, publishable only as an anecdote. vinsoc's own measurement standards (leave-one-repo-out,
  CI-gated claims, decision 0026 research protocol) would rightly reject it as a claim.
- Corpus diversity: +1 TS repo vs 63 Python repos. Marginal.

**Aspirational / wrong:**
- "Verifier precision/recall on real findings" — dead per 0020; nothing to measure.
- "AI post-filter cuts FP to ~6%" — vinsoc measured the opposite on its own gateway: FP-reduction 0,
  recall-floor breach. Do not import that literature number into any plan.

**Genuine but different track:** a labeled CMC authz map (route → required-auth/role → enforcement
point, evidenced by code + e2e) is the absence-of-control corpus class vinsoc proved unmeasured
(0% in OWASP Benchmark, 0024) and where its LLM-generative direction (0027) needs real targets that
models have NOT memorized (the Juice Shop A/B experiment died precisely on memorization —
phase3 plan CANCELLED). CMC is a real, non-famous ERP: exactly the target profile that experiment
needed. This is the only dogfood angle with research-grade value. Cost: days, manual, own decision.

## Q3 — Minimal viable one-directional integration

```
[CMC repo / CMC CI (GitHub Actions)]
  vendor into cmc_edu/scripts/security/:  run-semgrep.sh, run-trivy.sh,
      redact-report.sh, write-status.sh, image-pins.env   (copied from vinsoc, provenance-noted)
  + rulesets/ts-security.yml  (flattened mirror of p/typescript + chosen owasp rules)
  + rulesets/CHECKSUMS.txt, VERSION.txt

  CI job "security-scan" (report-only at first):
    TARGET_SRC=. run-semgrep.sh  raw.json          → redact-report.sh semgrep → semgrep.sanitized.json
    TARGET_SRC=. run-trivy.sh    raw.json (vuln,secret,misconfig)
                                                   → redact-report.sh trivy   → trivy.sanitized.json
    (later: trivy IMAGE mode on the 4 infra/docker images)
    upload sanitized reports as CI artifacts. RAW reports never leave the runner.

  --- manual boundary (one direction, human-carried) ---

[vinsoc repo]
  evaluation/sast-fp-discrimination/corpus-external/cmc/  (data gitignored; committed:)
    manifest.json   {repo_url, commit_sha, ruleset_version, scan_date, finding_count}
    labels.json     [{finding_id, file, line, cwe, rule_id, is_vulnerable, reason}]
    convert_semgrep.py  (sanitized-Semgrep-JSON → internal finding dicts)
```

- **What runs where:** scanning + redaction in CMC CI (automated). Export, labeling, corpus placement,
  any eval run: manual, on demand. No cron, no service, no webhook — YAGNI.
- **Explicitly NOT done:** no `import-report.sh` / DefectDojo — importing CMC into vinsoc's lake risks
  the charter baseline (close_old_findings + identity re-keying hazards their own README documents at
  length) and buys nothing for the benchmark. No DAST wrappers (ZAP/nuclei), no `target-allowlist`,
  no Kong, no controller — Semgrep/Trivy are source-mode; the "controller never touches CMC"
  constraint is satisfied by construction, not by discipline.
- Why vendor the wrappers instead of `semgrep-action`/`trivy-action` directly: the wrappers add
  digest-pinned images, checksummed rulesets, fail-closed contact proof, and — decisive here —
  **whitelist redaction**, which is mandatory the moment reports cross to another repo. That is the
  one place the extra weight pays for itself. If (b) is ever dropped entirely, plain
  semgrep/trivy GitHub Actions would be the simpler correct answer for (a) alone — noted trade-off.

## Q4 — Trivy meaningful? Semgrep TS ruleset mature?

- **Trivy: yes, for CMC.** Measured today: 3 product-lockfile CVEs (2 HIGH), working-tree secret
  detection that caught real files, 4 Dockerfiles available for image mode, misconfig mode unexercised
  yet. Cheap, actionable. **For vinsoc's benchmark: worthless** — dep CVEs have deterministic version
  ground truth, no FP-discrimination or triage signal. Trivy findings stay on the CMC side.
- **Semgrep: vinsoc's mirrored ruleset is 2 Java rules** (`owasp-local.yml`: insecure-random,
  weak-digest) → literally 0 findings on CMC. A TS ruleset must be mirrored fresh. Registry reality,
  measured: p/typescript → 0 findings; owasp+secrets → 36 findings, all hygiene-class, ~0 noise but
  also ~0 depth. Not "mostly noise" — the opposite problem: **too clean/small to be a corpus**. Root
  cause is structural: Drizzle/typed API surface removes the string-concat injection patterns Semgrep
  keys on. Adding p/security-audit or nodejsscan packs would raise volume mostly with true noise;
  fine for a CI gate, still not a benchmark.

## Q5 — Honest verdict on mutual value

- **(a):** CMC gains a real Tier-2 (CVE + secret + misconfig + config-hygiene regression gate) for
  ~1 day. vinsoc gains its first external consumer of the wrappers — a genuine reuse proof, worth a
  line in the capstone, nothing more. Positive-sum, small.
- **(b) as framed: one side subsidizes the other for ~nothing.** vinsoc gets 36 unlabeled hygiene
  findings against an existing 1,764-finding labeled corpus; CMC gets zero product value from (b).
  The "don't do (b), just do (a)" trigger — *the corpus is too small/homogeneous to move any vinsoc
  metric, and the metric it was meant to serve (verifier FP-filter) no longer exists* — **is already
  met on today's evidence.** Per your decision to do both, the minimal non-fake (b) is the half-day
  labeled export with a pre-registered "no statistical claims below n=200" note. It is honest,
  costs little, and creates the pipe for Phase 3.
- **What would change the calculus:** the authz/absence-of-control corpus (Phase 3). That is where
  CMC-as-dogfood is not a subsidy but a unique asset (real, unmemorized, RLS-bearing ERP), aligned
  with vinsoc's only live research frontier. If appetite exists, spend labeling effort there, not on
  Semgrep hygiene findings.

## Success metrics

**CMC (Tier-2):**
- CI `security-scan` job green on main, wall-clock < 5 min, report-only mode first.
- Ruleset supply chain: `sha256sum -c CHECKSUMS.txt` passes in CI; VERSION.txt records upstream pack + date.
- `trivy fs pnpm-lock.yaml`: 0 HIGH CVEs after triage (today: 2 HIGH, 1 MEDIUM).
- Full-history secret scan (gitleaks or trivy repo mode): 0 verified live secrets; any hit rotated within 24h.
- GH Actions mutable tags: 10 → 0 (pin by SHA; Semgrep rule `github-actions-mutable-action-tag` count is the meter).
- Regression gate (phase 1 exit): job fails on NEW HIGH Semgrep/Trivy finding vs baseline file.

**vinsoc (dogfood export):**
- `corpus-external/cmc/manifest.json` committed; `loaded_findings ≥ manifest finding_count`
  (their fail-closed non-vacuity pattern) verified by a test.
- `labels.json` covers 100% of exported findings; each label has a one-line evidence reason.
- Pre-registered honesty rule committed in the corpus README: no AUC/precision/recall claim from this
  sample below n=200; publishable outputs limited to conformance, cost, and qualitative notes.
- (Phase 3, if taken) authz map: every `apps/api` route labeled {auth?, role, enforcement point} with
  code/e2e evidence pointer; count of label disagreements with RLS docs = the discovery metric.

## Work checklist

- [ ] **P0 hygiene (do first, ~half day, CMC):** full-history secret scan on the now-public repo; rotate anything found; confirm `.env.prod`/`privkey.pem` stay untracked; pin all GH Action tags by SHA; upgrade/accept fast-uri + react-router + hono CVEs.
- [ ] **P1 Tier-2 (~1 day, CMC):** vendor `run-semgrep.sh`, `run-trivy.sh`, `redact-report.sh`, `write-status.sh`, `image-pins.env` into `scripts/security/` with provenance note; flatten a TS ruleset into one `.yml` + CHECKSUMS.txt + VERSION.txt; add CI `security-scan` job (semgrep + trivy fs vuln,secret,misconfig; sanitized artifacts only); exclude `.claude/skills/**` lockfiles from the gate (tooling noise) or report them separately.
- [ ] **P1b (later, CMC):** trivy IMAGE mode on the 4 `infra/docker` images; flip job from report-only to fail-on-new-HIGH with a committed baseline.
- [ ] **P2 minimal (b) (~half day, both):** export script sanitized-Semgrep→finding-dict JSONL + manifest; hand-label all findings (note self-grading bias: author labels own code); place under `evaluation/sast-fp-discrimination/corpus-external/cmc/` in vinsoc with the no-stats README; run zero-shot annotator once for conformance/cost only.
- [ ] **P3 optional, decision-gated (days, both):** CMC authz/absence-of-control labeled corpus (route → auth requirement → enforcement point), designed against vinsoc decisions 0023/0024/0027; treat as its own advised/planned initiative, not a checklist tail.

## Risks & unresolved questions

- **Ruleset flattening**: wrapper's exit-9 assertion requires single-file YAML; check_id collisions
  across merged packs unverified — test before CI adoption.
- **Redacted exports lose `message`/`lines`** (Semgrep branch redacts both) — labeling must happen
  against the LOCAL raw report before redaction; only sanitized data + labels cross repos. Never
  commit a raw report (Trivy secret findings embed literal secrets).
- **CI quota**: memory says Actions died 2026-07-17 on billing; public repo should restore free
  minutes — verify the first run actually executes (unverified belief).
- **Semgrep pack choice**: probe used registry packs live; production must pin. If a broader pack
  (p/security-audit) is added later, finding identity changes — re-baseline, don't diff across
  ruleset versions (vinsoc's Semgrep identity postmortem applies verbatim).
- **Egress**: annotator sends only code-derived facts (rule/CWE/severity) — no code egress issue.
  Full-code AI-SAST engines (Metis-style) on CMC are technically fine now the code is public, but the
  router's "public-corpora-only + no ToS" note still stands; not needed for anything above.
- **Open Q1**: does anyone intend Phase 3 (authz corpus)? It is the only version of (b) with real
  research value; if no, (b) ends at P2 permanently.
- **Open Q2**: should CMC's Tier-2 gate block merges (fail-on-new-HIGH) or stay report-only? Blocking
  needs a triage owner; default recommendation: report-only until UAT period ends.
