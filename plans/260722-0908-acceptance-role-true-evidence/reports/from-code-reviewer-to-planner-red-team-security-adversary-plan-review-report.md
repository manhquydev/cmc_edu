# Red Team — Security Adversary: plan review

Plan: `plans/260722-0908-acceptance-role-true-evidence/`
Reviewer role: Security Adversary / Fact Checker
Date: 2026-07-22

---

## Finding 1: `class.read` for `giao_vien` silently reverses the teacher class-scoping remediation (H1+H2)

- **Severity:** Critical
- **Location:** Phase 2, "Architecture" (procedure table) + `'class.read': ['giam_doc_kinh_doanh','giam_doc_dao_tao','sale','giao_vien']`; plan.md D2
- **Flaw:** The four procedures being moved to `class.read` contain **no** `assertTeacherOwnsClass` call. Today they are effectively director-only (`class.create` = `giam_doc_dao_tao` alone), so no teacher scoping was ever needed on them. The moment `giao_vien` is added to `class.read`, four unscoped class reads open up. The codebase already made the opposite decision for the equivalent roster read: `attendance.listBySession` — described in its own header as "the roster read" — is gated by `assertTeacherOwnsClass`. Phase 2's risk table lists only "RLS/facility-scope"; teacher-level scoping is never mentioned anywhere in the plan.
- **Failure scenario:** Teacher B (`giao_vien`, assigned to class B only) calls `classBatch.list` → picks class A's id → `classBatch.listStudents({classBatchId: A})`. The procedure resolves `scoped(ctx)` + `withFacility` (both satisfied — same facility) and returns the full roster of class A: `studentId`, `fullName`, enrollment `status` for every reserved/active minor. Same for `classBatch.get` and `classSession.list`. `attendance.listBySession` would have thrown `FORBIDDEN` for exactly this caller. The plan therefore grants, through a "read-only permission", precisely the cross-class child-data read that the 2026-07-15 remediation was written to close.
- **Evidence:**
  - `apps/api/src/attendance/assert-teacher-owns-class.ts:1-14` — "shared ownership gate extracted from `attendance.listBySession`'s inline check"; `:31-59` the guard; `:53-58` FORBIDDEN branches
  - `apps/api/src/attendance/router.ts:259` — `listBySession: requirePermission('attendance','mark')`; `:266` calls `assertTeacherOwnsClass`
  - `apps/api/src/class/class-batch-router.ts:254-281` — `listStudents` returns `{enrollmentId, studentId, fullName, status}`, **no** ownership check
  - `apps/api/src/class/class-batch-router.ts:229`, `:283`; `apps/api/src/class/class-session-router.ts:84` — same, no ownership check
  - `apps/api/src/assessment/assert-assessment-draft-scope.ts:46` and `apps/api/src/session-evidence/router.ts:176` — every other teacher-reachable class surface calls the guard
  - `docs/08-nfr-va-du-lieu-tre-em.md:64` — "Tối thiểu hoá dữ liệu: chỉ thu thập dữ liệu trẻ thực sự cần"
- **Suggested fix:** Phase 2 must wire `assertTeacherOwnsClass` into `classBatch.get`, `classBatch.listStudents`, `classSession.list`, and add a teacher-scoped filter (`teacherAppUserId = me`) to `classBatch.list` — or drop `giao_vien` from `class.read` and give the teaching screens a separate `classBatch.myClasses` procedure. Add a negative-authz test to Phase 2's mandatory list: `teacherB.classBatch.listStudents(classA)` → FORBIDDEN.

---

## Finding 2: `/admin/classes` has no nav gate and no route guard — `class.read` hands sale/GV the class administration surface by URL

