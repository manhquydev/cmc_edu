---
title: "LMS gap closure: OTP email delivery + parent visibility + test backfill + role-experience docs"
description: "Đóng 2 gap LMS chặn UAT (OTP email không được gửi; PH thiếu view điểm bài + buổi nghỉ của con), chính thức hoá trải nghiệm vai trò PH/HS (không show nội bộ/tiền), bồi test 6 module trống, amend UAT KB1. Nguồn: brainstorm 260710-0005 + scout 260709-2350 (verify code trực tiếp)."
status: completed
priority: P1
branch: "main"
tags: [lms, otp, email-outbox, parent-visibility, test-backfill, uat]
blockedBy: []
blocks: [260707-2308-golive-sprint-land-sso-env-uat] # chặn Phase 4 UAT của plan go-live — KB1 bước 7 cần OTP email thật; KB1 bước 8 amend trong Phase 4 plan này
created: "2026-07-09T17:17:59.303Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260710-0005-lms-gap-closure-sprint-scope-report.md"
---

# LMS gap closure: OTP email delivery + parent visibility + test backfill + role-experience docs

## Overview

Scout 260709-2350 (verify code, không dựa docs) phát hiện: **(1)** `requestOtpEmail` tạo `LoginOtp`
nhưng không gọi transport nào → PH không bao giờ nhận OTP ở production (cổng duy nhất vào LMS);
**(2)** UAT KB1 bước 8 test tính năng không tồn tại (PH xem phiếu thu). PO chốt (brainstorm
260710-0005): **không show tiền/nội bộ cho PH** — thay bằng đóng 2 gap thật theo định nghĩa vai trò
LMS mới: PH xem **điểm/kết quả bài tập của con** + thấy **buổi con nghỉ học**; HS giữ parent-mediated
password (quyết định chính thức, không phải nợ). Kèm bồi test đủ 6 module trống + chuẩn hoá docs.

**Định nghĩa vai trò LMS (PO 2026-07-10, nguồn sự thật cho Phase 2+4):**
- PH thấy: nhận xét GV từng buổi (buổi nghỉ hiển thị rõ "Nghỉ học") · điểm + kết quả bài tập của con ·
  ảnh lớp học · report card. KHÔNG thấy: phiếu thu/tiền/mọi thứ nội bộ ERP.
- HS: làm bài, nộp, xem điểm mình, đổi sao. Mật khẩu do PH quản (resetChildPassword — đã có, đã test).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Otp-Email-Delivery](./phase-01-otp-email-delivery.md) | Completed (code) — Brevo credential unverified, see risk note |
| 2 | [Parent-Visibility-Submission-Attendance](./phase-02-parent-visibility-submission-attendance.md) | Completed |
| 3 | [Test-Backfill-Six-Modules](./phase-03-test-backfill-six-modules.md) | Completed |
| 4 | [Docs-Uat-Adr-Memory](./phase-04-docs-uat-adr-memory.md) | Completed |

Phụ thuộc: Phase 1 ⊥ Phase 2 (module khác nhau, chạy song song được nếu cần nhưng mặc định tuần tự).
Phase 3 độc lập. Phase 4 SAU 1+2 (docs phải tả hệ thống đã có thật — không tả trước).

## Dependencies

- **Blocks** `project:260707-2308-golive-sprint-land-sso-env-uat` **Phase 4 (UAT) only**: KB1 bước 7
  (PH nhận OTP Brevo thật) bất khả thi tới khi Phase 1 land; KB1 bước 8 (phiếu thu) được amend ở
  Phase 4 plan này. Stack env-prod + các gate khác của plan đó không bị ảnh hưởng.
- Nguồn quyết định: `plans/reports/brainstorm-260710-0005-lms-gap-closure-sprint-scope-report.md`.
- Không migration DB (mọi model cần đã có: LoginOtp, EmailOutbox, Attendance, Submission).
- Ngoài repo: BREVO_API_KEY đã có trong `.env.prod` (dùng chung với receipt email); không cần creds mới.

## Bất biến kế thừa (không phase nào được nới)

