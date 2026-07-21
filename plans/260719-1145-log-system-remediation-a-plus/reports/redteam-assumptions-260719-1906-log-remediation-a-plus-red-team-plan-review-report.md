# Red-Team Review (Assumption Destroyer) — Log System Remediation A+

Perspective: hostile skeptic. Role: Scope Auditor + Fact Checker. Every path/line/symbol
below was grep/read-verified against the working tree at `D:\project\vip\CMC`.

## Finding 1: Phase 3 changelog "correction" is itself factually wrong — drops Contact (and QualitativeAssessment)
- **Severity:** High
- **Location:** Phase 3, step 1 ("`project-changelog.md:568`")
- **Flaw:** The plan says the RLS list is wrong only because it includes `AuditLog`, and
  proposes rewriting it to "5 bảng (Opportunity, Student, Enrollment, Receipt, RefundRecord)".
  The migration it cites as proof enables facility RLS on **six** tables — including
  `Contact`, which the plan's corrected list omits. QualitativeAssessment also has RLS
  (added later). So the plan fixes one inaccuracy while shipping another, then marks it
  "đã xác minh trực tiếp trên migration SQL."
- **Failure scenario:** A future agent reads the "corrected, verified" changelog, believes
  Contact is not RLS-scoped, and reasons about tenant isolation from a list that is still
  wrong — the exact "sửa code cho khớp docs sai" risk this phase claims to eliminate.
- **Evidence:** `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:88`
  ("facility: Contact, Opportunity, Receipt, RefundRecord, Student, Enrollment") and `:105`
  (`ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY`); `apps/api/src/assessment/draft-confirm.test.ts:30-32`
  ("QualitativeAssessment has RLS enabled"); plan `phase-03-docs-sync.md:33-39`.
- **Suggested fix:** Corrected list must be the six wave-1 facility tables (add `Contact`)
  and note that later migrations add more RLS tables (e.g. QualitativeAssessment); or state
  the entry is a dated wave-1 snapshot and correct it to the true wave-1 set. Do not assert
  "5 tables."

## Finding 2: LLM invocation happens BEFORE authorization and before any audit — "audit mọi lượt" is not met for failed-ownership drafts
- **Severity:** Medium
- **Location:** Phase 1, "Architecture" / "Success Criteria" (audit row "mỗi lượt draftComment", "đúng 1 row/lượt")
- **Flaw:** The plan places the manual `auditLog.create` after `assessment.create`, inside the
  second `withFacility` tx, i.e. after `assertTeacherOwnsSessionClass`. But the LLM call
  (`llmClient.draftAssessment(prompt)`) executes earlier, outside any tx, before the ownership
  assert. A draftComment that reaches the LLM but then fails the ownership check produces **zero**
  audit rows (mutation throws → middleware skips on `!result.ok`, and the manual write never runs).
  The phase's stated goal is TL13:114 / T8 "Audit mọi lượt: prompt version, model … kết quả" — a
  turn that sent context to the external provider yet left no record does not satisfy that.
- **Failure scenario:** A teacher not assigned to the target class calls draftComment. The
  external LLM at `router.clawcmc.io.vn` receives the prompt (data egress + cost), ownership
  assert throws, tx rolls back, no AuditLog row exists. The audit trail says the turn never
  happened.
- **Evidence:** `apps/api/src/assessment/router.ts:205` (LLM call) precedes `:208`
  (`assertTeacherOwnsSessionClass`) inside the `:207` tx; `apps/api/src/trpc.ts:150`
  (`!result.ok` short-circuits middleware audit); plan `phase-01-t8-agent-audit-patch.md:42-58, 94`.
- **Suggested fix:** Either move the ownership check before the LLM call, or write the audit
  row for every LLM invocation (including failed drafts) rather than only successful creates —
  and adjust the "đúng 1 row/lượt" criterion, which currently assumes success == every turn.

## Finding 3: `pnpm --filter api` matches no package — the verification gate never runs the API suite
- **Severity:** Medium
- **Location:** Plan Acceptance Criteria (`plan.md:56`), Phase 1 step 6, Phase 4 step 4b
- **Flaw:** The API package is named `@cmc/api`. pnpm `--filter` matches on package name;
  `api` does not match `@cmc/api`. Every place the plan writes `pnpm --filter api test -- …`
  selects zero projects (pnpm exits "No projects matched the filters"), so the "test suite
  xanh" gate silently validates nothing. The whole repo uses the scoped name.