- **Severity:** Critical
- **Location:** Phase 2, "Related Code Files" and "Success Criteria" (only `/finance/new`, `/teaching/session-assessment`, `/hr/payroll` are listed/validated)
- **Flaw:** The plan reasons about permission changes purely at the tRPC layer and validates exactly three screens. It never enumerates the other UI consumers of the four procedures. Four admin/teaching screens consume them, and the class administration entry has **no `permission` field** in the nav registry, while `apps/admin/src/routes/*.tsx` contain **no** route-level permission guard at all (grep for `permission` across all six route files returns nothing). Today those screens fail closed because every query 403s; after Phase 2 they render fully.
- **Failure scenario:** A `sale` user logs in. `/admin/classes` is already in their sidebar (ungated). Pre-Phase-2 the page shows an error/empty state because `classBatch.list` 403s. Post-Phase-2 it renders the complete class catalogue; clicking any class opens `class-detail.tsx`, which fires `classBatch.get`, `classBatch.listStudents` and `classSession.list` — all now permitted — exposing the roster of every class in the facility to a sales rep. `/teaching/schedule` (also ungated, line 19 has no `permission`) behaves the same. Nothing in Phase 2's acceptance criteria would catch this, because the criteria only assert that three *intended* screens start working.
- **Evidence:**
  - `apps/admin/src/shell/nav-registry.ts:36` — `{ id: 'classes', label: 'Lớp học', path: '/admin/classes', icon: 'layers' }` — no `permission` key, unlike siblings at `:20,:21,:25,:26,:72`
  - `apps/admin/src/shell/nav-registry.ts:19` — `/teaching/schedule`, also no `permission` key
  - `apps/admin/src/routes/` → `admin.routes.tsx`, `crm.routes.tsx`, `finance.routes.tsx`, `hr.routes.tsx`, `index.tsx`, `ops.routes.tsx`, `teaching.routes.tsx`: `grep -rn "permission" apps/admin/src/routes/*.tsx` → 0 matches
  - `apps/admin/src/pages/classes/index.tsx:42` (`classBatch.list`); `apps/admin/src/pages/classes/class-detail.tsx:71` (`listStudents`), `:128` (`classSession.list`), `:236` (`classBatch.get`)
  - `apps/admin/src/pages/teaching/schedule.tsx:229`, `apps/admin/src/pages/cockpit.tsx:173`, `apps/admin/src/pages/enrollment/class-placement.tsx:52`
- **Suggested fix:** Add to Phase 2 an explicit inventory step: enumerate every UI consumer of each re-permissioned procedure and decide per screen. Add `permission: { module: 'class', action: 'create' }` to the `/admin/classes` nav entry, and add a UAT/negative check that `sale` navigating directly to `/admin/classes` does not obtain a roster.

---

## Finding 3: D6 makes 9 flows structurally unsatisfiable, forcing a blanket whitelist that neuters the new gate

- **Severity:** High
- **Location:** plan.md "Quyết định đã chốt" D6; Phase 1 "Architecture" (`Loại khỏi phép tính: super_admin, he_thong, agent`); plan.md Acceptance Criteria bullet 2
- **Flaw:** D6 removes `super_admin`, `he_thong` and `agent` from the actor calculation, and Phase 1's assertion is two-way: every procedure of a flow must be callable by ≥1 declared actor. Nine flows in the manifest declare **only** excluded actors, so every one of their procedures becomes an ORPHAN-PROC on day one. The plan states the current violation count is "7/38" (F8) — a figure measured before D6 existed — and Phase 1 step 5 names exactly one exception (P1-09). The gap between "7" and "7 + 9" is never reconciled.
- **Failure scenario:** Phase 1 lands; `pnpm acceptance:report` exits non-zero with ~17 ADM procedures plus the `he_thong` flows' procedures flagged. Under CI pressure the fastest resolution is a bulk `DOCUMENTED_GAPS`/exception block covering all of ADM-* and all `he_thong` flows. That block is exactly the "nơi giấu lỗi" the plan's own Phase 1 risk table warns about, and once it exists the gate no longer distinguishes "intentionally super_admin-only" from "nobody can actually do this".
- **Evidence:**
  - `scripts/acceptance-report/flow-manifest.ts:511,522,533,544,555` — ADM-01..ADM-05 all `actorRoles: ['super_admin']`
  - `scripts/acceptance-report/flow-manifest.ts:70,82,407,419` — P1-04, P1-05, P3-10, P3-11 all `actorRoles: ['he_thong']`
  - `packages/auth/src/index.ts:78-81,96,97,109` — `facility.create/list/manage`, `audit.list`, `user.manage`, `facilityNetwork.manage`, `compensationPolicy.manage` all `[]` → unreachable by any non-super role
  - `phase-01-...md:42` (exclusion list), `:68` (fail on violation), `plan.md:77` (AC)
