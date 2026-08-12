---
title: "Software Testing Evolution in the AI-Assisted Era"
date: 2026-08-09
scope: "Durable testing principles and modernization options for CMC EDU v2"
status: research-complete
---

# Software Testing Evolution in the AI-Assisted Era

## Executive Summary

Testing evolved from late, human-led defect discovery into continuous, automated evidence about increasingly specific risks. The durable direction is not “more tests” or one ideal test shape. It is faster feedback, stronger independent oracles, realistic checks where risk warrants them, deterministic evidence, and explicit control of maintenance/compute cost.

AI-assisted and “vibe” coding changes the economics: implementation and test volume can grow much faster than one maintainer can deeply review. It does **not** change what constitutes proof. A generated test that repeats the generated implementation's assumption is correlated evidence, not an independent oracle. For CMC EDU—a facility-scoped ERP+LMS, solo-operated, mostly AI-generated, with money, payroll, identity, RBAC and RLS risk—the best response is a layered, risk-based system:

1. retain fast type/unit/integration gates;
2. use browser journeys for reachability, not as a universal correctness oracle;
3. encode money/state/security invariants below the UI;
4. add property-based and narrowly scoped mutation testing where they expose different defects;
5. preserve human UAT for usability and policy interpretation;
6. measure first-pass CI outcomes, flake and escaped defects rather than test count or AI-reported productivity.

CMC already has unusually strong foundations: blocking `typecheck-and-test`, blocking `ui-e2e`, CI-produced acceptance evidence, and `business:verify --strict` for money/state-critical flows. The next step is not a tool migration. It is to make proof levels explicit, deepen business oracles, and use new techniques only where marginal defect detection exceeds maintenance and CI cost.

## Contents

1. Research scope and method
2. Historical shifts
3. Invariants that survived every era
4. What AI changes
5. Conflicting evidence
6. Techniques and tool fit
7. Anti-patterns
8. Recommendations for CMC EDU
9. Sources
10. Unresolved questions

## 1. Research Scope and Method

**Question:** How should software testing evolve when a solo operator maintains a mostly AI-generated ERP+LMS?

**Evaluation criteria:** defect classes detected; oracle independence; determinism; maintenance burden; feedback speed; CI compute cost; diagnostic quality; compatibility with TypeScript/Vitest/Playwright/Postgres; value for finance, payroll, workflow state, RBAC and RLS.

**Evidence window:** NATO conference, October 1968, through current documentation and research available August 9, 2026.

**Source policy:** prefer original reports, official documentation, and the repository's executable configuration. Survey perception is not treated as causal productivity evidence. Historical repository prose is not treated as current CI authority when it conflicts with workflow files.

**Local authority inspected:** `README.md`, `docs/system-architecture.md`, `docs/codebase-summary.md`, `package.json`, `.github/workflows/ci.yml`, `.github/workflows/ui-e2e.yml`.

**Important local discrepancy:** sections of `docs/system-architecture.md` still describe `ui-e2e` as advisory, but `.github/workflows/ui-e2e.yml` removed `continue-on-error` on August 2, 2026 and runs `business:verify --strict`. For current behavior, the workflow is authoritative.

## 2. Historical Shifts

### Era 1 — Craft programming to engineered verification (1968–1980s)

The 1968 NATO conference framed “software engineering” around controlling the cost, reliability and complexity problems of large software systems [S1]. Testing moved from an informal debugging activity after construction toward a planned lifecycle activity. The central shift was organizational: quality could not depend only on the original programmer remembering every case.

**Legacy:** separation of construction from verification, explicit quality criteria, repeatable test data, and recognition that maintenance dominates long-lived systems.

### Era 2 — Automated component and regression testing (1980s–2000)

Modular design, unit-test frameworks and build automation made repeatable regression checks cheap enough to run frequently. Tests increasingly became executable specifications close to the code. This improved localization and speed, but also encouraged overuse of mocks and line coverage as substitutes for behavior.

**Legacy:** small deterministic tests are valuable because they fail quickly and identify a narrow cause—not because “unit” is intrinsically superior.

