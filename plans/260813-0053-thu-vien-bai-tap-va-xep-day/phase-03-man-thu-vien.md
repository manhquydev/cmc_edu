---
phase: 3
title: "Màn thư viện bài tập"
status: pending
priority: P2
dependencies: [2]
---

# Phase 3 — Màn thư viện

Thay màn `exercises.tsx` hiện tại (đang chọn unit) bằng thư viện theo thư mục.

## Bố cục

Cây thư mục bên trái · danh sách bài bên phải. Mỗi bài hiện **tên**, loại, trạng thái, và
**có đang nằm trong dãy của lớp nào không**.

## Thao tác

Tạo/đổi tên/ẩn thư mục · tải bài lên vào thư mục · đổi thứ tự trong thư mục · publish/close bài.

## Ràng buộc

- Ẩn thư mục **không** đụng dãy đã gán của lớp
- Giữ ngôn ngữ thiết kế và component sẵn có của `apps/admin`
- Có tìm kiếm khi danh sách dài

## Success Criteria

- [ ] Quản được thư mục và bài không cần vào cơ sở dữ liệu
- [ ] `apps/admin` typecheck 0 lỗi, test xanh
