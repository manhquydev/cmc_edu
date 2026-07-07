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
# Set env pointing to local prod-config stack
export APP_DATABASE_URL=postgresql://cmc_app:<pw>@localhost:5432/cmc_staging
export DATABASE_URL=postgresql://postgres:<pw>@localhost:5432/cmc_staging
export LMS_SESSION_SECRET=<same-secret-as-stack>
export E2E_BASE_URL=http://localhost:3000

pnpm --filter @cmc/e2e test
```

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

## Section 2 — Manual UAT by role

### 2.1 GĐKD (General Director of Business Development)

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Đăng nhập Entra SSO | Truy cập `/admin` → redirect Entra → đăng nhập bằng tài khoản thật | PASS / FAIL |
| Xem báo cáo doanh thu | Dashboard → Tài chính → xem số liệu cơ sở | PASS / FAIL |
| Xem danh sách cơ hội | CRM → Opportunities | PASS / FAIL |

### 2.2 GĐĐT (Director of Training)

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Đăng nhập Entra SSO | | PASS / FAIL |
| Xem chương trình giảng dạy | Curriculum → Course list | PASS / FAIL |
| Xem lớp học + học sinh | Classes → detail | PASS / FAIL |

### 2.3 Sale / tư vấn viên

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Tạo opportunity + học sinh mới | CRM → New → điền thông tin | PASS / FAIL |
| Tạo phiếu thu | Finance → Receipt → New | PASS / FAIL |
| Gửi email/OTP test | Lms-auth OTP nhận về email thật | PASS / FAIL |

### 2.4 Kế toán

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Duyệt phiếu thu (under threshold) | Receipt list → Approve | PASS / FAIL |
| Duyệt phiếu thu (over threshold — dual approval) | | PASS / FAIL |
| Xem báo cáo payroll | Payroll → list | PASS / FAIL |

### 2.5 Giáo viên

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Điểm danh trên tablet | Session → Attendance (từ tablet) | PASS / FAIL |
| Upload bài tập PDF | Exercise → Upload PDF | PASS / FAIL |
| Chấm bài + AI nhận xét (V4) | Grade → xem AI draft → sửa → xác nhận | PASS / FAIL |
| Xem ảnh buổi học | Session photo gallery (requires LMS bearer auth) | PASS / FAIL |

### 2.6 Phụ huynh (LMS portal)

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Nhận OTP (email thật Brevo) | LMS → Request OTP → nhận email → nhập | PASS / FAIL |
| Xem điểm danh con | LMS → Học sinh → Điểm danh | PASS / FAIL |
| Xem phiếu thu | LMS → Phiếu thu | PASS / FAIL |

### 2.7 Học sinh (LMS portal)

Tester: _________________ · Date: _________________

| Luồng | Steps | Result |
|-------|-------|--------|
| Xem bài tập + kết quả | LMS → Bài tập → xem nhận xét AI (draft đã GV duyệt) | PASS / FAIL |
| Xem điểm danh | LMS → Điểm danh | PASS / FAIL |

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
| G2 | All roles in Section 2 signed off | |
| G3 | Cutover probe → 401 (RT-2) | |
| G4 | 0 CRITICAL/HIGH open findings | |
| G5 | Restore drill PASS (backup host ≠ deploy host, RT-13) | |
| G6 | Isolation check PASS | |
| G7 | Runbook: second person executed deploy from scratch successfully | |
| G8 | `ALLOW_DEV_AUTH` absent from `.env.prod` (`grep ALLOW_DEV_AUTH .env.prod` → empty) | |

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
