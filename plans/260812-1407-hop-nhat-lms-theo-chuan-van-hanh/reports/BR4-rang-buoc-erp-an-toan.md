# BR4 — Ràng buộc an toàn & điểm nối ERP mà code LMS port từ cmc-lms BẮT BUỘC tuân

Repo: `/home/manhquy/Downloads/cmc_edu` (branch `develop`, HEAD `c15bb3d`). Chỉ đọc. Nhãn: **BAT BUOC** / **KHUYEN NGHI** (KN).

---

## 1. Facility & RLS (ADR 0042)

| # | Ràng buộc | Nhãn | Bằng chứng |
|---|---|---|---|
| 1.1 | **Mọi bảng facility-scoped mới phải có cột `facilityId` NOT NULL + `ENABLE ROW LEVEL SECURITY` + policy `facility_isolation` (`USING/WITH CHECK` so sánh `current_setting('app.current_facility_id')` hoặc `app.bypass_rls='on'`) + `FORCE ROW LEVEL SECURITY`** — nếu thiếu 1 trong 3, bảng đó không có lớp bảo vệ thứ 2 | BAT BUOC | Mẫu chuẩn: `packages/db/prisma/migrations/20260811120000_lms_foundation_unit_range/migration.sql` (EnrollmentUnitRange: ENABLE:96 / FORCE:97 / policy:98-107 / GRANT:109); bảng cũ: `20260706180000_t1_attendance_session_lifecycle/migration.sql:42-49` |
| 1.2 | **Hậu quả nếu bảng LMS mới KHÔNG có facilityId/RLS:** mất facility isolation (I10/docs/01) — đọc/ghi chéo cơ sở. Không có "fallback mở", nhưng GUC không set → policy trả 0 dòng (fail-closed), còn bảng KHÔNG có RLS thì không có backstop nào | BAT BUOC | `packages/db/src/index.ts:118-147` (withFacility; GUC `app.current_facility_id` transaction-LOCAL qua `set_config(...,true)`); ADR: `docs/decisions/0042-rls-defense-in-depth.md` (layer 1 app filter + layer 2 RLS) |
| 1.3 | **Mọi truy vấn facility-scoped PHẢI qua `withFacility()` (hoặc nhận `tx` từ nó); tuyệt đối không `ctx.db.model.find(...)` trần** — RLS coi "không GUC" = "không facility, không bypass" = 0 dòng, KHÔNG phải unrestricted | BAT BUOC | `packages/db/src/index.ts:107-112,118-147`; `apps/api/src/trpc.ts:39-45` (comment Context.db) |
| 1.4 | **App/test PHẢI kết nối bằng role không đặc quyền `cmc_app` qua `APP_DATABASE_URL`** (`createPrismaClient`). Role owner migration (`DATABASE_URL`) bỏ qua RLS vô điều kiện — app trỏ nhầm vào connection owner = 0 bảo vệ, không lỗi | BAT BUOC | `packages/db/src/index.ts:12-31,34`; `docs/decisions/0042...:54-62` (restricted role required) |
| 1.5 | **Bảng RLS-enabled phải có FORCE RLS** — nếu không, table owner (connection owner) vẫn đọc/ghi chéo facility. API boot-check sẽ từ chối khởi động nếu thiếu (`boot-checks.ts`: mọi bảng relrowsecurity=true mà relforcerowsecurity=false → FATAL) | BAT BUOC | `apps/api/src/boot-checks.ts:30-49`; migration `20260707190000_force_rls_on_rls_tables/migration.sql` |
| 1.6 | **Bảng LMS mới phải GRANT quyền cho `cmc_app` ngay trong migration** (SELECT/INSERT/UPDATE/DELETE hoặc subset theo nghiệp vụ) — mặc định Wave-A chỉ SELECT/INSERT cho bảng mới; thêm UPDATE/DELETE chỉ khi nghiệp vụ thực sự cần | BAT BUOC | `20260811120000_lms_foundation_unit_range/migration.sql:109` (GRANT SELECT,INSERT,UPDATE,DELETE); `20260706180000_.../migration.sql:55-58` (Attendance chỉ +UPDATE, cố ý không DELETE); `20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:1-8` |
| 1.7 | **Bảng append-only (ledger): không cấp DELETE/UPDATE cho `cmc_app`** (AuditLog, RefundRecord, ReconciliationFlag, KpiScore, Payslip, CompensationPolicy, SalaryTier...) — teardown test phải dùng `createPrivilegedPrismaClient` | BAT BUOC | `20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:8,43`; `apps/api/src/test/db.ts:60-79` (privilegedDb) |
| 1.8 | **Các bảng KHÔNG facility-scoped (được phép miễn RLS) — danh sách hiện có:** ParentAccount, StudentAccount, AuditLog, EmailOutbox, Facility, ReceiptCodeCounter; **Guardian/GuardianLinkRequest có `facilityId` nhưng KHÔNG RLS** (parent đọc chéo cơ sở, gated theo `parentAccountId`). Bảng LMS mới phải tự đánh giá mình thuộc loại nào; không được lách bằng cách bỏ facilityId khi bảng thực chất là dữ liệu 1 cơ sở | BAT BUOC | `packages/db/prisma/schema.prisma:452` (ParentAccount, comment "identity ... spans the whole system"), `:515-541` (Guardian NOTE), `:544-563` (GuardianLinkRequest NOTE); `docs/decisions/0042...:76-86` (scope adjustments) |
| 1.9 | `bypass_rls` là escape hatch hẹp, có audit; chỉ dùng cho super_admin/director đọc chéo cơ sở và path parent-facing. Code LMS mới không tự ý dùng | BAT BUOC | `packages/db/src/index.ts:96-106` (WithFacilityOptions.bypass); `apps/api/src/test/db.ts:81-85` (testDbBypass) |
| 1.10 | Test chứng minh: RLS phải chặn đọc chéo facility ở tầng DB ngay cả khi bỏ app filter; bảng mới cần 1 test negative tương tự | KN | `apps/api/src/security/rls-enforcement.test.ts:1-40`; `apps/api/src/finance/rls-negative.test.ts` |

