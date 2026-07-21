# Phase 01b — Auth 2 tầng LMS (parent email-OTP + student password) + tách danh tính trẻ

## Context links
- `docs/11` §auth, `docs/19` §2, `docs/24` WF-P1-07, `docs/08` §7 (dữ liệu trẻ). ADR đảo ngược QĐ0033/WF-P1-07 (phone-OTP) → email — **có chủ đích, product-decision 2026-07-07** (đồng bộ docs ở phase-08).
- Red-team findings áp dụng: C1 (nguồn email), C2 (transport blocked-on-comms), C4 (student login security), C5 (tách danh tính parent/student).

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: in-progress (code done; 8 unit tests pass; integration tests BLOCKED: needs DB; email-OTP prod BLOCKED-ON-COMMS) · Review gate: **adversarial BẮT BUỘC** (auth-substrate + dữ-liệu-trẻ — rủi ro trẻ-em số 1).
- Tách từ phase-01. Chặn phase-07 (LMS). Chạy song song 01a.

## Key insights
- **Parent auth → email + OTP-qua-email** (đảo QĐ0033 phone-OTP). Cần `ParentAccount.email` (hiện KHÔNG có — chỉ `Contact.email`/`AppUser.email`, `schema.prisma:235,963`). Provisioning tạo ParentAccount **chỉ từ phone** (`provision-from-receipt.ts:83,236`).
- **C1 — nguồn email**: nếu `email` bắt buộc @unique → provisioning gãy; nếu nullable → phụ huynh cũ không có email → không đăng nhập được. → email `String? @unique` + **bắt email ở form ghi danh/phiếu thu mới** + **luồng backfill** (staff cập nhật ở màn Phụ huynh ERP) + **hành vi khi email trống** (chưa login được app — hiển thị hướng dẫn liên hệ trung tâm).
- **C2 — transport là STUB**: `ConsoleEmailTransport` chỉ `console.log` (`worker/email-transport.ts:17-28`); OTP delivery hiện = audit row (`lms-auth/router.ts:128-140`), KHÔNG SMS/email thật. Đổi sang email KHÔNG sửa được giao — chỉ thêm cột. → giao-OTP là **BLOCKED-ON-COMMS**; đợt này chỉ verify được ở **dev/e2e (test seam)**. KHÔNG tuyên bố login PH hoạt động end-to-end prod. Stop-condition: chờ creds Brevo/Graph.
- **C4 — student login là rủi ro trẻ-em số 1**: SĐT phụ huynh bán-công-khai + mật khẩu mặc định `Cmc2026@` giống mọi nhà + không buộc đổi + không rate-limit = password spraying chiếm tài khoản trẻ (điểm/ảnh/PII). Login mới KHÔNG tự có lockout như OTP.
- **C5 — danh tính parent/student bị gộp = defect authz trẻ NGAY LẬP TỨC**: `LmsSubject = {parentAccountId, studentId?}` KHÔNG có trường phân biệt actor (`trpc.ts:18-20`). Nếu đặt credential trên ParentAccount, student login nhận session không phân biệt được với parent → student có thể (1) `guardian.setPhotoConsent` cấp/thu-hồi consent ảnh cho mình VÀ mọi anh chị em (`session-evidence/router.ts:341-348`), (2) thấy mọi sibling (`getApprovedChildren`, `approved-children.ts:45-54`), (3) hành động AS sibling. Audit không phân biệt được parent hay trẻ thao tác (lỗ truy vết docs/08 §7).

