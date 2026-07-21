---
phase: 4
title: "Docs-Uat-Adr-Memory"
status: completed
priority: P2
dependencies: [1, 2]
---

# Phase 4: Docs-Uat-Adr-Memory

## Overview
Chính thức hoá định nghĩa vai trò LMS (PH/HS thấy gì / KHÔNG thấy gì) vào docs, amend UAT KB1 theo
quyết định PO, ghi ADR note parent-mediated password, cập nhật harness memory. Chạy SAU Phase 1+2
(tả hệ thống đã có thật).

## Requirements
- Functional: người đọc TL14/TL17 hiểu được trọn trải nghiệm PH/HS mà không cần đọc code; UAT KB1
  chạy được đúng nghĩa với hệ thống thật.
- Quy tắc TL14 §7: đổi quyền/role → sửa registry + tài liệu cùng PR (phase này chỉ docs LMS surface,
  không đổi registry — nhưng vẫn giữ nguyên tắc 1 PR đồng bộ).

## Related Code Files (docs)
- Modify `docs/17-lien-ket-vai-tro-va-luong.md`: thêm §"Trải nghiệm LMS theo vai trò" — bảng PH thấy
  (nhận xét buổi + trạng thái nghỉ học · điểm/kết quả bài · ảnh lớp · report card) / HS làm (bài tập,
  nộp, xem điểm, đổi sao) / **KHÔNG thấy** (phiếu thu, tiền, nội bộ ERP — quyết định PO 2026-07-10,
  "đừng quá quan trọng hệ thống với PH/HS những cái mang tính nội bộ").
- Modify `docs/16-brief-quyet-dinh-thiet-ke-adr.md`: ADR note mới (2 quyết định):
  (a) **Mật khẩu HS parent-mediated là thiết kế chính thức** — trẻ nhỏ, PH quản qua
  `resetChildPassword`; KHÔNG build self-service; gỡ nhãn "P0-debt".
  (b) **OTP delivery qua EmailOutbox với payload plaintext ngắn hạn** — trade-off đã cân nhắc + user
  chốt (validation 2026-07-10): scrub ở `sent`+`dead`+sweep-quá-TTL; row `failed` (đang retry) GIỮ code
  để resend, sống tối đa ~5' (TTL login). Bù bằng: TTL 5', single-use, cooldown 30s, gate-send-theo-
  ParentAccount, global otp-cap/giờ, không log payload. EmailOutbox không RLS/không facilityId → ghi rõ
  đây là bảng duy nhất chứa secret ngắn hạn, code đã hết hạn login khi lọt backup.
- Modify `apps/lms/src/pages/student/change-password.tsx`: sửa comment header + dòng "P0-debt" trong
  UI text → phản ánh quyết định chính thức (bỏ câu "sẽ được bổ sung trong phiên bản tiếp theo").
- Modify `docs/uat-checklist-go-live.md` KB1: bước 7 giữ (giờ khả thi nhờ Phase 1 — bỏ ghi chú seam
  nếu có); **bước 8 thay** "PH xem phiếu thu" → "PH xem điểm bài tập của con + thấy buổi nghỉ học
  hiển thị 'Nghỉ học'" (expected state cụ thể theo Phase 2). Đối chiếu Phụ lục 2A nếu chạm.
- Modify `docs/14-danh-muc-vai-tro-phan-quyen.md`: nếu thêm procedure LMS mới (submission/attendance
  listForChild) chạm bảng đại diện §5 → thêm dòng ghi chú LMS surface (không phải staff role matrix).
- Modify `docs/project-changelog.md`: entry sprint này.
- Harness memory (`C:\Users\manhquy\.claude\projects\D--project-vip-CMC\memory\`): cập nhật
  `cmc-role-reality-principle.md` — thêm định nghĩa LMS experience (PH/HS thấy gì, không thấy nội bộ,
  parent-mediated password); MEMORY.md hook line cập nhật nếu cần.

## Implementation Steps
1. Đọc từng doc hiện trạng trước khi sửa (quy tắc documentation-management).
2. Sửa theo danh sách trên, 1 PR docs (kèm sửa comment change-password.tsx — đổi chữ, không đổi hành vi).
3. Verify chéo: UAT KB1 mới ↔ Phase 2 success criteria ↔ TL17 §mới — 3 nơi phải khớp nhau từng ý.
4. Changelog + gates (docs không chạy test nhưng typecheck/build vẫn chạy vì đổi 1 file .tsx).

## Success Criteria
- [ ] TL17 có §LMS experience đầy đủ; TL16 có 2 ADR note; change-password.tsx hết chữ "P0-debt".
- [ ] UAT KB1 bước 8 mới khớp đúng tính năng Phase 2 đã build (không test tính năng không tồn tại).
- [ ] Harness memory cập nhật; changelog entry.
- [ ] Sweep chéo 3-nơi-khớp pass (bước 3).

## Risk Assessment
- **Docs tả trước code** → dependency 1+2 bắt buộc; executor không viết docs khi Phase 2 chưa merge.
- **UAT checklist bị sửa bởi 2 plan** (plan go-live cũng own file này) → phase này là single-writer
  cho KB1 amendment; ghi chú vào plan go-live khi merge để tránh sửa đè.