## 2. RBAC (packages/auth)

| # | Ràng buộc | Nhãn | Bằng chứng |
|---|---|---|---|
| 2.1 | **Mọi mutation/query nghiệp vụ phải gate qua `requirePermission('module','action')`; CẤM hardcode mảng role trong router/UI.** Registry quyền duy nhất là `PERMISSIONS` trong `packages/auth/src/index.ts` | BAT BUOC | `packages/auth/src/index.ts:50-166` (PERMISSIONS), `:185-198` (`can()`); `apps/api/src/trpc.ts:265-276` (requirePermission) |
| 2.2 | **Quy tắc thêm quyền mới:** (a) thêm key `'module.action'` vào `PERMISSIONS` với mảng `ActiveRole[]`; (b) `super_admin` KHÔNG ghi vào từng dòng — nó bypass toàn bộ registry trong `can()`; (c) role ngoài `ACTIVE_ROLES` là vô hiệu (không có quyền, không được assign); (d) thêm role mới phải có ADR ("Do not add roles here without an ADR") | BAT BUOC | `packages/auth/src/index.ts:14-24` (ROLES + comment ADR), `:26-34` (ACTIVE_ROLES), `:185-198` (can: super_admin bypass) |
| 2.3 | **Quyền phải theo nguyên tắc SoD (separation of duties):** `sale` KHÔNG được trong `finance.receiptApprove` (người duyệt ≠ người soạn); `enrollment.grantUnits` CHỈ `giam_doc_dao_tao` — "money seat ≠ teaching rights", sale KHÔNG cấp quyền học | BAT BUOC | `packages/auth/src/index.ts:60-62` (finance.receiptApprove comment "sale MUST NOT appear here"), `:70-71` (enrollment.grantUnits comment "NEVER sale") |
| 2.4 | SoD thứ 2: over-threshold phải có "second eye" (GĐĐT/super_admin) khi `netAmount > APPROVAL_SECOND_EYE_THRESHOLD` — quyền `receiptApprove` không đủ nếu chỉ GĐKD | BAT BUOC | `apps/api/src/finance/router.ts:287-296` (H1 check); hằng số `APPROVAL_SECOND_EYE_THRESHOLD` (định nghĩa trong finance/router.ts — `rg APPROVAL_SECOND_EYE_THRESHOLD`) |
| 2.5 | Permission key phải tách đọc/ghi riêng (`class.create` vs `class.read` vs `classRoster.read`); 1 key duy nhất cho việc đọc danh sách học sinh (roster mang tên trẻ em) | BAT BUOC | `packages/auth/src/index.ts:99-110` (class.create/class.read/classRoster.read + comment); `apps/api/src/class/class-batch-router.ts:130-136` |
| 2.6 | Staff session: `protectedProcedure` (session + facility hợp lệ) + `scoped(ctx)` lấy facilityId từ server-side session — CẤM tin facilityId từ client | BAT BUOC | `apps/api/src/trpc.ts:224-246` (protectedProcedure), `:283-290` (scoped), `:189-222` (requireValidFacility K7) |
| 2.7 | LMS session (`lmsProcedure`) KHÔNG nhận staff roles, KHÔNG có bypass super_admin vào LMS surface; gate theo `requireLmsStudent`/`requireLmsParent` | BAT BUOC | `apps/api/src/trpc.ts:248-263` (lmsProcedure), `:292-328` (requireLmsStudent/requireLmsParent) |

