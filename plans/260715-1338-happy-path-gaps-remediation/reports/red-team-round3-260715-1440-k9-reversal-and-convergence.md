# Red-Team Round 3 — Đảo K9, mở rộng chặn trùng, hội tụ

**Ngày:** 2026-07-15 · **Trọng tâm:** mâu thuẫn giữa quyết định vòng 2 và code hiện có; tình huống con của "chặn trùng SĐT". **Kết luận:** plan hội tụ sau vòng này.

## Phát hiện + phán quyết PO

| # | Phase | Phát hiện (đọc code) | Phán quyết PO | Thay đổi |
|---|---|---|---|---|
| E5 | 5 | **Mâu thuẫn với E1:** E1 (vòng 2) chốt huỷ phiếu giữ login con. Nhưng `getApprovedChildren:80-85` (K9) ẩn con khi mọi enrollment `withdrawn` → con vào được nhưng phụ huynh không thấy con. Ngược đời. | Phụ huynh **vẫn thấy** con (đảo K9) | Phase 5: bỏ ẩn theo enrollment; chỉ ẩn `blocked_lms`+`withdrawn`; viết lại test K9 |
| E6 | 7 | "Chặn khác tên" (E4) bỏ sót trùng-SĐT-tên-GIỐNG-không-studentId → vẫn tạo nhầm bé (đúng bug gốc) | Chặn **mọi lúc** trùng SĐT chưa chỉ rõ bé | Phase 7: điều kiện chặn rộng hơn (bất kể tên) |
| E7 | 6 | Giới hạn xin mã OTP để "N" mơ hồ | Mặc định 5/15phút/identifier (placeholder) | Phase 6: hằng số cụ thể |

## Cảnh báo quan trọng (đảo quyết định cũ)
E5 **đảo K9** — một remediation cũ có test khẳng định hành vi ẩn. Đây là quyết định PO mới hợp lệ (phụ huynh xem lịch sử con mình, rủi ro riêng tư thấp), KHÔNG phải regression. Phase 5 đã: (a) ghi rõ đảo K9; (b) budget cập nhật test K9 cũ (`guardian/link.test.ts`, `lms-auth/login.test.ts`); (c) giữ đường "xoá hẳn" qua huỷ `void`.

## Whole-plan consistency sweep (sau vòng 3)
- E1 (giữ login) ↔ E5 (phụ huynh vẫn thấy): giờ NHẤT QUÁN — cả con lẫn phụ huynh đều xem được sau huỷ-thường; chỉ `void` cắt cả hai.
- Phase 5: filter lifecycle nhất quán giữa Requirements + architecture + steps (a–e) + success + risk.
- Phase 7: điều kiện chặn rộng nhất quán giữa Requirements + steps (a–f) + success.
- plan.md bảng vòng 2 + vòng 3 ↔ phase: khớp.
- Không còn mâu thuẫn tồn đọng.

## Đánh giá hội tụ
3 vòng review đã xử: vòng 1 (8 điểm kỹ thuật), vòng 2 (4 edge-case sản phẩm), vòng 3 (3 mâu thuẫn/mở rộng, gồm 1 đảo-quyết-định-cũ). Các vấn đề còn lại đều là chi tiết impl sẽ chốt khi code (chữ ký hàm, fixture) — không cần thêm quyết định PO. **Khuyến nghị: chốt plan, sang /ck:cook.** Vòng 4 sẽ lợi ích giảm dần.

## Còn mở (không chặn)
- Phase 1-V2: tách sub-plan frontend hay không (chờ số liệu Phase 1).
- Phase 3: rà & gán GV cho lớp `null` trước khi bật gate.
