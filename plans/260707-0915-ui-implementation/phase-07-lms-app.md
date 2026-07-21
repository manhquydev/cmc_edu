# Phase 07 — App LMS (phụ huynh + học sinh)

## Context links
- `docs/06` §note LMS (app riêng, `/child/{studentId}/exercises`), `docs/12` §7 (mobile-first), `docs/08` §7 (dữ liệu trẻ + consent ảnh), master roadmap (LMS auth, sao flat, PDF annotate, gift priced in stars).
- Router: `lmsAuth` (sau rework **phase-01b**), `guardian`(getApprovedChildren), `sessionEvidence`, `submission`, `exercise`(open-tier), `gift`, `rewards`, `reportCard`. lmsProcedure gate qua `x-dev-lms-user` header (`apps/api/src/context.ts:28`), nay mang thêm `kind` (phase-01b C5).

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: **completed** · Review gate: **adversarial (dữ-liệu-trẻ) — passed post-fix**.
- App mới `apps/lms`, mobile-first web. Phụ thuộc **phase-01b** (auth 2 tầng + kind discriminator) + 02 (component/theme dùng lại).

## Key insights
- **Auth 2 tầng** (phase-01b): Parent = email + OTP-qua-email (session `kind:'parent'`); Student = SĐT phụ huynh + password (mặc định `Cmc2026@`, buộc đổi lần đầu; session `kind:'student'`+studentId). Parent reset password 1 con; login không lộ tồn tại.
- **Tách danh tính (C5)**: UI LMS phải phân biệt actor parent vs student theo `kind`. **Màn/hành động parent-only** (đổi consent ảnh, reset password con, xem danh sách nhiều con) chỉ hiện cho `kind:'parent'`. Student session chỉ thao tác đúng con mình — KHÔNG thấy sibling, KHÔNG đổi consent. Backend gate là thật (phase-01b re-gate); UI không mời hành động parent-only cho student.
- **Email OTP BLOCKED-ON-COMMS** (C2): transport là stub → parent login qua email **chỉ verify được ở dev/e2e** (test seam). KHÔNG tuyên bố login PH prod hoạt động tới khi có creds Brevo/Graph.
- **Consent ảnh trẻ**: ảnh lớp (`sessionEvidence`) chỉ hiện cho phụ huynh khi `photoConsent=true AND photoConsentRevokedAt IS NULL` (schema Guardian). Gate bắt buộc phía LMS — backend đã lo, UI KHÔNG bypass, KHÔNG cache ảnh ngoài consent. Đổi consent chỉ `kind:'parent'`.
- **getApprovedChildren** span facility (1 phụ huynh nhiều cơ sở) gated bằng `parentAccountId` ownership + **`kind:'parent'`** (phase-01b) — student KHÔNG liệt kê được sibling.
- **Sao** flat balance (StarTransaction), quà định giá bằng sao (`gift`), đổi quà `rewards` lifecycle (redeem→approve→deliver).
- **Bài tập** open-tier reads (ADR 0038): student xem bài locked/unlocked, làm bài PDF (draw/save/submit) qua submission + PDF route.

## Requirements
1. **App scaffold** `apps/lms`: Vite + React 19 + TS + Mantine (dùng theme `@cmc/ui`), mobile-first, tRPC client gắn `x-dev-lms-user`. Import `AppRouter` type từ `@cmc/api`.
2. **Parent login** email + OTP (`lmsAuth.requestOtp`/`verifyOtp`, session `kind:'parent'`) + profile picker (chọn con). Reset password con. (dev/e2e only tới khi có comms creds — C2).
3. **Student login** SĐT + password (`lmsAuth.login`, session `kind:'student'`) + picker nếu nhiều con (chọn con → session gắn đúng `studentId`; **đổi con = re-issue session**, không dùng lại studentId cũ) + buộc đổi mật khẩu lần đầu (C4).
4. **Parent view** (`kind:'parent'`): child chips (nhiều con), buổi học sắp tới, nhận xét gần đây (đã confirm), lịch, kết quả/học bạ, đổi consent ảnh. Ảnh lớp CHỈ khi consent.
5. **Student view** (`kind:'student'`, chỉ con mình): star balance hero, danh sách bài tập (locked/unlocked), luồng làm bài PDF annotate (draw → `submission.saveDraft` → `submission.submit`), lưới đổi quà (giá bằng sao) + đổi (`rewards.redeem`). KHÔNG thấy sibling, KHÔNG đổi consent.
6. **KHÔNG có enroll self-service** (Q6 chốt): ghi danh CHỈ staff ERP (phase-03). LMS không có form/overlay ghi danh — bỏ mọi mock enroll của wireframe.

## Architecture notes
- `apps/lms` cấu trúc song song `apps/admin` (lib/routes/pages/components), dùng lại `@cmc/ui` component + theme. KHÔNG fork component; nếu cần biến thể mobile → prop responsive, không copy.
- PDF annotate student: cùng thư viện phase 04 (pdfjs + canvas overlay). Lưu bài qua `submission.saveDraft` (`annotationLayer` JSON, cap 1MB — verified `apps/api/src/submission/router.ts`), nộp qua `submission.submit`. Backend đã sẵn, không delta. Giữ payload gọn (không nhúng ảnh base64 vượt 1MB).
- Consent gate: đọc field consent từ response evidence/children; ẩn ảnh nếu không consent. Test khẳng định ảnh KHÔNG rò khi consent=false/revoked. Đổi consent chỉ `kind:'parent'`.
- **kind discriminator (C5)**: UI đọc `kind` từ session (phase-01b) → route/màn parent-only ẩn với student. Dev `x-dev-lms-user` header nay mang `kind` (+`studentId` cho student) để dev/e2e mô phỏng đúng 2 actor. Session token LMS vẫn placeholder base64 (real session infra = follow-up P0-debt) — nhưng `kind` là phần bắt buộc của payload, không optional. **Parent** đổi con = điều hướng (session giữ `kind:'parent'`); **student** đổi con = re-issue session `kind:'student'`+studentId mới.

