# J3 — Lý do danh tính & tài khoản gia đình (journals + plans)

Nguồn: journals/plans trong `/home/manhquy/Downloads/cmc-lms` (không suy diễn code-only).  
Ngày đo: 2026-08-12.  
Format: **nội dung · lý do · ngày · nguồn**.

---

## 1. Vì sao gộp PH + HS thành MỘT tài khoản gia đình

### 1.1 Vấn đề mô hình tách đôi (đã chốt phải gộp)

| Nội dung | Lý do | Ngày | Nguồn |
|----------|-------|------|-------|
| 2 vai trò khu `/` **gần như trùng tính năng** (xem + nộp theo con) | Owner muốn 1 tài khoản gia đình SĐT+MK + Netflix switcher | 2026-08-07 | `journals/2026-08-07-gp-hsph-…-pr-29.md:11-15`; `plans/260807-1211-…/plan.md:23-28` |
| Code **drift** khỏi docs “Model A đã gộp”: thực tế còn 2 cổng — family-phone-ticket (HS) + email-OTP (PH) | Scout advise/brainstorm đối chiếu code thật | 2026-08-07 | `2026-08-07-gp-hsph-…:19-22` |
| 2 app UI: `LmsApp` (student) + `ParentApp` (OTP, đa con) | Trùng màn, route `kind` rẽ nhánh | 2026-08-07 | plan `plan.md:23-28`; Phase 5 xóa ParentApp `phase-05:67-68` |
| Sink `studentIds[0]` (≥9 chỗ API + `app.tsx`) → đa-con luôn thấy **con đầu** sau switch | Red-team RT#4 High | 2026-08-07 | `plan.md:142-145,171`; `phase-03` header |
| `setChildPassword` / `childLoginInfo` = PH đặt MK con riêng; leo thang khi gộp role | RT#7; sau gộp moot | 2026-08-07 | `plan.md:149,174` |
| Hai guard/procedure (`parent`/`student`/`lms`) + 2 ownership helper | Phức tạp, dễ lệch | 2026-08-07 | `plan.md:32-33,146-148` |
| Lịch sử 28/07: suýt implement “PH chỉ OTP bỏ SĐT+MK” **ngược** hệ cũ | Owner làm rõ: OTP = cổng PH **riêng**, không bỏ SĐT | 2026-07-28 | `journals/260728-2146-parent-portal-va-auth-clarify.md:16-20` |
| 30/07: “đổi MK” trong role-matrix từng hiểu nhầm = MK PH; thực tế PH OTP **không có MK** — là `setChildPassword` cho `StudentAccount` | Định nghĩa lại tại chỗ | 2026-07-30 | `journals/260730-1132-parent-portal-hoc-ba-doi-mk.md:23-29` |

### 1.2 Đã cân nhắc / chốt (owner)

| Quyết định | Cân nhắc / trade-off | Ngày | Nguồn |
|------------|----------------------|------|-------|
| **D1** 1 TK = 1 gia đình, key `ParentAccount.phone` | Không gộp GV/ADMIN; không rename bảng sang FamilyAccount đợt này (D7 hoãn) | 2026-08-07 | `plan.md:71-74,92` |
| **D2** Login = SĐT+MK; **bỏ OTP** | Đơn giản 1 đường; PH prod đã có passwordHash (Phase 1) | 2026-08-07 | `plan.md:74-75` |
| **D3** loginCode thôi credential | Owner: HS chưa tự login (audit prod xác nhận hành vi, **không** verify DB vì không `lastLoginAt`); **giữ** `StudentAccount.passwordHash` | 2026-08-07 | `plan.md:75-78`; audit `reports/phase-01-prod-audit.md:49` |
| **D-KIND** literal `'family'` (không giữ `'parent'`) | Rẻ hơn giữ parent; owner chọn tên sạch, chấp nhận churn test + force re-login | 2026-08-07 | `plan.md:83-86`; journal ship `69-70` |
| **D4** Session đa-con; switch client-side; **không PIN / re-auth** | Đảo bất biến 0033 D4 (ticket chọn con); rủi ro máy chung 12h owner **chấp nhận tường minh** | 2026-08-07 | `plan.md:79-82`; RT#12 `plan.md:179` |
| **Không** ghi `submittedBy` phân biệt PH nộp thay con | Red-team lo; owner YAGNI → **Reject** finding | 2026-08-07 | `plan.md:64-65,181` |

