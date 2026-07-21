# Phase 08 — Đồng bộ docs/harness + e2e UI + changelog

## Context links
- `docs/06`, `docs/10`, `docs/11` (§auth), `docs/12`, `docs/15` (đồng bộ register), `docs/19` §2, `docs/24` WF-P1-07, QĐ0033, `docs/18`, `docs/FEATURE_INTAKE.md`, `docs/stories/`, `docs/HARNESS.md`, `docs/project-changelog.md`.
- Master roadmap protocol §5-6 (proof/trace → changelog). e2e hiện: Playwright **API-driven ở `apps/e2e/`** (L1 — KHÔNG phải apps/api/e2e), 2 spec, `playwright.config.ts` + `tests/`.

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: in-progress (1 todo BLOCKED: postgresql-x64-18) · Review gate: **reviewer 1 vòng**.
- Cuối cùng: sync docs cho 4 quyết định domain 2026-07-07 (chưa có trong corpus TL00-31/harness) + mở rộng e2e API-driven → UI-driven cho critical path + changelog.

## Key insights
- Quyết định domain **chưa có/đảo ngược trong docs**: (1) mã SO thay PT-; (2) **auth 2 tầng email — ĐẢO NGƯỢC QĐ0033/WF-P1-07** (docs hiện quy định phone-OTP 1 account) → cần **decision note "product-decision 2026-07-07"** ở docs/11 §auth, docs/19 §2, docs/24 WF-P1-07, docs/18; (3) StudentAccount.passwordHash + LmsSubject.kind (tách danh tính trẻ, C5); (4) KHÔNG cột studentCode (định danh fullName+SĐT); (5) over-threshold role-elevation (không co-approval).
- **Email OTP transport là stub** (C2): e2e login PH chỉ chạy được qua **test-seam non-prod** (M3) — docs/success phải ghi trung thực "login PH prod blocked-on-comms tới khi có Brevo/Graph". KHÔNG viết docs như thể đã hoạt động.
- e2e hiện API-driven (`apps/e2e/`, server spawn ephemeral, facility per-run + cleanup). Nâng lên UI-driven cho **critical path** (duyệt tiền canApprove/role-elevation, điểm danh, chấm+sao, LMS consent ảnh, kind-isolation, login 2 tầng qua test-seam) — không phủ toàn bộ (YAGNI), chỉ đường tiền/trẻ.
- Changelog + trace per phase là bất biến protocol.

## Requirements
1. **Docs sync + decision notes** (C2): cập nhật `docs/06` (route login/notifications), `docs/10` (email ParentAccount, **passwordHash StudentAccount + mustChangePassword**, KHÔNG studentCode), `docs/11` §auth (**đảo QĐ0033/WF-P1-07 → email+kind; decision note product-decision 2026-07-07**), `docs/19` §2 + `docs/24` WF-P1-07 (email OTP + blocked-on-comms), `docs/18` (transport nợ), `docs/12` (component + login pattern), `docs/15` (register mã SO + auth 2 tầng + kind). Mỗi chỗ docs↔code vênh: decision note (product-decision thắng, có ngày).
2. **Harness sync**: `docs/FEATURE_INTAKE.md` + `docs/stories/` thêm story cho UI phase + quyết định domain. `docs/HARNESS.md`/register cập nhật.
3. **Test-seam OTP** (M3): thêm seam **chỉ-non-prod** để e2e lấy mã OTP (endpoint test đọc OTP pending HOẶC mã cố định khi cờ `TEST`) — OTP hiện hash + không trả + không log plaintext (`lms-auth/router.ts:117,124-131`), browser e2e không lấy được nếu không có seam. Tài liệu hoá seam + đảm bảo tắt ở prod.
4. **e2e UI-driven** (`apps/e2e/`): mở rộng spec cho critical path: login staff dev-header + login LMS 2 tầng (qua test-seam), duyệt tiền canApprove-block + over-threshold role-elevation, điểm danh lưu, chấm+sao-once, LMS consent ảnh (ẩn khi revoke), **kind-isolation (student không chạm parent-only/sibling)**. Giữ pattern server-spawn + facility per-run + cleanup.
5. **Changelog**: `docs/project-changelog.md` entry per UI phase đã merge.

## Architecture notes
- e2e UI: Playwright browser context set header `x-dev-user`/`x-dev-lms-user` để auth (khớp dev-auth). Chạy trên build preview (`vite preview`) + api server ephemeral.
- Docs: đọc file trước sửa; verify date/link/claim khớp code thật (bất biến documentation-management).
- KHÔNG nhét plan-id/phase-number vào code/test/migration name (bất biến review-audit).

