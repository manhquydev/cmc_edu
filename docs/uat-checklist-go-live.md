# CMC EDU v2 — UAT Checklist & Go/No-Go Record

Version: v2.0 · Stack: cmcv2-prod · Mode B (V3) session-injection

---

## Prerequisites before UAT

> ℹ️ **2026-07-11:** scout build phát hiện `pnpm build`/`typecheck`/`lint` FAIL trên máy dev — **RESOLVED
> cùng ngày**: root cause là `node_modules` cục bộ stale (147 gói lệch, thiếu `eslint`), không phải bug
> Astryx thật. Sau `pnpm install --frozen-lockfile`: build/typecheck/lint 100% xanh. Đã verify trực tiếp
> qua `docker compose -p cmcv2-prod ps` — container `lms` build độc lập trong `Dockerfile.lms` (fresh
> install trong container) và **đang chạy, trả 200 trên `/lms/`** suốt — không hề bị ảnh hưởng bởi vấn đề
> node_modules cục bộ này. Chi tiết: `docs/project-changelog.md` mục `[2026-07-11]`.

- [x] ENV phase complete: all services healthy (`docker compose -p cmcv2-prod ps`) — **✅ REDEPLOYED 2026-07-11 from main `5c2cd2e`** (F-FM1 verdict: REDEPLOY DONE — images rebuilt with Astryx UI #28/#29 + P4 hardening #31 + schema reconcile #32; 2 pending migrations applied via socat sidecar; boot-checks no FATAL; env-check OK prod 22 vars; dev-seams absent; health 200; SSO smoke 302 → login.microsoftonline.com; admin SPA 200) — **✅ LMS SPA also verified up + 200 on `/lms/` (2026-07-11, this session)**
- [x] Restore drill passed (RT-13): `./scripts/restore-drill.sh` exits 0, backup host ≠ deploy host — **✅ PASSED 2026-07-09** (49 tables, escrow decrypt OK, pg_restore clean)
- [x] E2E critical green 1st run (see Section 1) — **✅ RUN 1 + RUN 2 PASSED 2026-07-09** (17/18, Mode-B)
- [ ] All CRITICAL/HIGH findings from red-team (RT-1..15) resolved via merged PRs

---

## Section 1 — Automated e2e critical (Mode B, session-injection)

Run on local prod-config stack (not the live VPS production DB):

```bash
# Set env pointing to local prod-config stack (NOT the live VPS production DB)
export NODE_ENV=production                  # enables Mode-B signed cookie/bearer auth
export APP_DATABASE_URL=postgresql://cmc_app:<pw>@localhost:5432/cmc_staging
export DATABASE_URL=postgresql://postgres:<pw>@localhost:5432/cmc_staging
export LMS_SESSION_SECRET=<same-secret-as-stack>
export STAFF_SESSION_SECRET=<same-secret-as-stack>  # must match API server
export E2E_BASE_URL=http://localhost:3000

pnpm --filter @cmc/e2e test
```

> **Mode-B auth:** When `NODE_ENV=production`, dev-headers are disabled.
> Staff specs use `createSignedStaffClient` + `mintStaffCookie(STAFF_SESSION_SECRET)`.
> LMS specs use `createSignedLmsClient` + `mintParentToken(LMS_SESSION_SECRET)`.
> Both secrets must match the running stack or auth will return 401.

### Run 1

| Date | Result | Notes |
|------|--------|-------|
| 2026-07-09 | **PASS** (17 passed, 1 skipped) | Mode-B `NODE_ENV=production`, DB throwaway `cmc_staging` (≠ cmc_prod), secret throwaway ≠ pilot. Skip = `TEST_OTP_SEAM` (đúng, seam tắt ở prod). |

### Run 2 (must also pass — 2 consecutive required)

| Date | Result | Notes |
|------|--------|-------|
| 2026-07-09 | **PASS** (17 passed, 1 skipped) | Chạy liên tiếp ngay sau Run 1, cùng config. 2/2 xanh liên tiếp ✅ |

> **Lần chạy này lộ + sửa 1 gap Mode-B thật:** 2 spec LMS (`kind-isolation`, `attendance-grading`)
> dùng helper dev-header cục bộ (`x-dev-lms-user`) — tắt dưới `NODE_ENV=production` → token bị
> UNAUTHORIZED trước khi tới kind-gate (4 test đỏ). Đã gom về factory mode-aware chung
> (`createE2eLmsStudentClient`/`ParentClient` trong `apps/e2e/src/trpc-client.ts`), khớp pattern staff.
> Prerequisite Phase 1 (C2 mode-switching) trước đây sót 2 helper LMS này.
>
> **Phạm vi e2e (plan Architecture):** e2e spawn server tsx riêng (`global-setup.ts`), KHÔNG phải
> stack docker cmcv2-prod → e2e xanh không validate images/nginx/boot-checks. Khoảng trống này phủ
> bằng HTTP smoke trực tiếp stack ở Phase 2 (health 200 + `/auth/login` 302 Entra).
>
> **Prerequisite lms-auth (giải quyết 2026-07-09):** `lms-auth-two-tier.test.ts` là 13 stub rỗng
> (0 assertion) — un-skip = fake-green, đã XÓA (user chốt). Coverage đối kháng two-tier (kind gate ·
> sibling scope · student lockout/no-leak · resetChildPassword scoping · OTP no-leak) nằm THẬT ở e2e
> `kind-isolation.spec.ts` + `lms-auth.spec.ts` (chạy xanh Mode-B lần này). Prerequisite coi như đạt
> qua e2e, không phải qua vitest stub.

**E2E critical flows covered:**
- [ ] Receipt create → approve (over-threshold role-elevation)
- [ ] Attendance mark + session lifecycle
- [ ] Exercise PDF upload (via real S3/MinIO) + grade submission
- [ ] Star/gift rewards
- [ ] Check-in with IP validation (trusted-proxy resolveIp)
- [ ] AI draft assessment (V4) — staff views draft, edits, confirms
- [ ] PII guard: assertNoPii rejects prompt with phone number

**Coverage gap (manual only):**
- Entra SSO staff login — see Section 2
- LMS OTP (parent receiving real email via Brevo) — see Section 2

---

## Section 2 — UAT kịch bản chuỗi liên vai

> **Phiên bản Phase 4** (2026-07-09, sau ADR-D amendment 2026-07-08 — xem
> `docs/14-danh-muc-vai-tro-phan-quyen.md`): registry `@cmc/auth` chỉ còn **5 role active**
> (super_admin, giam_doc_kinh_doanh, giam_doc_dao_tao, sale, giao_vien). 4 role gác cũ
> (ke_toan/cskh/ctv_mkt/hr) có **0 quyền, không gán được** — mọi bước kịch bản trước đây gán
> cho các role này đã đổi sang role active đang thực sự giữ quyền đó (verify trực tiếp từ
> `packages/auth/src/index.ts`, không suy đoán). Nếu sau này mở lại role gác, cập nhật file
> này + `packages/auth/src/index.ts` + `docs/14-danh-muc-vai-tro-phan-quyen.md` cùng lúc.
>
> **ctv_mkt role status:** Marked dormant per ADR-D (2026-07-09). Business decision pending before GO/NO-GO (2026-07-12 target). If activated before go-live, re-run Section 2 scenarios with ctv_mkt actor for scope testing (manual punch, reward approval, etc.).
>
> Mỗi chuỗi chạy theo thứ tự; verify **expected state sau MỖI bước** trước khi qua bước tiếp theo.
> Một tester có thể đóng nhiều vai (xem nhân sự tối thiểu dưới).

### Nhân sự tối thiểu

| Phương án | Số người | Phân vai |
|-----------|----------|----------|
| **Rút gọn (tối thiểu)** | 3 | P1: GĐKD + sale · P2: GĐĐT + giao_vien · P3: PH/HS thật |
| **Đầy đủ** | 6 | 1 người/vai staff (4 vai: GĐKD, GĐĐT, sale, giao_vien) + 1 PH thật + 1 HS thật |

> **Bắt buộc:** GĐKD phải test cả 2 miền — quyền tiền (đã có e2e coverage) VÀ quyền tiếp nhận
> (mới, trước đây do cskh/hr giữ) — đây là UAT đầu tiên kiểm chứng GĐKD gánh đúng phần việc gộp.

---

### Kịch bản 1 — Chuỗi Tuyển sinh (P1-01 → P1-07)

**Vai tham gia:** sale · giam_doc_kinh_doanh · PH thật  
**Mục tiêu:** OTP email Brevo landing đúng inbox PH sau khi phiếu được duyệt

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | sale | Đăng nhập Entra SSO | `/admin` → redirect Entra → login thật | Dashboard hiển thị, role = sale |
| 2 | sale | Tạo opportunity + học sinh mới | CRM → New → điền thông tin | opportunityId sinh, stage = O1 |
| 3 | sale | Tạo phiếu thu (< 20M VND) | Finance → Receipt → New | receiptId sinh, status = pending |
| 4 | giam_doc_kinh_doanh | Đăng nhập → duyệt phiếu (`finance.receiptApprove`) | Finance → Receipts → Approve | status = approved; enrollment = active |
| 5 | giam_doc_kinh_doanh | Phê duyệt liên kết PH (`guardian.approveLink`) | Parents → Pending links → Approve | GuardianLink = approved |
| 6 | sale | Cập nhật email PH (`parentAccount.updateEmail`) | Parents → :id → Edit email | email updated |
| 7 | PH | Nhận OTP email thật (Brevo) → đăng nhập LMS | LMS /login → OTP → inbox Brevo | LMS session, thấy con |
| 8 | PH | Xem điểm bài tập của con + buổi nghỉ học | LMS → Bài tập & điểm · Ảnh buổi học | Bài đã chấm hiển thị điểm/sao; buổi con nghỉ hiển thị "Nghỉ học" (không phiếu thu — TL16 ADR-D, PH không thấy dữ liệu tiền/nội bộ) |

**Verify đặc biệt:**
- Bước 3 → nếu > 20M: cần GĐKD hoặc GĐĐT duyệt (ADR-B second-eye) — cùng 1 người GĐKD tạo lẫn
  duyệt phải bị block (SoD); test bằng cách sale tạo, GĐKD duyệt (2 người khác nhau) là đường PASS
- Bước 5: `guardian.approveLink` thực ra share cho cả 4 role active (GĐKD/GĐĐT/sale/giao_vien) —
  test thêm 1 lần bằng sale để confirm không chỉ GĐKD làm được (registry `index.ts:67`)

Tester (giam_doc_kinh_doanh): _________________ · Date: _________________

| | Result | Notes |
|-|--------|-------|
| Kịch bản 1 | PASS / FAIL | |

---

### Kịch bản 2 — Chuỗi Học tập (P2-04 → P2-08)

**Vai tham gia:** GĐĐT · học sinh thật · giao_vien  
**Mục tiêu:** AI nhận xét được GV duyệt và land lên LMS PH

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | GĐĐT | Đăng nhập Entra SSO | `/admin` → Entra | Dashboard, role = giam_doc_dao_tao |
| 2 | GĐĐT | Upload bài tập PDF cho curriculum unit | Curriculum → Exercises → Upload | exercise published, visible for student |
| 3 | học sinh | Xem bài tập + làm + nộp | LMS → /child/:id/exercises | submission = submitted |
| 4 | giao_vien | Đăng nhập → chấm điểm + cộng sao | Teaching → Grading | grade + stars recorded |
| 5 | giao_vien | Xem AI draft nhận xét (V4) | Report cards → :id | AI draft hiển thị, chưa gửi |
| 6 | giao_vien | Sửa draft → xác nhận (`assessment.confirm`) | Report cards → Confirm | assessment confirmed |
| 7 | giao_vien | Upload ảnh buổi học + publish evidence | Session → Evidence → Publish | PH thấy ảnh trên LMS |

**Verify đặc biệt:**
- Bước 5: AI draft KHÔNG tự send — phải chờ GV xác nhận (TL08 §7 data-minimization)
- Bước 3: mật khẩu mặc định học sinh = `Cmc2026@` (nếu chưa đổi)

Tester (giao_vien): _________________ · Date: _________________

| | Result | Notes |
|-|--------|-------|
| Kịch bản 2 | PASS / FAIL | |

---

### Kịch bản 3 — Chuỗi Vận hành lớp (P2-01 → P2-02 → P2-08)

**Vai tham gia:** GĐĐT · giao_vien  
**Mục tiêu:** Lớp có lịch sinh, điểm danh qua IP trusted, evidence land LMS

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | GĐĐT | Tạo lớp học | Classes → New | classBatchId sinh |
| 2 | GĐĐT | Sinh lịch buổi (`schedule.generate`) | Classes → :id → Generate sessions | sessionIds sinh đủ số buổi |
| 3a | giao_vien | Điểm danh từ IP **ngoài** trusted-proxy | Session → Attendance (IP sai) | 403 / validation error ✓ |
| 3b | giao_vien | Điểm danh từ IP **trusted** (tablet công ty) | Session → Attendance (IP đúng) | attendance records saved |
| 4 | giao_vien | Upload ảnh + publish evidence | Session → Evidence → Publish | PH thấy ảnh |

**Verify đặc biệt:**
- Bước 3a phải thất bại (ADR 0039 IP-check) — nếu pass là lỗi bảo mật nghiêm trọng

Tester (GĐĐT + giao_vien): _________________ · Date: _________________

| | Result | Notes |
|-|--------|-------|
| Kịch bản 3 | PASS / FAIL | |

---

### Kịch bản 4 — Chuỗi Nhân sự + Lương (P3-01 → P3-06, P3-09) — HR remediation (ADR 0044)

**Vai tham gia:** giao_vien · sale · giam_doc_kinh_doanh · giam_doc_dao_tao  
**Mục tiêu:** Punch → manual ticket → gán bậc lương → ca → KPI auto-score → payslip finalized → tất toán KPI

> **Prerequisite (runbook onboarding, docs/20 §8c):** greenfield — nhân sự CHƯA có `SalaryTier` gán sẽ
> bị chặn ở bước KPI/payslip (`FORBIDDEN`/`tierMissing`). Bước 5 dưới đây phải chạy trước bước 8.
>
> **Lưu ý thời gian:** `kpi.submitSlip` (bước 9) chỉ mở từ **00:00 ICT ngày 3 tháng kế tiếp** của kỳ
> đang chấm. Nếu chạy UAT real-time trong tháng hiện tại, bước 9 sẽ trả `BAD_REQUEST` cho đến ngày đó
> — đây là hành vi ĐÚNG (không phải lỗi), không phải kịch bản nào tester cũng chạy được ngay trong tháng.

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | giao_vien | Đăng nhập → chấm công trong mạng cơ sở (`checkInOut.punch`) | HR → Chấm công | punch ghi nhận, không phiếu |
| 2 | sale | Chấm công ngoài mạng cơ sở → modal yêu cầu lý do → xác nhận (`checkInOut.punch({reason})`) | HR → Chấm công | phiếu `pending` tự sinh, mang `checkInAt` |
| 3 | giao_vien | Chấm công ngoài mạng cơ sở (verify giao_vien cũng sinh phiếu được) | HR → Chấm công | phiếu `pending` tự sinh |
| 4 | giam_doc_kinh_doanh + giam_doc_dao_tao | Mỗi GĐ duyệt phiếu **đúng track của mình** — GĐKD duyệt phiếu sale (bước 2), GĐĐT duyệt phiếu giao_vien (bước 3) (`manualPunch.approve`) | HR → Chấm công → Duyệt chấm công | cả 2 phiếu status = approved |
| 5 | giam_doc_kinh_doanh | Tạo `SalaryTier` + gán cho giao_vien/sale (`salaryTier.create` → `compensation.assignTier`) | HR → Bậc lương → New → Gán | tier gán cho cả 2 nhân sự |
| 6 | giao_vien | Đăng ký ca làm (`shift.submit`) | HR → Đăng ký ca | shiftRegistration submitted |
| 7 | giam_doc_dao_tao | Duyệt ca (`shift.approve`) | HR → Đăng ký ca → Pending | shiftRegistration approved |
| 8 | giao_vien | Tính KPI tự động (`kpi.refresh`) → xem "PHẦN NHÂN" | HR → KPI | kpi draft, `value` khớp công thức |
| 9 | giao_vien | Nộp phiếu KPI (`kpi.submitSlip`) — xem lưu ý thời gian trên | HR → KPI → Nộp | kpi submitted |
| 10 | giam_doc_dao_tao | Xác nhận phiếu KPI (`kpi.confirm`, direct manager) | HR → KPI → Xác nhận | kpi confirmed |
| 11 | giam_doc_kinh_doanh | Assemble + finalize payslip (`payslip.assemble` → `payslip.finalize`) | HR → Chốt lương → Assemble → Finalize | payslip finalized |
| 12 | giam_doc_dao_tao | Tất toán KPI hàng loạt (`kpi.bulkApprove`) — chỉ chạy khi payslip đã finalized | HR → KPI → Tất toán | kpi approved |

**Verify đặc biệt:**
- Bước 2 & 3: sale VÀ giao_vien đều chấm công ngoài mạng được, mỗi lần đều tự sinh phiếu — confirm
  `checkInOut.punch` hoạt động như nhau cho cả 2 role (ADR 0043)
- Bước 4: đúng track mới duyệt được — thử GĐKD duyệt phiếu giao_vien (hoặc ngược lại) → phải
  `FORBIDDEN` (gate ROLE khớp track chủ phiếu, docs/20 §1)
- Bước 4, 7, 10, 12: `manualPunch.approve`/`shift.approve`/`kpi.confirm`/`kpi.bulkApprove` chỉ
  GĐKD+GĐĐT giữ — confirm sale/giao_vien KHÔNG duyệt được (thử bằng sale → phải `FORBIDDEN`)
- Bước 7: GĐĐT duyệt vì `ShiftGroup.type = GIAO_VIEN` — thử GĐKD duyệt cùng phiếu → phải `FORBIDDEN`
  (gate ROLE khớp group-type, docs/20 §2)
- Bước 9: thiếu tier (bỏ qua bước 5) → `BAD_REQUEST` `tierMissing`
- Bước 11: `payslip.assemble`/`finalize` chỉ GĐKD+GĐĐT giữ, FORBIDDEN nếu chưa gán tier
- Bước 12: chạy trước khi finalize (bỏ qua bước 11) → `approved: 0`, `skippedUnfinalized` có phần tử

Tester (giam_doc_kinh_doanh): _________________ · Date: _________________ · Tester (giam_doc_dao_tao): _________________

| | Result | Notes |
|-|--------|-------|
| Kịch bản 4 | PASS / FAIL | |

---

### Kịch bản 5 — Chuỗi Sau bán + Lifecycle (P4-01 → P4-05)

**Vai tham gia:** giam_doc_kinh_doanh · học sinh thật · sale  
**Mục tiêu:** Quà đổi-giao xong, PH meeting được đặt, after-sale case đóng

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | giam_doc_kinh_doanh | Cấu hình quà catalog (`gift.upsert`) | Engagement → Gifts → New | giftId active |
| 2 | học sinh | Đổi sao lấy quà (LMS) | LMS → Gifts → Redeem | rewardId pending |
| 3 | sale | Đăng nhập → duyệt quà (`rewards.manage` → Approve) | Engagement → Rewards → Approve | reward approved |
| 4 | sale | Giao quà (`rewards.manage` → Deliver) | Engagement → Rewards → Deliver | reward delivered |
| 5 | sale | Lên lịch họp PH (`parentMeeting.manage`) | Parent meetings → Schedule | meetingId |
| 6 | sale | Đặt lịch test đầu vào (`testAppointment.manage`) | CRM → Appointments → Schedule | appointmentId |
| 7 | sale | Tạo after-sale case (`afterSale.manage`) | CRM → After-sale → New | caseId open |
| 8 | giam_doc_kinh_doanh | Đóng case + cập nhật lifecycle học sinh | CRM → After-sale → :id → Close | case closed |

**Verify đặc biệt:**
- Bước 3–7: `rewards.manage`/`parentMeeting.manage`/`testAppointment.manage`/`afterSale.manage`
  đều share GĐKD+GĐĐT+sale (`index.ts:111-114`, thay hr cũ) — sale thực hiện được cả 5 bước
  là UAT đầu tiên kiểm chứng phần này sau khi hr bị gác

Tester (sale): _________________ · Date: _________________

| | Result | Notes |
|-|--------|-------|
| Kịch bản 5 | PASS / FAIL | |

---

### Tổng hợp sign-off Section 2

| Vai (role) | Tester | Date | Signed |
|------------|--------|------|--------|
| giam_doc_kinh_doanh | | | |
| giam_doc_dao_tao | | | |
| sale | | | |
| giao_vien | | | |
| Phụ huynh (PH thật) | | | |
| Học sinh (thật) | | | |

> Gate **G2** (Section 4): tất cả 6 dòng trên phải có chữ ký trước khi tick G2 ✓ (giảm từ 10 xuống
> 6 sau ADR-D amendment — ke_toan/cskh/ctv_mkt/hr không còn active, xem note đầu Section 2)

---

### Phụ lục 2A — Ma trận role × mutation (proof of coverage)

Mọi role active giữ ≥1 mutation phải xuất hiện trong ≥1 kịch bản (ràng buộc F-S4). Nguồn:
`packages/auth/src/index.ts` (verify trực tiếp, không suy đoán) — 4 role gác (ke_toan/cskh/ctv_mkt/hr)
0 quyền, không xuất hiện ở bảng này (đúng theo thiết kế, xem TL14 §1).

| Role | Mutation permissions (key, không đầy đủ) | Kịch bản |
|------|---------------------------|----------|
| giam_doc_kinh_doanh | finance.receiptApprove · manualPunch.approve · shift.approve · kpi.confirm/bulkApprove/override(key kpi.approve) · salaryTier.manage · payslip.assemble/finalize · guardian.approveLink · gift.upsert · rewards/parentMeeting/testAppointment/afterSale.manage | KB1 · KB4 · KB5 |
| giam_doc_dao_tao | class.create · schedule.generate · exercise.manage · shift.approve · kpi.confirm/bulkApprove/override(key kpi.approve) · salaryTier.manage · payslip.assemble/finalize | KB2 · KB3 · KB4 |
| sale | crm.opportunityCreate · finance.receiptCreate · enrollment.enroll · parentAccount.updateEmail · checkIn.punch · shift.submit · kpi.refresh/submitSlip · rewards/parentMeeting/testAppointment/afterSale.manage | KB1 · KB4 · KB5 |
| giao_vien | attendance.mark · exercise.manage · submission.grade · sessionEvidence.publish · checkIn.punch · shift.submit · kpi.refresh/submitSlip | KB2 · KB3 · KB4 |

✅ Không role active nào giữ mutation mà vắng khỏi kịch bản.

---

## Section 3 — Security probes (mandatory, non-skippable)

### 3.1 Cutover probe — RT-2 (forged dev-header → 401)

On the **production stack** (`NODE_ENV=production`, `ALLOW_DEV_AUTH` unset):

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H 'x-dev-lms-user: {"parentAccountId":"evil","kind":"parent"}' \
  https://YOUR_DOMAIN/trpc/lmsAuth.me
# Expected: 401
```

| Date | HTTP status | Result |
|------|-------------|--------|
|      | 401 expected | PASS / FAIL |

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H 'x-dev-user: {"userId":"evil","roles":["super_admin"],"facilityId":"x"}' \
  https://YOUR_DOMAIN/trpc/facility.list
# Expected: 401
```

| Date | HTTP status | Result |
|------|-------------|--------|
|      | 401 expected | PASS / FAIL |

### 3.2 Restore drill (within UAT week)

```bash
source .env.prod && ./scripts/restore-drill.sh
```

| Date | Result | Backup key | Tables |
|------|--------|------------|--------|
| 2026-07-09 | ✅ PASS | R2 `cmc-db-backups` + age escrow decrypt | 49 tables verified (match pre-backup count) |

### 3.3 Isolation check

```bash
./scripts/isolation-check.sh
```

| Date | Result |
|------|--------|
|      | PASS / FAIL |

---

## Section 4 — Go/No-Go criteria

All of the following must be checked before proceeding to go-live:

> ⚠️ **2026-07-17 (audit trước go-live):** mọi dấu ✅ dưới đây đóng mốc **2026-07-09**, tức là
> **trước** 3 đợt merge tính năng sau đó (HR remediation 07-12, happy-path/review-gap fixes
> 07-15/07-16, super-admin+audit-log 07-17 — trong đó PR ngày 07-16 từng phát hiện và vá 1 lỗi
> rò rỉ OTP mức **Critical** trước khi merge). Các dấu ✅ cũ **không nên coi là chứng nhận cho
> bản build hôm nay** — cần chạy lại trước khi ký GO/NO-GO chính thức. Chi tiết:
> `plans/reports/infra-deployment-audit-260717-1013-m0-exit-criteria-report.md`.

| # | Criteria | Status |
|---|---------|--------|
| G1 | E2E critical green ≥2 consecutive runs | ✅ 2026-07-09 (Run 1+2 PASS 17/1skip, Mode-B staging) — ⚠️ **cần chạy lại**: kết quả chạy trên server tsx riêng (staging), chưa qua 3 đợt merge tính năng sau mốc này |
| G2 | All 6 rows in Section 2 sign-off table signed (4 active staff roles + PH + học sinh; ke_toan/cskh/ctv_mkt/hr no longer active per ADR-D amendment) | |
| G3 | Cutover probe → 401 (RT-2) | |
| G4 | 0 CRITICAL/HIGH open findings (UAT pre-conditions only) | ✅ 2026-07-09 — Phase 3 audit: 0 CRITICAL, 3 HIGH (UAT coverage gaps, not code defects). No blocking code findings. HIGH items tracked as UAT pre-conditions. — ⚠️ **cần audit lại**: mốc này có trước 3 đợt merge lớn, trong đó 1 lỗi rò rỉ OTP mức Critical được phát hiện+vá SAU mốc này (07-16) |
| G5 | Restore drill PASS (backup host ≠ deploy host, RT-13) | ✅ 2026-07-09 (R2 `cmc-db-backups`, 49 tables, escrow decrypt OK) — ⚠️ **cần chạy lại**: chỉ 1 lần duy nhất, đã 8 ngày, trên stack local-sim; chưa xác nhận bucket là R2 remote thật hay MinIO local |
| G6 | Isolation check PASS | ✅ 2026-07-09 — ⚠️ **cần xác nhận lại**: bảng probe ở Section 3.3 bên dưới đang để trống dù mục này đã đánh ✅ |
| G7 | **G7-nhẹ** (2026-07-08 user chốt): người thứ hai chạy `env-check.sh` + boot-checks API + grep `ALLOW_DEV_AUTH`/`TEST_OTP_SEAM` vắng → ký tên (full G7 deferred M1) | |
| G8 | `ALLOW_DEV_AUTH` absent from `.env.prod` (`grep ALLOW_DEV_AUTH .env.prod` → empty) | ✅ 2026-07-09 (0 dòng) — ⚠️ **cần chạy lại tay**: giá trị nằm trong `.env.prod` (gitignored), không tự xác minh lại được từ repo |
| G9 | `TEST_OTP_SEAM` absent from `.env.prod` (`grep TEST_OTP_SEAM .env.prod` → empty) | ✅ 2026-07-09 (0 dòng) — ⚠️ **cần chạy lại tay**: cùng lý do G8 |
| G10 | `STAFF_SESSION_SECRET` ≠ `LMS_SESSION_SECRET` in prod (two distinct values) | ✅ 2026-07-09 (distinct) — ⚠️ **cần chạy lại tay**: cùng lý do G8; runtime có `assertStaffLmsSecretsDistinct()` gác nhưng giá trị thật không xem được từ repo |

---

## Section 5 — Go/No-Go decision record

**Meeting date:** _________________

**Attendees:** _________________

**Decision:** GO ☐ / NO-GO ☐

**Blocking items (if NO-GO):**

```
1. 
2. 
```

**Go-live steps executed (if GO):**

- [ ] Dữ liệu giả UAT xoá sạch: `pnpm --filter @cmc/db exec prisma db seed --reset` (hoặc manual)
- [ ] Seed production: facility đầu tiên + super_admin
- [ ] Backup trước khi mở: `./scripts/backup-db.sh`
- [ ] Stack production restart với `NODE_ENV=production`, `ALLOW_DEV_AUTH` unset
- [ ] Cutover probe lần cuối → 401
- [ ] Mở cơ sở đầu cho người dùng thật

**Signed off by:** _________________ · Date: _________________
