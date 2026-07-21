---
phase: 1
title: "Land-SSO-Stack"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Land-SSO-Stack

> Lưu ý đánh số (2026-07-08): "Phase 3" trong file này (dòng gap e2e-forge, bước 6/7, success criteria)
> viết khi UAT còn là Phase 3. Sau khi chèn Flow-Audit (brainstorm 260708-0906), UAT = **Phase 4**;
> các tham chiếu `plans/260707-2128-.../phase-03/04` là plan KHÁC, không đổi.

## Overview
Đưa khối SSO uncommitted (22 files, ~682 dòng — gates đã xanh 2026-07-07 23:23) lên main qua
PR có adversarial review (code auth). Đóng task tracker #10. Sửa drift trạng thái plan 260707-2128.
Red-team lộ 1 lỗ CRITICAL trong CODE (thiếu OAuth `state`/CSRF) phải đóng TRONG phase này trước merge.

## Requirements
- Functional: staff login qua Entra → HttpOnly signed cookie → `session.me` trả roles từ DB; dev-header vẫn hoạt động non-prod; admin UI gán role (gate `user.manage`, chỉ super_admin); e2e staff Mode-B cookie util export sẵn VÀ specs thực dùng nó (xem bước 8).
- Non-functional: không secrets trong diff; migration an toàn dữ liệu hiện có; CI xanh; sau phase không còn CRITICAL/HIGH mở.

## Architecture
Code đã tồn tại trên working tree — phase LAND + đóng gap red-team, không viết feature mới:
- `apps/api/src/auth/sso-routes.ts` (msal-node redirect/callback), `staff-session.ts` + 13 tests (HMAC cookie).
- migration `20260707200000_staff_role_enum_and_assignment` (enum Role 9 giá trị docs/14 + `AppUser.roles Role[]`).
- `apps/api/src/context.ts` — cookie ký; `x-facility-id` override.
- `apps/api/src/user/router.ts` + `role-drift.test.ts`; `apps/e2e/src/session-injection.ts`.

## Gap red-team phải đóng trước merge (verified bằng code 2026-07-07)
- **CRITICAL-CSRF (sso-routes.ts:88-123)**: `/auth/login` KHÔNG sinh OAuth `state`; `/auth/callback` KHÔNG đọc/so `state` → login-CSRF/session-fixation. Comment dòng 14 ("state managed by msal") sai. **Fix trong phase**: sinh `state` (+ PKCE nếu msal hỗ trợ) ở login, lưu qua signed cookie, constant-time compare ở callback; validate id_token `nonce`. Không merge nếu chưa đóng.
- **RT-α wording (context.ts:200-204)**: thực tế `resolveStaffFacilityId` **silently ignore** header cho non-super_admin (an toàn), KHÔNG throw FORBIDDEN. Review verify đúng behavior IGNORE + thêm test path ignore; KHÔNG "sửa" thành throw (regression tự gây).
- **STAFF_EMAIL_DOMAIN fail-open (sso-routes.ts:132-140; boot-checks.ts:169-175)**: unset → chỉ `console.warn`, nhận mọi Entra user có AppUser row. **Fix**: thêm `STAFF_EMAIL_DOMAIN` vào `assertRequiredEnvForProd` SSO block (fail-closed khi SSO_ENABLED).
- **G10 chưa machine-enforce (boot-checks.ts:104-141)**: không assert `STAFF_SESSION_SECRET !== LMS_SESSION_SECRET`. **Fix**: thêm boot-check fail nếu 2 secret bằng nhau.
- **e2e forge primitive (session-injection.ts:141-159)**: `mintStaffCookie` ký role tùy ý, `verifyStaffToken` không re-check DB → xử lý ở Phase 3 (throwaway secret), ghi chú tại đây để reviewer biết.

## Related Code Files
- Commit: 22 files uncommitted (allowlist chốt ở bước 1) + fix CSRF/boot-check.
- Modify sau merge: `docs/project-changelog.md`; `plans/260707-2128-.../phase-03-env-prod.md` + `phase-04-uat-gonogo.md` (frontmatter `status: superseded`, body note trỏ plan 2308); `plans/260707-1830-.../plan.md` (`status: superseded`).