## 3. Audit log

| # | Ràng buộc | Nhãn | Bằng chứng |
|---|---|---|---|
| 3.1 | **MỌI mutation thành công đều được ghi AuditLog** qua middleware tự động (`auditLogMiddleware` trên `basedProcedure` — mọi procedure public/protected/lms). Procedure mới KHÔNG cần tự viết audit; nếu muốn audit phong phú hơn thì thêm path vào `AUDIT_EXCLUDED_PATHS` và tự ghi | BAT BUOC | `apps/api/src/trpc.ts:164-183` (middleware), `:58-148` (AUDIT_EXCLUDED_PATHS), `:186` (basedProcedure) |
| 3.2 | **Format AuditLog:** `actor` (staff=userId; parent=`parent:<id>`; student=`student:<id>`; không session=`anonymous`), `action` = tRPC path (nguồn sự thật), `entity` = module đầu path, `entityId` = input `id`/`*Id` hoặc result id, `data` = input đã sanitize (JSON nullable) | BAT BUOC | `packages/db/prisma/schema.prisma:1082-1095` (model AuditLog); `apps/api/src/audit/audit-helpers.ts:13-24` (resolveAuditActor), `:27-45` (deriveEntity/Id), `:95-116` (sanitizeAuditData) |
| 3.3 | **Sanitize bắt buộc:** mọi field khớp regex `/password|otp|token|secret/i` hoặc key chính xác `code` bị loại khỏi `data` (đệ quy mọi tầng). CẤM lưu credential vào AuditLog | BAT BUOC | `apps/api/src/audit/audit-helpers.ts:57-94` (SENSITIVE_KEY_RE, SENSITIVE_EXACT_KEYS, sanitizeValue) |
| 3.4 | Audit write là best-effort nhưng KHÔNG silent: lỗi DB khi ghi audit phải log ra server, không phá mutation gốc | BAT BUOC | `apps/api/src/trpc.ts:180-183` |
| 3.5 | **Action LMS đã dùng** (namespace phải nhất quán `module.action`): `provisioning.completed`; `enrollment.blockLms` / `enrollment.grantUnits` / `enrollment.grantPast` / `enrollment.revokeFromNext` / `enrollment.archive` / `enrollment.unarchive`; `lmsOps.assignExerciseSequence` / `lmsOps.deliverSessionExercise` / `lmsOps.cancelSessionAndRestamp`; `lmsAuth.requestOtp` / `requestOtpEmail` / `loginStudent` / `resetChildPassword`; `student.resetPassword` / `student.setLifecycle.blocked_lms` / `student.lookup`; `guardian.childDataRead`. Code port phải tái dùng, không bịa action mới trùng nghĩa | BAT BUOC | `apps/api/src/lms-ops/router.ts:291,470,548,583,609,641,686`; `apps/api/src/enrollment/router.ts:104`; `apps/api/src/lms-auth/router.ts:262,439,605,658`; `apps/api/src/provisioning/provision-from-receipt.ts:466`; `apps/api/src/student/router.ts:104,149,299`; `apps/api/src/trpc.ts:130-148` |
| 3.6 | Path chứa input nhạy cảm (OTP, password) phải nằm trong `AUDIT_EXCLUDED_PATHS` + tự ghi dòng audit sạch inline (như lmsAuth.verifyOtp, user.changeOwnPassword...) | BAT BUOC | `apps/api/src/trpc.ts:130-148` (exclusions + rationale) |

