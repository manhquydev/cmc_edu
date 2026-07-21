# Red-Team Review — ASSUMPTION DESTROYER lens (2026-07-08 delta)

Reviewer: code-reviewer (Contract Verifier role). Scope: Phase 3 (new), Phase 2/Phase 4 deltas.
Method: every claim grepped/read against the running codebase. Baked findings (17 from 2026-07-07,
plus L1 receiptApprove roster, L2 cskh/ctv_mkt/hr, L3 aspirational tests) NOT re-reported.

Verdict up front: the audit's *design targets* mostly exist and the 28-WF count is real, but the
audit's core **method assumption — "trace tự động quyền ↔ router ↔ TL25 bằng script/grep, agent chỉ
tổng hợp"** — is false for the WF layer. TL25's key column is drifted prose, the router file glob the
plan names drops 5 gated files, and the mechanical gate-rule mislabels LMS/provisioning procedures.
These inflate the exact agent-judgment surface the plan claims to have neutralized.

---

## Finding 1: TL25 "API (quyền)" column is drifted prose, not greppable registry keys — Step 2 cannot be mechanical

- **Severity:** High
- **Location:** phase-03-flow-audit.md Step 2 ("permission key khớp cột 'API (quyền)' TL25") + Risk Assessment ("bước 1 dùng grep/script cơ học làm xương sống, agent chỉ tổng hợp").
- **Flaw:** The plan assumes TL25's API column holds registry keys that can be matched against `PERMISSIONS`. It does not. The column holds procedure names, slash-compacted lists, wildcards, parentheticals, and several keys that are **wrong** vs the registry:
  - P3-01: TL25 `checkInOut.punch (checkInOut.punch)` — registry key is `checkIn.punch` (`packages/auth/src/index.ts:128`), call `requirePermission('checkIn','punch')` (`apps/api/src/checkin/router.ts:36`). Module name drift.
  - P3-03: TL25 `shiftRegistration.submit (shift.register)` — registry key is `shift.submit` (`index.ts:137`). Action drift.
  - P4-02: TL25 `gift.upsert/archive` — `gift.archive` **does not exist** in the registry (only `gift.upsert` `index.ts:157`, `gift.list` `index.ts:159`).
  - P2-04: TL25 `exercise.create/publish (assessment.*)` — registry uses `exercise.manage` (`index.ts:99`); the code comment `index.ts:96-98` itself flags TL25 as imprecise here ("the spec names assessment.*/exercise.* (TL25) but this repo's registry uses ... exercise.manage").
  - P1-01: TL25 `crm.opportunityCreate/advance/markLost/lookup (crm.*)` — slash-compacted, and omits `crm.opportunityList` which the registry grants (`index.ts:42`).
- **Failure scenario:** A grep/script join of registry-key ↔ TL25 column yields near-zero exact matches, so per-WF verdicts fall entirely to agent interpretation — the false-positive/negative risk the plan says is fenced off by "grep xương sống." Auditor either burns the "~1 buổi" budget hand-reconciling, or emits confident-but-wrong "khớp/lệch" verdicts.
- **Evidence:** `docs/25-ma-tran-truy-vet-p1.md:19-46`; `packages/auth/src/index.ts:42,99,128,137,157,159`; `apps/api/src/checkin/router.ts:36`.
- **Suggested fix:** Reframe Step 2: the registry↔router table (Step 1) is the source of truth; TL25's API column is an *input to be audited against it*, not a matchable key set. Make "TL25 key drift" an explicit finding category (checkInOut/shift.register/gift.archive/assessment.* already known offenders), not a match failure.

## Finding 2: `requirePermission` contract is a two-arg tuple, not a dotted key — "trace tự động quyền ↔ router" needs a transform the plan doesn't state