## Implementation Steps
1. Chốt allowlist commit CHÍNH XÁC (không `git add -A`): liệt kê đúng path SSO stack + fix bước sau; stage theo list; `git diff --cached --stat` đối chiếu allowlist trước commit (loại report/plan .md, harness.db, repomix-output.xml — dù đã .gitignore). Tách commit theo concern: db-migration / api-auth / admin-ui / e2e / env-docs.
2. Pre-flight migration: chạy `SELECT email, count(*) FROM "AppUser" WHERE email <> '' GROUP BY email HAVING count(*)>1;` trên MỌI DB sẽ nhận migration (dev + staging Phase 2). Phải 0 dòng (unique index `AppUser_email_key` build fail nếu trùng → migration nửa chừng, `_prisma_migrations` kẹt). Ghi bước phục hồi `migrate resolve --rolled-back` nếu lỡ fail.
3. Đóng gap CSRF + STAFF_EMAIL_DOMAIN required + G10 boot-check (mục "Gap red-team"); thêm test cho từng fix.
4. Gates trên branch `feat/staff-sso-golive`: `pnpm -w turbo run typecheck && test && build` xanh.
5. Adversarial review code auth: verify state/nonce round-trip, RT-α IGNORE path, cookie flags (HttpOnly/Secure-prod/SameSite/maxAge~8h), secret không log, alias `Role as DbRole` (RT-δ). Cap 2 vòng fix.
6. Un-skip suite adversarial `apps/api/src/lms-auth/lms-auth-two-tier.test.ts` (13 tests `describe.skip` "BLOCKED: needs DB") — chạy được sau khi có DB (Phase 2) → chuyển yêu cầu này sang Phase 3 pre-Run1 nếu chưa có DB ở đây; ghi rõ không để suite tối vĩnh viễn.
7. Refactor e2e staff specs sang client mode-switching: ~25 call site hiện dùng `createStaffClient` (x-dev-user, chết ở prod) — mirror nhánh Mode-B của `global-setup.ts:90-96` để dưới NODE_ENV=production dùng `createSignedStaffClient`+`mintStaffCookie`. KHÔNG refactor → Phase 3 gate bất khả thi. (Có thể tách PR riêng nhưng phải xong trước Phase 3.)
8. Bootstrap super_admin: `seed.mjs` hiện dev-only (chỉ Facility+CurriculumUnit, KHÔNG AppUser). Thêm script idempotent upsert 1 `AppUser{email:<Entra thật>, roles:[super_admin], facilityId}` (cast `Role[]`); review cùng adversarial auth. Giải bootstrap-paradox (chỉ super_admin gán role được — RT-γ).
9. Push, PR, CI xanh, merge → xoá branch. Cập nhật changelog; TaskUpdate #10 → completed.
10. Sửa drift: 2128 phase-03/04 `status: superseded` + note; 1830 plan `status: superseded`. Dùng `ck plan` tooling nếu hỗ trợ set status, ngược lại hand-edit frontmatter đúng giá trị enum.

## Success Criteria
- [x] Gap CRITICAL-CSRF đóng + test; STAFF_EMAIL_DOMAIN + G10 boot-enforced; không CRITICAL/HIGH mở (adversarial review 25/25 PASS, APPROVE_WITH_CONCERNS — 5 concern non-blocking).
- [x] PR #24 merged `00ca207`, main xanh (typecheck-and-test ×2 + e2e ×2 CI); 5 commit tách concern theo allowlist.
- [x] e2e staff specs mode-switching (`createE2eStaffClient`, 31 call site); `scripts/seed-super-admin.ts` reviewed; lms-auth un-skip chuyển Phase 3 pre-Run1 (M7).
- [x] Changelog (PR #25) + tracker #10 completed; drift 2128 phase-03/04 + 1830 → `superseded`.

## Risk Assessment
- CSRF fix là code auth thật → phải có test round-trip state; không land nếu review chưa xác nhận.
- Migration enum trên DB có dữ liệu → bước 2 pre-flight bắt buộc; stop nếu trùng email hoặc diff destructive (DROP/ALTER mất dữ liệu).
- Refactor e2e + bootstrap seed là code work phát lộ (không nằm trong "chỉ land") → tách commit/PR, gates đủ.
- Diff to → allowlist + tách commit theo concern để review được.