### Era 3 — Agile, continuous feedback and CI (2001–2010s)

The Agile Manifesto principles, published in 2001, prioritize early and continuous delivery, frequent working software, technical excellence, simplicity, sustainable pace and regular adaptation [S2]. Testing moved into daily development and then into CI. The test pyramid became a useful cost heuristic: many cheap checks, fewer expensive full-system checks.

**Legacy:** testing is part of delivery, not a downstream phase; working software is evidence, but “working” must be defined with domain-specific assertions.

### Era 4 — Risk/property portfolios beyond a fixed pyramid (late 2010s–2024)

Google's SMURF guidance, published October 15, 2024, argues that test type alone is too crude. Suites should balance **S**peed, **M**aintainability, **U**tilization, **R**eliability and **F**idelity [S3]. A fast low-fidelity test and a slower high-fidelity test can both be correct investments when they address different risks.

**Legacy:** optimize a portfolio, not a geometric ratio. Test location is less important than signal quality per unit of maintenance and compute.

### Era 5 — AI-assisted and agentic development (2022–2026)

AI can generate code, tests, fixtures and debugging hypotheses at high speed. Adoption and perceived benefits are widespread [S4], but causal productivity evidence is mixed [S5][S6]. The bottleneck shifts from typing to specifying, evaluating and maintaining. “Vibe coding” amplifies the risk that implementation and test encode the same plausible-but-wrong interpretation.

**New requirement:** preserve independent evidence. AI may draft checks, but product invariants, acceptance criteria, failure reproduction and CI artifacts must remain the authority.

## 3. What Remains Invariant

1. **A test needs an oracle.** Executing code is not proof; an assertion must distinguish acceptable from unacceptable outcomes.
2. **Oracle independence matters.** A test derived from the same implementation, prompt or model can reproduce the same mistake.
3. **Risk determines fidelity.** Payroll totals, refund caps, tenant isolation and authorization warrant stronger proof than cosmetic layout.
4. **Fast feedback prevents compounding defects.** Cheap checks should reject obvious failures before database/browser work.
5. **Real dependencies reveal integration truth.** Mocks cannot prove Postgres RLS, migrations, transactions, cookies, routing or browser wiring.
6. **Determinism is a product feature of the test system.** Seeds, isolated state, explicit clocks and reproducible environments are required for trusted gates.
7. **Tests are maintained software.** Duplicated fixtures, brittle selectors and opaque abstractions create their own defect surface.
8. **A green suite proves only its assertions.** Reachability, arithmetic correctness, security, usability and operational readiness are different claims.
9. **Evidence provenance matters.** CI artifacts tied to a commit are stronger than hand-edited local reports.
10. **Human validation remains necessary.** UAT detects ambiguous policy, workflow friction, misleading language and real-role behavior that deterministic automation may not model.

## 4. What AI Changes

### 4.1 Higher output, higher correlated-risk

AI lowers the cost of producing implementation and test code. It also makes it easy to create large suites with weak assertions, excessive mocking, duplicated cases or snapshots that approve the current output. Review capacity—not code generation—becomes the scarce resource.

### 4.2 Tests can become self-confirming

If the same agent writes the requirement interpretation, implementation and expected values in one pass, all three may agree and still be wrong. For high-risk behavior, derive the oracle from a separate authority: policy table, invariant, worked business example, database constraint, state-transition table, or independently reviewed acceptance criterion.

### 4.3 Test design becomes a high-leverage AI use

AI is useful for enumerating equivalence classes, boundary values, invalid transitions, role combinations, concurrency interleavings and missing negative cases. It is less trustworthy as the final judge of exact payroll, money, security or compliance behavior unless those rules are supplied as machine-checkable authority.

### 4.4 Evaluation must include the whole loop

AI can make initial code generation faster while increasing review, debugging or maintenance. Measure elapsed change-to-green time, first-pass CI success, review corrections, flake, escaped defects and rework. Do not use lines generated, tests generated or subjective speed alone.

### 4.5 Agent concurrency raises integration risk