- **Suggested fix:** Define the rule as *flow-level*: a flow whose declared actors are entirely outside the staff `Role` set is skipped from the actor↔permission math and reported in a separate "not actor-verifiable" bucket, rather than being funnelled into the same exception list used to hide genuine defects. State the expected post-D6 violation count in Phase 1 so the executor can tell a real regression from arithmetic.

---

## Finding 4: P1-09's `audit.list` exception encodes a manifest error as design intent, and hides a real financial-oversight gap

- **Severity:** High
- **Location:** Phase 1, "Implementation Steps" step 5, third bullet — *"Khai ngoại lệ có lý do khi cố ý (P1-09 `audit.list` là super_admin-only theo thiết kế ADMIN)"*
- **Flaw:** The stated justification is false on two counts. `audit.list` is already owned by ADM-04 ("Nhật ký hệ thống", `/admin/audit-log`, actor `super_admin`) — the ADMIN-design argument applies to ADM-04, not P1-09. P1-09 is "Giám sát bất thường tài chính" with `uiRoute: /ops/recon`, and that page makes no `audit.list` call anywhere in the admin app; the only consumer is `pages/admin/audit-log.tsx:66`. So `audit.list` in P1-09's procedure list is a manifest duplication error, and the plan proposes to whitelist it permanently instead of removing it.
- **Failure scenario:** The exception is written and the liveness guard passes (the procedure exists). From then on, the audit can never surface the substantive question the entry actually raises: P1-09's declared human actor is `giam_doc_dao_tao` — the ADR-B second-eye money approver — and that role has **no** audit-trail read (`'audit.list': []`). A financial-anomaly-monitoring flow whose only audit read requires the one role that bypasses the entire registry is precisely the anti-pattern this plan exists to eliminate, and the exception makes it invisible to every future run.
- **Evidence:**
  - `scripts/acceptance-report/flow-manifest.ts:146-156` — P1-09, `actorRoles: ['agent','giam_doc_dao_tao']`, `trpc: ['audit.list', 'reconciliation.listFlags', ...]`, `uiRoutes: ['/ops/recon']`
  - `scripts/acceptance-report/flow-manifest.ts:541-548` — ADM-04, `trpc: ['audit.list']`, `uiRoutes: ['/admin/audit-log']`
  - `packages/auth/src/index.ts:81` — `'audit.list': []`
  - `apps/admin/src/pages/admin/audit-log.tsx:66` — the only `trpc.audit.list.useQuery` in the app; `grep "trpc\." apps/admin/src/pages/ops/recon.tsx` → no audit call
- **Suggested fix:** Remove `audit.list` from P1-09's `expected.trpc` (it belongs to ADM-04) rather than whitelisting it, and raise as an explicit PO question whether GĐĐT/GĐKD need a scoped audit read for reconciliation oversight. Add a plan rule: an exception may not be written when the same procedure is correctly claimed by another flow.

---

## Finding 5: Phase 5's runtime guard is inert in the default run mode; the grep AC is already vacuously satisfied

