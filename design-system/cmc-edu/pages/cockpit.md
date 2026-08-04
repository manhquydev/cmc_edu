# Override: Cockpit / Tổng quan (all roles)

**Uses:** `DashboardPage` + `ShortcutChip` + `MetricCard` + `Panel` — see `PAGE-FRAMES.md`.

## Frame (locked)

1. Title **Tổng quan** + subtitle greeting VN roles  
2. Shortcut chip row (role-specific destinations, same chip chrome)  
3. Metrics grid 0–4 cards  
4. Body: primary task queue | secondary context panel  

## Role content

| Role | Shortcuts | Metrics | Queue | Side |
|------|-----------|---------|-------|------|
| Giáo viên | Điểm danh, Chấm bài, Nhật ký, Chấm công | Bài chờ chấm | Chấm bài | Lịch dạy hôm nay |
| Sale | CRM, Xếp lớp, Chấm công, Đổi thưởng | Sẵn sàng ghi danh | Ghi danh O4 | Pipeline |
| GĐ / SA | Phiếu thu, CRM, Lớp, Nhân sự | Phiếu chờ (+ vượt ngưỡng) | Duyệt phiếu | Pipeline |

## Anti-patterns

- Full-bleed single metric empty bar  
- Raw role keys in greeting  
- Empty queue without CTA  
- Custom page layout outside `DashboardPage`

## Deep redesign research

Component-level specs (WorkInbox, StageFunnel, SessionAgenda, role loops):

`plans/260802-research-cockpit-workflow-ux/reports/research-cockpit-components-workflow-ux.md`
