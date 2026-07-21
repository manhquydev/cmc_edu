# Phase 06 — Phủ route generic + Quản trị

## Context links
- `docs/06` §3A/D/E (route học sinh/phụ huynh/lớp/khoá/admin/engagement), `docs/12` §5 (pattern List/Detail), `docs/14` (RBAC quản trị).
- Router: `student`, `guardian`, `classBatch`, `course`, `curriculumUnit`, `parentMeeting`, `afterSale`, `gift`, `rewards`, `assessment`/`reportCard`, `facility`, `user`, `reconciliation`, `facilityNetwork`. Permission: `user.manage`/`facilityNetwork.manage` (super_admin), `student.setLifecycle` (GĐ).

## Overview
- Ngày: 2026-07-07 · Priority: P1 · Status: pending · Review gate: **reviewer 1 vòng**.
- ~18 route chưa-thiết-kế phủ bằng template `generic-list` + `record-detail` (phase 02), cấu hình cột/field/tab — YAGNI, tối thiểu code riêng.

## Key insights
- Đây là phase **cấu hình template**, không dựng UI riêng. Mỗi route = 1 config (cột list, field detail, tab, permission gate). DRY tuyệt đối trên template phase 02.
- Định danh HS/PH: fullName + SĐT phụ huynh, KHÔNG mã HS (bất biến user).
- Màn Quản trị (`/admin/*`) gate super_admin/`facilityNetwork.manage` — nav ẩn với role khác.
- **Nhận xét/Học bạ** (`reportCard`/`assessment`): MVP **xem + sửa + confirm** ngay trên template Record Detail (KHÔNG màn soạn thảo riêng, KHÔNG hoãn). GV xem draft AI (`assessment.draft`), sửa nội dung, `assessment.confirm` để phát hành. AI draft-only + che PII (`docs/08` §7) — mọi nội dung AI chỉ là nháp tới khi GV confirm.

## Requirements (route → template)
1. **Học sinh** `/students` + tab `profile/enrollments/attendance/grades/guardians` (record-detail).
2. **Phụ huynh** `/parents` + tab `children/receipts` + **backfill email** (C1, phase-01b): field email PH có thể sửa để staff bổ sung email cho PH cũ (điều kiện login app email-OTP). PH chưa có email → badge "chưa đăng nhập app được".
3. **Lớp** `/classes` + tab `overview/students/sessions/enroll`; **Khoá** `/courses`; **Chương trình** `/curriculum`.
4. **Họp PH** `/parent-meetings`; **Chăm sóc KH/After-sale** `/crm/aftersale?queue=`; **Hoàn tiền** `/finance/refunds`.
5. **Học bạ** `/teaching/report-cards` → `/{studentId}`; **Duyệt cấp độ** `/level-progress` (lưu ý LevelProgress đã descope — nếu không có nguồn dữ liệu → EmptyState "chưa áp dụng", không dựng giả).
6. **Báo cáo điểm danh** `/teaching/attendance/report`.
7. **Engagement**: `/engagement/{badges,leaderboard,rewards}`, `/engagement/rewards` (đổi quà staff-side).
8. **Quản trị**: `/admin/facilities` + `/admin/users` + `/admin/network-ip` + `/settings/shift-config` (gate super_admin).
9. **Nhận xét/Học bạ AI**: MVP xem + sửa text + confirm trên template Record Detail (đã chốt 2026-07-07) — dùng `assessment` router draft→confirm; màn soạn thảo chuyên sâu để đợt sau.
10. **Notifications** `/notifications`, **Search** `/search?q=`: khung tối thiểu (list thông báo, kết quả tìm) nếu backend hỗ trợ; nếu không → EmptyState.

## Architecture notes
- Config-driven: mỗi route khai báo `{ query, columns, filters, detailTabs, permission }` đẩy vào template. Không copy-paste page.
- Route thiếu dữ liệu backend (level-progress descope, có thể notifications/search) → **EmptyState trung thực** ("chưa áp dụng"/"sắp có"), KHÔNG dựng dữ liệu giả (bất biến development-rules).
- `student.setLifecycle` (block LMS/withdraw) là hành động GĐ → ConfirmDialog nêu hệ quả, gate role.

## Related code files
- Đọc: các router liệt kê trên (`apps/api/src/{student,guardian,class,course,exercise,meeting,after-sale,rewards,gift,assessment,facility,user,reconciliation}/router.ts`).
- Thêm: `apps/admin/src/pages/**/*` config files (nhỏ) + đăng ký route trong `routes/index.tsx`.
- File ownership: mọi route CHƯA thuộc phase 03/04/05. Tránh trùng: kiểm route tree trước khi thêm.

## Implementation steps
1. Hoàn thiện template generic-list + record-detail (nếu phase 02 để mở).
2. Cấu hình từng route theo bảng §Requirements.
3. Gate quyền mỗi route (nav ẩn + 403 page).
4. EmptyState trung thực cho route thiếu nguồn dữ liệu.
5. Verify: mọi route render (không trắng, không giả data), gate đúng.

## Todo list
- [x] Template List/Detail hoàn thiện
- [x] Học sinh/Phụ huynh/Lớp/Khoá/Chương trình
- [ ] Họp PH/After-sale/Hoàn tiền — không có backend endpoint phù hợp; EmptyState cần thêm sau
- [x] Học bạ/Duyệt cấp độ/Báo cáo điểm danh — level-progress descoped → EmptyState ✓; report-cards ✓ tại /admin/report-cards (ticked 2026-07-12 — narrative already confirmed done)
- [x] Engagement (badges/leaderboard/rewards) — gifts ✓; rewards/leaderboard → EmptyState trung thực
- [x] Quản trị (facilities/users/network-ip/shift-config)
- [x] Nhận xét/Học bạ xem+confirm — assessment.draftComment → confirm flow tại /admin/report-cards
- [ ] Notifications/Search khung — không có backend endpoint → bỏ qua (YAGNI)
- [x] Verify render + gate mọi route — typecheck xanh trên phase-06 files

## Success criteria
- Mọi route trong `docs/06` §3 render đúng (list/detail/tab), không trang trắng, không dữ liệu giả.
- Nav quản trị ẩn với role không phải super_admin; 403 khi ép truy cập.
- Route thiếu nguồn (level-progress) hiện EmptyState trung thực.
- Định danh HS bằng fullName + SĐT (không mã HS).
- **Verify**: build/typecheck xanh; smoke render toàn route tree; test gate admin.
- **Review**: reviewer 1 vòng — kiểm DRY (config-driven, không copy page), gate, không-giả-data.

## Risk assessment
| Rủi ro | K×I | Giảm thiểu |
|---|---|---|
| Copy-paste page thay vì config (vi phạm DRY) | TB×TB | template config-driven; review chặn |
| Dựng data giả cho route thiếu backend | TB×Cao | EmptyState trung thực; dev-rules cấm giả |
| AI authoring scope creep | TB×TB | MVP xem+confirm; authoring đầy đủ = phase riêng |
| Route trùng ownership phase 03-05 | Thấp×TB | kiểm route tree trước thêm |

## Security considerations
- Quản trị gate super_admin/`facilityNetwork.manage` — server chặn, UI ẩn.
- `student.setLifecycle` (block LMS) là hành động nhạy trẻ em — ConfirmDialog + gate GĐ + audit backend.
- Nhận xét AI: draft-only, che PII trước khi hiển thị.

## Next steps
→ Phase 07 LMS; phase 08 đồng bộ docs cho route mới.