- **Severity:** High
- **Location:** Phase 5, "Architecture" — *"Grep dễ bị lách … guard tại điểm cấp cookie thì không"*; Phase 4 "Non-functional" — *"Auth qua signed cookie (Mode-B), không `x-dev-user`"*; plan.md AC *"Grep gate: `roles: ['super_admin']` xuất hiện 0 lần"*
- **Flaw:** Two independent errors. (a) `createE2eStaffClient` — the helper every spec uses — only calls `mintStaffCookie` when `NODE_ENV === 'production'`; otherwise it falls back to `createStaffClient`, which sends an unsigned `x-dev-user: JSON.stringify(staff)` header carrying arbitrary roles. A guard installed inside `mintStaffCookie` is therefore never reached in a default `pnpm --filter @cmc/e2e test` run, so the "guard runtime là mức nên nhắm tới" claim is wrong for the mode the team actually runs. Mode-B is a property of the environment, not of the spec — a spec "written for Mode-B" silently degrades. (b) The grep AC is already true on main: `grep -rn "super_admin" apps/e2e/tests/*.ts` returns **0** matches. The gate therefore ships green having proven nothing; its only real subject is the unmerged branch.
- **Failure scenario:** Phase 5 lands both layers. A future spec author writes `createE2eStaffClient(baseUrl, { userId: 'x', roles: [ADMIN_ROLE], facilityId })` where `ADMIN_ROLE = 'super_admin'` is imported from a shared constant. The grep layer misses it (no literal), and the `mintStaffCookie` layer is never invoked because the run is Mode-A. The spec passes as `super_admin` through `x-dev-user`, bypassing the whole registry (`can()` returns `true` unconditionally), and gets stamped `proven` — reproducing the exact defect the phase exists to prevent.
- **Evidence:**
  - `apps/e2e/src/trpc-client.ts:101-111` — `if (process.env['NODE_ENV'] === 'production') { … mintStaffCookie … } return createStaffClient(baseUrl, staff);`
  - `apps/e2e/src/trpc-client.ts:26-35` — `headers: () => ({ 'x-dev-user': JSON.stringify(staff) })`
  - `apps/api/src/context.ts:51` — `const DEV_AUTH_ENABLED = process.env.NODE_ENV !== 'production'`; `:214,:234` the header path
  - `apps/e2e/package.json` — `"test": "playwright test"`, no `NODE_ENV` set
  - `apps/e2e/src/global-setup.ts:108-114` — mode branch, `roles: ['super_admin']` bootstrap lives in `src/`, outside the `apps/e2e/tests/**` scan Phase 5 specifies
  - `grep -rn "super_admin" apps/e2e/tests/*.ts` → 0 matches on `main`
- **Suggested fix:** Put the guard at the *client factory* (`createE2eStaffClient` / `createStaffClient`), not at `mintStaffCookie`, so it fires in both modes; and reject `super_admin` there for any spec not registered to an `ADM-*` flow. Restate the AC as "guard demonstrably fails on the runtime-verification branch" (which is falsifiable) rather than "0 grep hits on main" (which is already true).

---

## Finding 6: The permission-scanner cannot see inline authorization, and Phase 1 sets no coverage bar for it

- **Severity:** High
- **Location:** Phase 1, "Implementation Steps" step 1 (liveness guard is *only* "if scanner yields 0 permissions → throw") and "Test / Validation"
- **Flaw:** The scanner is specified as `ns.proc → module.action → Role[]`, a registry-only model. Ten procedures in the API carry **no** permission key and enforce authorization inline instead. The scanner cannot represent them, and the plan never says what happens to them: treated as orphans they get whitelisted; skipped, they vanish from the audit; defaulted to "any actor", the audit affirmatively certifies ungated procedures. Note the asymmetry with Phase 3, which does set a hard coverage bar ("~46 routes, not 13/40"); Phase 1's only guard is a non-zero check, which a scanner resolving 20 of 119 call sites would pass.
- **Failure scenario:** `payroll.getForUser` is a `protectedProcedure` whose privacy gate (own payslip OR director) lives inside the resolver. Under the Phase 1 model it has no permission key, so it is either flagged ORPHAN-PROC and written into `DOCUMENTED_GAPS` with a one-line reason, or dropped. Either way, a payslip read reachable by *any authenticated staff session* is recorded as "explained". Phase 4 then builds the P3-05 role-true spec on top of a flow the audit has already blessed, and the plan's headline promise — "no flow is 'done' until a real business role can complete it" — is satisfied by procedures nobody actually role-verified.
- **Evidence:**
  - `apps/api/src/payroll/router.ts:568-606` — `getForUser: protectedProcedure`, inline `isOwner || isDirector` gate at `:586-593`
  - `apps/api/src/payroll/router.ts:614`, `apps/api/src/checkin/router.ts:368,398`, `apps/api/src/kpi/router.ts:417,461`, `apps/api/src/shift/router.ts:372,386,426`, `apps/api/src/session/router.ts:24`
  - `packages/auth/src/index.ts:100-103` — comment confirming `manualPunch.resubmit` "uses an owner check instead of a permission key"
  - Counts: 119 `requirePermission(` call sites, 59 distinct keys, 73 registry keys, 1 unused key (`exercise.view`)
  - `phase-01-...md:58` (liveness guard text) vs `phase-03-...md:70` (46-route coverage bar)
