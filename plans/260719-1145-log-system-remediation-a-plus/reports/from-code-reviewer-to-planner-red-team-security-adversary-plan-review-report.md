# Red-Team Review — Security Adversary Perspective

Plan: `260719-1145-log-system-remediation-a-plus`
Reviewer role: Security Adversary + Fact Checker
Verdict basis: every finding grep/read-verified against the codebase.

Fact-check summary (all plan-cited facts I checked are ACCURATE unless noted in Finding 7):
`project-changelog.md:568` wrong-RLS claim — confirmed wrong (no `ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY` in any migration); `system-architecture.md:189` "JSON logging" — confirmed wrong (`packages/db/src/index.ts:26-29` has no `log:` option); migration `20260706054322.../migration.sql:96-97` "global identity/audit tables" — confirmed verbatim; `packages/auth/src/index.ts:77` `audit.list: []` — confirmed; `prompt` in scope at `router.ts:202` — confirmed; single LLM call site (`assessment/router.ts`) — confirmed via grep of `createLLMClient`.

---

## Finding 1: Phase 1 converts an auto-sanitized audit write into a hand-rolled write that bypasses the PII denylist — a live regression, not a future risk

- **Severity:** High
- **Location:** Phase 1, "Architecture" step 2 (manual `tx.auditLog.create`) + Phase 1 "Implementation Steps" step 3 (add to `AUDIT_EXCLUDED_PATHS`)
- **Flaw:** Today `assessment.draftComment` is NOT in `AUDIT_EXCLUDED_PATHS`, so it is auto-audited by the middleware, and its input passes through `sanitizeAuditData()` which strips `password|otp|token|secret` and exact-`code` fields before persistence (`apps/api/src/trpc.ts:162`, `apps/api/src/audit/audit-helpers.ts:73-81`). Phase 1 excludes the path and replaces it with a manual `auditLog.create` whose `data` object is built by hand and is NEVER passed through `sanitizeAuditData`. This actively removes existing denylist coverage from this path.
- **Failure scenario:** A later change adds any sensitive field to `draftCommentInput` (e.g. a `token`-bearing correlation id, or the prompt string itself accretes a secret). Under today's code it is stripped automatically. After this plan lands, it is written verbatim into `AuditLog.data`, which is append-only (REVOKE, migration `20260706150000`) and 12-month retained — i.e. unremovable until the retention sweep. The whole point of the denylist (audit-helpers.ts:59-62 comment: "a secret-bearing field should never rely on a single survey to stay out of AuditLog") is defeated for exactly the path Phase 1 touches.
- **Evidence:** `apps/api/src/trpc.ts:148-172` (middleware routes all data through `sanitizeAuditData`); `apps/api/src/trpc.ts:88-123` (`assessment.draftComment` absent → currently sanitized); `apps/api/src/audit/audit-helpers.ts:73-81`; plan `phase-01...md:44-58` (hand-built `data`, no sanitize call).
- **Suggested fix:** Either (a) keep the path on the auto-middleware and enrich via a different mechanism, or (b) pass the manual `data` through `sanitizeAuditData()` before `create`, and add a test asserting a denylisted key added to the payload is stripped. Do not silently opt this path out of the one guard the rest of the system relies on.

## Finding 2: "PII-free by construction" is asserted but not enforced — `assertNoPii` is name-blind, so any future prompt evolution leaks child data into a 12-month super_admin-readable table

