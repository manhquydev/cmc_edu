# Quality hardening P1–P5 — execution plan

**Status:** ACTIVE · **Base:** `develop@939f2a1` (protected: PR+strict+enforce_admins) · **Mode:** --tdd, per-item protected PR
**Constraint:** shared working tree + protected develop ⇒ **sequence** code PRs (parallelize only via worktrees when truly independent). Until P1a lands, every PR's CI keeps flaking → P1a goes first.

## Waves

| Wave | Item | Type | Worker | Gate |
|------|------|------|--------|------|
| **1** | **P1a deflake `grade.test.ts` atomic-lock** | code (TDD) | grok ui-console (`ak:debug`/`ak:test`) | test stable ×N; CI green; **human eyeball** (grade-integrity invariant) |
| 2 | P1c classify 24 orphans in `flow-manifest.ts` + flip ratchet (`|| true`→fail) | code/manifest | grok + pi verify | acceptance exit 0; CI green |
| 2 | P2 add P1-08 refund/cancel journey (35→36) | e2e (TDD) | grok (own worktree, parallel w/ P1c) | journey green in ui-e2e |
| 3 | P2 lmsOps.* status decision | product+manifest | needs user chốt: wire UI+journeys **or** flag experimental | — |
| 3 | P3 ADR supersede batch + INDEX/arch refresh | docs | ui-lean (`ak:docs`) | links resolve; CI green |

## Deferred / gated (NOT cooked now — by design)

- **P1b F8 (API `e2e`→required):** user-annotated "sau ~1 tuần ổn". Time-gated. **Prep only:** verify `e2e` job currently green on develop + watch ~1wk, THEN flip. Flipping now could block on the very flake we're fixing.
- **P4 develop→main promotion:** gated on F8 closed (else main inherits the blind spot). Human chốt, per-wave.
- **P5 human UAT** on money/state flows: **human task**, not agent-cookable. The only path to "production-ready".

## Notes
- Every code change: branch → TDD → PR → babysit CI (flake policy: quarantine list only) → merge (human for sensitive; sensitive = P1a grade integrity).
- Do NOT weaken tests to pass. P1a must assert a real invariant, not silence a race.
