---
type: brainstorm-report
date: 2026-07-16 10:47
slug: super-admin-completion
branch: main
flags: []
status: design-approved
---

# Brainstorm: Hoàn thiện vai trò Super Admin (CMC)

## Bối cảnh
Scout hệ thống hiện trạng vai trò `super_admin` (3 agent song song: backend API, frontend admin, docs/plans). PO xác nhận: super_admin = toàn quyền tuyệt đối, tách biệt 4 role nghiệp vụ (đúng thiết kế, `packages/auth/src/index.ts:74-91` map permission facility/user/facilityNetwork về mảng rỗng → chỉ super_admin bypass pass). Từ scout, phát hiện 4 khoảng trống cần hoàn thiện. PO đã quyết hướng cho cả 4.

## Hiện trạng (bằng chứng)
- **Facility**: chỉ `facility.create` + `facility.list` (apps/api/src/facility/router.ts). Không có update/deactivate. Model `Facility` (schema.prisma:230) KHÔNG có cột `isActive`/`updatedAt`. UI `facilities.tsx` chỉ list read-only.
- **Audit**: model `AuditLog` (schema.prisma:962, GLOBAL — không facilityId, không RLS, chỉ index `[entity,entityId]`) đã có, ghi ~15 chỗ. `user.create`/`user.update` KHÔNG ghi (chỉ `updateRoles` ghi). Không có endpoint đọc + không có UI xem.
- **Gate màn hình**: `facilities.tsx:53-56` + `users.tsx:307-310` có `canDo()` gate. `shift-config.tsx` KHÔNG có gate (server-side vẫn chặn đúng qua `requirePermission('shift','manage')` → không phải lỗ hổng bảo mật, chỉ UX). Không có top-level role guard (`routes/index.tsx` chỉ check session tồn tại).
- **Network IP**: model `FacilityNetwork` (schema.prisma:1100, cidr+label+isActive) đã có. Permission `facilityNetwork.manage` đã đăng ký nhưng KHÔNG có endpoint nào dùng — checkin/router.ts:200 chỉ READ. UI `network-ip.tsx` là placeholder "deferred to phase-08". → Backend + frontend đều thiếu. Khả thi nút tự-điền: `ctx.ip` (context.ts) đã có địa chỉ caller.

## Quyết định PO (chốt)
1. Super admin toàn quyền tuyệt đối — đúng thiết kế, không đổi.
2. Facility: làm **Tạo + Sửa tên** (KHÔNG làm deactivate giai đoạn này).
3. Audit: **ghi TẤT CẢ thao tác thêm/sửa/xoá toàn hệ thống**, xem qua UI.
4. Gate: siết chặt, ẩn màn hình + menu với role không phụ trách.
5. Network IP: xây UI, nút "lấy IP hiện tại → admin xác nhận → lưu" + hướng dẫn nhập tay.

## Thiết kế được duyệt (4 hạng mục độc lập)

### A — Facility UI (Tạo + Sửa tên)
Thêm form tạo/sửa trên `facilities.tsx`. Backend cần thêm `facility.update` (đổi name; code có thể giữ bất biến hoặc cho sửa — quyết ở plan). Gắn audit write. Không đụng schema.

### B — Nhật ký hoạt động (ghi tất cả + màn hình xem)
**Kiến trúc khuyến nghị (quan trọng): ghi tự động tại 1 điểm chốt** (tRPC middleware bọc mọi mutation) thay vì gắn tay từng endpoint.
- Lý do: gắn tay ~100 chỗ chắc chắn sót → lỗ hổng nhật ký thầm lặng (đúng loại lỗi "tests passing ≠ behavior running" của journal Phase 9). Middleware = đầy đủ tuyệt đối + DRY + 1 điểm bảo trì.
- Màn hình `/admin/audit-log`: bảng ai-làm-gì-khi-nào, **bộ lọc mạnh** (actor/action/entity/date), mặc định đẩy việc quan trọng lên. Cần thêm index (`createdAt`, `actor`) cho hiệu năng vì volume lớn.
- Backend: `audit.list` (super_admin-gated, phân trang + filter).

### C — Siết gate theo vai trò
Áp khuôn `canDo()` cho `shift-config.tsx` + ẩn nav item với role không phụ trách (không chỉ chặn trang). Cân nhắc top-level guard cho `/admin/*`.

### D — Network IP UI + tự điền
Backend: `facilityNetwork.list/create/update/delete` (super_admin-gated) + `facilityNetwork.detectMyIp` trả `ctx.ip` → gợi ý CIDR. Frontend `network-ip.tsx`: CRUD dải mạng + nút "Lấy IP hiện tại của tôi" + hướng dẫn nhập tay. Gắn audit write.

### Thứ tự gợi ý
C (nhẹ) → A → D → B (nặng nhất, đụng toàn hệ thống qua middleware).

## Rủi ro / lưu ý
- **B là hạng mục nặng nhất**: middleware audit đụng mọi mutation → phải test kỹ không làm chậm/hỏng luồng hiện có. Volume log lớn → cần index + chiến lược lưu trữ/xoá cũ (retention) về sau.
- Facility "sửa code" có thể phá vỡ mã lớp học đã phát hành (`{facility.code}` nằm trong class-code) → nên khoá sửa code, chỉ cho sửa name. Quyết ở plan.
- Middleware audit cần loại trừ query (chỉ ghi mutation) và tránh ghi trùng với ~15 chỗ đang ghi tay (dọn về 1 nguồn).

## Câu hỏi mở
1. Audit retention: giữ log bao lâu? (chưa quyết — để plan/về sau)
2. Facility.update có cho sửa `code` không, hay chỉ `name`? (khuyến nghị chỉ name)
3. Top-level `/admin/*` role guard: làm luôn ở hạng mục C hay để riêng?