- **Suggested fix:** Add a third scanner output — `Set<"ns.proc">` of permission-free `protectedProcedure`s — and make Phase 1 fail on any such procedure appearing in a manifest flow unless it carries an explicit "inline-authz, verified by test X" annotation. Add a coverage criterion mirroring Phase 3: resolved procedures must be ≥ N of the 119 known `requirePermission` call sites.

---

## Finding 7: Phase 2 option (a) understates `user.list`'s exposure and silently widens ADM-02

- **Severity:** High
- **Location:** Phase 2, "Architecture" — *"(a) … `user.list` trả PII nhân sự nên phạm vi phải cân nhắc"*; Risk table row *"`user.read` (hướng a) lộ PII nhân sự cho 2 vai giám đốc | Trung bình"*
- **Flaw:** `user.list` performs `tx.appUser.findMany({ where: { facilityId } })` with **no `select`** and casts the raw rows to `AppUserDto`, which includes `roles: AuthRole[]`. That is not merely staff PII: it is the facility's complete RBAC assignment map plus every staff member's login `userId`, `email`, `employeeCode` and `managerId` graph. Rating this "Trung bình / PII nhân sự" and leaving the (a)/(b) choice open at execution time defers a trust-boundary decision to whoever is implementing under time pressure — and (a) is described as the option "nhất quán với cách xử lý `class.read`", which makes it the path of least resistance. Separately, `user.list` is a declared procedure of **ADM-02** (actor `super_admin`); re-permissioning it changes an ADMIN-cluster flow that appears nowhere in Phase 2's blast radius, and Phase 1's audit will then report ADM-02 as *improved* while the surface has widened.
- **Failure scenario:** Executor picks (a) because it is cheaper, adds `'user.read': ['giam_doc_kinh_doanh','giam_doc_dao_tao']`, and writes the required one-line "accepted PII" note. `/hr/payroll` now works — and both directors can enumerate the entire staff directory including who holds which role, which is the reconnaissance input for any subsequent privilege-targeting. ADM-02's manifest entry is untouched, so the acceptance report still presents `user.list` as a super_admin-only administration procedure.
- **Evidence:**
  - `apps/api/src/user/router.ts:128-137` — `list: requirePermission('user','manage')`, `findMany({ where: { facilityId } })`, no `select`
  - `apps/api/src/user/router.ts:37-48` — `AppUserDto` includes `userId`, `email`, `roles: AuthRole[]`, `managerId`, `employeeCode`
  - `packages/db/prisma/schema.prisma:1079-1091` — `AppUser.roles Role[]`
  - `scripts/acceptance-report/flow-manifest.ts:519-527` — ADM-02 `trpc: ['user.create','user.list','user.update','user.updateRoles']`, `actorRoles: ['super_admin']`
  - `apps/admin/src/pages/hr/payroll.tsx:414-420` — consumes exactly `{id, fullName, employeeCode, position}`
- **Suggested fix:** Make (b) a hard constraint in Phase 2's Requirements, not a recommendation — the consumer already uses exactly four fields, so the narrow procedure is strictly cheaper to justify than the PII note (a) demands. If (a) survives, Phase 2 must also list ADM-02 as an impacted flow and `select` the DTO explicitly to exclude `roles` and `userId`.

---

## Finding 8: The identical `exercise.list` defect is routed *to* Phase 2 by Phase 1, but is outside Phase 2's scope

- **Severity:** Medium
- **Location:** Phase 1, step 5 bullet 2 (*"Chuyển sang Phase 2 khi code sai (P2-04 IDLE-ACTOR `giao_vien`…)"*) vs Phase 2's Requirements / Related Code Files / Success Criteria, which never mention `exercise`
- **Flaw:** `exercise.list` — a read — is gated by `exercise.manage` (`giam_doc_dao_tao` only), while `exercise.view` (`giao_vien`, `giam_doc_dao_tao`) already exists in the registry and is the **only** registry key gating nothing at all. This is byte-for-byte the F1/F2 shape the plan is fixing for `class.read`, with the read permission already written. Phase 1 hands it to Phase 2; Phase 2 has no slot for it, no file listed, no success criterion.
- **Failure scenario:** Phase 2 completes against its own criteria without touching `exercise`. Phase 1's audit still reports P2-04 IDLE-ACTOR for `giao_vien`. With Phase 2 closed, the only remaining disposition is a `DOCUMENTED_GAPS` entry — so the plan whose stated purpose is "placeholder không còn được đếm là đã xây" ends by whitelisting a live permission defect of exactly the class it was written to remove.
- **Evidence:**
  - `packages/auth/src/index.ts:88` — `'exercise.view': ['giao_vien','giam_doc_dao_tao']`; `:87` — `'exercise.manage': ['giam_doc_dao_tao']`
  - `apps/api/src/exercise/router.ts:104` and `:192` — both `list` procedures use `requirePermission('exercise','manage')`
  - `scripts/acceptance-report/flow-manifest.ts:213-223` — P2-04 `actorRoles: ['giao_vien','giam_doc_dao_tao']`, `trpc` includes `exercise.list`
  - `exercise.view` is the sole registry key with zero `requirePermission` call sites (registry 73 keys vs 59 distinct keys used)