RLS `withFacility`+`cmc_app` · `ACTIVE_ROLES` 5 role · LMS child-access DUY NHẤT qua
`getApprovedChildren` + `auditChildDataAccess` (guardian/approved-children.ts) · zod + 5 mã lỗi ·
**không log OTP/PII** (transport đã tuân thủ — giữ nguyên) · timestamptz/ICT · dev-header/TEST_OTP_SEAM
chỉ non-prod · build full local (cmcv2-prod local-sim), không đụng VPS thật · không commit secrets.

## Acceptance (toàn plan)

- PH trên stack local-sim nhận email OTP thật qua Brevo (inbox thật, không TEST_OTP_SEAM), đăng nhập
  LMS thành công end-to-end.
- OTP plaintext KHÔNG tồn đọng trong DB sau khi gửi (payload scrub) và KHÔNG xuất hiện trong log.
- PH xem được danh sách bài tập của con kèm điểm/sao GV đã chấm; per-session view hiển thị trạng thái
  điểm danh, buổi absent hiện "Nghỉ học" rõ ràng.
- Không endpoint/UI mới nào lộ dữ liệu tiền/nội bộ cho LMS principal (kiểm bằng test âm tính).
- 6 module (appointment, reconciliation, course, room, parentAccount, class/schedule-router) có test
  thật (assertion thật, theo pattern test DB hiện có).
- UAT checklist KB1 sửa xong; docs vai trò LMS cập nhật; ADR note parent-mediated password; harness
  memory cập nhật; changelog.
- Gates: typecheck 26/26 · full test suite xanh · build 14/14 · `pnpm --filter @cmc/e2e test` xanh
  Mode-B (chạy riêng — root filter bỏ e2e).

## Execution protocol

Branch `feat/<phase>` từ main · gates xanh trước merge · code-review bắt buộc cho Phase 1 (auth-adjacent,
OTP secret handling) · mỗi phase 1 PR · changelog sau merge · stop-conditions: e2e nghi trỏ DB thật,
lộ OTP/PII trong log, thao tác phá huỷ ngoài repo.

## Red Team Review — 2026-07-10 (2 reviewer thù địch, findings verify bằng code)

7 findings, tất cả ACCEPT + đã bake vào phase files. Severity: 1 Critical · 3 High · 3 Medium.

| # | Finding | Sev | Áp dụng |
|---|---------|-----|---------|
| C1 | Scrub chỉ chạy khi send thành công → row `dead`/`failed` giữ plaintext OTP mãi (EmailOutbox không RLS, lọt backup) | Critical | Phase 1: scrub cả `dead` + sweep theo TTL; `failed` giữ code để resend (chấp nhận có ADR note) |
| C2 | `requestOtpEmail` thành email-cannon: gửi Brevo thật tới email bất kỳ, cooldown per-email bypass được → email-bomb + cạn quota = DoS cổng LMS | Critical→High | Phase 1: global cap kind='otp'/giờ fail-closed + gate-send-theo-ParentAccount (response vẫn đồng nhất no-leak) |
| H1 | Phase 2 prose bỏ bước `withFacility(student.facilityId)` mà pattern gốc assessment.listForChild bắt buộc (getApprovedChildren bypass RLS) | High | Phase 2: copy TRỌN body, tái lập facility GUC |
| H2 | Mâu thuẫn gate: "requireLmsParent" vs "same as assessment (cho phép student-kind)" + success "student FORBIDDEN" | High | Phase 2: chốt parent-only `requireLmsParent`, thôi trích assessment như identical |
| M1 | LoginOtp + outbox không transaction; outbox fail = mã verify-được nhưng không gửi | Medium | Phase 1: ghi rõ ordering + TTL dọn |
| M2/F1 | Field sai: `toEmail`→`to`, `grade`/`stars`→`score`+`Exercise.starReward` | Medium | Phase 1 + 2 sửa field thật |
| F6 | e2e/test không guard target ≠ cmc_prod | Medium | Phase 3 §DB-safety: guard fail-closed theo tên DB |

**Xác nhận KHÔNG phải issue (đóng vòng):** transport không log payload (email-transport.ts:54-57) ·
audit lỗi ghi error Brevo không ghi code · atomic claim send chống double-send · getApprovedChildren
là boundary đơn nguồn đúng.

