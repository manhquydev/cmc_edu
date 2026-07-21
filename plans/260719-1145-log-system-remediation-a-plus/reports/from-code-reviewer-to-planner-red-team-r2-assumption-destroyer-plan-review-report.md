# Red Team R2 — Assumption Destroyer — Plan Review

Plan: `plans/260719-1145-log-system-remediation-a-plus`
Reviewer perspective: Assumption Destroyer (unstated dependencies, false claims, unverified premises)
Round: 2 (hunting flaws introduced BY the round-1 fixes; logged R1 findings not re-raised)
Date: 2026-07-19

Focus: the NEW claims/design added by round-1 fixes and validation decision #3 (stub prod-guard). 5 findings, all with file:line evidence. Verified-clean appendix at the end.

---

## Finding 1: Prod-guard "mirror pattern" points at the wrong file — `CONSOLE_TRANSPORT_PROD_FORBIDDEN` is NOT in `email-transport.ts`

**Severity:** Medium

**Location:** phase-01-t8-agent-audit-patch.md:59-61 (Architecture-1 stub prod-guard bullet); also plan.md:108 (Validation decision #3)

**Flaw:** The revision instructs: "Mirror pattern `CONSOLE_TRANSPORT_PROD_FORBIDDEN` của `apps/api/src/worker/email-transport.ts` (đọc pattern đó trước khi viết để khớp cách phrase lỗi + cách test)." That pattern does not exist in `email-transport.ts`. `email-transport.ts` contains only the transport classes (`ConsoleEmailTransport`, `BrevoEmailTransport`, `GraphEmailTransport`) — no `NODE_ENV` check, no prod-forbidden constant, no throw-in-production guard. The actual pattern lives in two other files.

**Failure scenario:** The implementer, told to read the pattern in `email-transport.ts` "before writing to match error phrasing + test approach," opens that file, finds nothing resembling a prod-guard, and either invents an ad-hoc guard (diverging from the established house pattern the validation decision intended to reuse) or wastes a cycle hunting. The one load-bearing instruction anchoring the newly-added validation-#3 work references a non-existent anchor.

**Evidence:**
- `apps/api/src/worker/email-transport.ts:26-32` — `ConsoleEmailTransport.send()`; whole file (lines 1-176) has no `NODE_ENV`/`PROD_FORBIDDEN`/guard.
- `apps/api/src/worker/relay-email-outbox.ts:34` — `export const CONSOLE_TRANSPORT_PROD_FORBIDDEN = true;` (the constant).
- `apps/api/src/worker/index.ts:85-92` — the actual mechanism: `if (process.env.NODE_ENV === 'production') { if (!CONSOLE_TRANSPORT_PROD_FORBIDDEN) throw ... }` inside `buildTransportMap()`.

**Suggested fix:** Repoint the citation to `apps/api/src/worker/index.ts:85-92` (guard mechanism) + `relay-email-outbox.ts:34` (constant). Note that the real pattern is a *transport-selection-time* branch, not a factory-constructor throw — which matters for Finding 2.

---

## Finding 2: Prod-guard sits in a MODULE-LOAD singleton → import-time throw gated on process-global `NODE_ENV`; `@cmc/api` tests flip `NODE_ENV=production` with incomplete restore

**Severity:** High

**Location:** phase-01-t8-agent-audit-patch.md:55-61 (validation-#3 guard inside `createLLMClient`); plan.md:108

**Flaw:** The plan puts the guard inside `createLLMClient` ("nếu `process.env.NODE_ENV === 'production'` mà không có apiKey → throw"). But the only real caller instantiates the client as a **module-load-time singleton**: `apps/api/src/assessment/router.ts:31` — `const llmClient = createLLMClient();` runs at import of the assessment router, which is imported transitively by `appRouter`, which nearly every `@cmc/api` test file imports via `createCaller`. So the guard fires at **import time**, not call time, and is gated on the process-global mutable `NODE_ENV`. The plan describes the guard as a runtime check and never flags the singleton-at-import placement.

**Failure scenario:** Several `@cmc/api` test files deliberately set `process.env.NODE_ENV = 'production'` via **direct assignment**, and the `afterEach` cleanup (`vi.unstubAllEnvs()`) does NOT revert direct assignments (only `vi.stubEnv`). With `fileParallelism: false` (single worker, `process.env` shared across files) and default module isolation (each file re-imports `appRouter` → re-runs `createLLMClient()`), any test file that terminates with `NODE_ENV=production` lingering, executing before a file that imports `appRouter`, causes that import to throw `LLM_STUB_PROD_FORBIDDEN` (no `LLM_API_KEY` in the test env — the stub is used precisely because there is no key), crashing the entire downstream file at load. Today the terminal `NODE_ENV` mutations in those files happen to land on `'development'` (so it may not break yet), but the design is an order-dependent landmine, and the plan's own new positive test must set `NODE_ENV=production` to exercise the guard.

**Evidence:**
- `apps/api/src/assessment/router.ts:31` — module-load singleton `createLLMClient()`.
- `apps/api/vitest.config.ts:31` — `fileParallelism: false` (files share one worker process; `process.env` persists across files).
- `apps/api/src/auth/sso-routes.test.ts:164,192,200` — `process.env['NODE_ENV'] = 'production'` (direct assignment); `:54-56` `afterEach` only `vi.unstubAllEnvs()` (does not revert direct `process.env` writes).
- `apps/api/src/boot-checks.test.ts:96` — `process.env.NODE_ENV = 'production'`.

**Suggested fix:** Move the prod-guard OUT of `createLLMClient` (factory/construction) INTO the stub's `draftAssessment` call path (throw at call time), mirroring how the real `email-transport` guard is a selection-time branch, not a construction throw. That keeps `appRouter` import-safe and makes the guard fire only when a stub draft is actually attempted in production. Alternatively, make the api `llmClient` lazy (construct inside the mutation). Either way, add an explicit note that the current sole caller instantiates at import.

---

## Finding 3: Phase-2 denylist keyword `hash` will strip Phase-1's `resultHash` egress field — self-inflicted cross-phase conflict

**Severity:** High

**Location:** phase-02-sensitive-field-schema-sweep.md:33-37 (suspicious-keyword catalog incl. `hash`, `salt`, `signature`) vs phase-01-t8-agent-audit-patch.md:76-83 (egress payload routed through `sanitizeAuditData`, includes `resultHash`)

**Flaw:** Phase 1 (round-1 fix SA-1) routes the egress audit payload through `sanitizeAuditData(...)`, and that payload contains the key `resultHash` (the tamper-evidence field replacing raw result, per validation #2). Phase 2's suspicious-keyword catalog lists `hash`, `salt`, `signature` as candidates to add to the denylist. If Phase 2 adds `hash` as a **substring** regex (the plan only warns about substring collisions for `code`→`facilityCode`, never for `hash`→`resultHash`), then `sanitizeAuditData({resultHash: ...})` will silently DROP `resultHash`. Phases run 1→2 (declared dependency), so Phase 1 lands green, then Phase 2 guts Phase 1's audit row. The plan never cross-references that its own Phase-1 payload contains a field matching a Phase-2 candidate keyword.

**Failure scenario:** Phase 2 implementer adds `/hash|salt|signature/i` (or even exact `hash`... but substring is the listed catalog form). Phase-1 acceptance criterion "row `.llm` ghi đủ model/promptVersion/resultHash/resultLength" and test 4a ("đủ 6 field data") break the moment Phase 2 merges — and worse, if the substring is added without re-running Phase-1's test in Phase-2's FULL suite gate, the tamper-evidence field is silently removed from a 12-month-retention security row with no failing test if the assertion is loosened.

**Evidence:**
- phase-01:81 — `resultHash: sha256hex(draftContent),` inside `sanitizeAuditData({...})` (phase-01:76-83).
- phase-02:36 — catalog lists `` `signature`, `hash`, `salt` `` as suspicious keywords to add to the denylist.
- `apps/api/src/audit/audit-helpers.ts:51,65-67` — `SENSITIVE_KEY_RE` is substring (`.test(key)`); a `hash` substring pattern matches `resultHash`.

**Suggested fix:** In phase-02, explicitly carve out `resultHash`/`resultLength` (Phase-1-owned egress fields) as known-safe, OR require any `hash`/`salt`/`signature` addition to be exact-match only (never substring), OR add a phase-2 negative test asserting `resultHash` survives `sanitizeAuditData`. Add a cross-phase note in phase-01 that `resultHash` must not be swept.

---

## Finding 4: Test 4c "mock ownership-assert throw" prescribes a mechanism the integration harness cannot use without breaking sibling tests

**Severity:** Medium

**Location:** phase-01-t8-agent-audit-patch.md:126-128 (test 4c)

**Flaw:** Test 4c says: "Lượt draft FAIL sau LLM (mock ownership-assert throw) → row `.llm` VẪN tồn tại." But `assertTeacherOwnsSessionClass` is a **static ESM import** in `assessment/router.ts:27` with no dependency injection, and `draft-confirm.test.ts` is a real-DB integration suite (`createCaller` + `testDb()`, no module mocks anywhere). The only way to "mock" the static import is a file-hoisted `vi.mock('../attendance/assert-teacher-owns-class.js', ...)`, which would replace the function for **every** test in the file — including `confirm`/`discard`/`listBySession` tests that depend on its REAL ownership behavior (e.g. the `sale` FORBIDDEN test at draft-confirm.test.ts:272-280).

**Failure scenario:** Implementer follows the instruction literally, adds `vi.mock` for the ownership helper, and silently breaks the real-ownership assertions in the same file — or spends a cycle discovering the mock cannot be scoped per-test.

**Evidence:**
- `apps/api/src/assessment/router.ts:27` — static `import { assertTeacherOwnsSessionClass }`; :208 the call site inside `withFacility`, AFTER the LLM call.
- `apps/api/src/assessment/draft-confirm.test.ts:9-25` — integration harness, no `vi.mock`.
- `apps/api/src/attendance/assert-teacher-owns-class.ts:53-54,68-81` — throws FORBIDDEN naturally when the class has no assigned teacher / teacher mismatch; returns (no-op) when `classSessionId` is null.

**Suggested fix:** Replace "mock ownership-assert throw" with the natural harness path: seed a `ClassBatch` WITHOUT assigning this teacher (or a session whose class `teacherAppUserId` ≠ caller), call `draftComment` with that `classSessionId` → `assertTeacherOwnsSessionClass` throws FORBIDDEN after the LLM egress row is written, `result.ok=false` so the middleware skips its row. Same asserted outcome, zero mocking, no collateral to sibling tests.

---

## Finding 5: Phase-3 changelog "enumerate RLS tables với số bảng đúng" contradicts "không viết lại lịch sử" — and the count scope is undefined

**Severity:** Medium

**Location:** phase-03-docs-sync.md:38-47 (step 1, changelog RLS correction)

**Flaw:** Step 1 gives two instructions in tension: (a) "liệt kê danh sách bảng RLS THẬT **tại thời điểm sửa** ... kèm **số bảng đúng**" and (b) "changelog lịch sử — đính chính bằng chú thích ngay tại dòng ... **không viết lại lịch sử**." The changelog line being corrected documents a specific point-in-time wave (the 2026-07-06 wave-1 remediation). But "the real RLS table list as of now" spans ~35 tables across many later migrations — including `CompensationPolicy`/`SalaryTier` added 2026-07-12, six days AFTER the changelog entry's date. Dumping the current full list/count onto a historical wave-1 line is a *different* anachronism, not a correction. "Số bảng đúng" is undefined: correct-as-of-wave-1 = 6 tables (Contact, Opportunity, Receipt, RefundRecord, Student, Enrollment), correct-as-of-now = ~35.

**Failure scenario:** Implementer greps all migrations (as instructed), finds ~35 RLS tables, and annotates the 2026-07-06 changelog line with a 35-table current-state list, retroactively attributing later-migration tables to the wave-1 entry — replacing one inaccuracy (AuditLog wrongly listed) with a new one (post-dated tables backfilled into history).

**Evidence:**
- `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:88` (comment enumerating the wave-1 six) and `:105,110,115,120,125,130` (the six `ENABLE ROW LEVEL SECURITY` for Contact/Opportunity/Receipt/RefundRecord/Student/Enrollment).
- `packages/db/prisma/migrations/20260712000000_hr_remediation_policy_quota_reject_done/migration.sql:27,58` — `CompensationPolicy`/`SalaryTier` RLS added 2026-07-12 (after the changelog line's era).
- Full grep: ~35 tables carry `ENABLE ROW LEVEL SECURITY` across all migrations.

**Suggested fix:** Scope the correction to the wave-1 entry's own migration: correct the line to the six tables that migration actually enabled (Contact replaces the wrongly-listed AuditLog), and state "AuditLog never had RLS (immutability is REVOKE, migration 20260706150000)." Do NOT enumerate the whole current schema onto a historical line. If a full current RLS inventory is wanted, put it in a dated NEW note, not the old entry.

---

## Verified clean (claims that checked out)

- **`assessment.draftComment` absent from `AUDIT_EXCLUDED_PATHS`** → middleware writes a row for successful draft. 2-row premise holds. `apps/api/src/trpc.ts:88-123` (path not in set), `:148-152` (middleware writes when `result.ok`), `:159` `action: path`.
- **Actor resolves to userId for this procedure.** `draftComment` is `requirePermission(...)` → `ctx.subject` non-null; egress `ctx.subject.userId` is valid (mirrors `confirm` at router.ts:253). `resolveAuditActor` returns `ctx.subject.userId` for staff (`audit-helpers.ts:13-14`).
- **`shift.submit` nested `entries: z.array(z.object({...}))`** confirmed at `apps/api/src/shift/router.ts:64-77` — valid example for the shallow-sanitize gap.
- **`sanitizeAuditData` is shallow (no recursion)** — `apps/api/src/audit/audit-helpers.ts:73-81`. Phase-2 recursion premise is accurate.
- **NODE_ENV=production IS set in prod docker** for `api` and `worker` — `docker-compose.prod.yml:54,78`. So the guard mechanism is meaningful at runtime (packages/llm reads the process-global env in the same node process). (Placement flaw is Finding 2, not the availability.)
- **minio profile-gated service** confirmed at `docker-compose.prod.yml:145-161` (`profiles: [minio]`); no socat sidecar in this file.
- **Contact RLS** confirmed at `...wave1_schema_rls/migration.sql:105` (line 88 is the enumerating comment); **QualitativeAssessment RLS** at `20260706210000_t3_assessment_evidence_consent/migration.sql:39` (a later migration than wave-1) — phase-3 anchors are true.
- **AuditLog "global identity/audit tables, never facility-scoped"** confirmed at `...wave1_schema_rls/migration.sql:96-97`.
- **`pnpm typecheck` / `--filter @cmc/api` / `--filter @cmc/llm`** all valid: root `package.json:12` `turbo run typecheck`, `apps/api/package.json:14`, `packages/llm/package.json:20`.
- **Test 4d "mock db.auditLog.create throw" is feasible.** `buildStaffContext` uses `db: testDb()` (shared singleton, `test/db.ts:295`), so `vi.spyOn(testDb().auditLog, 'create').mockRejectedValueOnce(...)` works; `mockRejectedValueOnce` throws only the egress create (first call), leaving the middleware create intact. Best-effort try/catch in the egress block means draft still succeeds. No finding.
- **Existing stub prompt-log test.** `draft-confirm.test.ts:108-129` spies `console.log`, asserts the stub logs the prompt with fullName absent. Runs under default vitest `NODE_ENV=test` (no per-test production flip in this file), so the new prod-guard does not fire for this file under normal ordering — the residual risk is the cross-file leak in Finding 2, not this test itself.

---

## Unresolved questions

1. Finding 2 severity hinges on whether any current/future `@cmc/api` test file terminates with `NODE_ENV=production` lingering before an `appRouter`-importing file loads. Today the known flippers end on `'development'`; confirm no other file leaves `'production'`, and decide whether to fix the design (recommended) or rely on ordering luck.
2. Should the whole-plan AC (plan.md:49-52) mention the `resultHash`-vs-Phase-2-`hash` carve-out (Finding 3) so the FULL-suite gate actually catches a regression?

Status: DONE
Summary: 5 new findings hunting the round-1/validation-#3 revisions — 2 High (prod-guard in import-time singleton gated on leak-prone NODE_ENV; Phase-2 `hash` keyword strips Phase-1 `resultHash`), 3 Medium (wrong-file prod-guard citation; test-4c mock mechanism incompatible with the integration harness; changelog enumerate-vs-don't-rewrite-history tension with undefined count scope). 11 revised claims verified clean.
Findings by severity: High 2, Medium 3, Critical 0.