- **Failure scenario:** Executor runs `pnpm --filter api test -- assessment`, sees no failures
  (because nothing ran), and reports the acceptance criterion green. Regressions in the
  assessment/audit suites go undetected.
- **Evidence:** `apps/api/package.json:2` (`"name": "@cmc/api"`); repo convention
  `infra/docker/Dockerfile.api:43`, `README.md:90`, `docs/codebase-summary.md:588`,
  `docs/journals/260712-hr-remediation-plan-shipped.md:59` all use `--filter @cmc/api`.
  Plan `phase-01-t8-agent-audit-patch.md:89`, `phase-04-docker-log-rotation-verification.md:61`.
- **Suggested fix:** Use `pnpm --filter @cmc/api …` (and `exec vitest run …` per the repo's
  actual test invocation shown in README) everywhere.

## Finding 4: Phase 4 service enumeration is wrong — omits `minio`, invents a `socat` sidecar
- **Severity:** Medium
- **Location:** Phase 4, step 1 / Requirements ("mọi service … có log rotation")
- **Flaw:** The plan expects the prod compose to contain "api, worker, admin, lms, nginx,
  postgres/socat sidecar nếu có". Actual `docker-compose.prod.yml` has **seven** services:
  nginx, api, worker, lms, admin, postgres, and **minio**. `minio` is real (profile-gated),
  not in the plan's list; there is no socat sidecar in prod (that is a local-sim quirk).
  The AC "mọi service trong docker-compose.prod.yml có log rotation" therefore cannot be met
  from the plan's own service inventory.
- **Failure scenario:** Executor applies the `x-logging` anchor to the five/six services it
  expected, skips `minio` (guarded by `profiles:`, easy to overlook), and the AC "every
  service has rotation" is falsely marked complete; a runaway MinIO container's json-file log
  can still fill the disk.
- **Evidence:** `docker-compose.prod.yml:24-161` — services nginx(27), api(47), worker(71),
  lms(93), admin(108), postgres(124), minio(145, `profiles: [minio]` at :160); plan
  `phase-04-docker-log-rotation-verification.md:53`.
- **Suggested fix:** Enumerate all seven services explicitly; drop the socat mention; state
  whether the profile-gated `minio` gets the anchor (it should, for symmetry).

## Finding 5: "Follows the 24 manual-audit sites" is false — no manual site uses `resolveAuditActor`
- **Severity:** Low
- **Location:** Phase 1, "Architecture" ("theo đúng pattern 24 path manual-audit hiện có (ví dụ `facility.create`)")
- **Flaw:** The plan justifies its manual write as matching the existing 24-site pattern, then
  uses `actor: resolveAuditActor(ctx)`. Every existing manual site writes `actor:
  ctx.subject.userId` (or an explicit actorId) directly; `resolveAuditActor` is called only by
  the auto-middleware, nowhere in the 24 hand-written sites. The justification is inaccurate,
  and `resolveAuditActor` is not currently imported into `assessment/router.ts`, so the "just
  mirror facility.create" framing understates the edit. (Functionally the value is identical
  for a staff context, so this is not a correctness bug — it is a false premise that can
  mislead the executor.)
- **Evidence:** grep `resolveAuditActor` → only `apps/api/src/trpc.ts:15,158` and
  `audit-helpers.test.ts`; manual sites use `ctx.subject.userId` at `facility/router.ts:84`,
  `enrollment/router.ts:103`, `class/class-session-router.ts:127`; plan
  `phase-01-t8-agent-audit-patch.md:38, 46`.
- **Suggested fix:** Either use `ctx.subject.userId` (true site pattern) with a note it is a
  staff-only procedure, or keep `resolveAuditActor` but drop the "matches 24 sites" claim and
  list the new import as an explicit edit.

