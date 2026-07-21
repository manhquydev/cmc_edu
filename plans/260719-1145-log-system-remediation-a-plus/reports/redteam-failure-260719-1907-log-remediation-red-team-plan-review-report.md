# Red-Team Plan Review — Failure Mode Analyst

Plan: `plans/260719-1145-log-system-remediation-a-plus`
Perspective: Failure Mode Analyst (Murphy's Law) · Verification role: Flow Tracer
Scope traced: `assessment/router.ts` draftComment, `trpc.ts` auditLogMiddleware + AUDIT_EXCLUDED_PATHS, `audit/audit-helpers.ts` sanitizeAuditData, `packages/llm/src/index.ts` both factory paths, existing manual-audit sites (`facility/router.ts`, `enrollment/router.ts`).

---

## Finding 1: In-transaction audit write couples the production draft flow to audit durability — opposite of the middleware's explicit design AND of the plan's own cited exemplar

- **Severity:** Critical
- **Location:** Phase 1, "Architecture" step 2 + "Implementation Steps" step 4
- **Flaw:** The plan places `tx.auditLog.create(...)` **inside** the `withFacility` transaction that creates the assessment (phase-01 lines 42-58). It claims to follow "đúng pattern 24 path manual-audit hiện có (ví dụ `facility.create`)" — but `facility.create` writes audit **outside** any transaction via `ctx.db.auditLog.create` (`apps/api/src/facility/router.ts:82`). The two are not the same pattern; they have opposite atomicity semantics. Worse, adding `assessment.draftComment` to `AUDIT_EXCLUDED_PATHS` removes the current best-effort middleware row, whose entire design contract is "a broken audit write must not break the underlying mutation" (`apps/api/src/trpc.ts:142-146,165-170`). The plan replaces a resilient audit with a brittle one.
- **Failure scenario:** `tx.auditLog.create` throws (transient DB error, connection reset, constraint/append-only privilege hiccup, statement timeout). Because it is inside the transaction, the whole transaction rolls back → the assessment is NOT created → the teacher's `draftComment` call fails. Today the same DB blip only produces a `console.error` and the draft still saves (trpc.ts:169). The change converts an invisible audit gap into a user-facing outage of the AI draft feature. The plan text never states this semantics choice or weighs it.
- **Evidence:** `apps/api/src/facility/router.ts:82` (`ctx.db.auditLog.create`, out-of-tx) vs plan phase-01 lines 42-58 (`tx.auditLog.create`, in-tx); `apps/api/src/trpc.ts:142-146` (best-effort contract), `:150,:165-170` (swallow-and-log); `apps/api/src/assessment/router.ts:207-222` (the `withFacility` block the plan injects into).
- **Suggested fix:** Decide the failure semantics explicitly. Either (a) mirror the exemplar it cites — write `ctx.db.auditLog.create` after the `withFacility` block returns, wrapped in try/catch that logs but does not rethrow, preserving the middleware's "audit failure never breaks the mutation" property; or (b) if in-tx atomicity is genuinely wanted (draft-and-audit must both exist or neither), state that as a deliberate reversal of the middleware contract with PO sign-off, and add a rollback note. Do not silently inherit `enrollment.blockLms`'s in-tx style while citing `facility.create`'s out-of-tx style.

---

## Finding 2: LLM call precedes the transaction — a sent prompt with a failed tx leaves zero audit trail, the exact T8 "log what was sent" gap the phase exists to close

- **Severity:** High
- **Location:** Phase 1, "Overview" (T8 / TL13:80 "Ghi log điều gì được gửi")
- **Flaw:** `llmClient.draftAssessment(prompt)` executes at `apps/api/src/assessment/router.ts:205`, BEFORE the transaction opens at `:207`. The audit row is written only if the transaction succeeds. Between the LLM call and a committed audit row sit `assertTeacherOwnsSessionClass` (`:208`, can throw FORBIDDEN) and `qualitativeAssessment.create` (`:210`, can throw). Any throw there means the prompt was already transmitted to the external provider (`router.clawcmc.io.vn`) with no audit record of the send.
- **Failure scenario:** Teacher A drafts for a session they do not own → the LLM request fires and reaches the provider → `assertTeacherOwnsSessionClass` throws FORBIDDEN → no assessment, no audit row. From an auditor's view the prompt-send never happened, yet PII-adjacent context (studentId, classSessionId) left the building. This is precisely the "log what was actually sent" invariant (TL13:80) the phase quotes as its justification, left with a hole.
- **Evidence:** `apps/api/src/assessment/router.ts:205` (LLM call) vs `:207-210` (tx + ownership assert + create); phase-01 lines 15-17 quote TL13:80 as the requirement.
- **Suggested fix:** Move the ownership/precondition checks before the LLM call (fail closed before transmitting), or record the send in a way independent of the create transaction's success (e.g., an out-of-tx best-effort "prompt.sent" audit immediately after `:205`). At minimum, the plan must acknowledge this window and state the accepted residual risk rather than implying full coverage.

---

## Finding 3: `PROMPT_VERSION` has no bump-enforcement mechanism — audit will silently record a stale version after any SYSTEM_PROMPT edit

- **Severity:** Medium
- **Location:** Phase 1, "Architecture" step 1
- **Flaw:** The plan adds `export const PROMPT_VERSION = 'v1'` with only a code comment "bump khi SYSTEM_PROMPT đổi" (phase-01 lines 33-35). Nothing couples the constant to the actual `SYSTEM_PROMPT` string (`packages/llm/src/index.ts:37-39`). A future edit to SYSTEM_PROMPT that forgets the manual bump makes every audit row assert a prompt version that no longer matches what was sent — a corrupt-by-omission audit field, worse than an absent one because it looks authoritative.
- **Failure scenario:** Someone tweaks the Vietnamese system instruction for tone. Tests still pass (no test pins version-to-content). Months later a regression investigation trusts `promptVersion: 'v1'` in the audit rows and reasons about the wrong prompt.
- **Evidence:** `packages/llm/src/index.ts:37-39` (SYSTEM_PROMPT literal, no version linkage); phase-01 lines 33-35 (constant + comment only).
- **Suggested fix:** Derive the version from content so it cannot drift — e.g., a short hash of `SYSTEM_PROMPT` as the version, or a unit test asserting a known checksum of SYSTEM_PROMPT that fails loudly when the string changes without a deliberate version update. A hand-maintained constant guarded only by a comment is not an audit-integrity mechanism.

---

## Finding 4: Denylist change is a behavior change to EVERY audited mutation, but the phase's test scope only exercises audit unit tests — over-strip regressions land silently

- **Severity:** High
- **Location:** Phase 2, "Implementation Steps" step 6 + "Requirements" (non-functional)
- **Flaw:** `sanitizeAuditData` runs for every non-excluded mutation in the middleware (`apps/api/src/trpc.ts:162`). Expanding `SENSITIVE_KEY_RE` / `SENSITIVE_EXACT_KEYS` (`apps/api/src/audit/audit-helpers.ts:51,63`) changes the persisted `AuditLog.data` shape for potentially dozens of existing mutations. Phase 2's verification is only `pnpm --filter api test -- audit` (step 6), which covers `audit-helpers.test.ts` and the audit router — NOT the per-mutation integration audit assertions across finance/enrollment/user/etc. A legitimate field wrongly stripped (e.g. a substring `pin` swallowing `shipping`/`mapping`, `hash` swallowing `hashtag`, `answer` swallowing `answerId`) will not be caught by the audit-only test filter.
- **Failure scenario:** Implementer adds `pin` as a regex substring per the "danh mục khả nghi" list (phase-02 line 35). Audit unit tests (which only test the patterns the implementer added positive/negative cases for) pass. A real mutation carrying a field like `shippingAddress` or `mappingId` now has that field dropped from its audit trail. No integration test asserts that field's presence, so it ships. The audit trail quietly loses forensic data — the same class of silent gap this whole plan is meant to close.
- **Evidence:** `apps/api/src/trpc.ts:162` (sanitize applied to all paths), `apps/api/src/audit/audit-helpers.ts:51-67`; phase-02 line 35 (candidate keyword list mixing short collision-prone names), phase-02 step 6 (test scope limited to `-- audit`).
- **Suggested fix:** For each new pattern, prefer exact-match (the plan says this but leaves the regex-vs-exact decision per-field to execution time — pre-decide it in the phase). Broaden the phase's test gate to the full `pnpm --filter api test` before declaring done, or add explicit negative assertions against a representative set of real mutation inputs, not just synthetic strings in the unit test.

---

## Finding 5: No phase carries rollback notes for code changes — Phase 1 touches a shared public interface and the production draft flow with no documented revert path

- **Severity:** High
- **Location:** All phases (documentation-management template requires "risks and rollback notes"); acute for Phase 1
- **Flaw:** Every phase has a "Risk Assessment" but none has rollback steps. Phase 1 mutates a monorepo-shared interface (`LLMClient` in `packages/llm/src/index.ts:14-22`), the shared exclude-list (`trpc.ts:88-123`), and the live `draftComment` resolver. If the in-tx audit (Finding 1) or the exclude-path edit breaks draft creation in production, there is no stated procedure to revert — the four changes are interdependent (removing from `AUDIT_EXCLUDED_PATHS` alone re-enables the middleware row; reverting the interface alone breaks the `llmClient.model` reference in the router).
- **Failure scenario:** Draft flow breaks post-deploy. On-call must reconstruct which of the four coordinated edits to unwind and in what order, under pressure, with no rollback note — and reverting only the router edit leaves `AUDIT_EXCLUDED_PATHS` still excluding the path, so draftComment ends up with NO audit at all.
- **Evidence:** phase-01 "Risk Assessment" (lines 99-107) — no rollback; interdependence across `packages/llm/src/index.ts`, `apps/api/src/trpc.ts:88-123`, `apps/api/src/assessment/router.ts`; project rule `.claude/rules/documentation-management.md` ("risks and rollback notes").
- **Suggested fix:** Add a rollback subsection to Phase 1 (and Phase 2) specifying the safe revert unit: revert all four Phase-1 edits together, or explicitly note that re-adding the middleware default (removing the exclude entry) is the fast mitigation that restores at least best-effort auditing while the manual path is fixed.

---

## Finding 6: Recorded `model` can diverge from the model actually sent — two independent resolution sites in the real LLM path

- **Severity:** Medium
- **Location:** Phase 1, "Architecture" step 1 ("real path trả model đã resolve từ env/opts")
- **Flaw:** In the real client, `model` is resolved inside the `draftAssessment` closure at `packages/llm/src/index.ts:62` and used in the request body at `:76`. The plan adds a `readonly model` field but does not specify unifying it with that closure resolution. If the implementer adds a separately-resolved field, the audited `llmClient.model` and the model in the actual HTTP request come from two sources of truth. They coincide today (both read `process.env['LLM_MODEL']`), but any future change to one path (e.g. per-call `opts.model`) makes the audit lie about which model produced the draft.
- **Failure scenario:** A later change passes a per-call model override into `draftAssessment` but not into the readonly field (or vice versa). Audit records model X; provider ran model Y. The audit's core purpose (which model generated this) is defeated silently.
- **Evidence:** `packages/llm/src/index.ts:62` (closure resolution), `:76` (used in body); phase-01 lines 32-35 (adds readonly field without stating single-source unification).
- **Suggested fix:** Resolve `model` once at factory construction and have both the readonly field and the request body read that single binding. State this explicitly in the phase so the implementer does not create a second resolution site.

---

## Finding 7: Full typecheck + `gitnexus_detect_changes()` scope-gate deferred to Phase 4 — across-session execution can land broken intermediate states

- **Severity:** Medium
- **Location:** Phase 4, "Implementation Steps" step 4 (verification gate); plan.md "Phases" sequencing
- **Flaw:** The monorepo-wide `pnpm typecheck` and the `gitnexus_detect_changes()` scope check run only in Phase 4 (phase-04 lines 59-66). Phases 1 and 2 each run only narrow, package-filtered tests (phase-01 step 6, phase-02 step 6). Given this project's documented harness durable-state drift (phases are executed across sessions), Phase 1 or 2 can be committed with a monorepo typecheck break or an out-of-scope diff that nothing catches until the final phase — by which point multiple commits may need unwinding.
- **Failure scenario:** Phase 1's `LLMClient` interface change type-checks within `@cmc/llm` and `api` filters but breaks a third consumer not covered by those filters; committed; session ends. Phase 2 builds on a red tree. The Phase 4 gate finally surfaces it, now entangled with Phase 2's changes.
- **Evidence:** phase-01 step 6 and phase-02 step 6 (filtered tests only); phase-04 lines 59-66 (full typecheck + detect_changes only here); memory note on harness durable-state drift / cross-session execution.
- **Suggested fix:** Add a lightweight per-phase gate: `pnpm typecheck` (monorepo) and `gitnexus_detect_changes()` at the end of Phase 1 and Phase 2 before their commits, not only in Phase 4.

---

## Finding 8: Audit omits the LLM "kết quả" (result) that TL13:114 lists — the plan quotes the requirement but records only prompt/model/version

- **Severity:** Medium
- **Location:** Phase 1, "Requirements" (functional)
- **Flaw:** Phase 1 quotes TL13:114 verbatim — "Audit mọi lượt: prompt version, model, tool gọi, **kết quả**, ai/agent" (phase-01 lines 15-16) — but the proposed audit `data` captures only `model`, `promptVersion`, `prompt`, `studentId`, `classSessionId` (phase-01 lines 48-56). The LLM output (`draftContent`, router.ts:205) is not in the audit row. It is persisted on `qualitativeAssessment.content` (router.ts:216) and reachable via `entityId`, but the plan never states that the result is intentionally captured via the linked row rather than the audit data. An auditor reading only the AuditLog sees no result.
- **Failure scenario:** A confirmed assessment is later edited by staff (`confirm` overwrites `content`, router.ts:250-252). The original AI `draftContent` is now gone from `content`, and it was never in the audit row — the "kết quả" of that LLM turn is unrecoverable, contradicting the requirement the phase cites.
- **Evidence:** phase-01 lines 15-16 (quotes "kết quả") vs lines 48-56 (audit data omits it); `apps/api/src/assessment/router.ts:205,216,250-252` (draftContent produced, stored on content, later overwritten by confirm).
- **Suggested fix:** Either include the AI `draftContent` (the untouched original) in the audit `data`, or state explicitly in the phase that "kết quả" is deliberately captured via `entityId → QualitativeAssessment.content` and justify why post-confirm overwrite is acceptable for the audit requirement.

---

## Unresolved Questions

1. Is in-tx atomicity (draft+audit both-or-neither) an intentional PO requirement, or an accidental copy from `enrollment.blockLms`'s style while citing `facility.create`? This determines whether Finding 1 is a fix or a documentation gap.
2. Does any consumer outside `@cmc/llm` and `api` import `LLMClient`? Phase 1 step 1 defers this to `gitnexus_impact` at execution — if a third consumer exists, the "additive, non-breaking" claim (phase-01 line 101) needs re-checking against Finding 7.

---

Status: DONE
Summary: Phase 1's in-transaction audit write couples the live AI-draft flow to audit durability — the reverse of both the middleware's explicit best-effort contract and the plan's own cited exemplar — and combined with an LLM-call-before-tx ordering gap, absent rollback notes, and a deferred full-verify gate, the plan trades a resilient audit for a brittle one on a production path.
Findings: 1 Critical, 3 High, 4 Medium.
