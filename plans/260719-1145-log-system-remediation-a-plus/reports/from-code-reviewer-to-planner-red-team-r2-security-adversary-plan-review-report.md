# Red Team R2 — Security Adversary — Plan Review

Plan: `260719-1145-log-system-remediation-a-plus`
Reviewer posture: hostile security adversary, round 2 (post 15-finding hardening).
Scope: NEW flaws in the revised design + regressions the round-1 fixes introduced. Round-1 table findings not re-raised.

Angles probed and **cleared** (no finding — stated so they are not re-opened):
- **`entity: 'Student'` (lead angle 3):** NOT an inconsistency. Manual audit sites already use PascalCase model names as `entity` (`guardian/approved-children.ts:90` and `enrollment/router.ts:105` both write `entity: 'Student'`). `deriveEntity` (lowercase router segment) applies to the *middleware* path only; manual sites deliberately use the model noun. Phase 1's `entity: 'Student'` matches the established manual convention. No leak — `entityId` = studentId is an ID the row stores by design.
- **`catch (err) … console.error(err)` (lead angle 4):** No new PII/prompt leak. The failing `auditLog.create` payload contains only `{studentId, classSessionId, model, promptVersion, resultHash, resultLength}`. Even if Prisma echoes field values into `err.meta`, it echoes IDs + a hash + a length — never the raw prompt (not in the create call) and never raw child-content (only its sha256). Nothing exposed beyond what the row already stores.
- **`sanitizeAuditData` return semantics (lead angle 5):** Hold. Phase 1 always passes an object literal, so the `undefined`-for-non-object branch never fires at runtime. (Type-level caveat is Finding 4.)

---

## Finding 1: Stub prod-guard throws at module load → crashes the entire API server, not just the LLM feature
**Severity:** High
**Location:** phase-01 §Architecture-1 (lines 55–61) + plan.md Validation Log decision #3 (lines 108). Introduced by round-1 validation, so in-scope for R2 regression hunting.

**Flaw:** Validation #3 adds a guard: `createLLMClient()` throws when `NODE_ENV==='production'` and no `LLM_API_KEY`. But the single caller instantiates the client at **module top-level**: `const llmClient = createLLMClient();` (`apps/api/src/assessment/router.ts:31`). `assessmentRouter` is imported **unconditionally** into the root router (`apps/api/src/router.ts:7,81`). Therefore the throw fires during module evaluation of `appRouter` — i.e. at API server boot — and takes down **every** route (auth, finance/receipts, payroll, attendance, LMS), not just `assessment.draftComment`.

**Failure scenario:** Today, a prod deploy with `LLM_API_KEY` unset silently degrades to the stub and the API still boots (only draftComment produces stub text). After this change, the same misconfiguration throws at import and the whole platform fails to start — a single, rarely-exercised feature becomes a hard boot dependency for the entire API. The guard, meant as defense-in-depth against "stub logging prompts in prod," converts a soft single-feature degradation into a full-platform outage.

**Evidence:**
- `apps/api/src/assessment/router.ts:31` — `const llmClient = createLLMClient();` (module scope, runs at import).
- `apps/api/src/router.ts:7,81` — `assessmentRouter` imported and mounted unconditionally.
- Contrast the pattern the plan *claims* to mirror: the email prod-guard runs inside `buildTransportMap()` at **worker** entrypoint (`apps/api/src/worker/index.ts:85-104`), a separate process — it cannot crash the API server. The codebase's actual convention for "prod-required env → fail-fast" is the centralized, explicitly-ordered `boot-checks.ts` (`assertLmsSecretConfiguredForProd` etc., `apps/api/src/boot-checks.ts:104-119`), invoked once at startup with a clear `FATAL:` message — LLM key is not among them.

**Suggested fix:** Do not throw in the factory that runs at import. Either (a) move the LLM-key assertion into `boot-checks.ts` as `assertLlmKeyConfiguredForProd()` so it fails fast at the designated startup point with the same `FATAL:` phrasing as its peers (and is unit-tested there like `boot-checks.test.ts`); or (b) make the guard lazy — throw inside `draftAssessment()` when prod-without-key, so only the draftComment call fails and the rest of the API boots. Pick one explicitly in the phase; the current wording ("throw in `createLLMClient`") + module-level caller = whole-API boot crash.

---

## Finding 2: Prod-guard "mirror" citation points to a file that contains no such guard — implementer will be misdirected
**Severity:** Medium
**Location:** phase-01 §Architecture-1 (lines 58–61): "Mirror pattern `CONSOLE_TRANSPORT_PROD_FORBIDDEN` của `apps/api/src/worker/email-transport.ts` (đọc pattern đó trước khi viết…)".

**Flaw:** `apps/api/src/worker/email-transport.ts` contains **no** prod guard and **no** `CONSOLE_TRANSPORT_PROD_FORBIDDEN` symbol. `ConsoleEmailTransport.send()` explicitly "Never throws" (`email-transport.ts:26-32`). The real pattern lives in two other files: the constant is `relay-email-outbox.ts:34` and the actual `NODE_ENV==='production'` gate is `worker/index.ts:86-104`. The instruction tells the implementer to read the pattern in a file where it does not exist.

**Failure scenario:** Implementer opens `email-transport.ts`, finds no guard, and either invents an ad-hoc guard with mismatched error phrasing/test shape (defeating the "match phrasing" intent) or copies `ConsoleEmailTransport`'s "never throws" behavior — the opposite of the intended fail-fast. Note: the `NODE_ENV==='production'` *mechanism* the plan proposes does match the real guard, so if written correctly the guard *would* fire — the defect is misdirection, not a dead check.