### 1.3 Cái đã thử / tồn tại rồi BỎ (cấm port lại mù)

| Đã bỏ | Vì sao | Ngày | Nguồn |
|-------|--------|------|-------|
| Email-OTP PH (`otpRequest`/`otpVerify`, bảng `LoginOtp`) | D2 + gộp 1 login | 2026-08-07 | Phase 2/6; journal ship `38` |
| Ticket chọn con / `enterChildProfile` mint session 1 con | D4 session đa-con 1 bước | 2026-08-07 | `phase-02:21-22,35-36` |
| `kind:'parent'` / `kind:'student'` | D-KIND | 2026-08-07 | `phase-02:29-34` |
| `ParentApp` + 16 file `apps/web/src/parent/` | Gộp UI Phase 5 | 2026-08-07 | journal ship `37` |
| `setChildPassword` / `childLoginInfo` / `loginStudent` | RT#7 + không còn credential HS riêng | 2026-08-07 | `phase-02:22-23` |
| “Model A” docs nói đã gộp trong khi code còn 2 cổng | Drift tài liệu — sửa docs sau ship | 2026-08-07 | journal ship `19-22,54-57` |

---

## 2. Cutover family trên PROD

### 2.1 Chuẩn bị (trước deploy)

| Bước | Nội dung | Ngày | Nguồn |
|------|----------|------|-------|
| Hard-STOP Phase 1 | Đếm null password/phone/email, orphan guardian, StudentAccount | 2026-08-07 | `phase-01-start.md:21-51` |
| Kết quả live | **0** null password/phone/email; **0** orphan; **10 PH / 11 HS**; 1 gia đình 2 con; StudentAccount=11 | 2026-08-07 | `reports/phase-01-prod-audit.md:9-47` |
| Scale | Docs cũ 3/3; prod thật **10 gia đình re-login** | 2026-08-07 | audit `60-67`; plan D5 `plan.md:96-98` |
| Backup | Hourly dumps + path restore; journal cutover backup có `login_otp` | 2026-08-07 | audit `69-78`; journal cutover `33` |
| Big-bang chốt | 0 lockout dimension → big-bang OK (không staggered OTP→password) | 2026-08-07 | `phase-01-start.md:59-62` |

### 2.2 Diễn biến cutover (đã làm — journal 07/08 tối)

| Bước | Nội dung | Rủi ro / giảm | Ngày | Nguồn |
|------|----------|---------------|------|-------|
| Ship code | PR #29 family → sau gitflow #31 merge `91a6c58` main | Conflict test family+grade; semantic-merge sót studentId | 2026-08-07 | `journals/2026-08-07-audit-ton-h-…-familyp0.md:25-29` |
| Fetch prod | Server **không** git fetch GitHub private → **git bundle** scp | Không đụng credential prod | 2026-08-07 | cutover journal `31-32,42` |
| Backup tươi | 42 bảng, gồm `login_otp` để rollback | Path: `/root/backups/cmc-pre-cutover-family-20260807-161814.sql.gz` | 2026-08-07 | cutover `33,50` |
| Deploy | detached rebuild; entrypoint `migrate deploy` | Drop `login_otp` | 2026-08-07 | cutover `34` |
| Verify | migration applied; DB 41 bảng; login_otp drop; data **10/11/11/137** buổi nguyên; domain 200; Netflix picker có; OTP UI=0; 0 runtime error | Prod == `91a6c58` | 2026-08-07 | cutover `35-36` |
| Force re-login | Đổi KINDS bỏ parent/student → cookie 12h cũ chết | Thông báo trước; **không** lockout nếu có password (Phase 1) | 2026-08-07 | `phase-02:31-34`; plan Constraints `54-56` |
| Freeze window | Plan: tạm ngưng ghi lúc cutover (rollback không mất data cửa sổ) | RT#11 | 2026-08-07 | `plan.md:204-205`; phase-06 `114-116` |
| Rollback sẵn | restore backup **hoặc** git reset `4b95e01`; ưu tiên forward-fix | cutover journal `50` | 2026-08-07 | |

### 2.3 PH cũ dùng OTP chuyển sang mật khẩu ra sao

