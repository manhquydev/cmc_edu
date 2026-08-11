---
title: "Phase 7: Auth family cutover"
status: todo
priority: P1
effort: "2–3d"
dependencies: [5, 6]
---

# Phase 7: Auth family cutover

## Overview

Chuyển LMS auth sang mô hình family (SĐT + mật khẩu, Netflix child switcher) từ `cmc-lms`, thay dual parent email-OTP + student password hiện tại — **không** đụng staff cookie.

## Requirements

- Functional:
  - [ ] `familyLogin(phone, password)` → session lists children
  - [ ] Active child selection client-side; server ownership checks on every call
  - [ ] Family change password + forgot password via email
  - [ ] Deprecate/disable student-only login after migration (or keep loginCode emergency path if decided)
  - [ ] Parent email-OTP path retired or dual-run windowed
- Non-functional:
  - [ ] Rate limit + lockout
  - [ ] Token version bump on parent deactivate
  - [ ] Secrets/hash compatible (PBKDF2 already shared)

## Architecture

Reuse crypto from `lms-auth/password-hash.ts`. Session kind becomes `family` (like cmc-lms) instead of split `parent`/`student`.

Migration:

1. Ensure ParentAccount has passwordHash (from family default or set-on-first-login).
2. Seed passwords for existing parents if only OTP existed.
3. StudentAccount remains for historical identity / optional student login freeze.

## Related Code Files

- Port: `cmc-lms` auth family procedures
- Modify: `apps/api/src/lms-auth/*`, `apps/api/src/trpc.ts`, `apps/lms` login
- Tests: auth integration + e2e login journeys

## Implementation Steps

1. Add family session encode/decode + guards.
2. Implement login/reset endpoints.
3. Migrate LMS UI login to single family form.
4. Feature flag dual auth for one release.
5. Remove OTP parent path when metrics OK.

## Success Criteria

- [ ] Family login e2e green
- [ ] Multi-child switch works
- [ ] Staff auth unaffected
- [ ] Comms path for reset email defined (Brevo or log stub documented)

## Risk Assessment

Parents with email-only OTP and no password need reset campaign. Plan SMS/email blast or force-set at facility counter.
