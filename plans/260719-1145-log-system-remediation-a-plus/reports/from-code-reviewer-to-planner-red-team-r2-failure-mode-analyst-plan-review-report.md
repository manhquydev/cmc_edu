# Red Team R2 — Failure Mode Analyst — Plan Review

Plan: `260719-1145-log-system-remediation-a-plus`
Reviewer perspective: Failure Mode Analyst (Murphy's Law — partial failures, ordering, drift, rollback holes)
Round: 2 (15 round-1 findings already logged in `plan.md ## Red Team Review`; these are NEW failure modes, several introduced by the round-1 fixes themselves)

---

## Finding 1: Prod-guard in `createLLMClient` crashes the ENTIRE API at module import; blast radius undocumented and email-transport precedent is non-analogous

**Severity:** High

**Location:** `phase-01-t8-agent-audit-patch.md:55-61` (validation #3 addition) · `apps/api/src/assessment/router.ts:31` · `apps/api/src/worker/index.ts:86-91` · `apps/api/src/boot-checks.ts:105,127,150,174`

**Flaw:** The plan puts the new production fail-fast guard inside `createLLMClient()` and calls it "Mirror pattern `CONSOLE_TRANSPORT_PROD_FORBIDDEN` của `apps/api/src/worker/email-transport.ts`". But `createLLMClient()` is invoked at **module load** — `const llmClient = createLLMClient();` (`router.ts:31`), not lazily per request. `assessment/router.ts` is imported by `appRouter`, so a throw here propagates at import time and the **whole API process fails to boot** — login, payroll, attendance, every endpoint, not just the assessment feature. The cited precedent does the opposite: the email guard fires inside `resolveTransport()` during **worker** boot (`worker/index.ts:86-91`), which is a *separate process*; when it throws, the API keeps serving. The plan presents these as equivalent and does not state the blast-radius change.

**Failure scenario:** Ops deploys with `NODE_ENV=production` but forgets/rotates `LLM_API_KEY` (exactly the misconfig the guard targets). Instead of degrading only AI drafting, `appRouter` import throws → the entire API server refuses to start. A single missing LLM key takes down authentication and payroll. The failure surfaces as an opaque import-time stack trace, not the actionable boot-check message that `boot-checks.ts` already produces for every other prod-misconfig (`boot-checks.ts:105/127/150/174` all gate on `NODE_ENV==='production'` in the established fail-fast seam).

**Evidence:** `apps/api/src/assessment/router.ts:31`; `apps/api/src/worker/index.ts:86-91`; `apps/api/src/worker/relay-email-outbox.ts:34`; `apps/api/src/boot-checks.ts:105`.

**Suggested fix:** Fail-fast is defensible, but move the check to `boot-checks.ts` (the real API prod fail-fast seam) so it emits an actionable message and is unit-testable without triggering module-import side effects — or make the client lazy (construct on first `draftAssessment`). Drop the "mirror email-transport" justification (it is worker-isolated) and document that this turns an LLM misconfig into an API-wide boot failure.

---

## Finding 2: Egress/mutation split has no correlation key — both audit rows resolve `entityId=studentId`, never the assessment id; an AI egress event cannot be tied to the assessment it produced

**Severity:** High

**Location:** `phase-01-t8-agent-audit-patch.md:69-85` (egress block) · `apps/api/src/trpc.ts:156-164` (middleware row) · `apps/api/src/audit/audit-helpers.ts:32-48` · `packages/db/prisma/schema.prisma:962-977`

**Flaw:** The round-1 redesign (findings #1/#2) split one action into two independent, non-transactional rows: an egress row written **before** the tx (`entity:'Student', entityId:input.studentId`, `phase-01:74-75`) and the middleware row written after the procedure resolves (`trpc.ts:156-164`). `AuditLog` has **no requestId/correlation column** (`schema.prisma:962-977`). The middleware's `entityId` comes from `deriveEntityId(rawInput, resultData)`, which returns `extractIdLike(input)` first (`audit-helpers.ts:47-48`); `extractIdLike` returns the first `*Id` key (`audit-helpers.ts:32-39`), and `draftComment` input has no `id` field, so it returns `studentId` (it precedes `classSessionId`/`period`) and **never reaches `resultData`** where the created `assessment.id` lives. Result: both rows carry `entityId=studentId`; neither references `assessment.id`. The only content linkage is `resultHash=sha256(draftContent)`, but `confirm()` overwrites `content` with human-edited `input.content` (`router.ts:248-254`), so after confirmation the hash no longer matches the stored row.

**Failure scenario:** A teacher re-drafts for the same student (retry, or period-then-session), or two GVs draft for the same student concurrently. You get N egress `.llm` rows and M≤N middleware rows, same actor, same `entityId=studentId`, timestamps freely interleaved (all are non-tx inserts on `ctx.db`, not `tx`). An auditor asking "which model/promptVersion/prompt produced confirmed assessment X" cannot pair any egress row with a specific mutation or with the resulting `QualitativeAssessment` — the exact "audit mọi lượt … kết quả" traceability that T8 exists to deliver (TL13:114). This gap is a direct consequence of the round-1 "write egress before the tx so it survives mutation failure" decision, and the plan never acknowledges that this sacrificed egress→result correlation.

**Evidence:** `apps/api/src/audit/audit-helpers.ts:47`; `apps/api/src/audit/audit-helpers.ts:32-39`; `apps/api/src/trpc.ts:161`; `packages/db/prisma/schema.prisma:967`.

**Suggested fix:** Mint a `correlationId` (uuid) before the LLM call; store it in the egress `data`, and thread it into the mutation's audit trail (e.g., include it in the created row / a manual audit on success) so the two rows and the assessment can be joined. At minimum, put the created `assessment.id` in the egress payload isn't possible pre-tx — so a pre-minted correlation id is the viable path — and the plan must state the accepted correlation method explicitly rather than assuming `(actor, studentId, timestamp)` suffices (it does not under concurrency).

---

## Finding 3: Field-name collision — phase-1 `resultHash` vs phase-2 `hash` candidate keyword; egress data passes through `sanitizeAuditData`, so a substring `hash` rule silently strips the tamper-evidence phase 1 just added

**Severity:** Medium

**Location:** `phase-01-t8-agent-audit-patch.md:76-83` · `phase-02-sensitive-field-schema-sweep.md:33-37,67-70` · `apps/api/src/audit/audit-helpers.ts:51`

**Flaw:** Phase 1 wraps its egress payload — including `resultHash` — in `sanitizeAuditData(...)` (`phase-01:76-83`). Phase 2 (which runs AFTER phase 1, `dependencies:[1]`) lists `hash`, `salt`, `signature` as candidate denylist keywords (`phase-02:36`) and the existing denylist is a **substring regex** `/password|otp|token|secret/i` (`audit-helpers.ts:51`). If the phase-2 implementer extends that regex with `hash` (the path of least resistance, matching the existing style), `'resultHash'` matches as a substring and is stripped from the egress row. `resultHash` is not an input-schema field the sweep naturally surfaces, so the collision is easy to miss; phase-2 advises exact-match for short names (`phase-02:69`) but does not pin `hash/salt/signature` to exact-vs-substring.

**Failure scenario:** Phase-2 adds `|hash` to `SENSITIVE_KEY_RE`. The phase-1 full-suite gate (`phase-02:79`) fails `draft-confirm.test.ts` test 4a — IF that test asserts `resultHash` value/presence (`phase-01:123` says "đủ 6 field", but the test is authored in phase 1; if written to check only row existence + `model`, the strip reaches prod silently). Even when the gate catches it, a plausible mis-resolution is the implementer reading the red test as "resultHash is sensitive, correctly stripped" and deleting the assertion — permanently removing the tamper-evidence field from prod egress rows.

**Evidence:** `apps/api/src/audit/audit-helpers.ts:51`; `phase-02-sensitive-field-schema-sweep.md:36`; `phase-01-t8-agent-audit-patch.md:82`.

**Suggested fix:** Explicitly reserve `resultHash`/`resultLength` in the plan and instruct phase 2 to use **exact-match only** for `hash`/`salt`/`signature` (never substring). Pin phase-1 test 4a to assert `resultHash` equals `sha256hex(draftContent)` (value equality), so any accidental strip fails loudly and is not silently "resolved".

---

## Finding 4: Rollback notes claim additive/atomic/no-residue, but `AuditLog` is REVOKE-immutable — a bad phase-1 prod rollout writes PERMANENT rows that revert cannot remove

**Severity:** Medium

**Location:** `phase-01-t8-agent-audit-patch.md:148-153` (Rollback) · `packages/db/prisma/migrations/20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:19` · `plan.md:24`

**Flaw:** Round-1 finding #8 added rollback notes; phase-1's version states "Toàn bộ thay đổi là additive: revert … revert không để lại trạng thái trung gian." That is true for the code plane but **false for the data plane**. `REVOKE UPDATE, DELETE ON "AuditLog" FROM "cmc_app"` (`migration …150000:19`) makes the table append-only at the app role. Once `action:'assessment.draftComment.llm'` rows exist in prod, reverting the code cannot delete them — they persist until the 12-month retention sweep ages them out (`plan.md:24`).

**Failure scenario:** Phase 1 ships with a data bug — e.g., `sha256hex` fed the wrong variable, or a later edit accidentally lands raw child-content in `data`. The plan's own rationale (child-data minimization, docs/08 §7) is then violated, and the bad rows **cannot be purged**: the app role has no DELETE, and the "atomic revert" the plan promises leaves the sensitive rows in place for up to 12 months. The rollback note gives false confidence that a botched rollout is cleanly reversible.

**Evidence:** `packages/db/prisma/migrations/20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:19`; `phase-01-t8-agent-audit-patch.md:150-152`; `plan.md:24`.

**Suggested fix:** Rewrite the rollback section to state that emitted audit rows are permanent (append-only), so revert restores code but not data. Gate the first prod rollout behind a canary that verifies `data` carries no raw prompt/content BEFORE volume accumulates; document that the 12-month retention sweep is the only cleanup path and that a data-shape bug is therefore effectively unrecoverable — raising the bar on getting the payload shape right the first time.

---

## Angles checked that held up (no finding)

- **DRY / shared hash util:** No reusable plain `sha256hex(string)` helper exists — all `createHash('sha256')` sites are salted/HMAC/KDF for their own concerns (`otp-hash.ts:16`, `staff-session.ts:43`, `password-hash.ts`). A single-use local helper in `assessment/router.ts` is correct; the plan is fine here.

## Unresolved questions

- Is `entity:'Student'` on the egress row intentional divergence from the middleware's `entity:'assessment'`? It further separates the two rows across the `(entity, entityId)` index (`schema.prisma:971`), compounding Finding 2. Confirm the viewer/entity filter design accounts for one logical action producing rows under two different `entity` values.

Status: DONE
Summary: 4 NEW failure modes in the revised design, all consequences of round-1/validation fixes: (1) prod-guard crashes the whole API at import with a non-analogous precedent; (2) two-row split has no correlation key, both rows resolve entityId=studentId so egress can't be tied to result; (3) resultHash vs phase-2 `hash` denylist collision silently strips tamper-evidence; (4) rollback notes deny AuditLog append-only permanence.
Findings count by severity: High 2 · Medium 2 · Critical 0