- **Severity:** Medium
- **Location:** phase-03-flow-audit.md Step 1 ("liệt kê mọi key trong `PERMISSIONS` ↔ call-site `requirePermission`/`can(`").
- **Flaw:** `PERMISSIONS` keys are dotted strings `module.action` (`index.ts:41-174`). Call sites are `requirePermission('module', 'action')` — two separate quoted args (`apps/api/src/crm/router.ts:78`, `after-sale/router.ts:34`, etc.). A literal grep of the key `finance.receiptApprove` matches **zero** call sites.
- **Failure scenario:** A naive "grep the key" script reports 100% of registry keys as orphaned (no call-site), producing a false "quyền mồ côi" list; or the auditor silently hand-maps and the "cơ học" claim is fiction.
- **Evidence:** `packages/auth/src/index.ts:41-174` (dotted keys) vs `apps/api/src/crm/router.ts:78`, `apps/api/src/checkin/router.ts:36,94,130` (tuple calls).
- **Suggested fix:** State the transform in Step 1: split each key on `.` and grep `requirePermission\(\s*['"]MODULE['"]\s*,\s*['"]ACTION['"]`. Feasible mechanically — but the plan must say so or it will be executed wrong.

## Finding 3: Step 1 gate-rule "mutation không key = lỗ hổng gate" mislabels lmsProcedure / publicProcedure / internal procedures as CRITICAL

- **Severity:** High
- **Location:** phase-03-flow-audit.md Step 1 final sentence ("procedure mutation không key = lỗ hổng gate") + Success Criteria "0 mutation thiếu gate."
- **Flaw:** Not every mutation is `requirePermission`-gated by design. `lmsProcedure` (`apps/api/src/trpc.ts:123`) and `publicProcedure` (`trpc.ts:58`) are legitimate non-registry gates, and internal provisioning has no permission key at all. TL25 itself confirms this: P1-04 "Sinh tài khoản khi thu tiền" = `(internal provisioning; key=phone)` no key (`docs/25:22`); P1-06/07, P2-03/05 are LMS procedures (`docs/25:24,25,30,32`).
- **Failure scenario:** The mechanical rule flags every LMS mutation (`submission.submit`, `lmsAuth.verifyOtp`, guardian link request) and the provisioning path as "lỗ hổng gate = CRITICAL." Auditor either drowns the report in false CRITICALs (each of which, per Step 6, gates GO via fix-forward PR) or must carve them out by hand — again not mechanical.
- **Evidence:** `apps/api/src/trpc.ts:58,111-123`; `docs/25-ma-tran-truy-vet-p1.md:22,24,25,30,32`.
- **Suggested fix:** Step 1 rule must classify by procedure builder: `requirePermission`-gated / `lmsProcedure`-gated / `publicProcedure` (intentional) / `protectedProcedure`-without-permission (the real risk). Only the last is a candidate finding.

## Finding 4: Router enumeration `apps/api/src/<domain>/router.ts` silently drops 5 permission-gated files

- **Severity:** High
- **Location:** phase-03-flow-audit.md Architecture §3 ("routers `apps/api/src/<domain>/router.ts` (31 file...)").
- **Flaw:** The count "31" is only reachable via a `*router*.ts` glob, but the path pattern the plan writes (`<domain>/router.ts`) matches **26** files. The 5 files it misses all carry live `requirePermission` gates:
  - `apps/api/src/class/class-session-router.ts` — `schedule.generate` gates (:96,133,161,207)
  - `apps/api/src/class/class-batch-router.ts` — `class.create` gates (:95,194,219,248)
  - `apps/api/src/class/schedule-router.ts`
  - `apps/api/src/rewards/gift-router.ts` — `gift.upsert`/`gift.list` (:31,64)
  - `apps/api/src/rewards/reward-router.ts` — `rewards.manage` (:119,146,188,245)
- **Failure scenario:** An auditor globbing `**/router.ts` (as the Architecture line literally instructs) never inspects class-session/class-batch/gift/reward gates. WF P2-01 (`class.create`), P4-01 (`rewards.manage`), P4-02 (`gift.upsert`) trace to files outside the enumerated set → false "mồ côi/absent" verdicts on real, gated flows.
- **Evidence:** Glob `apps/api/src/**/*router*.ts` = 31 files; `apps/api/src/**/router.ts` = 26. `apps/api/src/class/class-session-router.ts:96`, `class-batch-router.ts:95`, `rewards/gift-router.ts:31`, `rewards/reward-router.ts:119`.
- **Suggested fix:** Change the anchor to `apps/api/src/**/*router*.ts` (31 files) and explicitly name the `-router.ts` variants, OR drive the trace from `apps/api/src/router.ts` mount graph instead of a filename glob.

## Finding 5: Phase 2 restore/backup env contract under-specified — "bucket + API token" ≠ the 4-6 vars the scripts require