| Nội dung | Lý do / cách | Ngày | Nguồn |
|----------|--------------|------|-------|
| **Không** có luồng migrate OTP→password riêng | Phase 1: **0** `passwordHash` null — mọi PH active đã có MK (mặc định 0032 / migrate) | 2026-08-07 | `phase-01-prod-audit.md:11-24` |
| OTP chỉ là **cổng đăng nhập song song** (email) | Sau gỡ OTP, cùng `ParentAccount.passwordHash` dùng với SĐT | 2026-07-28 mô tả 2 cổng; 2026-08-07 gỡ | `260728-2146:12-13`; plan D2 |
| Residual `login_otp` rows | Prod còn **2** row OTP; drop cả bảng Phase 6 | 2026-08-07 | audit `55-56`; migration drop table |
| Sau cutover PH | Đăng nhập **SĐT + mật khẩu** (mật khẩu mặc định / đã đổi trước đó); không OTP | 2026-08-07 | cutover verify Netflix; plan Goal 1 |
| Quên MK gia đình | Phase 4 (email che) — **không chặn cutover**; bật khi SPF/DKIM sẵn | 2026-08-07 | `plan.md:129-130`; journal ship `86` |
| Con người verify login live | Journal ghi: chưa có MK thật để agent tự test | 2026-08-07 | cutover journal `46` |

---

## 3. Vì sao BỎ OTP

| Nội dung | Lý do | Ngày | Nguồn |
|----------|-------|------|-------|
| Owner D2: login khu `/` = SĐT+MK only | Gộp 1 đường credential; OTP là cổng PH **tách** không còn cần | 2026-08-07 | `plan.md:74-75` |
| Lịch sử: OTP sinh ra vì “cổng PH riêng” sau design-system, **không** thay SĐT+MK hệ cũ | Journal 28/07 suýt hiểu sai “PH chỉ OTP” | 2026-07-28 | `260728-2146:16-18` |
| OTP + password dual path: `passwordHash` nullable → account OTP-only **lockout** nếu gỡ OTP sớm | Red-team Critical #1/#2 → Phase 1 gate | 2026-08-07 | `plan.md:168-169`; ParentAccount nullable scout `plan.md:154` |
| Gỡ OTP/ticket ngay Phase 2 (không deprecated-live nhiều phase) | RT#8 mint/ticket cũ sống → session lệch | 2026-08-07 | `plan.md:175`; `phase-02:14-15` |
| Bảng `LoginOtp` drop migration riêng Phase 6 | Code OTP gỡ trước; schema sau | 2026-08-07 | phase-06 `13-14,128-130` |

**Không** ghi trong tài liệu: “OTP kém bảo mật hơn password” như lý do chính — lý do chốt là **mô hình 1 tài khoản + dual-path risk + owner D2**.

---

## 4. Netflix switcher — hoạt động & vì sao chọn

| Nội dung | Lý do | Ngày | Nguồn |
|----------|-------|------|-------|
| Sau login: màn chọn con (grid) → app theo con; 1 con auto-skip | UX Netflix / tránh picker thừa | 2026-08-07 | `phase-05:13-15,21-23` |
| Session JWT mang **tất cả** con; “con đang chọn” = **client state** | Không re-mint; đổi con **0** request login | 2026-08-07 | D4 `plan.md:79-80`; phase-05 success `62` |
| Persist `localStorage` nhớ con lần trước → vào thẳng | Validation Session 1 chốt | 2026-08-07 | `plan.md:206-207`; phase-05 `35-37,50-52` |
| “Đổi hồ sơ” về grid **không** logout | Cùng session family | 2026-08-07 | phase-05 `22-23` |
| Mọi API gửi `studentId` tường minh + ownership | Sửa sink `studentIds[0]` | 2026-08-07 | phase-05 `19-21`; phase-03 |
| Không PIN / re-auth khi switch | Owner non-goal; threat model máy chung chấp nhận (12h cookie) | 2026-08-07 | `plan.md:62-63,81-82`; RT#12 |
| Vì sao không ticket mint 1 con (0033 D4 cũ) | Ticket + OTP + ParentApp = 2 vai; gộp thì session đa-con rẻ hơn re-auth mỗi lần | 2026-08-07 | plan Overview `30-33`; comment sessions đảo 0033 D4 |

---

## 5. Lỗ hổng bảo mật red-team / review & cách sửa

### 5.1 Plan family 07/08 (4 lens → 13 accept)

