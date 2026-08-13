---
title: "Chương trình trải nghiệm chuỗi kinh doanh"
description: "Kế hoạch chương trình (mẹ): đưa chuỗi bán hàng O1→O5 từ 'chạy được' lên 'dùng được hàng ngày'. Giữ hợp đồng bốn điểm đau, thứ tự và phép đo; việc thi hành nằm ở các kế hoạch con."
status: pending
priority: P1
effort: multi-sprint
tags: [crm, ux, program, chatter, activity, kanban]
created: 2026-08-13
blockedBy: []
blocks: []
---

# Chương trình trải nghiệm chuỗi kinh doanh

**Nguồn quyết định (bắt buộc đọc trước khi sửa bất kỳ kế hoạch con nào):**
[`plans/reports/decisions-owner-260813-1607-trai-nghiem-crm.md`](../reports/decisions-owner-260813-1607-trai-nghiem-crm.md)
— 18 quyết định của chủ hệ thống + dữ kiện đã đo + cải chính. File đó là hợp đồng; kế hoạch này
chỉ sắp việc.

**Nguồn bằng chứng:** `plans/reports/research-260813-odoo19-ux-patterns.md` (Odoo 19, đọc code
4 nhánh) · `plans/reports/research-260813-teky-odoo11-openeducat11-baseline.md` (hệ TEKY thật) ·
`plans/reports/brainstorm-260813-1615-dong-thoi-gian-va-cau-hinh.md` (phân xử kiến trúc).

## Overview

Bốn điểm đau do chủ hệ thống nêu là thước đo của mọi hạng mục — mọi PR thuộc chương trình phải
nêu nó chữa điểm đau nào:

| # | Điểm đau |
|---|---|
| Đ1 | Thẩm mỹ và tính nhất quán kém giữa các màn hình (mốc đo hiện tại: Console 10/20 — `audit-260813-0052`) |
| Đ2 | UX lan man, giải thích dài dòng — chữ quá nhiều |
| Đ3 | Responsive/mobile — đã co phạm vi: **"đọc được trên màn hẹp"**, không đầu tư thao tác sâu (quyết định #10: gần như toàn desktop) |
| Đ4 | Không biết dùng gì ở đâu; mơ hồ, **sợ dùng hệ thống** |

Người dùng gốc quen **Odoo CRM** (hệ TEKY: Odoo 11 + OpenEduCat Enterprise + Odoo CRM — xác minh
`erp.teky.edu.vn/website/info`), đích tham chiếu là **Odoo 19**, nhưng mục tiêu cuối là hệ thống
CMC dùng được thật — chép pattern giải quyết đúng điểm đau, không chép nhược điểm.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Người dùng thấy hệ quả của mọi hành động ngay trên màn hình, không cần tải lại (Đ4) | P1 |
| 2 | Mỗi bản ghi cơ hội có dòng thời gian đầy đủ "ai làm gì, nói gì, lúc nào" — bất biến (Đ4) | P1 |
| 3 | Việc cần làm phân biệt bằng màu ba mức + một chỗ gom có đếm số; cơ hội nguội hiện số ngày theo ngưỡng từng giai đoạn (Đ4) | P1 |
| 4 | Danh sách và phễu thao tác nhanh: bộ lọc lưu được (mặc định + chia sẻ), kéo-thả, ẩn/hiện cột (Đ4, Đ2) | P2 |
| 5 | Toàn chuỗi kinh doanh nhất quán một thang chữ/bo/spacing, chữ ngắn theo 9 quy tắc, đọc được trên màn hẹp (Đ1, Đ2, Đ3) | P2 |

## Phases

Mỗi "phase" của chương trình là **một kế hoạch con độc lập** (tiền lệ repo: `260812-1407` ↔
`260813-0813` qua `parent:`). Con B và Con C **tạo thư mục khi tới lượt** — phạm vi của chúng chốt
ở đây để red-team soi được toàn cục, nhưng chi tiết viết muộn để không phải sửa hai lần.

| # | Phase | Status |
|---|-------|--------|
| 1 | [Con A — Trải nghiệm trang bản ghi CRM](./phase-01-con-a-trang-ban-ghi.md) | Pending |
| 2 | [Con B — Danh sách & phễu](./phase-02-con-b-danh-sach-va-pheu.md) | Pending |
| 3 | [Con C — Nhất quán + chữ + màn hẹp](./phase-03-con-c-nhat-quan-chu-man-hep.md) | Pending |

Phạm vi từng con nằm trong phase file tương ứng. Con A đã có kế hoạch con
([`260813-1629-con-a-trai-nghiem-trang-ban-ghi-crm`](../260813-1629-con-a-trai-nghiem-trang-ban-ghi-crm/plan.md));
Con B/C tạo kế hoạch con khi tới lượt.

## Trình tự và luật chung

```
Con A ──► Con B ──► Con C (phần chữ + thang có thể chạy song song với B)
```

- Mỗi kế hoạch con nhiều PR nhỏ; mỗi PR một phase; branch + PR, không commit thẳng `main`/`develop`.
- Theo quy ước repo: `impact` trước khi sửa symbol, `detect_changes()` trước khi commit, cảnh báo
  nếu HIGH/CRITICAL.
- `typecheck-and-test` + `ui-e2e` xanh là điều kiện gọi "done" cho mọi phase (CI là đội review).
- Lấy mốc `pnpm acceptance:report` **trước khi bắt đầu Con A**; không PR nào được làm tụt mốc.

## Success Criteria

- [ ] Con A hoàn thành đủ cổng nghiệm thu của nó (xem plan con)
- [ ] Con B, Con C được tạo đúng lúc với phạm vi ở trên, hoàn thành đủ cổng riêng
- [ ] `pnpm acceptance:report` không tụt so với mốc trước chương trình
- [ ] Mỗi PR thuộc chương trình nêu rõ điểm đau (Đ1–Đ4) nó chữa
- [ ] Ba câu hỏi treo cần người ngoài (cổng tiền TEKY, ảnh chụp hệ TEKY, module tự viết) được hỏi
      trước khi Con C chốt copy hướng dẫn người dùng cũ

## Rủi ro cấp chương trình

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | Mutation CRM tương lai quên emit `RecordEvent` ⇒ dòng thời gian thiếu | Quy ước test per-mutation, ghi thành cổng cứng ở Con A |
| R2 | Chép Odoo cả phần dở (bảng mobile, mật độ thông tin giảm) | Nguồn quyết định đã đánh dấu sẵn "không chép" từng mục; red-team soi lại |
| R3 | Kế hoạch con phình phạm vi (thêm follower, email, backfill…) | "Chưa làm" ghi tường minh trong từng plan con; thêm gì phải qua vòng quyết định mới |
| R4 | ~17 kế hoạch chưa xong trong repo — chương trình này bị trôi | Kế hoạch con nhỏ, đóng được từng cái; chương trình chỉ giữ hợp đồng, không giữ việc |
| R5 | Kế hoạch `260813-0813` (pending) đổi enum trên cùng `schema.prisma` — xung đột thứ tự migration với bảng `RecordEvent` của Con A | Bên nào land sau phải rebase migration; payload event tối thiểu hoá + fallback hiển thị đã đỡ chiều dữ liệu cũ (red-team vòng 1, finding 14) |

<!-- slug: chuong-trinh-trai-nghiem-chuoi-kinh-doanh -->
