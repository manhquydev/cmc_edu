---
phase: 2
title: "Triage 38 luồng — bản đồ thi công"
status: done
completed: '2026-07-24'
reports:
  - 'plans/reports/triage-260724-1530-38-luong-tong-hop-report.md'
  - 'plans/reports/triage-260724-1512-flows-p1-p2-report.md'
  - 'plans/reports/triage-260724-1512-flows-p3-p4-adm-report.md'
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 2: Triage 38 luồng

## Overview
Đi qua cả 38 flow trong `scripts/acceptance-report/flow-manifest.ts`: với mỗi flow ghi chuỗi vai → chuỗi màn → grep xác minh đường UI cho TỪNG bước tạo-dữ-liệu. Phân loại khả-thi-viết trước khi tốn công viết journey. Đây là khoản đầu tư lãi nhất (advise §4).

## Requirements
- Functional: bảng triage 38 dòng, mỗi dòng: flow ID, chuỗi vai, màn hình per bước, **cột `đợt` MỚI** (khóa chia đợt nghiệp vụ tiền/ghi-danh/vận-hành-lớp/HR/rewards-admin — RT-8: field `cluster` manifest là nhãn phase P1..P4/ADMIN, KHÔNG dùng làm khóa; gán rõ P1-06/P1-07 cho Phase 4 hoặc 8), **cột `nav-reachability` RIÊNG** (màn có trong nav-tree của đúng vai không — RT-8: grep call-site KHÔNG chứng minh tới được bằng menu; chính branch này có commit e14b739 vì màn URL-only), phân loại {viết-được | thiếu-đường-UI (kèm bằng chứng grep) | trùng-journey-hiện-có}, journey dự kiến (tên file), ghi chú seed-ngoại-lệ nếu cần.
- Non-functional: mọi claim "không có UI làm X" PHẢI kèm lệnh grep + kết quả — không có ngoại lệ (bài học fabricated-approvals: claim "no UI creates AppUser" từng SAI, form `/admin/users` tồn tại).

## Architecture
Thuần đọc: manifest (`expected.trpc/uiRoutes/models`) × `apps/admin/src/pages/**` × `apps/lms/src/pages/**` × nav-registry. 9 flow đã có journey → xác nhận lại mapping H2 (giao procedure/route thật) thay vì tin khai báo cũ.

## Related Code Files
- Đọc: `scripts/acceptance-report/flow-manifest.ts`, `apps/admin/src/pages/**`, `apps/lms/src/pages/**`, `apps/e2e/tests/journeys/*`
- Tạo: `plans/reports/triage-38-luong-260724-{hhmm}-report.md`
- Không sửa code.

## Implementation Steps
1. Xuất danh sách 38 flow (ID, displayName, cluster, actorRoles, expected) thành bảng khung.
2. Với từng flow: map từng procedure trong `expected.trpc` sang màn admin/lms gọi nó (grep `trpc.<router>.<proc>`); ghi màn + đường menu. Cột `nav-reachability` xác minh RIÊNG qua nav-registry theo vai (không suy từ call-site).
3. Bước nào KHÔNG có UI tạo dữ liệu đầu vào → grep chứng minh (pattern: `rg "user.create|classBatch.create|..." apps/admin/src apps/lms/src`), ghi lệnh + output tóm tắt vào bảng.
4. Gom danh sách ngoại-lệ-seed đề xuất (nếu có) thành mục riêng "CẦN USER DUYỆT" — trình user trong phiên, ghi ngày duyệt thật vào report. **KHÔNG tự phê duyệt.**
5. Đối chiếu 9 journey hiện có với luật H2; flow gắn sai → ghi hành động sửa mapping (sửa ở Phase 3 khi đụng manifest).
6. Chốt số spec dự kiến (feed ngược Phase 1 dự phóng) và phân bổ vào đợt 5/6/7/8 theo cột `đợt` mới (KHÔNG theo `cluster`).

## Success Criteria
- [ ] 38/38 flow có phân loại + bằng chứng + cột `đợt` + cột `nav-reachability`; 0 flow "chưa xem"; P1-06/P1-07 có chủ sở hữu phase rõ
- [ ] Mọi claim thiếu-đường-UI có lệnh grep + kết quả trong report
- [ ] Danh sách ngoại lệ seed (nếu có) được user duyệt với ngày thật, ghi trong report
- [ ] Số spec dự kiến per đợt được chốt (đầu vào cho Phase 5-8)

## Risk Assessment
- Triage sai màn (như H1: `/teaching/grading` vs `/teaching/session-assessment`) → mitigate: mỗi flow ghi đường menu cụ thể, spot-check bằng cách mở app dev với 3 flow ngẫu nhiên.
- Cám dỗ "phân loại nhanh cho xong" → mỗi dòng bảng bắt buộc có ô bằng-chứng; dòng thiếu ô = chưa xong.