Parallel agents can independently produce locally plausible changes. Contract, migration, RBAC, navigation and generated-artifact drift checks become more valuable because they detect inconsistencies between workstreams. Isolation and narrow ownership reduce shared-state interference.

## 5. Conflicting Evidence on AI Productivity and Quality

| Evidence | Result | Strength | Limitation / interpretation |
|---|---|---|---|
| GitHub survey, published August 20, 2024; fielded February 26–March 18, 2024 [S4] | 97%+ of 2,000 enterprise respondents had used AI coding tools at work at some point; 98%+ reported organizational experimentation with AI-generated test cases; many reported perceived code-quality benefits | Large, multi-country sample; useful adoption/perception signal | Self-report, sponsor-commissioned, enterprise-only, “ever used” rather than frequency; not causal defect or productivity measurement |
| METR randomized trial, published July 10, 2025 [S5] | 16 experienced open-source developers, 246 real tasks; AI-allowed tasks took 19% longer. Developers expected 24% speedup and afterward still believed they were 20% faster | Randomized within-developer design on real repositories and tasks | Narrow population: experienced maintainers on familiar, mature repositories; early-2025 tools; not representative of greenfield or unfamiliar-code work |
| METR update, published February 24, 2026 [S6] | Later raw estimates hinted at speedup: returning developers −18% time (CI −38% to +9%); new developers −4% (CI −15% to +9%) | 57 developers, 143 repositories, 800+ tasks; newer agentic tools | METR judged the signal unreliable because AI enthusiasts/tasks selected out, pay changed, parallel-agent time was hard to measure, and quality/task choice differed |

**Synthesis:** AI benefit is context-sensitive and rapidly changing. The 2025 slowdown should not be generalized to all developers; the 2026 hints should not be promoted to a reliable speedup estimate. CMC should run a lightweight internal measurement: compare change-to-green time and post-merge defects by change type, with no attempt to manufacture a universal “AI productivity” number.

## 6. Techniques and Tool Fit

Ratings: **CI cost** considers marginal runtime; **maintenance** considers ongoing suite ownership; **fit** is for CMC EDU, not a general popularity score.

