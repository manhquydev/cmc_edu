# Red-Team Plan Review — Failure Mode Analyst (Murphy's Law lens)

**Reviewer role:** rt-failure (hostile) · **Verification role:** FACT CHECKER
**Date:** 2026-07-08 · **Target:** 2026-07-08 delta of `plans/260707-2308-golive-sprint-land-sso-env-uat`
**Scope:** plan.md, phase-02, phase-03 (NEW), phase-04 (renamed). Baked findings (RT-α..ε, C1-C3, H1-H7, M1-M7, L1-L3) NOT re-reported.

---

## Finding 1: Phase-3 fix-forward PRs never redeployed into the docker stack before UAT — humans validate a stale binary

- **Severity:** Critical
- **Location:** phase-02 step 4 (`phase-02-env-prod-cmcv2.md:35`); phase-03 step 6 (`phase-03-flow-audit.md:68`); phase-04 steps 1 & 6 (`phase-04-uat-gonogo.md:37-39, 47-51`)
- **Flaw:** Phase 2 builds the `cmcv2-prod` images exactly once (`phase-02:35` "Build images + prisma migrate deploy + up -d"). Phase 3 mandates that audit CRITICAL findings are fixed-forward via separate PRs landing on `main` BEFORE UAT (`phase-03:68`). Phase 4 has no image rebuild/redeploy step — step 1 pre-check lists gates and audit-closed, step 6 runs real-person UAT "theo docs/29 + Section 2" against the running stack. Nothing in the plan re-runs `docker compose build` after Phase-3 fixes merge.
- **Failure scenario:** Phase-3 audit finds a CRITICAL money/child-data gate defect (exactly the class it hunts — e.g. an ungated mutation or a wrong `receiptApprove` roster). A fix-forward PR lands on `main`. Phase-4 e2e (`pnpm --filter @cmc/e2e test`) spawns its OWN tsx API server from the working tree (`apps/e2e/src/global-setup.ts:70`, `serverEntry = ../../api/src/server.ts`), so e2e runs the FIXED code and goes green. But real-person UAT (phase-04:47) and the SSO smoke both hit the docker stack, which still runs the OLD images built in Phase 2. The go/no-go record is signed GO on a binary that does not contain the CRITICAL fix. Divergent validation surface — green tests, unfixed production artifact.
- **Evidence:** `apps/e2e/src/global-setup.ts:62-73` (e2e spawns tsx server, not the stack); `phase-04-uat-gonogo.md:27-29` (plan's own note: e2e "KHÔNG validate images/nginx/boot-checks của cmcv2-prod"); `phase-02-env-prod-cmcv2.md:35` (single build); no rebuild step anywhere in phase-04.
- **Suggested fix:** Add an explicit Phase-4 step-0: "If any fix-forward PR landed since Phase-2 build, `docker compose -p cmcv2-prod build` + `up -d` + re-run boot-checks + SSO smoke BEFORE Run 1 e2e and before real-person UAT." Gate the go/no-go record on `git rev-parse HEAD` of the built image matching `main`.

---

## Finding 2: Cross-plan stale phase number — roadmap plan still calls UAT "Phase-3", which is now the Flow-Audit gate

- **Severity:** Medium
- **Location:** `plans/260708-0504-roadmap-m1-m4-execution/plan.md:45`; renumbering in `plan.md:39-44`
- **Flaw:** The golive-sprint plan inserted a NEW Phase 3 (Flow-Audit) and renamed old `phase-03-uat-gonogo.md → phase-04-uat-gonogo.md`. But the sibling roadmap plan's status line still reads "Phase-2 ENV đang chạy ... Phase-3 UAT chưa." After the delta, Phase 3 is the audit gate and UAT is Phase 4.
- **Failure scenario:** An operator (or a future agent) reading the roadmap's status line concludes UAT ("Phase-3") is the next step after ENV and skips the Flow-Audit gate entirely — the exact gate the 2026-07-08 delta inserted to prevent testing the wrong things. Silent gate-skip via stale cross-reference.
- **Evidence:** `plans/260708-0504-roadmap-m1-m4-execution/plan.md:45` (VERIFIED: "Phase-3 UAT chưa"); golive `plan.md:41` (UAT is now Phase 4).
- **Suggested fix:** Update roadmap plan:45 to "Phase-3 Flow-Audit + Phase-4 UAT chưa." Add a one-line "renumbered 2026-07-08" note in golive `plan.md` Phases table so downstream readers reconcile.

---

## Finding 3: Section-2 rewrite orphans Go/No-Go gate G2 and the Section-1 coverage pointers

- **Severity:** High
- **Location:** phase-03 step 7 (`phase-03-flow-audit.md:70-72`); `docs/uat-checklist-go-live.md:59-60, 64-135, 196`
- **Flaw:** Phase 3 rewrites Section 2 from role-organized subsections (2.1 GĐKD … 2.7 Học sinh) into ≥5 cross-role chains. But other parts of the SAME official record are hard-wired to the role structure: Go/No-Go gate **G2 = "All roles in Section 2 signed off"** (`uat-checklist:196`), and Section 1's coverage-gap notes point per-role into Section 2 ("Entra SSO staff login — see Section 2"; "LMS OTP … see Section 2", `uat-checklist:59-60`). The plan's step 7 rewrites Section 2 but never reconciles G2's "all roles" semantics or the Section-1 pointers.
- **Failure scenario:** After the rewrite there is no per-role sign-off grid, so G2 ("all roles signed off") is unverifiable against the new chain layout — the reviewer either ticks G2 with no artifact backing it (false GO) or blocks on an ambiguous gate. Section-1's "see Section 2" pointers dangle. L1's own evidence anchor (§2.4 "Kế toán duyệt phiếu thu", `uat-checklist:102`) may be dissolved by the rewrite, breaking the audit's own citation.
- **Evidence:** `docs/uat-checklist-go-live.md:196` (G2 wording, VERIFIED); `:59-60` (Section-1 pointers, VERIFIED); `:96-104` (§2.4 role anchor, VERIFIED); `phase-03:70-72` (rewrite instruction, no reconciliation).
- **Suggested fix:** phase-03 step 7 must also (a) restate G2 in terms of chains/roles-covered-by-chains, (b) repoint Section-1 coverage notes, (c) preserve a role→chain coverage matrix so every one of the 9 roles remains individually sign-off-traceable.

---

## Finding 4: Three phases mutate the official go/no-go record file concurrently — lost ticks / merge clobber

- **Severity:** High
- **Location:** phase-02 step 9 (`phase-02:43`); phase-03 step 7 (`phase-03:70`); phase-04 steps 3/6/8 (`phase-04:44,47,53-55`); single file `docs/uat-checklist-go-live.md`
- **Flaw:** `docs/uat-checklist-go-live.md` is the single official record, and three phases write it: Phase 2 fills Prerequisites + G1–G10 (Section 4), Phase 3 rewrites Section 2 on a fix-forward branch, Phase 4 fills Run 1/2 (Section 1) + Section 5 decision. Phase-3 fix-forward is explicitly branch+PR based (`phase-03:22, :68`). No step defines a merge/ordering discipline for this shared file.
- **Failure scenario:** Phase 2 ticks G1–G10 on the working copy / main. Phase 3's Section-2 rewrite branches from an earlier revision and, on merge/rebase, silently reverts or conflicts with the Phase-2 gate ticks (same file, adjacent sections). A dropped G-tick or a resurrected empty Section 2 in the official record produces a GO signed against an incomplete checklist. Because the file is the audit-of-record, a lost tick is a silent integrity failure, not a visible test failure.
- **Evidence:** `phase-02:43`, `phase-03:70`, `phase-04:33` all name `docs/uat-checklist-go-live.md` as a modify target; `phase-03:22` (fix-forward = separate PR/branch). Checklist has interleaved sections (Prereq :7, Section 1 :16, Section 2 :64, Section 4 gates :188) that different phases touch.
- **Suggested fix:** Serialize checklist edits: Phase 3's Section-2 rewrite must rebase onto the Phase-2 tip immediately before merge, and a post-merge step must re-verify G1–G10 ticks survived. Alternatively split the record — put the Phase-3 chain scenarios in a referenced sub-file so the gate section is never on a Phase-3 branch.

---

## Finding 5: R2 restore drill is now on the critical path AND stop-conditioned, but the known R2/aws-CLI incompatibility is deferred to "fix-forward if it breaks"

- **Severity:** Medium
- **Location:** phase-02 step 7 (`phase-02:38-41`), stop-condition (`phase-02:57`); `scripts/backup-db.sh:34-44`; `scripts/restore-drill.sh:38-59`
- **Flaw:** The drill is un-deferred and retargeted to Cloudflare R2. The scripts use `aws s3 cp/ls/rm` with only `--endpoint-url` + `--region auto`. Recent aws CLI v2 defaults to request/response integrity checksums (CRC32) that non-AWS S3 endpoints including R2 have historically rejected on upload/multipart. The plan acknowledges "R2 endpoint khác AWS S3 chuẩn, script có thể lộ lỗi tương thích (fix-forward PR riêng nếu có)" — but the drill is a **stop-condition after 2 failures** (`phase-02:57` "restore drill fail 2 lần"). A checksum incompatibility fails deterministically, so it burns both attempts and halts task #8 with no pre-identified mitigation.
- **Failure scenario:** First `backup-db.sh` upload to R2 fails on checksum header; operator retries verbatim, fails again → 2-failure stop-condition trips → task #8 blocked mid-sprint, GO slips, and the stack keeps squatting resources during the stall (see Finding 6). The RT-13 host check itself passes trivially for any R2 endpoint (`restore-drill.sh:27-34`: `<acct>.r2.cloudflarestorage.com` ≠ deploy host, ≠ localhost/minio), so the false-green RT-13 does not catch the real upload failure.
- **Evidence:** `scripts/backup-db.sh:39-44` (`aws s3 cp ... --endpoint-url`), `scripts/restore-drill.sh:38-59` (`aws s3 ls`/`cp`), `restore-drill.sh:18` (region defaults `auto` — good), `phase-02:41` (deferral wording), `phase-02:57` (2-failure stop-condition).
- **Suggested fix:** Pre-pin the R2 mitigation in phase-02 step 7 BEFORE first run: set `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` (and `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required`) or an equivalent aws config, and validate `aws s3 ls` against the bucket as a zero-cost pre-check before the first `cp`. Do not let a deterministic config error consume the 2-failure budget.

---

## Finding 6: No defined path when a Phase-3 CRITICAL needs a PRODUCT decision (not a code fix) — multi-day stall while the stack squats 80/443 and holds a real Entra super_admin

- **Severity:** High
- **Location:** phase-03 stop-condition (`phase-03:84`), success criteria (`phase-03:79`); plan.md stop-conditions (`plan.md:79`); phase-04 teardown (`phase-04:55`); `docker-compose.prod.yml:29,51,75,99,115,122,143`
- **Flaw:** Phase 3's failure handling assumes CRITICALs are code-fixable: "cap fix-forward 2 vòng, vòng 3 = stop-condition" (`phase-03:84`) and "0 CRITICAL mở … đã fix-forward hoặc user chấp nhận rủi ro" (`phase-03:79`). But its own leads describe CRITICALs that are DESIGN decisions, not bugs — L1 asks "roster rộng là chủ đích ADR-B hay drift?" (`phase-03:35`), which resolves via an ADR/product ruling, not a 2-round PR. The plan-level stop-conditions (`plan.md:79`) list only creds/migration/destructive/e2e-DB — nothing for "audit surfaced a CRITICAL requiring a product decision." There is no pre-resolution and no "pause + teardown during decision stall" step.
- **Failure scenario:** Audit finds a money-gate CRITICAL that hinges on a product ruling. It cannot be fixed-forward in 2 rounds because it needs a human decision that takes days. Phase 4 is blocked (dep [3]). Meanwhile the `cmcv2-prod` stack has `restart: unless-stopped` on every service and continues occupying host ports 80/443 and holding the seeded **real-Entra-email super_admin** (`phase-02:8, :42`) on the dev machine across the stall, surviving reboots. No step tears down or parks the stack during an open-ended decision wait. Resource squat + a live privileged account sitting idle on a dev box = the exact H6 teardown risk, but triggered by a process deadlock the plan does not model.
- **Evidence:** `phase-03:84` (2-round cap assumes fixable), `phase-03:35` (L1 = product decision), `plan.md:79` (stop-condition list omits product-decision case), `docker-compose.prod.yml:29,51,75,99,115,122,143` (all `restart: unless-stopped`, VERIFIED), `phase-04:55` (teardown only defined at NO-GO, not at stall).
- **Suggested fix:** Add a Phase-3 stop-condition: "CRITICAL requiring a product/ADR decision that cannot pre-resolve → park: `docker compose -p cmcv2-prod down` (release 80/443), disable/rotate the seeded super_admin, record the open decision, resume on ruling." Add the product-decision case to plan.md stop-conditions.

---

## Fact Checker Results (sampled 12 claims across the delta)

| # | Claim (plan location) | Verdict |
|---|----------------------|---------|
| 1 | `finance.receiptApprove = [giam_doc_kinh_doanh, giam_doc_dao_tao, ke_toan]` (phase-03:35, L1) | **VERIFIED** `packages/auth/src/index.ts:50` |
| 2 | Comment "ADR-B chỉ loại sale" on receiptApprove (phase-03:35) | **VERIFIED** `index.ts:48-49` |
| 3 | ROLES registry = 9 roles at `index.ts:10-20` (plan.md:31) | **VERIFIED** `index.ts:10-20` (super_admin + 8) |
| 4 | `PERMISSIONS` registry `:41-174`, `can()` `:180-192` (phase-03:27) | **VERIFIED** `index.ts:41-174`, `:180-192` |
| 5 | L2 hr perms: rewards.manage, parentMeeting.manage, testAppointment.manage (phase-03:40) | **VERIFIED** `index.ts:161,163,165` |
| 6 | L2 cskh: parentAccount.updateEmail, guardian.approveLink (phase-03:40) | **VERIFIED** `index.ts:106,58` |
| 7 | restore-drill FAIL on localhost/127.0.0.1/minio, host-identity check (phase-02:18) | **VERIFIED** `scripts/restore-drill.sh:29-33` |
| 8 | `restore-drill.sh:27` uses `hostname -f` (C3, plan.md:96) | **VERIFIED** `restore-drill.sh:27` |
| 9 | isolation-check only greps `cmcnew*` (phase-02:33, H7) | **VERIFIED** `scripts/isolation-check.sh:14,26,37,49` |
| 10 | compose `restart: unless-stopped` at `:29,51,...` (phase-04:55) | **VERIFIED** `docker-compose.prod.yml:29,51,75,99,115,122,143` |
| 11 | minio in compose is opt-in app-storage, not backup (phase-02:18, cites `:140`) | **VERIFIED** `docker-compose.prod.yml:141-143,157` (`--profile minio`); cited line off-by-1 |
| 12 | e2e global-setup spawns own tsx API server, not the docker stack (phase-04:27) | **VERIFIED** `apps/e2e/src/global-setup.ts:62-73` (actual path `apps/e2e/src/`, plan cited `global-setup.ts:68-73`) |
| 13 | Renumbering: no stale `phase-03-uat-gonogo` file remains | **VERIFIED** only `phase-03-flow-audit.md` + `phase-04-uat-gonogo.md` exist |
| 14 | Cross-plan stale "Phase-3 UAT" reference | **FAILED (stale)** `plans/260708-0504-roadmap-m1-m4-execution/plan.md:45` still says "Phase-3 UAT" → Finding 2 |

All sampled code-symbol/line claims VERIFIED (two cite trivially off-by-one line numbers: minio `:140` vs `:141`, global-setup `:68-73` vs `:62-73` + wrong dir `tests/` vs `src/` — cosmetic, non-blocking). The only substantive FAILED check is the cross-plan phase-number drift (Finding 2).

---

## Unresolved Questions

1. Does the operator intend real-person UAT to run against the docker stack or against the e2e tsx server? Finding 1 assumes the stack; if UAT is only ever run against freshly-spawned tsx servers, the stale-image risk narrows to the SSO smoke only (still a gap).
2. Is `DRILL_PG_URL` for the restore drill intended to point at the prod postgres container (localhost:5432) or a separate throwaway instance? If the former, the drill's `CREATE/DROP DATABASE` runs on the same cluster holding pilot data (name-safe but coupling risk).
3. Who owns reconciling G2 wording after the Section-2 rewrite (Finding 3) — Phase 3 executor or Phase 4?

---

Status: DONE_WITH_CONCERNS
Summary: Delta is factually well-grounded (13/14 sampled claims verified against code), but has one Critical sequencing hole (Phase-3 fixes never redeployed → UAT validates a stale binary) plus three High failure-modes around the shared UAT-checklist file and an unmodeled product-decision stall.
