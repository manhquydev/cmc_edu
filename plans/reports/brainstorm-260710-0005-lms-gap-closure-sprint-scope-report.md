# Brainstorm Report — Sprint "Đóng gap LMS + chuẩn hoá trải nghiệm PH/HS"

**Date:** 2026-07-10 00:05 · **PO:** manhquy · **Status:** Concluded — scope chốt, chuyển /ck:plan
**Nguồn:** scout report `scout-260709-2350-project-completion-status-and-lms-otp-gap-report.md` (verify code trực tiếp)

## 1. Vấn đề

Scout verify code phát hiện: (a) OTP email không bao giờ được gửi trong production (go-live blocker);
(b) UAT kịch bản test tính năng không tồn tại (PH xem phiếu thu); (c) trải nghiệm LMS của PH/HS chưa
được định nghĩa chính thức → docs/UAT/code lệch nhau; (d) 5 module + schedule-router không có test.

## 2. Quyết định PO (2026-07-10, đảo hướng quan trọng)

**Định nghĩa vai trò LMS (mới, chính thức):**
- **PH thấy:** nhận xét GV từng buổi (kể cả cách hiển thị khi HS **nghỉ học**) · kết quả bài tập con
  đã làm + điểm GV chấm · hình ảnh lớp học · nhận xét tổng (report card).
- **PH/HS KHÔNG thấy:** phiếu thu, tiền, mọi thứ nội bộ — "đừng quá quan trọng hệ thống với PH và HS
  những cái mang tính nội bộ". Phiếu thu chỉ ở ERP staff.
- **HS:** làm bài, nộp, xem điểm mình, đổi sao lấy quà. Mật khẩu HS do **PH quản** (parent-mediated,
  quyết định chính thức — không phải nợ; C1).

**Scope chốt:**
| # | Hạng mục | Quyết định |
|---|---|---|
| A | OTP email delivery | Build — wire `requestOtpEmail` → `EmailOutbox` (kind `otp`) → tái dùng relay+Brevo. KHÔNG SMS (UI không dùng phone OTP). |
| B | Phiếu thu trên LMS | **KHÔNG build** — amend UAT KB1 bước 8; thay bằng đóng 2 gap thật: PH xem điểm bài con + PH thấy buổi nghỉ học |
| C | HS tự đổi mật khẩu | **KHÔNG build** — parent-mediated là thiết kế chính thức; gỡ label "P0-debt", ghi ADR note |
| D | Test backfill | **Đủ cả 6**: appointment, reconciliation, course, room, parentAccount, schedule-router |
| E | Docs + memory | Chuẩn hoá tài liệu vai trò LMS (PH/HS thấy gì/không thấy gì) + amend UAT + update harness memory |

## 3. Gap analysis (verify code 2026-07-10)

| PH cần | Code hiện tại | Gap? |
|---|---|---|
| Nhận xét từng buổi + tổng | `assessment.listForChild`, `reportCard.getForChild` | Có rồi |
| Ảnh lớp học | `sessionEvidence.listForChild` | Có rồi |
| Điểm/kết quả bài tập của con | submission chỉ có saveDraft/submit (student-write) | **GAP — cần query + UI** |
| Buổi nghỉ học của con | attendance router 0 procedure LMS | **GAP — cần query + UI, kèm design hiển thị "nghỉ"** |
| Không thấy phiếu thu | đúng hiện trạng | chỉ amend UAT + ghi quyết định |

OTP: `lms-auth/router.ts` `requestOtpEmail` (L282-329) tạo `LoginOtp` nhưng không gọi transport nào;
`EmailOutbox` chỉ có 1 insert site (receipt email, `finance/router.ts:832`); relay worker + Brevo
transport sẵn sàng (transport đã chủ động không log payload "may contain OTP" — thiết kế đón sẵn).
LMS login UI chỉ dùng email OTP + student password (`login.tsx:44,54,149`) — phone OTP dormant.

## 4. Hướng loại bỏ (chống phình)
SMS gateway (không ai dùng phone OTP) · LMS receipt view (PO loại) · student self-service password
(PO chốt parent-mediated) · leaderboard (TL16 đã loại) · trang admin network-ip/shift-config (seed đủ,
YAGNI tới khi vận hành thật cần).

## 5. Ràng buộc kế thừa (bất biến)
RLS `withFacility` + `cmc_app` · `ACTIVE_ROLES` 5 role · LMS access qua `getApprovedChildren`
(Guardian approved, chặn blocked_lms/withdrawn) · zod + 5 mã lỗi · không log OTP/PII · timestamptz/ICT ·
dev-header chỉ non-prod · build full local (cmcv2-prod local-sim) tới khi kiểm chứng xong mới VPS thật.

## 6. Success criteria sprint
- PH nhận OTP email thật qua Brevo trên stack local-sim (verify inbox thật) — không cần TEST_OTP_SEAM.
- PH xem được điểm + kết quả bài tập của con; thấy buổi con nghỉ học với hiển thị rõ ràng.
- UAT checklist KB1 sửa xong (bỏ bước phiếu thu, thêm bước điểm bài + nghỉ học).
- Tài liệu vai trò LMS cập nhật (TL17 hoặc TL14 §LMS) + ADR note password + harness memory.
- 6 module có test thật (assertion thật); gates typecheck/test/build xanh; e2e 2 lần xanh Mode-B.

## Next: /ck:plan → red-team → validate → tối ưu bản cuối