## Finding 6: Phase 2 sweep step cannot enumerate fields from a `.input(` / `z.object` grep alone
- **Severity:** Low
- **Location:** Phase 2, step 1 ("Grep toàn bộ `z.object({...})` … trích danh sách field name theo từng mutation path")
- **Flaw:** Input schemas in this repo are named consts wired via `.input(constName)` (e.g.
  `draftCommentInput`, `confirmInput`), sometimes wrapped in `.refine(...)`, and the `.input(`
  call site carries only the schema *name*, not fields. A grep of `z.object({...})` finds the
  field lists but does not bind them to a mutation path; a grep of `.input(` finds paths but not
  fields. Neither step, as written, produces the phase's promised deliverable ("danh sách đầy
  đủ mọi field name … theo từng mutation path") without a manual resolve pass the plan does not
  budget. Composed schemas (`.extend`/`.merge`, imported shared schemas) widen the gap.
- **Failure scenario:** The sweep lists fields it can see inline, misses fields behind named/
  composed schemas, and the "đã-quét-chủ-động" report claims completeness while a sensitive
  field slips through — reproducing the reactive-OTP failure the phase exists to prevent.
- **Evidence:** `apps/api/src/assessment/router.ts:133-171` (named consts + `.refine`, wired at
  `:182, :229, :272`); plan `phase-02-sensitive-field-schema-sweep.md:50-52, 77-78`.
- **Suggested fix:** Specify the two-pass method: collect `.input(<name>)` → resolve each
  `<name>`/imported schema → flatten fields, and account for `.extend`/`.merge`/discriminated
  unions.

---

## Verified — suspicions that did NOT hold (to prevent false findings at adjudication)

- **`assessment.draftComment` is genuinely NOT in `AUDIT_EXCLUDED_PATHS`** — confirmed absent
  from the set at `apps/api/src/trpc.ts:88-123`. Plan's premise is correct.
- **Writing `AuditLog` inside a `withFacility` (RLS) tx works** — `AuditLog` has no RLS policy
  (`migration.sql:96` "never facility-scoped"; no `ENABLE ROW LEVEL SECURITY` for it), and there
  is direct precedent for `tx.auditLog.create` inside `withFacility`: `enrollment/router.ts:101`,
  `class/class-session-router.ts:125`, `finance/router.ts:340,498`. The GUC is irrelevant to a
  non-RLS table. Not a defect.
- **No double-write risk if the exclude entry is added** — middleware audits only when
  `!AUDIT_EXCLUDED_PATHS.has(path)` and `result.ok` (`trpc.ts:150`); adding the path suppresses
  the middleware row cleanly. Mechanism is sound.
- **`createLLMClient` caller surface** — sole non-test importer is `apps/api/src/assessment/router.ts:19`
  (module-level singleton at `:31`). Plan's blast-radius expectation holds.
- **`draft-confirm.test.ts` exists**; its PII test asserts on the console-logged prompt line
  (`:108-129`), not on AuditLog rows — so the plan's new audit-row assertions are additive, not
  a rewrite. Accurate.
- **Phase 3 doc claims (other than Finding 1) check out:** `system-architecture.md:189`
  ("+ JSON logging") is false because `packages/db/src/index.ts:26-29` `createPrismaClient` has
  no `log:` option; `packages/auth/src/index.ts:77` is exactly `'audit.list': []`;
  `packages/mcp-server/src/tools.ts` and `docs/HARNESS_BACKLOG.md` both exist. Package name
  `@cmc/llm` is correct.

## Unresolved questions
1. Is `docs/project-changelog.md:568` intended as a dated wave-1 snapshot (leave historical) or
   as current state (must reflect all RLS tables, now >6)? Finding 1's fix depends on this.
2. Should the profile-gated `minio` service receive the log-rotation anchor, given it is opt-in?
3. Does "audit mọi lượt" (TL13:114) require auditing LLM turns that fail authorization, or only
   successful drafts? Finding 2's severity hinges on the intended semantics.

Status: DONE
Summary: Plan is largely well-grounded, but the Phase 3 changelog fix ships a new inaccuracy
(drops Contact), the `pnpm --filter api` verification commands run nothing, Phase 4 omits the
`minio` service, and Phase 1 leaves LLM-invoked-but-failed drafts unaudited while mis-citing the
manual-audit-site pattern.
Findings count by severity: High 1, Medium 3, Low 2.