## 4. ADR 0041 & ràng buộc tiền

| # | Ràng buộc | Nhãn | Bằng chứng |
|---|---|---|---|
| 4.1 | **Provisioning KHÔNG được nằm trong transaction tiền.** `finance.receiptApprove` chạy money TX (Receipt→approved + O5 advance + closedAt) rồi gọi `provisionFromReceipt` SAU, trong try/catch riêng; lỗi provision KHÔNG rollback `netAmount`/status, chỉ ghi `retry_pending` | BAT BUOC | `apps/api/src/finance/router.ts:1015-1060` (approve: money TX xong → provision riêng); `apps/api/src/provisioning/provision-from-receipt.ts:1-14` (header ADR 0041) |
| 4.2 | **Trong transaction tiền chỉ được: claim draft→approved, advance opportunity O5, ghi audit tiền.** KHÔNG tạo Student/ParentAccount/Enrollment/StudentAccount/unit range trong đó | BAT BUOC | `apps/api/src/finance/router.ts:264-272` (runMoneyTransaction header "Provisioning is intentionally NOT part of this transaction") |
| 4.3 | **Provisioning từng bước find-or-create, idempotent theo `createdByReceiptId`/phone/`sourceReceiptId`** — replay (retry outbox/reconciler) không nhân đôi. Bước nào cũng phải chịu replay an toàn | BAT BUOC | `apps/api/src/provisioning/provision-from-receipt.ts:387` (main); `:241-300` (findOrCreateStudent P2002 refetch); `apps/api/src/lms-ops/grant-units.ts:239-248,271-283` (idempotent theo sourceReceiptId) |
| 4.4 | **Không student mồ côi:** Student chỉ tạo qua provision (provenance `createdByReceiptId`); không UI tạo student thủ công ngoài mạch tiền | BAT BUOC | `docs/decisions/0041-provisioning-atomic-at-receipt-approval.md` (Decision); `apps/api/src/provisioning/provision-from-receipt.ts:152-153` (findUnique createdByReceiptId) |
| 4.5 | **Cấp quyền học gắn với tiền còn hiệu lực:** grant đọc lại Receipt `FOR UPDATE` (phải `approved`) + kiểm tra `netAmount - Σrefund > 0` — đã hoàn đủ thì KHÔNG grant; cancel/refund-đủ thì xóa range | BAT BUOC | `apps/api/src/lms-ops/grant-units.ts:236-253`; `apps/api/src/finance/router.ts:596-601` (cancel revoke), `:726-731` (full refund revoke) |
| 4.6 | `Enrollment.status 'active' ⇔ Receipt approved` (ADR-A) — không đặt active bằng tay ngoài mạch Receipt | BAT BUOC | `apps/api/src/enrollment/activate-enrollment.ts:77-135` (chỉ chạy khi Receipt approved, có FOR UPDATE guard); comment `packages/db/prisma/schema.prisma:562-563` |
| 4.7 | Race tiền↔provision phải serialize (lock Receipt `FOR UPDATE`, claim `updateMany WHERE status='draft'`) — port code không được bỏ | BAT BUOC | `apps/api/src/finance/router.ts:310-321` (atomic claim); `apps/api/src/enrollment/activate-enrollment.ts:88-99` |

