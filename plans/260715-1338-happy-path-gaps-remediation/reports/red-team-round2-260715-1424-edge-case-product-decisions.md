# Red-Team Round 2 — Edge Cases cần quyết định sản phẩm

**Ngày:** 2026-07-15 · **Trọng tâm:** tình huống hiếm mà plan chưa nói rõ cách xử lý, cần phán quyết PO (không tự quyết được).

## Edge cases phát hiện + phán quyết PO

| # | Phase | Edge case (đọc code xác nhận) | Phán quyết PO | Thay đổi plan |
|---|---|---|---|---|
| E1 | 2 | `runCancelTransaction:395-430`: huỷ phiếu withdraw enrollment nhưng **KHÔNG** đụng StudentAccount → con đã học rồi hoàn tiền vẫn đăng nhập LMS. Bug hay intended? | Giữ login, chỉ rút chỗ | Ghi rõ scope C1 = chỉ chặn race; không khoá login |
| E2 | 4 | `ensureDayTicket:91-92` return sớm khi all-in-network → bấm 1 lần trong mạng quên bấm ra = 0 công, KHÔNG phiếu, KHÔNG cảnh báo. Phase 4 (chỉ warn phiếu) bỏ sót case này | Để tự chịu, không nhắc | Ghi rủi ro chấp nhận; không mở rộng Phase 4 |
| E3 | 3 | Helper để lớp `teacherAppUserId=null` pass → mọi GV thao tác được lớp chưa gán. Intended? | Chặn GV, chỉ giám đốc | Helper thêm nhánh null→forbidden; +1 test case; +rủi ro vận hành (gán GV trước) |
| E4 | 7 | Trùng SĐT khác tên chỉ soft-warn → dễ tạo hồ sơ trùng khi gõ nhầm tên | Chặn + bắt sale xác nhận | receiptCreate thêm cổng chặn + cờ `confirmNewStudent`; đổi từ label-fix → workflow-change; sweep UI+e2e |

## Edge cases tự quyết theo nếp hệ thống (không cần hỏi)
- **Recompute FinalGrade sau khi báo cáo đã hiển thị:** reportCard tính live sẵn → recompute chỉ để FinalGrade khớp; không tạo mâu thuẫn "đã gửi". Không cần warn-gate.
- **Đặt trùng giờ họp:** cảnh báo không chặn (họp việc nhẹ).

## Whole-plan consistency sweep (sau round 2)
- Phase 2: scope C1 nhất quán (chặn race, giữ login) giữa Requirements + quyết định PO + reconcile behavior.
- Phase 3: null-class rule nhất quán giữa Requirements + code sketch + test steps (6 case) + success criteria + risk.
- Phase 4: in-network-single-punch = accepted risk, nhất quán với "chỉ warn phiếu".
- Phase 7: block+confirm nhất quán giữa Requirements + files + steps (a/b/c/d) + success + risk.
- plan.md bảng "PO vòng 2" ↔ từng phase: khớp.
- Không còn mâu thuẫn tồn đọng.

## Còn mở (không chặn plan)
- Phase 1-V2: có tách sub-plan frontend authz không (chờ số liệu Phase 1).
- Phase 3: rà & gán GV cho lớp null trước khi bật gate (vận hành, đầu Phase 3).