## Related code files
- Sửa docs: `docs/{06,10,11,12,15,18,19}-*.md`, `docs/24-*.md` (WF-P1-07), `docs/FEATURE_INTAKE.md`, `docs/stories/*`, `docs/HARNESS.md`, `docs/project-changelog.md`, `docs/codebase-summary.md`/`system-architecture.md` nếu kiến trúc UI đổi.
- Thêm/sửa e2e: **`apps/e2e/`** (L1 — `playwright.config.ts` + `tests/`, KHÔNG phải apps/api/e2e) — thêm spec UI-driven + preview server admin/lms.
- Thêm (M3): test-seam OTP non-prod (endpoint/cờ) trong `apps/api/src/lms-auth/` — gate tắt ở prod.
- Đọc: build preview config `apps/admin`/`apps/lms`.

## Implementation steps
1. Sync docs 06/10/11/12/15/18/19/24 + decision notes (đảo QĐ0033/WF-P1-07 product-decision).
2. Harness intake + stories cho UI + quyết định domain.
3. Test-seam OTP non-prod (M3) + tài liệu, đảm bảo tắt prod.
4. Thiết lập Playwright UI-driven ở `apps/e2e/` (browser + dev header + preview server).
5. Viết spec critical path (login 2 tầng qua seam, duyệt canApprove/role-elevation, điểm danh, chấm+sao, consent ảnh, kind-isolation).
6. Changelog entries.
7. Verify: e2e xanh CI, docs link/date đúng.

## Todo list
- [x] Docs 06/10/11/12/15/18/19/24 sync + decision notes (đảo QĐ0033) — done 2026-07-07, verified by 3 parallel Explore agents
- [x] Harness intake + stories — done 2026-07-07, US-UI-01a through US-UI-08 story packets created in docs/stories/
- [x] Test-seam OTP non-prod (M3) — TEST_OTP_SEAM_ENABLED gated NODE_ENV!='production', done 2026-07-07
- [x] Playwright UI-driven setup ở apps/e2e/ — done 2026-07-07, projects (api + ui-chromium) + webServer (admin:4173, lms:4174) added to playwright.config.ts
- [x] Spec: login 2 tầng (test-seam) — apps/e2e/tests/lms-auth.spec.ts, 4 tests, typecheck pass
- [x] Spec: duyệt tiền canApprove + over-threshold role-elevation — apps/e2e/tests/finance-approval.spec.ts, 4 tests
- [x] Spec: điểm danh + chấm+sao — apps/e2e/tests/attendance-grading.spec.ts, 4 tests
- [x] Spec: LMS consent ảnh + kind-isolation — apps/e2e/tests/kind-isolation.spec.ts, 3 tests
- [x] Changelog per phase — docs/project-changelog.md updated per phase 01a–08
- [ ] e2e xanh trên CI — BLOCKED: postgresql-x64-18 stopped (unresolved); UI-driven infra unblocked (phase-07 done + playwright.config.ts has ui-chromium project), but cannot run until DB starts

## Success criteria
- Docs phản ánh đúng: mã SO, auth 2 tầng email (decision note đảo QĐ0033), StudentAccount.passwordHash+kind, không studentCode, over-threshold role-elevation — không claim sai, không viết như thể email login prod đã chạy.
- Test-seam OTP chỉ hoạt động non-prod (verify tắt prod).
- Harness stories phủ UI phase + quyết định domain.
- e2e UI-driven xanh cho critical path (tiền + trẻ + login-qua-seam + kind-isolation), chạy trên GitHub Actions CI.
- Changelog có entry mỗi UI phase merged.
- **Verify**: `pnpm test` e2e xanh; docs review link/date; CI xanh.
- **Review**: reviewer 1 vòng — docs khớp code + decision note đúng, e2e phủ đúng critical path.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| Docs claim lệch code sau nhiều phase | TB×TB | đọc code trước sửa; decision note khi vênh |
| e2e UI flaky (browser timing) | Cao×TB | rerun 1 lần; sửa isolation, KHÔNG nới test (bất biến) |
| e2e phủ quá rộng (chậm CI) | TB×TB | chỉ critical path tiền/trẻ/login (YAGNI) |
| Consent-ảnh e2e không bắt được rò | TB×Cao | assert DOM không chứa ảnh khi revoke |
| Test-seam OTP lọt sang prod (backdoor) | Thấp×**Cao** | gate cờ non-prod cứng; test khẳng định tắt prod; review |
| Docs viết email login như đã chạy (sai sự thật) | TB×TB | decision note blocked-on-comms; review chặn |

## Security considerations
- e2e không commit secret/credential; dev-header + test-seam OTP chỉ hoạt động non-prod (fail-closed prod).
- Spec consent ảnh + kind-isolation là kiểm bảo mật trẻ em — bắt buộc trong bộ critical.
- Docs không lộ giá trị secret/mật khẩu mặc định ngoài mô tả nghiệp vụ.
- Test-seam OTP là backdoor nếu lọt prod → gate cứng + test khẳng định.

## Next steps
→ Kết thúc đợt UI. Nợ còn lại: Entra SSO (P0-debt), real session infra LMS, **comms creds Brevo/Graph cho email OTP** (login PH prod), transport/store/backup (PD phase roadmap).
