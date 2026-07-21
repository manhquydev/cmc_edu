# Plan hoàn tất: Khắc phục Happy-path Gaps (scenario audit) — TDD

**Ngày hoàn tất:** 2026-07-15 · **Trạng thái:** 8/8 phase Completed (100%)

## Mục tiêu ban đầu
Biến ~43 phát hiện ngoài-happy-path (từ `/ck-scenario` audit toàn bộ vai trò/module) thành công việc có cấu trúc theo Hybrid B+C: fix Critical riêng + gom pattern gốc dùng chung + xếp ưu tiên theo rủi ro thực, TDD nghiêm ngặt (test đỏ→impl→xanh→regression mỗi bước) để không phá 532+ test sẵn có khi đụng vào logic tiền/quyền/lương.

## Kết quả theo phase
| # | Phase | Trọng tâm |
|---|---|---|
| 1 | Verification & Promotion Gate | Xác nhận không có lỗ hổng `assertPasswordNotExpired`; 4 điểm frontend role-literal còn lại là display-only (không phải cổng quyền thật) → nhập Phase 8 |
| 2 | C1 Receipt-Cancel Provisioning Race | `SELECT FOR UPDATE` khoá Receipt trước khi cấp Enrollment; lớp 2 reconcile bắt lọt |
| 3 | Teacher Class-Scoping Authorization | `assertTeacherOwnsClass` dùng chung cho 10+ thủ tục (attendance/submission/assessment/sessionEvidence); fail-closed khi thiếu AppUser |
| 4 | C2 Single-Punch Approval Warning | `manualPunch.approve` trả `warnings: string[]` (SINGLE_PUNCH_NO_CREDIT/PAYSLIP_FINALIZED); rule 0-công KHÔNG đổi |
| 5 | Status & Lifecycle Guards | Chặn ghi evidence/họp cho session cancelled/HS withdrawn; **ĐẢO K9** (huỷ-phiếu-thường vẫn hiện con cho phụ huynh) |
| 6 | Atomic-Lock Standardization | `submission.grade` compare-and-swap; `ReconciliationFlag` partial unique index thật; OTP advisory-lock + rate-limit 5/15p; email-reaper 5→15p |
| 7 | Metric & Data Integrity | Duplicate-student gate (`needs_confirmation` + UI picker); `closedAt` không ghi đè; FinalGrade tự refresh; `submit` tái kiểm exercise; Tier B time-gate |
| 8 | Low-Severity Hygiene | slots/makeup validation; meeting double-book warn; **phát hiện+sửa bug refund price-drift**; multi-guardian warn |

## Quyết định PO quan trọng đã chốt (qua các vòng brainstorm/validate)
- **Huỷ phiếu → LMS con:** giữ login, chỉ rút chỗ học.
- **Quên bấm ra trong mạng:** để tự chịu, không nhắc (rủi ro chấp nhận, ghi rõ).
- **Lớp chưa gán GV:** chặn giáo viên, chỉ giám đốc thao tác được.
- **Trùng SĐT chưa chỉ rõ bé:** chặn MỌI lúc (kể cả tên giống), bắt sale xác nhận bé cũ/mới.
- **ĐẢO K9:** huỷ-phiếu-thường không còn ẩn con khỏi phụ huynh (chỉ `void`/`blocked_lms` mới ẩn).
- **OTP rate-limit:** 5 lần/15 phút/định danh, soft-block tự nhiên qua rolling window.
- **email-reaper:** chấp nhận at-least-once (Brevo/Graph không có idempotency-key khả dụng), ngưỡng reap 5→15 phút.
- **meeting double-book:** cảnh báo, không chặn (họp là việc nhẹ).

## Quy mô cuối cùng
- **API (`@cmc/api`):** 826 test, 93 file — xanh 100%.
- **Admin UI:** 239 test, 32 file — xanh 100%.
- **domain-finance:** 17 test — xanh 100%.
- **Typecheck:** 26/26 package sạch.
- Nhiều bug THẬT phát hiện thêm ngoài dự kiến ban đầu, đã sửa cùng lúc (không phải scope creep — cần thiết để tính năng chính hoạt động đúng): phone không chuẩn hoá khi tra `ParentAccount`, `kind` tính theo phone thay vì student, refund gift dùng giá LIVE thay vì giá đã trừ.

## Sự cố hạ tầng gặp phải trong quá trình làm (đã xử lý, không phải lỗi code)
1. **DATABASE_URL rỗng ban đầu** → tạo DB test riêng `cmc_edu` trong Docker sẵn có, không đụng `cmc_prod`.
2. **Máy khởi động lại giữa chừng** (giữa Phase 6) → container `cmcv2-pgfwd` (port-forward) không tự sống lại, gây treo test nhiều phút → `docker start cmcv2-pgfwd` khắc phục, đã ghi vào memory dài hạn.
3. **Windows Prisma DLL EPERM race** khi 2 lệnh `prisma generate` chạy song song — tránh bằng cách chạy tuần tự (regression trước, typecheck sau).
4. **1 lần flaky** ở `session-done-sweep.test.ts` (race giữa file test chạy song song, query bypass-RLS không scope facility) — xác nhận qua 3 lần chạy riêng lẻ + 2 lần full suite đều xanh, không phải regression, không thuộc phạm vi phase nào đã sửa.

## Unresolved questions
Không có — toàn bộ 43 phát hiện đã được xử lý qua 8 phase, mọi quyết định PO đã chốt qua brainstorm/validate trước khi implement.
