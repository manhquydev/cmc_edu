# Plan — LMS family login Wave 1 (additive)

**Branch:** `feat/lms-family-login` @ worktree `/home/manhquy/Downloads/cmc_edu-family-login`  
**SoT:** `plans/reports/brainstorm-260821-lms-wave1-scope.md`  
**Không** thi hành brief C3 / một form / `develop`.

## Hợp đồng

- **Outcome:** thêm cửa SĐT+MK, forgot/reset, picker Netflix, 0032 PH mới.
- **Constraints:** OTP + `loginStudent` + tab còn; PBKDF2; HMAC bearer; không VPS.
- **Non-goals:** gỡ OTP, Làn A, kho, cookie 3-kind.
- **Acceptance:** `familyLogin` sống; OTP sống; hash-null fail generic; 2 con không re-mint.

## Phases

| # | Slice | Commit rule |
|---|---|---|
| 1 | Lockout columns | Schema only |
| 2 | Forgot / reset | Public, no-leak, no session |
| 3 | `familyLogin` + kind union | **Cùng commit** với gate/parse |
| 4 | Netflix picker + tab Gia đình | OTP/HS tab còn, student default |
| 5 | 0032 insert-only hash | Không UPDATE hàng cũ |

Blast HIGH (GitNexus MCP không có — tự ghi): `requireLmsParent`, `verifyLmsToken`, `parseLmsToken`, `findOrCreateParentAccount`.

## C0 (local DB `cmc_edu`, 2026-08-21)

`ParentAccount` total=11, `hash_null`=11, `email_null`=11, `both_null`=11. **Cấm gỡ OTP.** Forgot trên hàng không email không gửi được — OTP vẫn là lối vào.

## Tests (worktree)

`family-login` 8, `family-reset-token`, `session-token`, `email-templates`, `guardian-provisioning` (0032 hash), `login.test` OTP 33, `lms-session` 4 — đã chạy.
