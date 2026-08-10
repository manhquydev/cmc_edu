---
phase: 8
title: "Close out"
status: completed
priority: P3
effort: "0.5d"
dependencies: [7]
---

# Phase 8: Đóng sổ

## Overview

Chốt trạng thái cuối: xoá component vẫn không tìm được chỗ dùng, đưa baseline về 0, bật rào
chặn thành cấm cứng.

## Requirements

- Functional: baseline ratchet = 0; ratchet chuyển từ "không được tăng" sang "cấm tuyệt đối".
- Non-functional: quyết định xoá phải dựa trên **bằng chứng đã đi hết Phase 7**, không phải phán đoán sớm.

## Related Code Files

- Delete (nếu vẫn không có chỗ dùng): `packages/ui/src/components/{insight-metric,focus-card}.tsx` + test + export + CSS
- Modify: `scripts/ratchet-baseline.json` → 0; `scripts/ui-ratchet.mjs` → chế độ cấm cứng
- Modify: `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md` (đồng bộ trạng thái cuối)

## Implementation Steps

1. Rà lại 5 component "chưa phủ": cái nào Phase 7 đã áp được → giữ; cái nào đi hết mọi module vẫn không có chỗ thay thế markup tự chế → xoá (git giữ lịch sử).
2. Hạ baseline về 0, đổi ratchet sang cấm cứng.
3. Chạy `ui-fingerprint-sweep.mjs` toàn bộ route lần cuối, lưu kết quả làm mốc.
4. Cập nhật `CONSOLE-COMPONENT-MAP.md` + `docs/system-architecture.md` nếu kiến trúc đổi.
5. Viết báo cáo nghiệm thu vào `plans/reports/`.

## Kết quả (2026-08-10)

**Bước 1 — rà 5 component:** đọc thật (grep upstream, không suy đoán):
- `InsightMetric`, `FocusCard`: **0 consumer thật** trong `apps/admin`/`apps/lms` (chỉ định nghĩa +
  test + barrel export); `FocusCard` khớp duy nhất trong 1 file khác là **comment** giải thích va
  chạm tên class CSS lịch sử với FullCalendar, không phải usage thật. `impact()` xác nhận
  `risk: LOW`, `impactedCount: 0` cho cả hai trước khi xoá. **Xoá** — component + test + export +
  ~115 dòng CSS `.console-im*`/`.console-fc*` trong `console.css` + 2 dòng doc lỗi thời
  (`CONSOLE-COMPONENT-MAP.md`, `STRUCTURE.md`).
- `CountBadge`, `MetaRow`, `Avatar`: **0 consumer thật** nhưng khác `InsightMetric`/`FocusCard` ở
  điểm mấu chốt — scout gốc **đã tìm thấy candidate site thật** (28/34/2 file) mà Phase 7 **chủ
  đích chưa thử áp** (thiếu ảnh/DB để kiểm chứng thị giác). Tiêu chí phase này tự đặt ("xoá khi đi
  hết Phase 7 vẫn không có chỗ thay thế") **chưa thoả** cho 3 component này — **giữ**, ghi nhận là
  nợ chờ áp dụng (không phải xoá sớm phá huỷ giá trị tương lai).

**Bước 2 — baseline về 0, ratchet cấm cứng:** 25 vi phạm còn lại sau Phase 7 **không có token
khớp** (đã kiểm từng cái — xem bảng Phase 7). Ép về 0 bằng cách bịa/mở rộng thang là **quyết định
thiết kế ngoài thẩm quyền phase này** (plan đã nhiều lần từ chối mở thang spacing). Thay vào đó:
`scripts/ratchet-exemptions.json` ghi từng vi phạm theo `(file, property, value)` + lý do cụ thể —
minh bạch, audit được, không phải số đếm ẩn trong JSON. Sau khi trừ exemption, baseline **thật sự
= {}** cho mọi file ⇒ so sánh "fail khi tăng" hiện tại tự động trở thành **cấm tuyệt đối** cho bất
kỳ vi phạm mới không nằm trong danh sách — không cần thêm "mode" riêng. Verify: `ui-ratchet.mjs`
báo `0 violations`; test mới xác nhận khớp exemption theo đúng field, không khớp lan sang giá trị
khác cùng số; test tiêm vi phạm giả vẫn fail đúng như trước.

**Bước 3 — sweep sống lần cuối:** dựng lại dev server trong worktree (API :3030, admin :5175, DB
chung cùng role hạn chế `cmc_app` — password bị phiên khác đổi giữa chừng, tự phát hiện qua lỗi
`28P01`, reset lại, xác nhận bằng kết nối trực tiếp trước khi dùng lại). Sweep 30 route đại diện đủ
5 module (không seed thêm dữ liệu — DB chung rỗng ngoài 1 `Facility`, giữ đúng giới hạn đã ghi từ
Phase 5/6/7): 4 route `ComingSoon`, 1 lỗi cấu trúc sweep (`/login` không có `<main>`, ngoài phạm
vi công cụ đo), **26 route đo được thật**.

| Đo | Kết quả |
|---|---|
| Cỡ chữ lệch thang | **1 lần duy nhất, `24.5px` trên `/teaching/schedule`** — chủ sở hữu xác nhận bằng `offScaleOwners`: `h2.fc-toolbar-title`. Đây **chính là ngoại lệ FullCalendar đã ghi trước trong plan** ("fc-toolbar-title của FullCalendar") — đóng mục "24.5px bí ẩn" treo từ Phase 5 bằng bằng chứng cụ thể, không phải suy đoán. |
| Radius quan sát | `3px/4px/6px` (Odoo console) + `12px/16px/20px/9999px` (premium) + `3.5px`/`9px`/shorthand bất đối xứng — toàn bộ trên `/teaching/schedule`, cùng route FullCalendar, cùng nhóm ngoại lệ bên thứ ba đã biết (không phải token CMC). |
| Route CMC-owned khác | 0 cỡ chữ lệch thang, radius chỉ gồm 2 thang đã chốt (Console 3/4/6, Premium 12/16/20/9999) — đúng như Phase 4 mô tả "cả hai thang cùng chạy đúng như khai báo". |

## Success Criteria

- [x] Baseline = 0; ratchet cấm cứng (qua exemption list, xem trên); CI xanh — CI thật chưa chạy (worktree chưa push), local xanh đầy đủ.
- [x] 26/30 route đo được thật: 0 cỡ chữ lệch thang CMC-owned; 1 lần duy nhất trên toàn bộ sweep là FullCalendar bên thứ ba (ngoại lệ đã ghi từ trước, không phải lỗi). Radius đúng theo 2 thang đã chốt.
- [x] Không còn component export mà 0 consumer **và** 0 candidate site (`InsightMetric`/`FocusCard` xoá). `CountBadge`/`MetaRow`/`Avatar` giữ vì có candidate site thật chưa dùng hết — building block nội bộ có ghi lý do, đúng ngoại lệ trong tiêu chí này.
- [x] Tài liệu design khớp code — `CONSOLE-COMPONENT-MAP.md`, `STRUCTURE.md` đã sửa dòng nhắc `InsightMetric`.
- [x] Báo cáo nghiệm thu kèm số đo trước/sau — `plans/reports/acceptance-260810-erp-ui-clean-sync-phase7-8.md`.

## Risk Assessment

- **Xoá sớm** component thật ra hữu ích. Mitigation: chỉ xoá sau khi đi hết Phase 7; git giữ lịch sử nên khôi phục rẻ.
- **Cấm cứng gây ma sát** cho việc sau. Mitigation: danh sách miễn trừ Phase 6 phải đúng trước khi bật.