- **Suggested fix:** Add `exercise.list` → `exercise.view` to Phase 2's procedure table and success criteria (a one-line change that closes an IDLE-ACTOR without inventing a permission), plus a negative test that `giao_vien` still cannot call `exercise.create/publish/close`.

---

## Finding 9: `nhan_vien` occurs in four flows, not three; the missed flow is the one that cannot be resolved from the registry

- **Severity:** Medium
- **Location:** plan.md F6; Phase 1, step 3 (lists P3-01, P4-01, P4-03)
- **Flaw:** `nhan_vien` appears in **four** manifest entries: P3-01, **P3-02**, P4-01, P4-03. P3-02 is missing from the plan. That matters beyond arithmetic: P3-02's procedure list is `manualPunch.approve/reject/resubmit/list`, and `manualPunch.resubmit` has **no permission key** (owner check, `protectedProcedure`) while `manualPunch.list` likewise has none — so the substitution method Phase 1 prescribes ("suy từ registry: các vai có `<permission>`") cannot produce an answer for it. The one flow the plan omitted is the one its stated method does not handle.
- **Failure scenario:** Phase 1 step 2 flips `actorRoles` to `FlowActor[]`; typecheck goes red in four places, not three. The executor fixes the fourth by pattern-matching the other three — assigning it the roles of `manualPunch.approve` (GĐKD/GĐĐT) — which silently drops the *submitter* actor from an approval flow. The audit then reports P3-02 clean while the flow's real first actor (the staff member filing the offsite ticket) is unrepresented, so no role-true e2e will ever exercise the submit side.
- **Evidence:**
  - `scripts/acceptance-report/flow-manifest.ts:297` (P3-01), `:308` (P3-02, `['nhan_vien','giam_doc_kinh_doanh','giam_doc_dao_tao']`), `:433` (P4-01), `:457` (P4-03)
  - `scripts/acceptance-report/flow-manifest.ts:303-313` — P3-02 `trpc: ['manualPunch.approve','manualPunch.reject','manualPunch.resubmit','manualPunch.list']`
  - `apps/api/src/checkin/router.ts:368` (`resubmit: protectedProcedure`), `:398` (`list: protectedProcedure`)
  - `packages/auth/src/index.ts:100-103` — comment confirming `manualPunch.resubmit` has no key by design
- **Suggested fix:** Add P3-02 to Phase 1 step 3 explicitly, and resolve it from `checkIn.punch`'s roster (everyone who can punch can file a ticket) plus the approver roles — noting in the comment that two of its four procedures are owner-checked, not registry-gated. Ties into Finding 6.

---

## Finding 10: `trpc.ts:214` is misattributed, and the actual bypass at that line is never accounted for