- **Severity:** Medium
- **Location:** phase-02-env-prod-cmcv2.md Step 7 / plan.md Dependencies ("cấp creds ngay — bucket + API token").
- **Flaw:** `backup-db.sh` and `restore-drill.sh` require, and `exit 1` without: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY` (plus `BACKUP_S3_REGION`, default `auto`). The creds are consumed as `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` for `aws s3` (`restore-drill.sh:38-43`, `backup-db.sh:39-44`). "API token" conflates R2's bearer API-token with the S3 access-key-id/secret-access-key **pair** the scripts need; the endpoint URL is not mentioned at all. Also unstated: `restore-drill.sh` requires a backup to **already exist** in the bucket (`restore-drill.sh:45-48`, `exit 1` if none) and a local superuser Postgres + `cmc_app` role for the smoke queries (`restore-drill.sh:12-13,64-66,85-91`).
- **Failure scenario:** User hands over a Cloudflare "API Token" (bearer) or omits the endpoint; drill dies at the `:?` env guards or `aws s3 ls` auth-fails — discovered only when the R2 dependency was declared "resolved," re-opening a stop-condition mid-Phase-2.
- **Evidence:** `scripts/backup-db.sh:11-16,39-44`; `scripts/restore-drill.sh:12-18,38-48,64-66,85-91`.
- **Suggested fix:** Replace "bucket + API token" with the exact var list (endpoint, bucket, access-key-id, secret-access-key, region=auto) and note the R2 credential type must be the S3-compatible keypair. Add "run backup-db.sh once before drill."

## Finding 6: TL25 "Test" column is 100% aspirational paths — Step 2 "test tồn tại & pass" is undecidable mechanically and "& pass" is unbudgeted

- **Severity:** Medium
- **Location:** phase-03-flow-audit.md Step 2 ("test spec cột 'Test' tồn tại & pass") + Success Criteria "28/28 WF có verdict."
- **Flaw:** TL25 names 28 nested specs (`crm/stage.spec`, `finance/approve.spec`, `provisioning/idempotent.spec`, `class/generate-sessions.spec`, ...). The e2e tree holds **6 flat files** with different names: `attendance-grading`, `attendance`, `enrollment`, `finance-approval`, `kind-isolation`, `lms-auth` (`apps/e2e/tests/`). None of the 28 TL25 paths exist; the name→file mapping (`finance/approve.spec` ≈ `finance-approval.spec.ts`? `crm/stage.spec` ≈ nothing?) is human judgment. Verifying "& pass" means *running* Playwright, which spins up a tsx API server + DB per run (`apps/e2e/src/global-setup.ts:62-73`) — a cost the "~1 buổi" estimate and Step 2 do not budget, and the plan elsewhere says "dừng ở plan, KHÔNG cook."
- **Failure scenario:** ~22/28 WF get verdict "test absent" (correct but low-value), the 6 real specs are mis-mapped, and "& pass" is either skipped (criterion unmet) or triggers an unplanned test run that itself needs the stack up.
- **Evidence:** `docs/25-ma-tran-truy-vet-p1.md:19-46` (Test column); Glob `apps/e2e/tests/**/*.spec.ts` = 6 files; `apps/e2e/src/global-setup.ts:70` (spawns own API server).
- **Suggested fix:** Downgrade Step 2 test-check to "exists (mapped by hand) / absent"; drop "& pass" or move pass-verification into Phase 4's e2e runs where the stack is already up.

## Finding 7: "0 CRITICAL mở" exit + "~1 buổi" estimate are not self-decidable — they depend on user-in-loop fix-forward that the plan defers

- **Severity:** Medium
- **Location:** phase-03-flow-audit.md Step 6 + Success Criteria ("0 CRITICAL mở khi kết phase") + Risk ("cap fix-forward 2 vòng"); plan.md Validation ("dừng ở plan, user review sau — KHÔNG cook trong phiên này").
- **Flaw:** Step 6 routes every CRITICAL to a "fix-forward PR riêng TRƯỚC UAT (cap 2 vòng)." Merging PRs needs the user (plan says execution stops at the plan; user reviews later). So "0 CRITICAL mở" cannot be closed inside Phase 3 by the auditor alone — it silently blocks on user availability and PR merge. The "~1 buổi" estimate covers only the *read* audit (28 WF × 4 checks + 9 roles + ≥5 chains + 5-source doc sweep + UAT Section 2 rewrite), not the fix-forward loop it may trigger. Phase 4 Step 1 then hard-gates on "Phase 3 audit đóng (0 CRITICAL mở)," so an audit that surfaces even one money/auth CRITICAL stalls the whole go-live on an unestimated dependency.
- **Failure scenario:** Audit finds a real over-threshold/SoD gap (plausible given L1 roster question); "0 CRITICAL mở" cannot be ticked without a user-merged PR; Phase 4 blocks; the "~1 ngày lùi GO" the user accepted silently becomes multi-day.
- **Evidence:** phase-03-flow-audit.md:67-69,79; plan.md:119; phase-04-uat-gonogo.md:37-39.
- **Suggested fix:** Split Phase 3 exit into "audit complete (findings delivered)" vs "CRITICALs remediated (user-gated)." Estimate the read-audit separately from the fix loop; make Phase 4's gate reference the remediation milestone, not conflate the two.

---

## Contract Verifier results (interfaces/commands the plan relies on)

| Contract | Plan usage | Actual (file:line) | Verdict |
|---|---|---|---|
| `requirePermission(module, action)` | "grep key ↔ call-site" (P3 Step 1) | 2 separate string args, e.g. `requirePermission('crm','opportunityCreate')` `apps/api/src/crm/router.ts:78`; def `apps/api/src/trpc.ts:129-136` | Mismatch — dotted key never matches call site (F2) |
| `PERMISSIONS` key shape | matched vs TL25 column | dotted `module.action` `packages/auth/src/index.ts:41-174` | Keys OK; TL25 column drifted (F1) |
| `ROLES` = 9 | "9 role" | 9 entries `packages/auth/src/index.ts:10-20` | Match |
| receiptApprove roster (baked L1) | `[GĐKD, GĐĐT, ke_toan]` | `packages/auth/src/index.ts:50` | Match (not re-reported) |
| Router set | "31 file `<domain>/router.ts`" | 31 via `*router*.ts`; 26 via `router.ts` — 5 gated `-router.ts` dropped | Path pattern under-counts (F4) |
| `restore-drill.sh` env | "bucket + API token" | requires ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY(/REGION) + pre-existing backup + local superuser PG `scripts/restore-drill.sh:12-18,45-48` | Under-specified (F5) |
| `backup-db.sh` target | R2 off-box | `aws s3 --endpoint-url $BACKUP_S3_ENDPOINT --region ${...:-auto}` `scripts/backup-db.sh:39-44` — R2 S3-compatible, endpoint override supported | Compatible (no finding) — R2 host ≠ deploy host passes RT-13 `restore-drill.sh:29-30` |
| e2e run command | `pnpm --filter @cmc/e2e test` (P4 Step 3) | script `"test": "playwright test"` `apps/e2e/package.json:7` | Match |
| e2e scope caveat | "global-setup spawns tsx API, not docker stack" (P4 Architecture) | `spawn(process.execPath,[tsxCli, '../../api/src/server.ts'])` `apps/e2e/src/global-setup.ts:70` (path is `src/global-setup.ts`, not `global-setup.ts`) | Substantively correct (valid caveat) |
| Anchors: `apps/admin/src/routes`, `apps/admin/src/shell` (nav-registry.ts), `apps/admin/src/pages/<area>`, `apps/lms/src/pages` | P3 Step 2/3 targets | all exist | Match |
| WF count | "28 WF" | P1×9 + P2×8 + P3×6 + P4×5 = 28 `docs/25:19-46` | Match |

---

Status: DONE_WITH_CONCERNS
Summary: The 28-WF count, 9 roles, and all UI/route/LMS anchors are real, but the audit's "mechanical
script/grep backbone" is a false assumption at the WF layer — TL25's key column is drifted prose (F1),
the `requirePermission` contract is a tuple not a dotted key (F2), the gate-rule mislabels LMS/internal
procedures (F3), and the router glob the plan names drops 5 gated files (F4). Phase 2's R2 env contract
is under-specified vs the scripts (F5), and Phase 3's "0 CRITICAL / ~1 buổi" exit is not self-decidable (F7).
