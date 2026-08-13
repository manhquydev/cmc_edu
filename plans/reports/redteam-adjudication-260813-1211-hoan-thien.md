# Phân xử red-team — plan hoàn thiện sản phẩm (2026-08-13)

**Plan:** `plans/260813-1211-hoan-thien-san-pham-meter-va-diem-nghen/`  
**Lenses:** [Security](69ea8981-b890-47df-b514-ad204305bf3f) · [Assumption Destroyer](100e0b75-b969-4103-8207-c1ae062ef919) · [Failure Mode](1a569f66-4abf-4245-a31e-7f5f5c3a0782)

**Kết quả:** plan **giữ**, đã vá. Premise “student home chết vì chưa có UI Phát bài” **sai** — worker đã `deliverDueExercises`. Premise “xóa DOCUMENTED_GAPS vì UI tồn tại” **sai** — orphan ratchet đỏ `ui-e2e` nếu chưa claim `expected.trpc`.

Dispositions: Accept toàn bộ finding Security (8) + AD/FM (16 unique); Reject 0; Defer `unarchiveEnrollment` UI.

Bảng đầy đủ + consistency sweep (0 contradiction) nằm trong `plan.md` mục Red Team Review.
