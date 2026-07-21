# Red-Team Review — Happy-path Gaps Remediation Plan

**Ngày:** 2026-07-15 · **Đối tượng:** plan 8 phase · **Kết quả:** 8 điểm yếu tìm thấy, đã vá tất cả vào phase files.

| # | Phase | Điểm yếu | Vá |
|---|---|---|---|
| RT1 | 2 (C1) | "Re-read status" chỉ thu hẹp race (READ COMMITTED), không đóng; reconcile backstop **chạy thủ công** (chưa có scheduler) → có thể không bao giờ chạy | Đổi sang cặp `SELECT ... FOR UPDATE` (enrollment ↔ cancel) để serialize thật; reconcile hạ xuống lưới đỡ #2, ghi rõ không phải phòng tuyến chính |
| RT2 | 3 | Fail-closed có thể khoá nhầm giáo viên thật nếu prod có GV không AppUser? | Xác minh: `checkin.punch:175` đã bắt buộc staff có AppUser → fail-closed an toàn prod; thêm mục "Prod-safety" giải trình |
| RT3 | 6 | Full unique `(facilityId,receiptId,kind)` chặn re-flag hợp lệ sau dismiss | Bắt buộc **partial unique `WHERE status='open'`** qua raw SQL migration; nêu rõ lý do vòng đời flag |
| RT4 | 7 | Trigger recompute từ `markAll` có thể chạy N lần (per-enrollment); chưa rõ `recomputeFinalGrade` có scope period | Verify chữ ký trước; gom UNIQUE (studentId, period) recompute 1 lần/cặp; chống vòng lặp |
| RT5 | 4 | `warning` single-field nuốt cảnh báo khi trúng cả SINGLE_PUNCH + PAYSLIP_FINALIZED | Chốt đổi `warnings: string[]` + sweep call site; test case 2-warning |
| RT6 | plan | Parallel note sai — P3 và P7 đều sửa `attendance/router.ts` | Sửa note: P3 trước P7, không song song 2 phase này |
| RT7 | plan | TDD "no regression" không đo được nếu baseline chưa biết xanh | Thêm Precondition BẮT BUỘC: chạy full suite xác nhận baseline xanh trước Phase 2 |
| RT8 | 2 | Test đua khó dựng deterministic trong vitest | Thêm fallback: test đơn luồng "cancelled trước enrollment → abort" bao phủ nhánh guard nếu không dựng được đua thật |

## Whole-plan consistency sweep
- Parallel/execution note ↔ phase deps: nhất quán sau RT6 (P3→P7).
- Phase 4 dùng `warnings[]` xuyên suốt (architecture + steps + risk): nhất quán sau RT5.
- Không còn thuật ngữ "chỉ thu hẹp race" mâu thuẫn với "đóng race" ở Phase 2 sau RT1.
- Loại-khỏi-scope (3 việc âm + rule 0-công) nhất quán giữa plan.md và Phase 4/7: OK.

Không còn mâu thuẫn tồn đọng.