- **Severity:** High
- **Location:** Phase 1, "Requirements" (Functional: `prompt` "vốn PII-free by construction") and "Risk Assessment" ("Prompt chứa PII trong tương lai: ngoài phạm vi")
- **Flaw:** The plan's safety argument rests on the prompt being PII-free "by construction" and on the client-side guard. But `assertNoPii` (`packages/llm/src/pii-guard.ts:6-23`) matches ONLY Vietnamese phone-number regexes. It does not detect student `fullName`, address, DOB, CCCD, or any other identifier. The prompt is safe today solely because the builder at `router.ts:199-202` happens to emit only `studentId`/`classSessionId`/`period`. There is no structural guard; the "by construction" claim is a snapshot, not an invariant.
- **Failure scenario:** A very plausible next iteration enriches the prompt for better AI drafts (recent attendance, teacher notes, or the child's name for tone). `assertNoPii` passes (no phone), the manual audit write has no denylist (Finding 1), and the child's name/notes land verbatim in `AuditLog.data.prompt`. That table is readable only by super_admin (`audit.list: []` → super_admin bypass, `packages/auth/src/index.ts:77`), a role NOT in docs/08 §7's "roles with need" for child records (GV lớp, giám đốc, PH). This directly conflicts with the §7 HARD constraints "Tối thiểu hoá dữ liệu" and "Quyền truy cập hẹp… Không mở rộng mặc định."
- **Evidence:** `packages/llm/src/pii-guard.ts:6-23` (phone-only); `apps/api/src/assessment/router.ts:199-202`; `docs/08-nfr-va-du-lieu-tre-em.md:60-71` (child-data hard constraints); `packages/auth/src/index.ts:77`.
- **Suggested fix:** Do not store the raw `prompt` string at all (see Finding 3). If it must be stored, gate it behind a real content guard or a prompt-schema-version check, and add a regression test that fails if the prompt builder emits any field beyond an allow-list. Note in the plan that `assertNoPii` is phone-only and is NOT a PII backstop for the audit write.

## Finding 3: Storing the raw `prompt` is redundant liability — it duplicates fields already captured and adds nothing to the T8/TL13 requirement

- **Severity:** Medium
- **Location:** Phase 1, "Architecture" step 2 (`prompt,` field in `data`)
- **Flaw:** The prompt is literally `Nhận xét học sinh — studentId: X, classSessionId: Y, period: Z` (`router.ts:199-202`). The plan's `data` object ALREADY stores `studentId` and `classSessionId` as discrete fields, plus `model` and `promptVersion`. Storing the raw prompt string therefore adds no auditing information that TL13:80 ("ghi log điều gì được gửi") doesn't already get from `model` + `promptVersion` + the structured fields — while being the single field most likely to accrete PII over time (Finding 2).
- **Failure scenario:** The plan takes on the entire future-PII blast radius (Finding 2) in exchange for zero incremental audit value today. YAGNI/data-minimization (docs/08 §7) argue for the structured fields only.
- **Evidence:** `apps/api/src/assessment/router.ts:199-202`; plan `phase-01...md:49-57`; `docs/13-ai-agent-llm-integration.md` (TL13 §8/§9 requirement is model/promptVersion/tool/result, satisfiable without the raw string).
- **Suggested fix:** Store `model` + `promptVersion` + the structured request fields; drop `prompt`, or store only a length/hash if "what was sent" fidelity is genuinely needed. Reduces the retained-child-data surface to what the middleware already captured.

## Finding 4: Phase 2's denylist approach cannot protect nested inputs — `sanitizeAuditData` is shallow, and the sweep methodology won't fix that

- **Severity:** Medium
- **Location:** Phase 2, "Architecture" + "Implementation Steps" 2-4 (denylist/exact-match expansion)
- **Flaw:** `sanitizeAuditData` iterates only top-level keys (`Object.entries(input)`) and copies any nested object/array wholesale (`out[key] = value`, `audit-helpers.ts:76-78`). `isSensitiveKey` is never applied recursively. Phase 2 frames itself as the definitive "đã-quét-chủ-động" anti-recurrence deliverable against the OTP incident, and its entire remedy is expanding the flat denylist keyword set — but no number of added keywords strips a sensitive field nested one level down.
- **Failure scenario:** A mutation with a nested-object/array input (concrete example exists: `shift.submit` input has `entries: z.array(z.object({...}))`, `apps/api/src/shift/router.ts:64-77`) that ever nests a `token`/`password`/`code` field would have it persisted verbatim, because sanitization never descends into `entries`. Phase 2's field-name grep will list the top-level key but the denylist it expands is structurally incapable of stripping the nested value. The plan does not acknowledge or test this gap.
- **Evidence:** `apps/api/src/audit/audit-helpers.ts:73-81` (single-level loop, no recursion); `apps/api/src/shift/router.ts:64-77` (real nested-array input reaching the auto-middleware).
- **Suggested fix:** Phase 2 must either make `sanitizeAuditData` recurse (with a depth cap + array handling) and add nested positive/negative tests, or explicitly document nested-object inputs as an accepted residual risk with the list of affected paths. Expanding a flat denylist and calling the sweep "complete" is the same false-completeness that produced the OTP gap.

## Finding 5: Phase 4 log rotation enables anti-forensic log-flooding — 30MB/service with no shipping, unjustified against incident conditions

- **Severity:** Medium
- **Location:** Phase 4, "Requirements" (`max-size: "10m"`, `max-file: "3"` → "~30MB trần/service, đủ cho điều tra sự cố gần nhất")
- **Flaw:** The AuditLog DB table covers only successful mutations. Pre-session security events — failed logins, OTP brute-force, rate-limit hits, injection attempts, 4xx/5xx bursts — live only in the application/nginx stdout logs that Phase 4 caps at 30MB with `max-file:3` and no log shipping. The plan asserts 30MB is "đủ cho điều tra sự cố gần nhất" with no volume basis.
- **Failure scenario:** An attacker probing auth (exactly the threat-model surface Phase 1 cites) generates enough log volume that `json-file` rotation discards the 3 oldest files — rolling away the attacker's own earlier traffic before an investigator looks. Under normal load a chatty nginx+api stack can turn over 30MB in minutes. This is classic log-flooding anti-forensics, and it works precisely because there is no shipping/retention floor.
- **Evidence:** `docker-compose.prod.yml` (target file exists, confirmed present); plan `phase-04...md:20-24, 44-45`; `docs/08-nfr-va-du-lieu-tre-em.md:39-43` (auditability requirement); AuditLog append-only immutability (migration `20260706150000`) covers mutations only, not the access-log forensic layer.
- **Suggested fix:** Keep rotation (disk-fill protection is valid) but note in the plan that it deliberately trades away forensic depth, and record a backlog item for log shipping / a larger retention floor for security-relevant services (nginx, api, lms-auth) before go-live. Do not present 30MB as forensically "đủ" without a volume estimate.

## Finding 6: Plan's own Phase 1 invariant "client does not log the prompt" is factually false for the stub — the full prompt is already emitted to stdout that Phase 4 then persists

- **Severity:** Medium
- **Location:** Phase 1, "Requirements" Non-functional ("không log prompt ở tầng LLM client (giữ nguyên phòng thủ PII tầng client)")
- **Flaw:** The stub path logs the FULL prompt: `console.log('[LLMClient stub] draftAssessment prompt:', prompt)` (`packages/llm/src/index.ts:52`). The existing PII test depends on this behavior (`draft-confirm.test.ts:108-129` greps `console.log` output for the prompt). Only the real path logs length-only (`index.ts:67`). So the plan's stated invariant "client does not log the prompt" is false for the stub, and the plan's PII reasoning ("audit ghi ở call site nơi prompt đã được chứng minh sạch") ignores that the prompt is already emitted to stdout — which, once Phase 4 wires `json-file`, becomes a container log file readable by anyone with host/container access, outside AuditLog's REVOKE-immutability and super_admin gating.
- **Failure scenario:** In any environment running the stub (tests, and any deploy without `LLM_API_KEY`), the full prompt — carrying whatever child data it accretes per Finding 2 — is written to Docker json-file logs with no access control comparable to AuditLog. The plan asserts a client-side PII defense that does not exist on the stub path.
- **Evidence:** `packages/llm/src/index.ts:52` (stub logs full prompt) vs `:67` (real logs length); `apps/api/src/assessment/draft-confirm.test.ts:108-129` (test relies on full-prompt stdout).
- **Suggested fix:** Correct the plan's non-functional claim. Either make the stub log length-only too (and update the PII test to assert against the audit row instead of stdout), or explicitly scope the stdout-prompt exposure and confirm production runs the real (length-only) path.

## Finding 7: Migration path cited without its package prefix — a subagent following the plan literally will glob the wrong tree

- **Severity:** Medium
- **Location:** Phase 3, "Implementation Steps" step 1 (migration `20260706054322_p1_remediation_wave1_schema_rls/migration.sql:96-97`)
- **Flaw:** The migration lives at `packages/db/prisma/migrations/...`, not the repo-root or `apps/api/prisma/...`. The plan cites only the migration folder name. The content claim (lines 96-97: "global identity/audit tables, never facility-scoped") is CORRECT, and the RLS-list correction is CORRECT (no `ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY` exists anywhere). This is a locate-ability defect, not a correctness defect — but an executing agent that globs the bare path (as happened during this review) gets "No files found" and may skip or mis-edit.
- **Failure scenario:** Executor can't find the cited evidence, either abandons the changelog correction or edits the wrong file. Low blast radius (docs-only phase) but wastes a cycle and undermines the "docs are source of truth" rationale.
- **Evidence:** actual path `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:96-97` (verified); `packages/db/src/index.ts:26-29` (no `log:` option, confirming the system-architecture:189 correction); no AuditLog RLS in any of the 30+ `ENABLE ROW LEVEL SECURITY` statements across migrations.
- **Suggested fix:** Prefix all migration/source citations with their package path (`packages/db/prisma/migrations/...`). Trivial edit; prevents an executor dead-end.

---

## Unresolved Questions

1. Is super_admin an acceptable reader of child-linked prompt content under docs/08 §7's "narrow access" rule, or does audit oversight of child data need its own justification recorded in doc 14? The plan asserts the former implicitly but never argues it.
2. Does any current production deploy run without `LLM_API_KEY` (stub path)? That determines whether Finding 6's full-prompt stdout exposure is live in prod or test-only.

---

Status: DONE
Summary: The remediation plan is factually accurate on its docs-correction claims, but its Phase 1 audit enrichment removes existing denylist coverage (Finding 1) and stores an unguarded, redundant raw prompt into a 12-month child-data-adjacent table whose only guard is phone-blind (Findings 2-3); Phase 2's flat-denylist sweep cannot protect nested inputs (Finding 4); Phase 4 rotation is anti-forensic without shipping (Finding 5); plus a false client-logging invariant (Finding 6) and a mis-pathed citation (Finding 7).
Findings count by severity: High 2, Medium 5, Critical 0.
