# Phase 04 — Chatter dưới form + systray (sau data CRM)

**Plan:** [plan.md](./plan.md)  
**Blocked by:** chương trình CRM (timeline + activity) — `plans/260813-1629-chuong-trinh-trai-nghiem-chuoi-kinh-doanh/`  
**Pack:** `10`, `14`, `16`, `30`, `01` systray

## Overview

Không làm skin rỗng. Chatter cần mail.thread / activity. Phase này chỉ **layout + chrome** khi model đã có: composer dưới sheet, Follow, date separators. Systray: badge chat/activities + avatar vuông 24px.

## Requirements

- [x] Chatter dưới sheet khi width < 1400 (`.console-detail-split--timeline`; RecordTimeline đã có data CRM)
- [ ] Buttons: Send message / Log note / Activities — không bịa; composer hiện tại là "Thêm ghi chú"
- [x] Systray: CSS badge xanh `#28a745` sẵn; **không** fake số 8/11 (chưa có Discuss counts)
- [x] Avatar 24px square radius 4 từ `me.userId` initial
- [x] ≥1400: cột phải cho timeline (quyết định 1400px, không 1200)

## Acceptance

- [ ] Form + chatter vs `14` / `16` at 1280 (so tay)
- [x] Empty discuss vs `35` không bắt buộc P4 — skipped