**Evidence:** `apps/api/src/worker/email-transport.ts` (whole file — no guard); `apps/api/src/worker/index.ts:86-104` (real gate); `apps/api/src/worker/relay-email-outbox.ts:34` (`export const CONSOLE_TRANSPORT_PROD_FORBIDDEN = true`).

**Suggested fix:** Repoint the citation to `apps/api/src/worker/index.ts:85-104` and `relay-email-outbox.ts:34`. Better, per Finding 1, mirror `boot-checks.ts` instead, which is the true home of prod-required-env assertions.

---

## Finding 3: Cross-phase collision — Phase 2's `hash`/`signature` denylist candidates silently strip Phase 1's `resultHash`, gutting its tamper-evidence
**Severity:** Medium
**Location:** phase-02 §Architecture (line 36, suspect-keyword list includes `signature`, `hash`, `salt`) vs phase-01 §Architecture-2 (lines 76–83, writes `resultHash` through `sanitizeAuditData`). Sequenced 1→2 on the same file but the semantic collision is not called out.

**Flaw:** Phase 1's minimization compromise (round-1 finding #11) stores `resultHash` + `resultLength` **instead of** raw result content — `resultHash` is the entire tamper-evidence control. It is routed through `sanitizeAuditData` (phase-01:76). Phase 2 then edits the same `sanitizeAuditData`/denylist and lists `hash` and `signature` as expansion candidates. The current denylist is a **substring** regex `/password|otp|token|secret/i` (`audit-helpers.ts:51`). If Phase 2 extends it the same way — e.g. `…|hash|signature/i` — then `isSensitiveKey('resultHash')` becomes true and `sanitizeAuditData` strips `resultHash` from every Phase 1 egress row. The plan never warns Phase 2 that `resultHash` is now a protected downstream consumer.

**Failure scenario:** Reviewer doing the sweep sees `hash`/`signature` on their own candidate list, adds them as substring patterns (natural reading of the current regex style), and the egress row loses `resultHash` — the audit records model/promptVersion/length but no tamper-evident digest, defeating the point of the Phase 1 design. The Phase 2 full-suite gate (`draft-confirm.test.ts` asserting `resultHash` present) *should* turn red and catch this — but the second-order risk is a hurried "fix" that weakens the assertion to make the suite pass, because the sweep report independently justified the denylist addition and nothing flags `resultHash` as intentional.

**Evidence:** `apps/api/src/audit/audit-helpers.ts:51` (`SENSITIVE_KEY_RE` is substring), `:65-67` (`isSensitiveKey` = regex OR exact-set); phase-02.md:36 (candidate list); phase-01.md:81 (`resultHash: sha256hex(draftContent)` via `sanitizeAuditData`).

**Suggested fix:** Add an explicit note in Phase 2: `hash`/`signature` (and any short/collision-prone name) must be added as **exact-match** entries in `SENSITIVE_EXACT_KEYS`, never as substring regex, precisely so `resultHash` (and business fields like `signatureUrl`) survive — this is already the stated rule for `code` (`audit-helpers.ts:53-63`), just apply it here. State that Phase 1's `resultHash` is a protected field the sweep must not strip.

---

## Finding 4: Phase 1 audit-write sample omits the Prisma JSON cast the codebase requires — as written it fails typecheck
**Severity:** Low
**Location:** phase-01 §Architecture-2 code block (lines 76–84): `data: sanitizeAuditData({ … })`.

**Flaw:** `sanitizeAuditData` returns `Record<string, unknown> | undefined` (`audit-helpers.ts:73`). Prisma's `auditLog.create` `data.data` field expects `InputJsonValue`; a `Record<string, unknown>` (values typed `unknown`) is not assignable to it. The only existing caller — the middleware — works around this with an explicit cast: `data: sanitizeAuditData(rawInput) as Prisma.InputJsonValue | undefined` (`trpc.ts:162`). Phase 1's sample block drops that cast. Every existing *manual* audit site (crm/facility/finance/etc.) hand-builds an inline `data` object rather than passing `sanitizeAuditData`, so Phase 1 is the first manual site to hit this exact typing issue and there is no manual-site precedent to copy the cast from.

**Failure scenario:** Implementer copies the plan block verbatim; `pnpm typecheck` (a plan AC) fails with a Prisma JSON assignability error. Recoverable, but the block is presented as copy-ready and isn't.

**Evidence:** `apps/api/src/trpc.ts:162` (`as Prisma.InputJsonValue | undefined`); `apps/api/src/audit/audit-helpers.ts:73` (return type).

**Suggested fix:** Mirror the middleware: `data: sanitizeAuditData({ … }) as Prisma.InputJsonValue`, and add the `Prisma` import to `assessment/router.ts` if absent.

---

Status: DONE
Summary: Round-2 security pass on the hardened plan. Three of the lead's five probe angles cleared as non-issues (entity naming, err-leak, sanitize semantics). Four NEW findings, the load-bearing one being a High regression introduced by round-1 validation #3: the stub prod-guard, placed in a factory that runs at module import of the unconditionally-mounted assessment router, crashes the entire API at boot in prod-without-key rather than degrading one feature — and it diverges from the codebase's centralized `boot-checks.ts` convention while citing a file (`email-transport.ts`) that holds no such guard.
Findings by severity: High 1, Medium 2, Low 1.