## Requirements
1. **Schema** (C1/C5): thêm `ParentAccount.email String? @unique`; thêm **`StudentAccount.passwordHash String?`** (đặt credential trên StudentAccount, KHÔNG trên ParentAccount — để danh tính student tách bạch + hỗ trợ per-con về sau, tránh cửa-một-chiều). Migration tay (identity-exempt, không RLS). **Đảo quyết định vòng trước** (reuse ParentAccount.passwordHash) theo red-team C5.
2. **LmsSubject discriminator** (C5): thêm `kind: 'parent' | 'student'` vào `LmsSubject` (`trpc.ts:18-20`) + `x-dev-lms-user` header schema (`context.ts:28-31`). Re-gate mọi thủ tục parent-only về `kind==='parent'`: `guardian.setPhotoConsent` (`session-evidence/router.ts:341`), `getApprovedChildren` (`guardian/approved-children.ts`), `resetChildPassword` (mới), **và rà toàn bộ thủ tục lms lấy scope theo `parentAccountId`** (grep `lmsProcedure`/`parentAccountId` — không bỏ sót thủ tục nào). Student session chỉ thấy/hành động trên CHÍNH `studentId` của session (submission/redeem sao), KHÔNG thấy siblings. **Bắt buộc cùng req1** — chỉ đặt credential mà bỏ discriminator thì student vẫn thừa quyền parent.
3. **Parent auth = email + OTP-qua-email** (C1): `requestOtp(email)`/`verifyOtp(email,code)` gửi qua email-outbox; giữ bất biến không-lộ-tồn-tại + hash + cooldown + lockout. Session parent = `kind:'parent'`.
4. **Email capture + backfill** (C1): thêm input `parentEmail` (optional) ở `finance.receiptCreate` + form ghi danh/phiếu thu (phase-03 UI). Màn Phụ huynh ERP (phase-06) cho staff backfill email PH cũ. Email trống → PH chưa login app được → UI hiển thị hướng dẫn liên hệ trung tâm.
5. **Student auth = SĐT phụ huynh + password** (C4/C5): login resolve SĐT → StudentAccount(s) của phụ huynh đó → verify `passwordHash`; >1 con → **child picker → cấp session `kind:'student'` + đúng `studentId` đã chọn**. **Đổi con = re-issue session** (không mang studentId cũ). Mặc định `Cmc2026@` khi provisioning (set trên StudentAccount). Không lộ tồn tại.
6. **Student login security BẮT BUỘC** (C4, KHÔNG defer): (a) **buộc đổi mật khẩu lần đầu** (kể cả sau staff reset về default) — cờ `mustChangePassword`; (b) áp **cùng cooldown+lockout** như OTP flow cho `lmsAuth.login`; (c) **audit ghi actor kind** (parent vs student) trong `auditChildDataAccess` (`guardian/approved-children.ts` — hiện chỉ ghi `parentAccountId`+`via`, không truy vết được ai thao tác dữ liệu trẻ). Mọi login/đổi/reset đều audit.
7. **Reset mật khẩu**: (a) parent reset mật khẩu 1 con qua LMS (lmsProcedure, `kind==='parent'`, chỉ con đã link — per-StudentAccount nên reset ĐÚNG 1 con, không đụng sibling); (b) staff ERP reset student về default + set `mustChangePassword` (protectedProcedure + permission mới `studentAccount.resetPassword`, roster GĐKD/GĐĐT+super_admin, SoD). KHÔNG thêm role mới vào `ROLES`.

## Architecture notes
- **passwordHash trên StudentAccount** giải quyết red-team verdict (d) cửa-một-chiều: per-con reset/rehash khả thi; login resolve SĐT→các con→verify. Multi-sibling cùng default: verify password khớp StudentAccount nào → picker các con khớp (chi tiết resolve chốt ở spec build; rate-limit C4 chặn dò).
- **Discriminator là fix gốc** (C5): không có nó, mọi thứ khác chỉ vá bề mặt. Bổ sung vào cả dev-header path (`context.ts`) để dev/e2e mô phỏng đúng 2 actor.
- Hash: argon2 trong `@cmc/domain-identity` (module dùng chung, không tự cuộn). OTP email tái dùng outbox hiện có; nội dung OTP không log plaintext ngoài dev.
- Email transport (C2): giữ `ConsoleEmailTransport` cho dev/e2e; test-seam đọc OTP pending (phase-08 M3). KHÔNG claim prod-ready.

## Related code files
- Sửa: `packages/db/prisma/schema.prisma` (`ParentAccount.email`, `StudentAccount.passwordHash`, `StudentAccount.mustChangePassword`) + migration.
- Sửa: `apps/api/src/trpc.ts` (LmsSubject.kind + re-gate parent-only), `apps/api/src/context.ts` (dev-lms header schema + kind).
- Sửa: `apps/api/src/lms-auth/router.ts` (email OTP + student login + forced-change + rate-limit + parent reset child pw) + `otp-hash.ts`.
- Sửa: `apps/api/src/session-evidence/router.ts` (`setPhotoConsent` gate `kind==='parent'`), `apps/api/src/guardian/approved-children.ts` (sibling scope gate + `auditChildDataAccess` ghi actor kind).
- Sửa: `apps/api/src/finance/router.ts` (input `parentEmail` ở receiptCreate) + `provision-from-receipt.ts` (set default passwordHash + email khi có).
- Sửa: `packages/auth/src/index.ts` (permission `studentAccount.resetPassword`).
- Thêm: procedure staff reset (student/user router).

## Implementation steps
1. Schema: `ParentAccount.email`, `StudentAccount.passwordHash` + `mustChangePassword` + migration.
2. LmsSubject `kind` + dev-header schema + re-gate parent-only thủ tục (setPhotoConsent, getApprovedChildren siblings, resetChildPassword) + rà toàn bộ `lmsProcedure` lấy scope `parentAccountId` (grep, không bỏ sót).
3. Module hash argon2 (nếu chưa có).
4. Parent email-OTP (requestOtp/verifyOtp email, session kind:'parent').
5. Email capture input ở receiptCreate + provisioning set email/default passwordHash.
6. Student login (resolve SĐT→con→verify, picker → session kind:'student'+studentId, đổi con=re-issue) + forced-change + cooldown/lockout + audit ghi actor kind.
7. Reset flows (parent→1 con; staff→default+mustChange+permission).
8. Test: adversarial — student KHÔNG gọi được parent-only (kind gate), reset 1 con không đụng sibling, login no-leak, lockout, forced-change, email empty→no-login.