## Related code files
- Đọc: `apps/api/src/lms-auth/router.ts` (sau phase-01b), `apps/api/src/trpc.ts` (LmsSubject.kind), `guardian/approved-children.ts`, `session-evidence/router.ts`, `submission/router.ts`, `exercise/open-tier.ts`, `rewards/{gift-router,reward-router}.ts`, `assessment`/`reportCard`.
- Thêm: `apps/lms/*` (app mới) — `package.json`, `vite.config`, `src/{lib,routes,pages/parent,pages/student}`.
- File ownership: toàn bộ `apps/lms/*` (app mới, không đụng admin). Có thể thêm export component vào `@cmc/ui` nếu cần (phối hợp — `@cmc/ui` là shared).

## Implementation steps
1. Scaffold `apps/lms` + Mantine theme + tRPC lmsClient.
2. Parent login email-OTP + picker.
3. Student login phone+password + picker.
4. Parent view (children/sessions/comments/schedule/results) + consent-gated ảnh.
5. Student view (sao hero, bài tập locked/unlocked, PDF làm bài, đổi quà).
6. Reset password con (parent, `kind:'parent'`).
7. Verify: mobile viewport, consent gate ảnh, sao balance, **student KHÔNG chạm parent-only (kind gate) + KHÔNG thấy sibling**.

## Todo list
- [x] Scaffold apps/lms + theme + lmsClient — done 2026-07-07
- [x] Parent login email-OTP + picker — done 2026-07-07
- [x] Student login phone+pw + picker — done 2026-07-07
- [x] Parent view + consent-gated ảnh — done 2026-07-07; backend-authoritative gate
- [x] Student view (sao/bài/quà) + PDF làm bài (kind:'student', chỉ con mình) — done 2026-07-07
- [x] Reset password con (kind:'parent') — done 2026-07-07
- [x] Verify mobile + consent + kind-gate + adversarial — done 2026-07-07; 6 issues fixed post-review

## Success criteria
- Parent đăng nhập email-OTP (`kind:'parent'`); Student đăng nhập SĐT+password + buộc đổi lần đầu (`kind:'student'`); sai không lộ tồn tại.
- **C5**: student session KHÔNG hiện/không gọi được màn parent-only (consent, reset con, sibling list) — test khẳng định; chỉ thao tác đúng con mình.
- **C2 (trung thực)**: parent email-OTP chỉ verify được ở dev/e2e (test seam); KHÔNG tuyên bố login PH prod hoạt động (blocked-on-comms creds).
- Ảnh lớp CHỈ hiện khi consent=true & chưa revoke — test khẳng định không rò.
- Sao balance + đổi quà đúng giá sao; redeem gọi `rewards.redeem`.
- Bài tập locked/unlocked đúng open-tier; làm bài PDF submit được.
- Mobile-first: dùng tốt trên viewport phone.
- **Verify**: build/typecheck `apps/lms` xanh; test consent-gate + login-no-leak + kind-gate + sibling-isolation.
- **Review**: adversarial — soi rò dữ liệu/ảnh trẻ, login leak, kind bypass, sibling access, sao gian lận.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| Ảnh trẻ rò khi consent=false/revoked | TB×**Cao** | gate từ backend field; test khẳng định; review adversarial |
| Student thấy/chạm dữ liệu sibling (C5) | TB×**Cao** | kind gate (phase-01b) backend + UI; test sibling-isolation |
| Login lộ tồn tại account | TB×Cao | giữ generic-error pattern phase-01b |
| Tuyên bố login PH prod hoạt động khi transport stub | TB×Cao | success ghi dev/e2e-only; blocked-on-comms |
| Fork component (drift admin/lms) | TB×TB | dùng chung `@cmc/ui`, prop responsive |
| Sao balance tính sai/gian lận client | Thấp×Cao | balance từ backend StarTransaction, UI read-only |

## Security considerations
- Dữ liệu trẻ em là hạng nhạy cảm nhất: consent gate ảnh, che PII, không cache chéo phụ huynh.
- **kind discriminator (C5)** là gate bắt buộc: student KHÔNG chạm parent-only (consent/reset/sibling). Backend re-gate (phase-01b) là thật; UI không mời.
- lmsProcedure gate `parentAccountId` ownership + `kind` — UI không truy cập con chưa link, student không leo quyền parent.
- Reset password: audit (phân biệt actor nhờ kind), không cho reset con chưa link.
- Session token placeholder — không coi là credential thật; real session + comms creds là follow-up (P0-debt).

## Next steps
→ Phase 08: e2e UI cho login LMS (test-seam OTP) + consent gate + kind-isolation; đồng bộ docs auth 2 tầng (QĐ0033/WF-P1-07 đảo).