- **Severity:** Medium
- **Location:** plan.md Overview, D6, "Môi trường & cạm bẫy"; Phase 1 "Architecture"; Phase 5 step 3 (error message text) — four citations of `apps/api/src/trpc.ts:214` as *"bypass toàn bộ permission registry"*
- **Flaw:** Line 214 is the `super_admin` early-return inside `requireValidFacility`, i.e. the **facility-validation** bypass. The permission-registry bypass is `packages/auth/src/index.ts:147` inside `can()`. Phase 5 step 3 mandates that the guard's error message cite `trpc.ts:214` as the registry bypass — the plan would ship the wrong citation into a developer-facing error string. More substantively: because the plan collapsed the two bypasses into one, it never reasons about the facility one. A `super_admin` session skips the "does this facilityId resolve to a real Facility row" check entirely, so evidence collected as `super_admin` on the runtime-verification branch was not merely permission-blind — it may not have been facility-scoped either.
- **Failure scenario:** Phase 6 step 3 replaces the shared `super_admin` `beforeEach` with per-flow business roles. Those roles now hit `requireValidFacility` for the first time. Any spec or fixture that was passing a facility id which does not resolve to a real row (previously waved through by the line-214 exemption) starts failing UNAUTHORIZED. With the plan predicting "số proven sẽ THẤP HƠN 35" and pre-labelling the drop as a *good* sign, this genuine infrastructure failure is indistinguishable from the expected honest decline and gets recorded as "flow không dùng được" instead of being fixed.
- **Evidence:**
  - `apps/api/src/trpc.ts:212-227` — `const requireValidFacility = t.middleware(...)`; `:214` `if (ctx.subject?.roles.includes('super_admin')) { return next(); }`; `:217-224` the facility existence check that is skipped
  - `apps/api/src/trpc.ts:205-206` — the comment itself distinguishes the two: "`super_admin` **already** bypasses the entire @cmc/auth permission registry (`can()`)"
  - `packages/auth/src/index.ts:141-149` — `export function can(...)`, `:147` `if (subject.roles.includes('super_admin')) return true;`
  - `apps/e2e/src/global-setup.ts:4` — "super_admin bypasses `requireValidFacility`"; `:112` bootstrap uses `facilityId: 'bootstrap'` (a non-UUID literal, not a real row)
- **Suggested fix:** Correct all four citations to `packages/auth/src/index.ts:147` for the registry bypass, keep `trpc.ts:214` where facility validation is meant, and add to Phase 6 step 6 a required triage split: distinguish "lost `proven` because the role genuinely cannot do the work" from "lost `proven` because the fixture relied on a super_admin-only bypass". Only the first is the good news the plan is pre-announcing.

---

## Verification Results

**Claims checked: 41 · VERIFIED: 33 · FAILED: 5 · UNVERIFIED: 3**

Verified (sample):