| Technique | Best defect signal | Determinism / maintenance / CI cost | CMC fit and verdict |
|---|---|---|---|
| 1. Typecheck + static rules | Broken contracts, invalid imports, unsafe structural drift | High determinism; low maintenance; low cost | **Keep blocking now.** Cheapest rejection layer. Does not prove runtime behavior. |
| 2. Example-based unit tests | Pure calculations, parsing, formatting, explicit edge examples | High determinism; low–medium maintenance; low cost | **Keep and sharpen.** Best for phone normalization, receipt codes, payroll components and link safety. Avoid testing implementation trivia. |
| 3. Real-Postgres integration tests | RLS, transactions, constraints, concurrency, procedure workflows | High if DB isolated; medium maintenance; medium cost | **Highest-value current layer.** CMC's tenant and money risks live here. Prefer real DB over Prisma mocks. |
| 4. Contract and drift tests | tRPC input/output expectations, registry/route/manifest mismatch, generated-artifact drift | High determinism; low–medium maintenance; low cost | **Use existing compile-time contracts and targeted drift checks.** Do not add Pact or a second contract platform for an in-repo tRPC monorepo without an external consumer. |
| 5. Business-invariant/state-transition tests | Wrong arithmetic or illegal lifecycle transitions despite reachable UI | High with authoritative tables; medium maintenance; low–medium cost | **Expand now.** Refund ≤ net amount, second-eye threshold, payroll equations, idempotency, immutable ledgers, valid status transitions. Stronger than more smoke journeys. |
| 6. Property-based testing (`fast-check`) [S12] | Boundary combinations, algebraic invariants, round trips, state-machine sequences | Deterministic with recorded/fixed seeds; medium learning/maintenance; medium cost | **Pilot next.** Strong fit for finance/payroll/time/identity pure logic. Shrunk counterexamples aid debugging. Do not spray across UI tests. |
| 7. Mutation testing (StrykerJS) [S11] | Weak assertions and untested decision branches that coverage misses | Deterministic; potentially high compute; survivor triage costs maintenance | **Narrow pilot next/later.** Run against small pure domain packages or changed critical files, likely nightly/manual first. Do not mutate the whole monorepo per PR. |
| 8. Browser journey tests (Playwright) | Routing, auth cookies, real build wiring, role-visible workflow reachability | Medium determinism; high maintenance; high cost | **Keep blocking, do not expand blindly.** CMC already reached 31/38 UI journey ceiling; use journeys for critical user paths, not every rule or no-UI flow. |
| 9. Negative security/authorization tests | Cross-facility access, role denial, ownership bypass, append-only violations | High with controlled identities/DB; medium maintenance; medium cost | **Expand with each permission/data path.** Positive happy paths cannot prove isolation. Test `not found` masking and direct API access, not only hidden UI controls. |
| 10. Coverage thresholds (Vitest) [S13] | Untouched code and broad regression holes | High determinism; low runtime overhead; metric-gaming risk | **Use as a floor, not proof.** Include uncovered source explicitly; prioritize changed/critical code. CMC's scoped payroll threshold is more valuable than chasing a monorepo percentage. |
| 11. Retry classification + trace-on-first-retry (Playwright) [S9][S10] | Flake diagnosis and failure forensics | Retries reduce first-pass determinism if abused; traces add artifact cost | **Adopt disciplined policy.** Preserve first-run result, label flaky separately, record trace on first retry, and fix/quarantine with an owner/deadline. Never turn retry-pass into “stable.” |
| 12. Sharding (Playwright) [S8] | Runtime reduction only; no new defect class | Determinism depends on isolation; higher CI coordination/artifact cost | **Not now.** The workflow records a 6.1-minute UI run on July 26, 2026; shard only when measured wall time threatens feedback or budget. Prefer `fullyParallel` only after independence is proven. |
| 13. Metamorphic/differential tests | Cases with no easy exact oracle: equivalent representations, old/new implementation comparison | High if relation/reference is stable; medium maintenance; medium cost | **Targeted use.** Useful during calculation rewrites or Prisma migrations; not a standing framework requirement. |
| 14. AI-assisted test generation | Rapid boundary/negative-case ideation and fixture drafts | Output is deterministic only after committed; review burden can be high; low generation cost | **Use with independent review.** Require an explicit oracle source and deletion of redundant/weak generated cases. Strong for scenario discovery, weak as sole acceptance authority. |

### Tool choices

- **Retain Vitest and Playwright.** Replacing mature existing infrastructure adds migration cost without a missing defect class.
- **Consider `fast-check` first.** Incremental Vitest integration, reproducible seeds and shrinking align with high-risk pure domains [S12].
- **Evaluate StrykerJS only on bounded targets.** Mutation testing asks “would tests notice a plausible code change?”, which coverage cannot answer [S11], but full-monorepo cost is unjustified.
- **Use Playwright traces on retry and merged artifacts.** Traces provide action, DOM, network, console and source context [S10].
- **Do not add a dedicated AI testing SaaS now.** No demonstrated gap requires external data exposure, recurring spend or another nondeterministic judge.
- **Do not shard preemptively.** Sharding is an optimization after isolation and runtime evidence, not a quality technique [S8].

## 7. Anti-Patterns

1. **Test-count theater:** “988 tests” or “31 journeys” describes inventory, not assurance.
2. **Coverage as correctness:** 90% execution can retain wrong or missing assertions; mutation testing exists precisely because coverage cannot measure assertion strength [S11].
3. **Journey monoculture:** browser tests are expensive and cannot cover CMC's seven `no-ui-path` flows; domain/API proof is the correct layer.
4. **Mocking the risk away:** mocked Prisma/Postgres cannot prove RLS, isolation, migrations, locks or append-only grants.
5. **Same-agent tautology:** one prompt generates code and tests from its own interpretation with no independent invariant.
6. **Bulk-generating tests without deletion:** duplicated examples raise maintenance and CI cost while adding no distinct signal.
7. **Retrying until green:** retries are diagnostic; a fail-then-pass is flaky, not passed [S9].
8. **Randomness without replay:** property/fuzz tests must preserve a seed and minimized counterexample [S12].
9. **Snapshots for business logic:** approving a large output diff can normalize the defect. Assert named invariants and values.
10. **Permanent advisory gates:** a signal nobody owns or promotes becomes background noise. Define promotion/removal criteria.
11. **Documentation as live test status:** CMC correctly states that measured commands and CI artifacts outrank dated prose; keep that hierarchy.
12. **Adding tools before identifying a missing signal:** each dependency needs a named defect class, owner, runtime budget and removal condition.