**Câu hỏi mở chuyển sang /ck:plan validate:** (1) ngưỡng global otp-cap/giờ cụ thể; (2) Brevo có
sending-domain allowlist/double-opt-in giảm C2 không; (3) `failed` row giữ plaintext OTP tới TTL —
security chấp nhận không.

## Validation Log — 2026-07-10 (user chốt)

| # | Câu hỏi | Quyết định | Propagated |
|---|---------|-----------|------------|
| 1 | Gate gửi OTP theo ParentAccount + email-bomb | **Có gate + global cap** (chỉ gửi khi account tồn tại; response đồng nhất; thêm trần OTP/giờ fail-closed) | Phase 1 (đã bake) |
| 2 | `failed` row giữ OTP plaintext tới TTL | **Chấp nhận + sweep TTL** (giữ code cho resend; scrub dead/sent + sweep >5'; ADR note) | Phase 1 (đã bake) · Phase 4 ADR note |
| 3 | Phạm vi 6 module test | **Giữ đủ 6** (Phase 3 độc lập, không chặn gap chính) | Phase 3 giữ nguyên |

Ngưỡng global cap cụ thể: để executor chọn hằng số hợp lý cho pilot (gợi ý 200/h toàn hệ, đặt hằng
số có comment — chỉnh khi multi-facility). Brevo domain allowlist: hạ tầng, ngoài phạm vi code plan.

### Whole-Plan Consistency Sweep — 2026-07-10
- Files reread: plan.md · phase-01..04.
- Deltas checked: 7 red-team + 3 validation = 10. Reconciled: `to` (không `toEmail`) nhất quán P1;
  `score`/`starReward` nhất quán P2; gate parent-only + withFacility nhất quán P2 (architecture ↔
  success criteria); scrub dead+sweep nhất quán P1; DB-guard ở P3 dùng chung; ADR note `failed`-row ở
  P4 khớp quyết định validation #2.
- Mâu thuẫn mở còn lại: **0** → plan sẵn sàng /ck:cook.

## Execution Log — 2026-07-10 (/ck:cook --auto)

**Kết quả:** 4/4 phase implement xong, code-review PASS (0 Critical/High; 1 Medium tự fix trong phiên —
sweep chạy sau drain loop thay vì trước, tránh gửi email rỗng cho row OTP stale), tests xanh (api
524/525 — 1 fail pre-existing không liên quan `finance/receipt-get.test.ts`, verify độc lập tái hiện cả
khi chạy riêng file, không đụng bởi diff plan này), typecheck + build xanh (api/lms/e2e/admin — riêng
`@cmc/db#typecheck` bị Windows EPERM file-lock khi `prisma generate` ghi đè `.dll.node`, môi trường-cụ
thể, không phải lỗi code — root build vẫn 14/14 xanh dùng client đã generate).

**Blocker ngoài code:** live-verify Phase 1 trên stack local-sim (`cmcv2-prod`, rebuild api+worker
thật, gọi `requestOtpEmail` qua network) xác nhận pipeline đúng — outbox row tạo đúng shape, worker
gọi Brevo, xử lý lỗi đúng, không log code — nhưng Brevo trả `401 Key not found`. `BREVO_API_KEY` trong
`.env.prod` của stack local-sim này chưa từng hoạt động thật (khớp ghi nhận sprint journal 260709: "LMS
OTP manual only, chưa verify thật bao giờ"). Đây là gap credential/hạ tầng, KHÔNG phải gap code — UAT
KB1 bước 7 (PH nhận OTP thật) vẫn không thể ký xác nhận tới khi có key Brevo hợp lệ.

**Đã dọn:** ParentAccount/EmailOutbox throwaway tạo trong live-verify đã xoá khỏi `cmc_prod` sau khi
verify xong. `cmc_staging` (throwaway, qua socat sidecar `cmcv2-pgfwd`) dùng cho toàn bộ test suite
phiên này — không đụng `cmc_prod` cho bất kỳ INSERT/UPDATE/DELETE nào của test.
