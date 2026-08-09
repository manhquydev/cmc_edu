---
phase: 1
title: "P1 — Báo cáo tuyển sinh"
status: in-progress
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 01 — P1: Báo cáo tuyển sinh

## Overview
Thêm một màn hình **Báo cáo** cho phễu tuyển sinh: tỷ lệ chuyển đổi qua từng bước, lý do mất, hiệu quả theo kênh nguồn và theo tư vấn viên. Chỉ đọc dữ liệu đã có — không đổi quy trình, không đổi cấu trúc dữ liệu.

## Giá trị nghiệp vụ (cho người nghiệm thu)
- GĐKD ra quyết định bằng số liệu thay vì cảm tính.
- Tạo **số liệu nền** để sau này chứng minh P2/P4 có giảm rơi lead thật.
- Là màn hình dễ ngồi cùng người dùng thật nhất → dùng làm điểm bắt đầu buổi UAT.

## Nghiệm thu tính năng (điều kiện chấp nhận — demo được ngay)
- [ ] GĐKD trả lời <1 phút, ngay trên màn hình: "rớt nhiều nhất vì lý do gì", "kênh nào ra nhiều học viên nhất", "tỷ lệ chuyển đổi theo từng tư vấn viên".
- [ ] **Tư vấn viên xem được** tổng phễu + lý do mất + hiệu quả kênh của cơ sở; **nhưng KPI theo người chỉ thấy của chính mình** (không thấy của đồng nghiệp). GĐKD thấy toàn đội. (Kiểm thử phân quyền phải xác nhận đúng cả 2 vế.)
- [ ] Ba loại số liệu hiển thị **có nhãn thời gian rõ ràng** (xem dưới), không gây đọc nhầm.
- [ ] Không màn hình/thao tác nào lộ dữ liệu của cơ sở khác.

## Chỉ số kết quả nghiệp vụ (theo dõi, KHÔNG chặn sign-off)
- Báo cáo được GĐKD dùng thật trong họp tuần ≥ 2 tuần liên tiếp.

## Requirements
- Functional:
  - Trang báo cáo với 3 khối số liệu, **mỗi khối ghi rõ mốc thời gian**:
    1. **Ảnh chụp phễu hiện tại** (không lọc ngày): số cơ hội đang ở mỗi bước — tái dùng `stageCounts` sẵn có.
    2. **Nhóm lead vào theo kỳ** (lọc theo ngày tạo): lead vào trong kỳ → bao nhiêu đã nhập học. Hiển thị cảnh báo "kỳ gần đây chưa đủ thời gian chuyển đổi" (right-censoring) hoặc loại kỳ quá sát hiện tại. *(Khối khó hiểu nhất với người nghiệm thu — nếu UAT đầu thấy rối, có thể ẩn tạm, giữ nguyên trong plan.)*
    3. **Kết quả đóng trong kỳ** (lọc theo ngày đóng `closedAt`): nhập học vs mất, phân bố lý do mất, hiệu quả theo kênh nguồn của các ca ĐÓNG.
  - Hiệu quả "kênh nào ra nhập học" tính theo **ngày đóng** (kết quả), KHÔNG trộn với nhóm-vào-theo-kỳ.
  - **Baseline cho P2/P4:** khối (3) phải hiện tỷ lệ mất theo từng lý do (gồm "không phản hồi") — đây là con số nền để P4 đối chiếu. (Con số nền cho "cảnh báo nguội" do chính P2 chụp ở tuần đầu, không thuộc P1.)
  - Lọc theo khoảng thời gian.
- Non-functional:
  - Quyền: key phân quyền mới `crm.report` mở cửa cho `giam_doc_kinh_doanh` + `sale`. **Việc lọc own-only cho KPI-theo-người của sale là logic tầng thủ tục** (thêm điều kiện `assignedToId = currentUser` cho riêng khối KPI-theo-người), giống tiền lệ `crm.opportunityAssign`. Registry KHÔNG diễn đạt được own-only — đừng nhầm mở-cửa với thực thi.
  - RLS `facilityId` áp trên mọi truy vấn (belt-and-braces: luôn kèm `facilityId`; nếu dùng SQL thô cho aggregate thì tự thêm `facilityId`).

## Architecture
- Backend: procedure tRPC read-only mới trong `crmRouter` (đề xuất `opportunityReport`). Aggregate qua Prisma `groupBy` theo `stage`, `source`, `lostReason`, `assignedToId` + điều kiện thời gian, chạy trong `withFacility`. Tách helper `apps/api/src/crm/opportunity-report.ts` nếu query lớn.
- Frontend: theo **khuôn báo cáo đã có** `apps/admin/src/pages/finance/revenue-report.tsx` (DRY) — bảng số + tỷ lệ %, **không thêm thư viện biểu đồ mới**.

## Related Code Files
- Create: `apps/api/src/crm/opportunity-report.ts` (nếu cần), `apps/admin/src/pages/crm/report.tsx`, journey `apps/e2e/.../crm-report.journey.ui.spec.ts`.
- Modify: `apps/api/src/crm/router.ts` (thêm procedure, tái dùng `NOT_LOST_WHERE` tại `:92-94` / `LOST_WHERE` tại `:96-99`), `apps/admin/src/routes/crm.routes.tsx`, `packages/auth/src/index.ts` (thêm `crm.report`).
- Reference: `apps/admin/src/pages/finance/revenue-report.tsx` + test aggregate của nó.

## Implementation Steps
1. `impact({target:"opportunityList", direction:"upstream"})` trước khi tái dùng helper/where.
2. Thêm key `crm.report` vào registry; thực thi lọc own-only KPI-theo-người trong procedure.
3. Viết procedure report + unit test aggregate (bắt buộc case lead-vào-kỳ-trước-đóng-kỳ-này để chốt semantics thời gian; case sale-A-không-thấy-KPI-sale-B).
4. Kiểm seed/fixture e2e đủ đa dạng `source`/`lostReason`; nếu thiếu, thêm seed.
5. Trang UI theo khuôn revenue-report; nhãn thời gian mỗi khối rõ ràng.
6. Chuẩn bị dữ liệu mẫu môi trường demo (§7 plan).
7. Journey ui-e2e; `pnpm acceptance:report`; `detect_changes(compare main)`; PR.

## Success Criteria
- [ ] Số report khớp đối chiếu SQL tay 1 lần trên seed.
- [ ] Sale không xem được KPI-theo-người của sale khác; vẫn xem được khối tổng (test phân quyền 2 vế).
- [ ] `typecheck-and-test` + `ui-e2e` xanh; journey report proven; 3 journey CRM cũ không hồi quy.

## Risk Assessment
- Read-only, không schema → rollback = gỡ procedure + trang. Không ảnh hưởng dữ liệu.
- Rủi ro chính = **đọc nhầm số** do trộn mốc thời gian → giảm thiểu bằng nhãn rõ + unit test semantics.
- Aggregate nặng nếu bảng lớn → chỉ thêm index khi đo thấy chậm (YAGNI).

## Phụ lục kỹ thuật
- `opportunityList` hiện chỉ `groupBy:['stage']` (`crm/router.ts:411-420`); dữ liệu đủ: `source` (`schema.prisma:288`, chỉ zod-enum), `lostReason` (DB enum `:48-55,:280`), `assignedToId` (indexed `:287,297`), `closedAt` (`:281`).
- RLS trên `groupBy` an toàn: `withFacility` set GUC transaction-local, Postgres lọc dòng trước khi aggregate (red-team xác minh tại `packages/db/src/index.ts:118`).