## 5. Điểm nối hiện có: dạy-học ↔ ERP (tiền / nhân sự / CRM)

| # | Điểm nối | Chiều đọc/ghi | Bằng chứng |
|---|---|---|---|
| 5.1 | `finance.receiptCreate` → tạo `Receipt` gắn `classBatchId` + `studentId` (renewal) + `unitCount`; gọi `findOrCreateContact` (CRM Contact — writer DUY NHẤT cho Contact) | dạy-học đọc lớp; tiền ghi CRM | `apps/api/src/finance/router.ts:975-990`; `apps/api/src/crm/find-or-create-contact.ts:1-39` (unique writer + `@@unique([facilityId,phone])`) |
| 5.2 | `finance.receiptApprove` → (1) advance Opportunity **O5_ENROLLED + closedAt** (CRM) trong money TX; (2) provision: tạo `Student`/`ParentAccount`/`Guardian`/`Enrollment(active)`/`StudentAccount`; (3) `grantUnitsFromReceipt` tạo `EnrollmentUnitRange` | tiền ghi CRM + identity + dạy-học | `apps/api/src/finance/router.ts:344-354` (auto-advance O5), `:1034-1045` (provision); `apps/api/src/provisioning/provision-from-receipt.ts:387-490` |
| 5.3 | `finance.receiptCancel` → revert Opportunity O5→O4, withdraw Enrollment (M9: chỉ khi không còn receipt approved khác), `Student.lifecycle` nếu void, `revokeRangesForReceipt` | tiền ghi CRM + dạy-học | `apps/api/src/finance/router.ts:556-601` |
| 5.4 | `finance.refundCreate` → khi `remaining<=0` gọi `revokeRangesForReceipt` (xóa range theo sourceReceiptId) | tiền ghi dạy-học | `apps/api/src/finance/router.ts:723-731` |
| 5.5 | `grantUnitsFromReceipt` ĐỌC `Receipt` (status/netAmount) + aggregate `RefundRecord` — **dạy-học đọc dữ liệu tiền** (SEAM: quyết định cấp quyền học phụ thuộc tiền còn hiệu lực) | dạy-học đọc tiền | `apps/api/src/lms-ops/grant-units.ts:236-253` |
| 5.6 | `activateEnrollmentForReceipt` đọc `Receipt` FOR UPDATE để guard cancel-race | dạy-học đọc tiền | `apps/api/src/enrollment/activate-enrollment.ts:88-99` |
| 5.7 | Class tạo/assign teacher → `resolveTeacher` kiểm tra `AppUser` (role `giao_vien`) — `ClassBatch.teacherAppUserId` là nguồn credit giờ dạy vào **payroll + KPI** | dạy-học ghi nhân sự (kế thừa) | `apps/api/src/class/class-batch-router.ts:113-134` (resolveTeacher + comment payroll/KPI); `apps/api/src/lms-ops/router.ts:118` (createClassWithUnits cùng role check) |
| 5.8 | Identity xuyên domain: `Student.createdByReceiptId` (tiền→identity), `Guardian.parentAccountId` (identity→LMS read gate `getApprovedChildren`/`enrollment.mine`), `StudentAccount` login | nối identity | `packages/db/prisma/schema.prisma:360-368` (Receipt.studentId), `:515-541` (Guardian); `apps/api/src/guardian/approved-children.ts:1-30` |
| 5.9 | Unit entitlement: `CurriculumUnit.orderGlobal` + `ClassBatch.currentUnitId/startUnitId/currentUnitAnchor` + `EnrollmentUnitRange` — chính là "khóa học > unit" mà LMS mới port vào; single-writer range = `grant-units.ts` (admin `addWithUnits`/`grantPast` + provision `grantUnitsFromReceipt`) | nội bộ dạy-học | `packages/db/prisma/schema.prisma:792` (CurriculumUnit), `:567-580` (ClassBatch neo); `apps/api/src/lms-ops/grant-units.ts:1-2` (single writer) |
| 5.10 | Dual-gate roster: `rosterForSession` = `ClassSession`(stamp unit) + `Enrollment` + `EnrollmentUnitRange` + `Student.lifecycle` — fail-closed | nội bộ dạy-học + identity | `apps/api/src/lms-ops/on-roster.ts:20-33`; `packages/domain-lms/src/unit-progression.ts:59-61` |
| 5.11 | `classSession.cancel` dùng chung helper với `lmsOps.cancelSessionAndRestamp`; `lmsOps.*` hiện **chưa bị claim bởi flow acceptance nào** (11 key unclaimed) — port code mới phải đăng ký flow/claim | KN | `apps/api/src/lms-ops/router.ts:388`; `plans/reports/scout-260812-1054-develop-consolidated-state.md:40` |