| Claim | Result |
|---|---|
| `class-batch-router.ts:112-114` comment "registry has only 4 P2-Foundation entries" | VERIFIED `apps/api/src/class/class-batch-router.ts:112-114` |
| `classBatch.create/list/listStudents/get/assignTeacher` at 115/229/254/283/300 | VERIFIED — all five line numbers exact |
| `classSession.list` at `class-session-router.ts:84` on `class.create` | VERIFIED |
| `class.create: ['giam_doc_dao_tao']` only | VERIFIED `packages/auth/src/index.ts:84` |
| ADR-B: `finance.receiptCreate` excludes GĐĐT; `receiptApprove` excludes sale | VERIFIED `packages/auth/src/index.ts:64,66-67` |
| Money gates unchanged by plan (`receiptApprove`, `refundCreate`, `payslip.finalize`) | VERIFIED — no phase touches `packages/auth/src/index.ts:67,68,113` |
| `user.list` requires `user.manage: []` | VERIFIED `apps/api/src/user/router.ts:128`, `packages/auth/src/index.ts:96` |
| `payroll.tsx:414` calls `trpc.user.list` unconditionally; `:416-420` uses 4 fields | VERIFIED |
| `/hr/payroll` nav gated by `payslip.assemble` (GĐKD/GĐĐT) | VERIFIED `apps/admin/src/shell/nav-registry.ts:72` |
| `DOCUMENTED_GAPS` / `INFRA_PROCEDURE_WHITELIST` + liveness guards exist | VERIFIED `scripts/acceptance-report/verify.ts:33,43,114-116,122-124` |
| `actorRoles: string[]` untyped today | VERIFIED `scripts/acceptance-report/types.ts:13` |
| Branch `test/independent-runtime-verification-38-flows`, 5 unmerged commits, hashes as listed | VERIFIED `git log main..<branch>` |
| `runtime-evidence.json`: 35 proven / 3 blocked, `runBatch: ir38-c339f4a-final-20260720` | VERIFIED |
| `flow-ui-routes.ui.spec.ts` `beforeEach` mints `roles: ['super_admin']` for all flows | VERIFIED branch file, `beforeEach` at :50, `roles: ['super_admin']` at :53 |
| `/finance/refund` + `/engagement/leaderboard` are `Tính năng chưa áp dụng` placeholders | VERIFIED `apps/admin/src/pages/finance/refund.tsx:23`, `leaderboard.tsx:19` |
| `post-sale-meeting` / `aftersale` no longer placeholders on main | VERIFIED their `.test.tsx:124,:114` assert `not.toBeInTheDocument()` |
| `compensationPolicy.manage: []` intentional (plan's self-refuted F4′) | VERIFIED `packages/auth/src/index.ts:109` |
| RLS/facility scoping (`scoped()` + `withFacility`) present on all four re-permissioned procedures | VERIFIED — cross-facility read is **not** opened by `class.read` |
| Registry↔code consistency (no `requirePermission` key missing from registry) | VERIFIED — only `exercise.view` unused |

FAILED claims:

| # | Plan claim | Reality |
|---|---|---|
| F-1 | `apps/api/src/trpc.ts:214` = "bypass toàn bộ permission registry" (plan.md Overview/D6/traps, phase-01:42, phase-05 step 3) | FAILED — `trpc.ts:212-227` is `requireValidFacility`; registry bypass is `packages/auth/src/index.ts:147` |
| F-2 | "3 luồng khai `nhan_vien`" (plan.md F6, phase-01 step 3) | FAILED — 4 flows: `flow-manifest.ts:297,308,433,457` (P3-02 missing from plan) |
| F-3 | "P1-09 `audit.list` là super_admin-only theo thiết kế ADMIN" (phase-01 step 5) | FAILED — `audit.list` belongs to ADM-04 (`flow-manifest.ts:541-548`); P1-09's `/ops/recon` makes no audit call |
| F-4 | "guard tại điểm cấp cookie thì không [bị lách]" (phase-05 Architecture) | FAILED — `trpc-client.ts:101-111`: `mintStaffCookie` only runs when `NODE_ENV==='production'`; default path is `x-dev-user` |
| F-5 | AC "Grep gate: `roles: ['super_admin']` xuất hiện 0 lần" is a meaningful gate | FAILED — already 0 occurrences in `apps/e2e/tests/*.ts` on `main`; passes without proving anything |

UNVERIFIED (ambiguous / not resolvable statically):

- "7/38 luồng mâu thuẫn actor↔permission" (plan.md F8) — the scanner does not exist yet; the count cannot be reproduced, and it predates D6 (see Finding 3).
- "F1 đã tồn tại từ 2026-07-06, chưa từng chạy được" (phase-02 Overview) — plausible from the `class.create`-reuse comment, but not established by the code alone.
- Phase 3's ~46-route resolution target — `path:` entries are spread across six `routes/*.tsx` files; the exact denominator was not recomputed.

---

## Unresolved questions

1. Does the PO accept that `giao_vien` gains cross-class roster visibility, or must `class.read` carry `assertTeacherOwnsClass` (Finding 1)? This changes Phase 2's size materially.
2. Should `/admin/classes` and `/teaching/schedule` receive nav permission gates as part of Phase 2, or is that a separate hardening plan (Finding 2)?
3. Is the ADM-*/`he_thong` exclusion meant to skip those flows entirely, or to fail them (Finding 3)? The plan's D6 and its acceptance criterion say different things.
4. Does GĐĐT/GĐKD need a scoped audit-trail read for reconciliation oversight, now that P1-09's `audit.list` turns out to be a manifest error rather than a design decision (Finding 4)?

---

Status: DONE_WITH_CONCERNS
Summary: Ten security findings against the plan, two Critical — `class.read` for `giao_vien` reverses the documented teacher class-scoping invariant on unscoped roster reads, and the ungated `/admin/classes` route turns that permission into a full class-administration surface for `sale`. Five of the plan's factual claims failed verification, including the `trpc.ts:214` bypass attribution repeated four times and Phase 5's core assumption that a `mintStaffCookie` guard cannot be bypassed.
Concerns/Blockers: Phase 2 should not be executed as written — its procedure table opens child-data reads that existing code deliberately closed, and its (a)/(b) decision on `user.list` is left open at execution time on a trust boundary. Phase 5's runtime-guard design does not work in the default e2e run mode. Phase 1's D6 exclusion rule needs reconciliation with the 9 flows whose only declared actors it excludes.