| # | Lỗ / rủi ro | Sev | Cách xử lý | Nguồn |
|---|-------------|-----|------------|-------|
| 1–2 | Null password/phone/email → **lockout vĩnh viễn** khi gỡ OTP | Critical | Phase 1 hard-STOP audit; 0 null → big-bang | `plan.md:168-169` |
| 4 | `studentIds[0]` → xem/nộp **sai con** | High | Phase 3: mọi sink nhận `studentId` + assert ownership | `plan.md:171` |
| 5 | `save/submit` chỉ studentProcedure → family bị từ chối; giữ record-check roster | High | Phase 3 đổi guard + giữ check | `plan.md:172` |
| 7 | `setChildPassword` leo thang nếu family=parent | High | Gỡ endpoint Phase 2 | `plan.md:174` |
| 8 | Endpoint/ticket cũ sống song song cutover | Med-High | Gỡ legacy ngay Phase 2 | `plan.md:175` |
| 9 | Drop `StudentAccount.tokenVersion` phá cascade khóa PH | High | **Không drop field**; chỉ drop LoginOtp | `plan.md:176` |
| 10 | Reuse password-reset staff mất pre-check oracle | Med | Phase 4 thứ tự + test (mirror staff) | `plan.md:177` |
| 11 | Rollback restore mất data cửa sổ cutover | Med | Freeze + forward-fix | `plan.md:178` |
| 12 | Netflix no-PIN = đổi threat model | Med | Ghi nhận + owner accept | `plan.md:179` |
| 13 | “HS chưa login” không verify DB | Med | Giữ passwordHash StudentAccount | `plan.md:180` |
| 14 | Thiếu `submittedBy` | Med | **Reject** — owner non-goal | `plan.md:181` |

### 5.2 Code-review trong cook family (sau red-team plan)

| Finding | Cách sửa | Ngày | Nguồn |
|---------|----------|------|-------|
| **H1** email cấp TK còn hướng dẫn OTP/cổng PH đã gỡ; PH **không** xoay MK mặc định | Owner: tự phục vụ full — forgot email + change | 2026-08-07 | journal ship `41-46` |
| **M1** `setFamilyPassword` **không** bắt current-password → chiếm TK qua tRPC nếu có cookie | Bắt current-password (chuẩn app thường) | 2026-08-07 | journal ship `42-45,73-76` |
| Forgot family: email **che**, vé HMAC typ riêng, chống oracle | Mirror staff + D8 enumeration nhẹ owner accept | 2026-08-07 | journal ship `45-46`; D8 `plan.md:87-91` |

### 5.3 Trước gộp — lỗ liên quan danh tính (còn giá trị khi merge ERP)

| Finding | Cách sửa | Ngày | Nguồn |
|---------|----------|------|-------|
| `parent.update` phone: race với `student.create` ghi đè phone cũ (H1 silent revert) | Omit field đã có khỏi `data` update; advisory lock 91001 cùng `student.create` | 2026-07-30 | `journals/260730-2114-…:62-69,47-54` |
| Hiểu nhầm “`$transaction` = hết race” | READ COMMITTED cần lock tường minh | 2026-07-30 | `260730-2114:33-36,94-96` |
| Đổi SĐT PH → có thể **tách gia đình** nếu ghi danh sau dùng SĐT cũ | Cảnh báo UI, không chặn | 2026-07-30 | `260730-2114:52-54` |
| Staff forgot: query `?token=` vào **nginx access log** | Fragment `#token=` + replaceState | 2026-07-31 | `journals/260731-2126-…:25-29` |
| Oracle dò MK qua vé reset chết | Pre-check tokenVersion/isActive **trước** verifyPassword | 2026-07-31 | `260731-2126:35-40` |
| `FORGOT_PASSWORD_ENABLED` chỉ ẩn link UI — API/route public vẫn gửi mail | Mở cổng có chủ đích + review deploy | 2026-07-31 | `260731-2126:77-86` |
| Thiết kế bảng PasswordResetToken → đảo sang JWT neo tokenVersion | Tái dùng khuôn vé; vé chết khi đổi MK đường khác | 2026-07-31 | `260731-2126:17-23` |

### 5.4 Nợ sau cutover (journal thừa nhận)

| Nội dung | Ngày | Nguồn |
|----------|------|-------|
| e2e `ph-dashboard.spec.ts` còn OTP — **vỡ**; CI **không** chạy Playwright | 2026-08-07 | journal ship `59-65` |
| Chưa verify login người thật + forgot email SPF/DKIM trên live | 2026-08-07 | cutover journal `46-47` |

