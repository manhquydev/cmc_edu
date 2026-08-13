---
title: "Con B — Danh sách & phễu"
status: todo
priority: P2
effort: "1w"
dependencies: [1]
---

# Con B — Danh sách & phễu

## Overview

**Chưa tạo kế hoạch con** — tạo khi Con A xong (chặn bởi: dùng lại quy ước màu theo hạn). Phạm vi
đã chốt, chi tiết viết lúc tạo:

- `SavedFilter` model riêng, facility-scoped, có "đặt làm mặc định" + "chia sẻ cho mọi người"
  (quyết định #14 — chia sẻ là object cấp cơ sở, không phải preference cá nhân)
- Kéo-thả trên phễu: kéo sang bước không hợp lệ bị chặn nhìn thấy được; hỏng mạng thẻ quay về chỗ
  cũ; tham chiếu kanban scroll-snap Odoo (chỗ họ làm tốt); tôn trọng luật một-bước-liền-kề và
  quyền sở hữu như statusbar Con A
- Ẩn/hiện cột trong bảng — thói quen TEKY có thật (họ cài `EESTISOFT columns toggles` riêng)

## Success Criteria

- Kế hoạch con được tạo với `parent:` trỏ về đây, qua đủ vòng red-team/validate, và đóng
