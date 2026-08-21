# Wave 1 — phạm vi triển khai + vệ sinh git

**Date:** 2026-08-21
**Advise:** kongming GO. SoT cho cook trên worktree `cmc_edu-family-login`.
**Brief / phase-b1 / journal nói gỡ OTP, một form, nhánh `develop` = stale — không thi hành.**

## Hợp đồng Wave 1 (bốn trường)

**Outcome.** `devlms` **thêm** cửa gia đình (SĐT + MK, `kind:'family'`, picker Netflix, quên MK). Cửa OTP + `loginStudent` **còn sống**. PH hash-null vẫn vào được bằng OTP.

**Constraints.** Port luật, rewrite service. Bearer HMAC giữ. PBKDF2, không copy bcrypt. Cấm gỡ OTP / xóa tab / reject `parent|student`. Cấm mass-hash 22 PH NULL. Cấm đụng VPS `cmclms-*`. Base = tip P0 `feat/lms-family-login` (stacked #182), không `develop`.

**Non-goals.** Một form duy nhất (sau C0). Làn A buổi. Kho `ExerciseFile`. Cookie 3-kind. Đóng `hoc`.

**Acceptance.** `rg familyLogin` > 0; `rg requestOtpEmail|loginStudent` **vẫn** > 0; tab OTP còn; nhà 2 con picker không re-mint; hash-null `familyLogin` fail generic; forgot+reset rồi login được.

## IN / OUT

| IN | OUT |
|---|---|
| Cột lockout trên `ParentAccount` | `DROP LoginOtp` / `NOT NULL` hash |
| `familyLogin` + forgot/reset | Xóa tab PH/HS |
| 0032: hash default **chỉ** `parentAccount.create` | SQL gán `Cmc2026@` hàng cũ |
| Picker chỉ sau session `family` | Reject token `parent`/`student` |
| `kind` additive: `parent \| student \| family` | Gỡ OTP / `loginStudent` |
| OTP e2e giữ | Làn A / kho / cookie `cmc.session` |

`requireLmsParent` nhận `parent | family`. Token family **không** mang `studentId`.