---

## 6. `StudentAccount` còn lại để làm gì sau gộp

| Nội dung | Lý do giữ | Ngày | Nguồn |
|----------|-----------|-------|-------|
| `loginCode` = mã định danh HS (thường = studentCode) | D3: thôi credential; vẫn tra cứu/UI/admin; migrate giữ nguyên chuỗi | 2026-08-07 | Goal 6 `plan.md:45`; D3 `75-78` |
| `passwordHash` **không drop** | Không chứng minh được “HS chưa login” (không lastLoginAt); tránh khóa nếu giả định sai; non-goal drop field | 2026-08-07 | RT#9/#13 `plan.md:68-69,176,180`; phase-06 `80-83` |
| `tokenVersion` **không drop** | Cascade khi `parent.setActive(false)` bump StudentAccount để thu hồi phiên con (legacy/cutover) | 2026-08-07 | `plan.md:50-51,150`; phase-06 `82-83` |
| Không còn `loginStudent` / setChildPassword | Endpoint gỡ Phase 2 | 2026-08-07 | phase-02 |
| Vẫn tạo khi `student.create` | Intake admin: tạo account + loginCode | (code + journal intake trước đó) | plan non-goal không đổi intake |

**Tóm ý docs:** StudentAccount = **danh tính + thu hồi phiên + migrate**, không phải cổng đăng nhập khu `/`.

---

## LỆCH (docs/plan vs thực tế / code)

| Lệch | Chi tiết | Nguồn |
|------|----------|-------|
| Docs “Model A đã gộp” vs code 2 cổng | Trước 07/08 docs đi trước code | journal ship `19-22` |
| Plan constraints “3 HS/3 PH” vs prod 10/11 | Phase 1 sửa messaging cutover | audit `60-67` |
| Phase 6 frontmatter `status: pending` / cutover DEFER trong phase file | Journal cutover tối cùng ngày: **đã** deploy live | phase-06 Result `124-132` vs cutover journal `31-36` |
| `plan.md` status `in-progress` dù ship PR | Metadata plan không phải SoT | `plan.md:4` |
| Parent portal plan `20260730` “đổi MK = setChildPassword” | Superseded: family self-service password; setChildPassword gỡ | plan family Open Q3; phase-06 supersede |
| e2e OTP còn trong repo sau gỡ OTP | CI không e2e → không đỏ | journal ship `61-63` |

---

## Timeline rút gọn (danh tính)

| Ngày | Sự kiện |
|------|---------|
| 28/07 | Auth clarify: SĐT=PH credential; OTP=cổng PH riêng; build ParentApp |
| 30/07 | Parent portal: học bạ; setChildPassword (định nghĩa lại “đổi MK”) |
| 30/07 | Red-team parent.phone + staff.setActive; H1 race student.create |
| 31/07 | Staff forgot/change password; JWT ticket; fragment token; oracle fix |
| 07/08 sáng–chiều | Advise→plan→cook family 6 phase; PR #29 |
| 07/08 tối | Audit P0 + gitflow + **cutover prod** drop login_otp, Netflix live |

---

## Unknowns

| # | UNKNOWN |
|---|---------|
| U1 | Có bao nhiêu PH prod từng **chỉ** dùng OTP (không dùng SĐT+MK) trước cutover — audit đếm passwordHash=0 (=0) nhưng không đếm tần suất OTP. |
| U2 | Journal cutover: “con người verify 1 login thật” — **không** có bằng chứng PASS/FAIL trong repo. |
| U3 | Forgot-password family đã gửi mail thật trên prod hay chưa (SPF/DKIM). |
| U4 | Chi tiết freeze window thực tế (bao nhiêu phút, có tắt ghi) — journal không mô tả bước freeze, chỉ backup+deploy. |
| U5 | Sau cutover, cascade bump StudentAccount còn cần thiết cho session nào (chỉ legacy cookie?) — plan giữ “cửa sổ cutover”, không đo sau vài ngày. |

---

Status: DONE | Summary: Gộp family vì 2 cổng trùng + sink sai con + dual app; cutover big-bang 10 PH sau audit 0-null, drop OTP, force re-login; Netflix = client switch không PIN; StudentAccount giữ identity+revoke không login.
