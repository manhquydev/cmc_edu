# CMC EDU v2 — UAT Checklist & Go/No-Go Record

Version: v2.0 · Stack: cmcv2-prod · Mode B (V3) session-injection

---

## Prerequisites before UAT

- [ ] ENV phase complete: all services healthy (`docker compose -p cmcv2-prod ps`)
- [ ] Restore drill passed (RT-13): `./scripts/restore-drill.sh` exits 0, backup host ≠ deploy host
- [ ] E2E critical green 1st run (see Section 1)
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
|      | PASS / FAIL | |

### Run 2 (must also pass — 2 consecutive required)

| Date | Result | Notes |
|------|--------|-------|
|      | PASS / FAIL | |

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

> **Phiên bản Phase 3** (2026-07-08): thay các mục role đơn lẻ cũ bằng 5 kịch bản chuỗi liên vai.
> Mỗi chuỗi chạy theo thứ tự; verify **expected state sau MỖI bước** trước khi qua bước tiếp theo.
> Một tester có thể đóng nhiều vai (xem nhân sự tối thiểu dưới).

### Nhân sự tối thiểu

| Phương án | Số người | Phân vai |
|-----------|----------|----------|
| **Rút gọn (tối thiểu)** | 3 | P1: GĐKD + sale + cskh · P2: GĐĐT + giao_vien + hr + ctv_mkt · P3: PH/HS thật |
| **Đầy đủ** | 9 | 1 người/vai staff (7 vai) + 1 PH thật + 1 HS thật |

> **Bắt buộc:** hr, cskh, ctv_mkt phải có tester thực hiện các bước mutation của họ — không skip.
> 3 role này chưa có e2e coverage; UAT là lần kiểm chứng đầu tiên.

---

### Kịch bản 1 — Chuỗi Tuyển sinh (P1-01 → P1-07)

**Vai tham gia:** sale · ke_toan · cskh · PH thật  
**Mục tiêu:** OTP email Brevo landing đúng inbox PH sau khi phiếu được duyệt

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | sale | Đăng nhập Entra SSO | `/admin` → redirect Entra → login thật | Dashboard hiển thị, role = sale |
| 2 | sale | Tạo opportunity + học sinh mới | CRM → New → điền thông tin | opportunityId sinh, stage = O1 |
| 3 | sale | Tạo phiếu thu (< 20M VND) | Finance → Receipt → New | receiptId sinh, status = pending |
| 4 | ke_toan | Đăng nhập → duyệt phiếu | Finance → Receipts → Approve | status = approved; enrollment = active |
| 5 | cskh | Đăng nhập → phê duyệt liên kết PH (`guardian.approveLink`) | Parents → Pending links → Approve | GuardianLink = approved |
| 6 | cskh | Cập nhật email PH (`parentAccount.updateEmail`) | Parents → :id → Edit email | email updated |
| 7 | PH | Nhận OTP email thật (Brevo) → đăng nhập LMS | LMS /login → OTP → inbox Brevo | LMS session, thấy con |
| 8 | PH | Xem phiếu thu của con | LMS → Phiếu thu | Receipt hiển thị đúng số tiền |

**Verify đặc biệt:**
- Bước 3 → nếu > 20M: cần GĐKD hoặc GĐĐT duyệt (ADR-B second-eye); ke_toan đơn độc → phải block
- Bước 6: sale CŨNG có `parentAccount.updateEmail` → confirm sale cũng thực hiện được

Tester (cskh): _________________ · Date: _________________

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

### Kịch bản 4 — Chuỗi Nhân sự + Lương (P3-01 → P3-06)

**Vai tham gia:** hr · ctv_mkt · cskh · GĐKD · ke_toan  
**Mục tiêu:** Punch → manual ticket → ca → KPI → payslip finalized

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | hr | Đăng nhập → chấm công (`checkIn.punch`) | Attendance → Check-in-out | punchId sinh |
| 2 | ctv_mkt | Đăng nhập → tạo manual punch ticket | Attendance → Manual ticket → New | manualPunchId pending |
| 3 | cskh | Đăng nhập → tạo manual punch ticket (verify cskh có quyền) | Attendance → Manual ticket → New | manualPunchId pending |
| 4 | GĐKD | Duyệt các manual punch tickets (`manualPunch.approve`) | Attendance → Pending tickets → Approve | status = approved |
| 5 | hr | Đăng ký ca làm (`shift.submit`) | Attendance → Shifts → Register | shiftRegistration pending |
| 6 | hr | Submit KPI (`kpi.submit`) | HR → KPI → Submit | kpi pending |
| 7 | GĐKD | Duyệt KPI (`kpi.approve`) | HR → KPI → Approve | kpi approved |
| 8 | ke_toan | Assemble + finalize payslip (`payslip.finalize`) | HR → Payroll → Assemble → Finalize | payslip finalized |

