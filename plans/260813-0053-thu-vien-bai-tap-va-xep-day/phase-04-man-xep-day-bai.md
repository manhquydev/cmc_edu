---
phase: 4
title: "Màn xếp dãy bài cho lớp"
status: pending
priority: P2
dependencies: [2]
---

# Phase 4 — Màn xếp dãy bài

`lmsOps.assignExerciseSequence` đã có, **chưa có màn**.

## Bố cục

Hai cột: thư viện bên trái · dãy của lớp bên phải. Kéo sang, sắp thứ tự.

## Phải hiện rõ

| | |
|---|---|
| Vị trí **đã phát** | **Khoá, không sửa được** — hiện rõ lý do |
| Vị trí kế tiếp | Sẽ phát vào buổi nào |
| Lớp **chưa có dãy** | **Cảnh báo đậm** — sau khi bỏ fallback, không dãy nghĩa là **không có bài tập nào** |
| Dãy **ngắn hơn** số buổi còn lại | Cảnh báo — lớp sẽ hết bài giữa chừng |

## Ràng buộc

- Chỉ bài `status = 'published'` xếp được vào dãy
- Phần đã phát đóng băng (`exercise-sequence.ts` đã có)
- Sửa dãy **không** làm lệch con trỏ phát bài
- **Không** tự lặp lại bài khi dãy ngắn

## Success Criteria

- [ ] Xếp được dãy ≥ 4 bài; phần đã phát khoá
- [ ] Cảnh báo hiện đúng cho lớp chưa có dãy và dãy ngắn
- [ ] `apps/admin` typecheck 0 lỗi, test xanh