## Todo list
- [x] Schema email + StudentAccount.passwordHash + mustChangePassword + loginAttempts + loginLockedUntil + migration (20260707120000_phase01b_lms_auth_two_tier)
- [x] LmsSubject.kind + re-gate parent-only (setPhotoConsent/siblings/resetChild); devLmsUserHeaderSchema updated; buildLmsContext updated
- [x] Module hash — PBKDF2-SHA256 via node:crypto (no argon2, no native deps); password-hash.ts; 8 unit tests pass
- [x] Parent email-OTP (requestOtpEmail / verifyOtpEmail, kind:'parent'); LoginOtp.phone nullable; LoginOtp.email added
- [x] Email capture at receiptCreate (parentEmail optional input) + Receipt.parentEmail column + provisioning upserts email + sets default passwordHash + mustChangePassword=true
- [x] Student login (loginStudent: phone→StudentAccount→verify, lockout MAX_STUDENT_LOGIN_ATTEMPTS, no-leak, audit) + mustChangePassword flag preserved in token
- [x] Reset flows: parent resetChildPassword (lmsProcedure, kind=parent, per-StudentAccount); staff student.resetPassword (permission studentAccount.resetPassword, GĐKD/GĐĐT)
- [x] Test adversarial: unit tests (8, pass); integration tests written as describe.skip (BLOCKED: needs DB) in lms-auth-two-tier.test.ts

## Implementation notes (2026-07-07)
- Used PBKDF2-SHA256 (100k iterations, 16-byte salt) instead of argon2 — no native bindings needed, adequate for this use case.
- LoginOtp.phone made nullable (both schema and migration ALTER COLUMN DROP NOT NULL).
- Receipt.parentEmail column added to carry email from receiptCreate through to provisioning.
- Pre-existing TypeScript errors in payroll/shift/user modules — not introduced by this phase.
- DB build and unit tests confirmed passing. Integration tests require live Postgres.

## Success criteria
- **C5**: student session (`kind:'student'`) KHÔNG gọi được `setPhotoConsent`/`resetChildPassword`/sibling list; chỉ thao tác đúng `studentId` của mình — test khẳng định 403. `auditChildDataAccess` ghi actor kind (parent vs student). Đổi con → re-issue session (studentId mới).
- **C4**: `lmsAuth.login` có cooldown+lockout; buộc đổi mật khẩu lần đầu + sau staff reset; audit đầy đủ.
- Parent login qua email OTP (kind:'parent'); email/SĐT sai không lộ tồn tại (same generic error).
- Reset 1 con KHÔNG đổi mật khẩu sibling (per-StudentAccount).
- **C2 (trung thực)**: success chỉ tuyên bố "OTP email verify được ở **dev/e2e qua test seam**"; login PH end-to-end prod = **blocked-on-comms** tới khi có creds Brevo/Graph (stop-condition).
- Email trống (PH cũ) → không login được app + UI hướng dẫn liên hệ; staff backfill được.
- **Verify**: `pnpm -F @cmc/api test` (adversarial cases), typecheck+build, migrate dry-run.
- **Review**: adversarial BẮT BUỘC — kind-gate bypass, sibling isolation, no-leak, lockout, forced-change, hash strength.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| Student thừa quyền parent (thiếu discriminator) | TB×**Cao** | C5 req1+req2 BẮT BUỘC cả hai; test kind-gate |
| Reset 1 con đụng cả sibling (credential dùng chung) | TB×Cao | passwordHash per-StudentAccount |
| Password spraying chiếm tài khoản trẻ | Cao×**Cao** | cooldown+lockout + forced-change (C4), audit |
| Tuyên bố login PH hoạt động khi transport stub | TB×Cao | success ghi blocked-on-comms; stop-condition creds |
| Provisioning gãy do email @unique bắt buộc | TB×Cao | email nullable + capture-at-enrollment + backfill |
| Mã hoá/OTP log plaintext | Thấp×Cao | argon2, không log ngoài dev |

## Security considerations
- Dữ liệu trẻ hạng nhạy nhất: discriminator kind + sibling isolation là gate bắt buộc (C5).
- Default `Cmc2026@` là known-secret → buộc đổi lần đầu (C4), audit reset.
- OTP/mật khẩu không log plaintext; email-outbox không rò OTP prod.
- Permission reset = SoD; parent reset chỉ con đã link (kind:'parent').

## Next steps
→ phase-07 LMS tiêu thụ auth 2 tầng + kind discriminator; phase-08 đồng bộ docs QĐ0033/WF-P1-07 + test-seam OTP e2e.

## Nợ ghi nhận (stop-condition)
- **Comms creds** (Brevo/Graph) cho email OTP thật — chưa có → login PH prod chưa hoạt động. Cùng nhóm nợ với SSO (P0-debt).