**Verify đặc biệt:**
- Bước 2 & 3: ctv_mkt VÀ cskh đều phải tạo được manual punch — confirm cả hai quyền hoạt động
- Bước 8: ke_toan trong roster `payslip.finalize` — confirm phân quyền đúng

Tester (hr): _________________ · Date: _________________ · Tester (ctv_mkt): _________________ · Tester (cskh): _________________

| | Result | Notes |
|-|--------|-------|
| Kịch bản 4 | PASS / FAIL | |

---

### Kịch bản 5 — Chuỗi Sau bán + Lifecycle (P4-01 → P4-05)

**Vai tham gia:** GĐKD · học sinh thật · hr · sale  
**Mục tiêu:** Quà đổi-giao xong, PH meeting được đặt, after-sale case đóng

| Bước | Vai | Thao tác | URL / action | Expected state |
|------|-----|----------|--------------|----------------|
| 1 | GĐKD | Cấu hình quà catalog (`gift.upsert`) | Engagement → Gifts → New | giftId active |
| 2 | học sinh | Đổi sao lấy quà (LMS) | LMS → Gifts → Redeem | rewardId pending |
| 3 | hr | Đăng nhập → duyệt quà (`rewards.manage` → Approve) | Engagement → Rewards → Approve | reward approved |
| 4 | hr | Giao quà (`rewards.manage` → Deliver) | Engagement → Rewards → Deliver | reward delivered |
| 5 | hr | Lên lịch họp PH (`parentMeeting.manage`) | Parent meetings → Schedule | meetingId |
| 6 | hr | Đặt lịch test đầu vào (`testAppointment.manage`) | CRM → Appointments → Schedule | appointmentId |
| 7 | sale | Tạo after-sale case (`afterSale.manage`) | CRM → After-sale → New | caseId open |
| 8 | GĐKD | Đóng case + cập nhật lifecycle học sinh | CRM → After-sale → :id → Close | case closed |

**Verify đặc biệt:**
- Bước 3–6: hr phải thực hiện được cả 4 bước — đây là UAT đầu tiên cho hr mutations

Tester (hr): _________________ · Date: _________________

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
| ke_toan | | | |
| giao_vien | | | |
| **cskh** | | | |
| **ctv_mkt** | | | |
| **hr** | | | |
| Phụ huynh (PH thật) | | | |
| Học sinh (thật) | | | |

> Gate **G2** (Section 4): tất cả 10 dòng trên phải có chữ ký trước khi tick G2 ✓

---

### Phụ lục 2A — Ma trận role × mutation (proof of coverage)

Mọi role giữ ≥1 mutation phải xuất hiện trong ≥1 kịch bản (ràng buộc F-S4).

| Role | Mutation permissions (key) | Kịch bản |
|------|---------------------------|----------|
| giam_doc_kinh_doanh | finance.receiptApprove · manualPunch.approve · kpi.approve · ... | KB1 · KB4 · KB5 |
| giam_doc_dao_tao | class.create · schedule.generate · exercise.manage · payslip.finalize · ... | KB2 · KB3 |
| sale | crm.opportunityCreate · finance.receiptCreate · enrollment.enroll | KB1 · KB5 |
| giao_vien | attendance.mark · exercise.manage · submission.grade · sessionEvidence.publish | KB2 · KB3 |
| ke_toan | finance.receiptApprove · payslip.finalize · payslip.assemble | KB1 · KB4 |
| **cskh** | guardian.approveLink · parentAccount.updateEmail · manualPunch.create | **KB1 · KB4** |
| **ctv_mkt** | manualPunch.create | **KB4** |
| **hr** | manualPunch.create · shift.submit · kpi.submit · rewards.manage · parentMeeting.manage · testAppointment.manage | **KB4 · KB5** |

✅ Không role nào giữ mutation mà vắng khỏi kịch bản.

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
|      | PASS / FAIL | | |

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

| # | Criteria | Status |
|---|---------|--------|
| G1 | E2E critical green ≥2 consecutive runs | |
| G2 | All 10 roles in Section 2 sign-off table signed (incl. cskh · ctv_mkt · hr) | |
| G3 | Cutover probe → 401 (RT-2) | |
| G4 | 0 CRITICAL/HIGH open findings | |
| G5 | Restore drill PASS (backup host ≠ deploy host, RT-13) | |
| G6 | Isolation check PASS | |
| G7 | **G7-nhẹ** (2026-07-08 user chốt): người thứ hai chạy `env-check.sh` + boot-checks API + grep `ALLOW_DEV_AUTH`/`TEST_OTP_SEAM` vắng → ký tên (full G7 deferred M1) | |
| G8 | `ALLOW_DEV_AUTH` absent from `.env.prod` (`grep ALLOW_DEV_AUTH .env.prod` → empty) | |
| G9 | `TEST_OTP_SEAM` absent from `.env.prod` (`grep TEST_OTP_SEAM .env.prod` → empty) | |
| G10 | `STAFF_SESSION_SECRET` ≠ `LMS_SESSION_SECRET` in prod (two distinct values) | |

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