## 8. Actionable Recommendations for CMC EDU

### Now — consolidate proof, no platform migration

1. **Publish one proof taxonomy and use it in PRs/reports:**

   | Level | Claim |
   |---|---|
   | Static | Code and contracts compile; structural policies hold |
   | Unit/domain | Named calculation/invariant holds for explicit cases |
   | Integration | Procedure + real Postgres/RLS/transaction behavior holds |
   | Browser reachability | A real role can complete the UI path on a production build |
   | Business correctness | Critical values and state changes are asserted, not merely reached |
   | Human UAT | Real operators understand and can use the workflow |

   CMC already implements most levels. Make the language consistent: a green journey is not automatically business-correct or UAT-approved.

2. **Preserve the two blocking CI gates and strict business verification.** Do not weaken `typecheck-and-test`, `ui-e2e`, or `business:verify --strict` to compensate for AI output velocity. The absence of a human review team makes executable gates more important.

3. **Require an oracle source for AI-generated high-risk tests.** For finance/payroll/RBAC/RLS/state transitions, record one of: policy/ADR, invariant, worked example, schema constraint, or separately reviewed acceptance table. Prefer generating tests and implementation in separate passes.

4. **Expand business assertions before adding journeys.** For every money/state-critical flow, assert inputs, exact output, persisted state, audit side effects, idempotent replay and forbidden transition. Cover no-UI flows at the API/integration layer.

5. **Formalize flake handling.** Record first-pass result; configure trace on first retry; classify retry-pass as flaky; require a linked issue/owner/deadline for quarantine. Track the known `kpi.refresh` race as a product/test-system defect, not routine runner noise.

6. **Reconcile documentation with executable CI.** The current workflow makes `ui-e2e` blocking, while older architecture prose says advisory. This is not merely editorial: conflicting gate descriptions cause operators and agents to make unsafe assumptions.

7. **Measure a small outcome set monthly:**

   - first-pass green rate by gate;
   - median/p95 change-to-green time;
   - flaky tests and retry-pass count;
   - top recurring failure causes;
   - escaped business/security defects;
   - percentage of critical flows `verified-correct` versus `reachable-only`;
   - CI minutes and artifact storage.

### Next — two bounded experiments

1. **Property-based pilot in one pure critical domain.**

   Recommended candidates: refund arithmetic, payroll aggregation, time-punch pairing, phone normalization, or state-transition sequences. Start with 3–5 invariants, fixed/reported seeds and CI replay. Continue only if it finds distinct edge cases or simplifies example suites.

2. **Mutation pilot on a small domain package.**

   Run StrykerJS against changed files or one pure package, initially manual/nightly. Measure survivors that reveal real missing assertions, runtime and triage hours. Adopt a threshold only after equivalent mutants and noise are understood.

3. **Strengthen drift/contract checks.**

   Promote deterministic high-signal checks for RBAC registry ↔ routes ↔ navigation ↔ acceptance manifest after an observation window. A drift check should either be owned and blocking or removed; indefinite warning-only output is low-value.

4. **Complete real-human UAT.**

   Automation cannot certify Vietnamese wording, workflow comprehension, role handoffs or whether policies match how centers operate. UAT remains the missing production-readiness evidence.

### Later — only on measured trigger

