---
title: "Con C — Nhất quán + chữ + màn hẹp"
status: todo
priority: P2
effort: "1w"
dependencies: [1]
---

# Con C — Nhất quán + chữ + màn hẹp

## Overview

**Chưa tạo kế hoạch con** — tạo khi bài học từ Con A/B đã ngấm. Phạm vi đã chốt:

- Siết một thang cỡ chữ / bán kính bo / thang spacing (bài học Odoo 17→19: nhất quán đến từ
  thang, không phải màu) — nối tiếp `260813-0120-design-system-hardening` (landed), **không mở
  lại** phần A–D
- Áp 9 quy tắc viết chữ (`research-260813-odoo19-ux-patterns.md` §4.6) lên chuỗi kinh doanh —
  rẻ nhất chữa Đ2, cắt chữ chứ không viết code
- Màn hẹp: dưới `md` danh sách đổi thành thẻ (KHÔNG chép bảng-cuộn-ngang của Odoo);
  chatter/timeline đã responsive từ Con A (1200px). `BottomSheet` và thao tác sâu mobile **cuối
  hàng** (quyết định #10: gần như toàn desktop)
- Bỏ: command palette (YAGNI)
- Trước khi chốt copy hướng dẫn cho người dùng cũ: hỏi xong ba câu treo (cổng tiền TEKY, ảnh chụp
  hệ TEKY, module tự viết)

## Success Criteria

- Kế hoạch con được tạo với `parent:` trỏ về đây, qua đủ vòng red-team/validate, và đóng
- Đ1 đo lại tăng so với mốc Console 10/20 (`audit-260813-0052`)
