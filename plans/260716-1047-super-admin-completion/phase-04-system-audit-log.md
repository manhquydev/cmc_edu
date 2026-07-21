# Phase 04 — Nhật ký toàn hệ thống (middleware + màn xem)

## Context links
- Parent: [plan.md](plan.md)
- Design: brainstorm report (hạng mục B)
- Nặng nhất — làm cuối. Độc lập file, nhưng đụng MỌI mutation qua middleware.

## Overview
- Date: 2026-07-16
- Mô tả: PO chốt "ghi TẤT CẢ thao tác thêm/sửa/xoá". Làm bằng **middleware ghi tự động tại 1 điểm chốt** (mọi mutation tRPC) thay vì gắn tay từng chỗ. Thêm màn hình xem nhật ký với bộ lọc mạnh.
- Priority: P2 (giá trị cao, rủi ro cao nhất)
- Implementation status: done
- Review status: done (1 Critical + 1 Medium finding fixed, re-verified)

## Key Insights
- Model `AuditLog` (schema.prisma:962) đã có: `actor/action/entity/entityId/data/createdAt`, GLOBAL (không facilityId, không RLS), chỉ index `[entity,entityId]`.
- Đang ghi tay ~15 chỗ (finance approve, updateRoles, facility.create...). Gắn tay không nhất quán, đã sót (`user.create`/`user.update` không ghi).
- **Lý do chọn middleware**: gắn tay ~100 chỗ chắc chắn sót → lỗ hổng nhật ký thầm lặng (đúng loại lỗi "tests passing ≠ behavior running" journal Phase 9). Middleware = đầy đủ tuyệt đối + DRY + 1 điểm bảo trì.
- Volume lớn → cần index `createdAt` (+ `actor`) cho màn lọc; AuditLog global nên super_admin xem tổng hợp lý.

## Requirements (đã chốt qua red-team)
- **Middleware audit** bọc mọi mutation tRPC: **CHỈ khi mutation THÀNH CÔNG** (PO chốt: không ghi việc thất bại/bị từ chối giai đoạn này) → ghi 1 AuditLog `{ actor, action: '<router.procedure>', entity, entityId: best-effort, data: input đã lọc }`. CHỈ ghi mutation (bỏ query).
- **Người thực hiện (`actor`)** phải bao cả 3 loại phiên: nhân viên (`subject.userId`), phụ huynh/học sinh (`lmsSubject` → ghi `parent:<id>`/`student:<id>`), và public/không phiên (vd đăng nhập) → `anonymous`. Không được rơi khi phiên không phải staff.
- **Retention**: cơ chế dọn tự xoá AuditLog cũ hơn **12 tháng** (chạy trong worker loop sẵn có — xem `apps/api/src/worker` — hoặc cron; chốt khi implement). Có test cho mốc cắt.
- **Dọn trùng**: middleware là nguồn CHUẨN cho log dạng "đã xảy ra hành động X". Với ~15 site ghi tay hiện có: nếu chúng ghi ngữ nghĩa GIÀU hơn (vd finance approve ghi before/after số tiền) thì GIỮ và cho middleware BỎ QUA path đó (danh sách loại trừ); nếu chỉ ghi trùng chung chung thì GỠ ghi tay. Quy tắc: **không bao giờ 2 bản ghi cho 1 lần gọi**.
- **Backend `audit.list`** (super_admin-gated): phân trang + lọc theo `actor`, `action`, `entity`, khoảng `createdAt`; sắp mới→cũ.
- **Schema**: thêm index `createdAt` (và `actor`) cho AuditLog → migration.
- **Frontend** `/admin/audit-log`: bảng ai-làm-gì-khi-nào + bộ lọc (người/loại việc/đối tượng/thời gian), phân trang. Nav child mới.
- Bảo mật dữ liệu nhạy cảm: middleware KHÔNG ghi mật khẩu/OTP/token/secret vào `data` (denylist field).

## Architecture
- Middleware đặt tại `apps/api/src/trpc.ts` (nơi định nghĩa procedure) — bọc `protectedProcedure`/mutation. Cần phân biệt mutation vs query (tRPC `type`). Ghi async best-effort NHƯNG không nuốt lỗi ghi thầm lặng (log lỗi ghi audit).
- `entity`/`entityId` suy từ tên path + input phổ biến (`id`, `receiptId`...). Chấp nhận best-effort; path (`action`) là trường luôn chính xác.
- Denylist field nhạy cảm khi serialize `data` (password, otp, token, secret...).
- `audit.list`: router mới `apps/api/src/audit/router.ts`, đọc AuditLog global (không `withFacility`), gate super_admin.
- Frontend: trang mới + nav child, khuôn bảng+lọc giống các list hiện có.