## 6. Quy ước migration

| # | Ràng buộc | Nhãn | Bằng chứng |
|---|---|---|---|
| 6.1 | **Naming:** `YYYYMMDDHHMMSS_snake_case_mo_ta` (VD `20260811120000_lms_foundation_unit_range`) | BAT BUOC | `packages/db/prisma/migrations/` (toàn bộ thư mục) |
| 6.2 | **Migration additive, an toàn khi chạy lại:** dùng `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` / `DROP POLICY IF EXISTS` trước khi `CREATE POLICY` / `IF NOT EXISTS (SELECT ... FROM pg_constraint)` cho FK | BAT BUOC | `20260811120000_lms_foundation_unit_range/migration.sql:9,21-35,52,60-79,93-107`; `20260811150000_receipt_unit_count_range_source/migration.sql:5-10` |
| 6.3 | **Từng migration tự chứa đủ 4 phần: DDL + backfill + RLS + GRANT — "all-or-nothing" (1 file migration = 1 đơn vị nguyên tử).** KHÔNG tách RLS/GRANT ra migration sau (đã từng phạm → migration force-rls riêng, giờ chuẩn là gộp) | BAT BUOC | `20260811120000_.../migration.sql:1-2` ("All-or-nothing: tables/columns + FORCE RLS + grants"); `20260707190000_force_rls_on_rls_tables` (bài học lịch sử) |
| 6.4 | **Backfill trước, rồi mới set NOT NULL / unique constraint** (VD orderGlobal: add nullable → backfill ranked → update null sentinel → ALTER SET NOT NULL → unique index) | BAT BUOC | `20260811120000_.../migration.sql:7-20` |
| 6.5 | **Enum mới qua `ALTER TYPE ... ADD VALUE`:** không được reference enum vừa thêm trong CHÍNH migration đó (Postgres restriction) — tách 2 migration nếu cần | BAT BUOC | `packages/db/prisma/schema.prisma:133-137` (invariant note SessionStatus) |
| 6.6 | Migration viết tay (project non-interactive `prisma migrate dev`); chạy bằng `pnpm --filter @cmc/db prisma migrate dev --name <desc>` local và `prisma migrate deploy` CI/deploy; CLI dùng `DATABASE_URL` (owner role) qua `prisma.config.ts`, KHÔNG `APP_DATABASE_URL` | BAT BUOC | `docs/system-architecture.md:578-580`; `packages/db/prisma.config.ts:1-24` |
| 6.7 | Đổi cấu trúc phá vỡ (drop cột, đổi kiểu dữ liệu 1 chiều) phải có migration bù (compensating) và kiểm tra drift (`prisma migrate diff`); tránh để `migrate dev` tự gộp nhầm | KN | `docs/runbook-deploy.md:203`; `docs/project-changelog.md:409-455` |

## 7. Test harness (integration test)