1. **Shard Playwright** only if UI wall time or CI budget becomes a bottleneck and tests are independently seeded. Merge blob reports and retain per-shard traces [S8].
2. **Broaden mutation scope** only if the pilot's defect yield justifies compute and survivor triage.
3. **Add model-based state-machine testing** for workflows with many legal/illegal transitions if hand-maintained tables become error-prone.
4. **Add multi-browser testing** only when browser support policy or incidents require it; Chromium-only is rational while no evidence demands more.
5. **Use AI/LLM evaluation only for exploratory, non-blocking review** of text quality or scenario discovery. Never use an LLM judge for exact money, authorization or tenant-isolation decisions that deterministic code can assert.

### Recommended operating rule

> AI may increase how much code enters review; it must not lower the independence, determinism or provenance of the evidence required to merge it.

## 9. Sources

### Historical and AI evidence

- **[S1]** NATO Science Committee, *Software Engineering: Report on a Conference*, conference held October 7–11, 1968; report edited January 1969. https://homepages.cs.ncl.ac.uk/brian.randell/NATO/nato1968.PDF
- **[S2]** Agile Manifesto, *Principles behind the Agile Manifesto*, 2001. https://agilemanifesto.org/principles
- **[S3]** Google Testing Blog, *SMURF: Beyond the Test Pyramid*, October 15, 2024. https://testing.googleblog.com/2024/10/smurf-beyond-test-pyramid.html
- **[S4]** GitHub, *Survey: The AI wave continues to grow on software development teams*, August 20, 2024; survey fieldwork February 26–March 18, 2024. https://github.blog/news-insights/research/survey-ai-wave-grows/
- **[S5]** METR, *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*, July 10, 2025. https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- **[S6]** METR, *We are Changing our Developer Productivity Experiment Design*, February 24, 2026. https://metr.org/blog/2026-02-24-uplift-update/
- **[S7]** ACM Digital Library DOI landing page. Publication metadata/content was inaccessible through the available non-interactive client and the DOI was not indexed by queried scholarly metadata services on August 9, 2026; therefore no substantive claim in this report depends on it. https://dl.acm.org/doi/10.1145/3778312.3786581

### Technique documentation

- **[S8]** Playwright, *Sharding*, current documentation accessed August 9, 2026. https://playwright.dev/docs/test-sharding
- **[S9]** Playwright, *Retries*, current documentation accessed August 9, 2026. https://playwright.dev/docs/test-retries
- **[S10]** Playwright, *Trace Viewer*, current documentation accessed August 9, 2026. https://playwright.dev/docs/trace-viewer-intro
- **[S11]** Stryker Mutator, *What is mutation testing?*, current documentation accessed August 9, 2026. https://stryker-mutator.io/docs/
- **[S12]** fast-check, *Why Property-Based Testing?*, current documentation accessed August 9, 2026. https://fast-check.dev/docs/introduction/why-property-based/
- **[S13]** Vitest, *Coverage*, current documentation accessed August 9, 2026. https://vitest.dev/guide/coverage

### CMC EDU repository evidence

- `README.md` — project scope, dated test/acceptance snapshots and journey ceiling.
- `docs/system-architecture.md` — domain risks, RLS model, testing strategy and dated architecture snapshots.
- `docs/codebase-summary.md` — test inventory, acceptance evidence, UAT gap and known CI flake.
- `package.json` — Node ≥22, pnpm, Vitest 4 and verification commands.
- `.github/workflows/ci.yml` — blocking static/unit/integration gate, advisory API e2e and scoped payroll coverage.
- `.github/workflows/ui-e2e.yml` — blocking Playwright UI run, strict business-correctness gate and commit-bound evidence artifact.

## 10. Unresolved Questions

1. What are the current median/p95 durations and first-pass failure rates for `typecheck-and-test` and `ui-e2e` over the latest 20–30 runs?
2. Which money/state-critical flows remain `reachable-only`, and which of the seven `no-ui-path` flows lack API-level correctness proof?
3. Does Vitest coverage currently include unimported source files, or only files loaded during tests?
4. What monthly GitHub Actions/runtime budget should constrain mutation testing and any future sharding?
5. Which domain offers the best first property-based pilot: finance, payroll, time or identity?
6. Who will perform real-human UAT, with which roles and authoritative expected calculations?
