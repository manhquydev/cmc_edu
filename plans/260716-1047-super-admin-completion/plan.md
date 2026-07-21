---
title: "Hoàn thiện vai trò Super Admin (CMC)"
description: "4 hạng mục: siết gate màn hình, CRUD cơ sở, quản lý IP mạng + tự dò, nhật ký toàn hệ thống."
status: done
priority: P2
effort: ~5-7 ngày
branch: feat/super-admin-completion
tags: [super-admin, admin-ui, audit-log, facility, network-ip, rbac, tdd]
created: 2026-07-16
---

# Hoàn thiện vai trò Super Admin

Nguồn thiết kế: `plans/reports/brainstorm-260716-1047-super-admin-completion-report.md` (đã duyệt).
Chế độ: **TDD** — mỗi phase viết test khoá hành vi trước, rồi implement, rồi verify test xanh.

## Bối cảnh
`super_admin` = toàn quyền tuyệt đối, bypass registry `can()` (đúng thiết kế, không đổi). Scout phát hiện 4 khoảng trống trong bề mặt quản trị. PO đã chốt hướng cho cả 4 (xem báo cáo brainstorm).

## Phases (thứ tự: nhẹ → nặng)

| # | Phase | Trọng tâm | Status | Tiến độ |
|---|-------|-----------|--------|---------|
| 01 | [Siết gate màn hình theo role](phase-01-role-gate-tightening.md) | Frontend | done | 100% |
| 02 | [CRUD Cơ sở (tạo + sửa tên)](phase-02-facility-crud-ui.md) | Backend + Frontend | done | 100% |
| 03 | [Quản lý IP mạng + tự dò IP](phase-03-network-ip-management.md) | Backend + Frontend | done | 100% |
| 04 | [Nhật ký toàn hệ thống (middleware + màn xem)](phase-04-system-audit-log.md) | Backend + Frontend + Schema | done | 100% |

## Phụ thuộc
- Các phase **độc lập** về file ownership, có thể làm song song. Thứ tự gợi ý là theo rủi ro tăng dần.
- Phase 04 nặng nhất (đụng mọi mutation qua middleware) — làm cuối, sau khi các phase kia ổn định.
- Phase 02, 03, 04 đều gắn ghi-audit; nếu làm 04 trước thì 02/03 tự động được log qua middleware (giảm việc gắn tay). Nếu làm 04 cuối, 02/03 dùng ghi-audit tay tạm rồi middleware bao trùm sau — chấp nhận trùng vì middleware là nguồn chuẩn.

## Tiêu chí hoàn thành tổng
- 4 phase xanh test, typecheck sạch, build 0 lỗi.
- Không hồi quy: bộ test API hiện tại (839/839) vẫn xanh sau phase 04 (middleware không phá luồng cũ).
- Mọi màn hình admin có gate đúng + có hướng dẫn (không để tính năng trống).

## Quyết định PO (đã chốt qua red-team/validate 2026-07-16)
1. **Mã cơ sở**: admin tự gõ mã ngắn (bắt buộc nhập, không auto-sinh); trùng mã → báo lỗi thân thiện. Không cho sửa `code` sau khi tạo (chỉ sửa `name`).
2. **Dải mạng**: mỗi dải mặc định TẮT (`isActive=false`) khi thêm; admin bật thủ công qua công tắc sau khi kiểm tra. Thêm dải KHÔNG khoá hẳn nhân viên — chỉ khiến chấm công ngoài mạng cần lý do + tạo yêu cầu duyệt (ADR 0043).
3. **Nhật ký retention**: ghi TẤT CẢ mutation thành công + tự xoá dòng cũ hơn 12 tháng (cần cơ chế dọn định kỳ).
4. **Phạm vi nhật ký**: CHỈ ghi thao tác thành công (không ghi việc bị từ chối/đăng nhập sai giai đoạn này).

## Câu hỏi mở còn lại
1. ~~Nhánh làm việc~~ — CHỐT: `feat/super-admin-completion`, tách khỏi `main`.
2. ~~Cơ chế dọn log >12 tháng~~ — CHỐT: chạy trong worker loop sẵn có (`drainOnce`), nhưng qua **kết nối DB riêng có quyền cao** (`DATABASE_URL`, không phải `APP_DATABASE_URL`/`cmc_app`) — vì `AuditLog` đã bị thu hồi quyền UPDATE/DELETE của `cmc_app` (đảm bảo append-only), nên kết nối thường của app không thể tự xoá được. Quyết định do PO chọn qua AskUserQuestion khi implement phase 04 (giữ nguyên bất biến append-only cho mọi request thường, chỉ job dọn định kỳ này có quyền xoá).

## Kết quả triển khai (2026-07-16)
- Cả 4 phase done, TDD đầy đủ (red→green từng bước).
- Full API suite: 886/886 xanh (baseline 839 + net mới). Full admin suite: 255/255 xanh. Typecheck + build sạch cả 2 app.
- 2 migration tay: `facility_network_delete_grant` (cấp quyền DELETE cho `FacilityNetwork`, trước đó chỉ SELECT/INSERT/UPDATE), `audit_log_indexes` (index `createdAt` + `actor`).
- Middleware audit loại trừ ~25 path đã tự ghi audit tay từ trước (danh sách trong `apps/api/src/trpc.ts`, `AUDIT_EXCLUDED_PATHS`) — không ghi đôi.
- Đã chạy code-review agent trên toàn bộ diff branch trước khi bàn giao.