| # | Ràng buộc | Nhãn | Bằng chứng |
|---|---|---|---|
| 7.1 | **Mẫu chuẩn:** `beforeEach` → `createTestFacility` (facility dùng 1 lần, code tự sinh tránh collision) + seed dữ liệu; `afterEach` → `cleanupFacility(facilityId)` (xóa theo thứ tự FK, dùng privileged connection cho bảng append-only). Test file mới phải theo đúng mẫu | BAT BUOC | `apps/api/src/test/db.ts:88-92` (createTestFacility), `:94-202` (cleanupFacility — FK order), `:1-31` (header) |
| 7.2 | **Test dùng role `cmc_app` (`testDb()`) — RLS áp dụng như production**; arrange/assert ngoài session dùng `testDbBypass()` (bypass RLS, cùng escape hatch super_admin). CẤM dùng privileged connection cho arrange/act/assert | BAT BUOC | `apps/api/src/test/db.ts:46-57` (testDb), `:81-85` (testDbBypass), `:60-79` (privilegedDb — teardown-only) |
| 7.3 | **Fail-closed chống DB production:** test từ chối chạy nếu `APP_DATABASE_URL` trỏ `cmc_prod` | BAT BUOC | `apps/api/src/test/db.ts:33-44` (assertNotProdDatabase) |
| 7.4 | **Seed sẵn có cho dạy-học:** `ensureProgramUnitAxis` (tạo chuỗi CurriculumUnit UCREA), `seedClassBatch`, `seedCurriculumUnit`, `seedClassSession`, `seedActiveEnrollment`, `seedParentAccount`, `seedStudentAccount`, `seedGuardianLink`, `seedEnrolledStudentWithGuardian` — ưu tiên tái dùng, không tự viết lại | BAT BUOC | `apps/api/src/test/db.ts:462,501,565,618,658,351,361,387,422` |
| 7.5 | **Identity toàn hệ thống (ParentAccount unique theo phone) phải cleanup riêng theo phone** (`cleanupParentAccountsByPhone`) — không facility-scoped | BAT BUOC | `apps/api/src/test/db.ts:204-223`; header `:8-11` |
| 7.6 | App code (không test) gọi DB test: `appRouter.createCaller(buildStaffContext(...))` / `buildLmsContext(...)` để chạy qua middleware thật (RBAC + audit + RLS); test trực tiếp helper (VD provisionFromReceipt) vẫn phải set đủ `facilityId` | BAT BUOC | `apps/api/src/test/db.ts:316-349` (buildStaffContext/buildLmsContext); `apps/api/src/lms-ops/grant-units.int.test.ts:21-72` (mẫu caller + seed) |
| 7.7 | Mọi luật tiền↔unit phải có test: grant đầu tiên, replay idempotent, break-glass, renewal, refund/cancel revoke — mẫu có sẵn trong `grant-units.int.test.ts` | KN | `apps/api/src/lms-ops/grant-units.int.test.ts:81,108,133,182,207,241` |

---

## Unknowns

- `APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000` (VND) định nghĩa tại `apps/api/src/finance/router.ts:40`; `SECOND_EYE_ROLES` không tìm thấy định nghĩa tên này (check tại dòng 287-296 dùng role check trực tiếp — `rg SECOND_EYE_ROLES` rỗng).
- `cleanupFacility` danh sách xóa đầy đủ chưa đọc hết (571 dòng tiếp theo của `test/db.ts`) — chỉ xác nhận mẫu + nguyên tắc.
- Quy tắc migration "all-or-nothing" đọc từ comment migration mới nhất + migration lịch sử force-rls; chưa thấy văn bản ADR/checklist migration riêng ngoài comment.
- `docs/24`/`docs/30` (threat model) chưa đọc sâu — các ràng buộc bảo mật bổ sung từ đó (VD taint source→sink) có thể còn thiếu.

Status: DONE | Summary: 7 nhóm ràng buộc an toàn (RLS/withFacility, RBAC/SoD, audit bắt buộc + sanitize, ADR 0041 tách provision khỏi transaction tiền, 11 điểm nối dạy-học↔ERP, migration additive kèm RLS+GRANT trong 1 file, test harness mẫu seed/cleanup) đã ghi kèm bằng chứng file:dòng, phân loại BAT BUOC/KHUYEN NGHI.