## Related code files
- Sửa: `apps/api/src/trpc.ts` (middleware audit) + test mới
- Tạo: `apps/api/src/audit/router.ts` (+ test)
- Sửa: `apps/api/src/router.ts` (đăng ký)
- Sửa: `packages/db/prisma/schema.prisma` (index) + migration mới
- Dọn trùng (khảo sát): ~15 site ghi tay hiện có (finance/router.ts, user/router.ts...)
- Tạo: `apps/admin/src/pages/admin/audit-log.tsx` (+ test)
- Sửa: `apps/admin/src/shell/nav-registry.ts` (+ test) — nav child
- Sửa: routes admin (`admin.routes.tsx`) — đăng ký route

## Implementation Steps (TDD)
1. **Test middleware trước**: gọi 1 mutation staff → đúng 1 AuditLog (action=path, actor=userId); mutation LMS → actor=`parent:/student:`; mutation public (login) → actor=`anonymous`; gọi query → KHÔNG ghi; mutation ném lỗi → KHÔNG ghi; field nhạy cảm (password/otp) KHÔNG có trong `data`. Đỏ.
2. Implement middleware → xanh. Chạy FULL API suite (839) → phải xanh, không hồi quy (middleware không đổi kết quả/loại lỗi mutation cũ). **Cửa quan trọng nhất.**
3. **Dọn trùng**: khảo sát ~15 site ghi tay; lập danh sách loại trừ cho path ghi-giàu (giữ), gỡ path ghi-trùng chung chung. Test: mỗi luồng (finance approve, updateRoles, facility.create) đúng 1 bản ghi.
4. **Migration index** AuditLog `createdAt`(+`actor`); test không phá schema.
5. **Retention**: implement job dọn >12 tháng (worker loop/cron); test mốc cắt (dòng 11 tháng giữ, 13 tháng xoá).
6. **Test `audit.list`**: super_admin lọc theo actor/action/entity/date + phân trang; non-super_admin FORBIDDEN. Đỏ → implement → xanh.
7. **Frontend**: bảng + lọc + phân trang; gate super_admin; nav child + route. Test render/lọc/phân trang. Đỏ → implement → xanh.

## Todo list
- [ ] Middleware audit (3 loại actor, chỉ-thành-công, denylist) + test (đỏ→xanh)
- [ ] FULL API suite regression (cửa chính)
- [ ] Dọn trùng site ghi tay (danh sách loại trừ)
- [ ] Migration index AuditLog
- [ ] Retention job >12 tháng + test mốc cắt
- [ ] `audit.list` + test
- [ ] Màn hình audit-log + nav + route + test

## Success Criteria
- Mọi mutation thành công (staff/LMS/public) → có đúng 1 bản ghi nhật ký, không sót, không ghi đôi.
- Không ghi query, không ghi khi lỗi, không lộ field nhạy cảm.
- Log cũ >12 tháng tự bị dọn.
- super_admin xem + lọc nhật ký qua UI, không cần đụng DB.
- FULL API suite (839) vẫn xanh sau middleware; typecheck/build sạch.

## Risk Assessment
- **Cửa lớn nhất**: middleware đụng mọi mutation → nguy cơ hồi quy/độ trễ. Mitigation: middleware chỉ chạy SAU khi mutation thành công, ghi best-effort, không đổi giá trị trả về/loại lỗi; chạy full suite làm gate bắt buộc.
- Volume log tăng nhanh → index + backlog retention (câu hỏi mở, không chặn phase).
- Ghi đôi khi vừa có middleware vừa còn ghi tay → bước dọn trùng bắt buộc.
- Best-effort `entityId` có thể trống vài path → chấp nhận; `action` luôn đúng.

## Security Considerations
- Denylist field nhạy cảm (password/otp/token/secret) trong `data`.
- `audit.list` super_admin-only; AuditLog global (không rò cross-facility cho role thường vì role thường không tới được endpoint).
- Không nuốt lỗi ghi audit thầm lặng — log ra để phát hiện thủng nhật ký.

## Next steps
- Hoàn tất 4/4 → chạy code-review + finalize (project-management sync, docs, journal).
- Backlog: retention policy cho AuditLog.
