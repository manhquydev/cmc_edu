# Research Report: UI/UX & Product — đánh giá trải nghiệm CMC EDU

**Ngày nghiên cứu:** 2026-08-02  
**Phạm vi:** Kiến thức UI/UX/product (enterprise ERP, dashboard, EdTech multi-role) + áp dụng đánh giá giao diện ERP CMC EDU (ảnh capture thật, không chỉ code).  
**Mục tiêu:** Hướng cải thiện trải nghiệm người dùng có căn cứ.

---

## Executive Summary

CMC EDU đã có **nền visual ổn** (shell sidebar, card trắng trên canvas ấm, icon outline, list/filter pattern). Vấn đề chính **không phải “xấu”** mà là **lệch loại sản phẩm**: giao diện đang nghiêng **consumer-minimal / catalog demo**, trong khi đúng bản chất là **enterprise operational tool** (ERP + LMS trung tâm giáo dục).

Nghiên cứu enterprise UX 2024–2026 thống nhất: phần mềm nội bộ thắng khi **hoàn thành việc nhanh, ít lỗi, adoption theo role** — không phải whitespace hay engagement. Dashboard operational phải **glanceable + actionable** (NN/g). Education software: mỗi role (GV, sale, GĐ) cần UI **task-oriented** khác nhau, không chỉ ẩn menu. Density + progressive disclosure phải đi đôi: **hierarchy trong mật độ**, không thay bằng màn hình rỗng.

**Khuyến nghị chiến lược:** tái định vị UI theo 3 lớp — (1) **Product language** (copy/role/status người), (2) **Operational density** (list/ops đậm hơn; empty có CTA), (3) **Role workspaces** (dashboard & shortcut theo persona, không chỉ RBAC ẩn entry).

---

## Research Methodology

| Hạng mục | Chi tiết |
|----------|----------|
| Nguồn | ~5 cụm web search + deep-read NN/g, Fuselab Enterprise UX 2026, school SMS guides, dashboard patterns 2026 |
| Thời gian tài liệu | 2017 (NN/g classic dashboard) → 2026 (enterprise UX guides) |
| Bằng chứng sản phẩm | Screenshot e2e local-sim: login, cockpit (sale/GV/GĐĐT), CRM, phiếu thu, lớp, điểm danh, chấm bài, chấm công, admin users, LMS |
| Từ khóa | enterprise UX density, progressive disclosure B2B, dashboard KPI NN/g, school management teacher UX, role-based personalization SaaS |

**Tiêu chí đánh giá nguồn:** authority (NN/g, IxDF), currency (2024–2026), actionability cho ERP/EdTech.

---

## Key Findings (kiến thức bổ sung)

### 1. Enterprise UX ≠ Consumer UX

| Chiều | Consumer | Enterprise (CMC EDU thuộc đây) |
|-------|----------|--------------------------------|
| Mục tiêu | Engagement, thời gian ở app | **Hoàn thành task, độ chính xác, tốc độ** |
| Success metric | DAU, retention | Time-on-task ↓, error ↓, adoption theo role |
| Data | Ít / 1 action / màn | **Cao; hierarchy trong mật độ** |
| Workflow | Tuyến tính | Circular, duyệt, bàn giao role |
| Motivation | Tự nguyện | **Bắt buộc làm việc** → friction = né tool (Excel/chat) |

Nguồn: Fuselab Enterprise UX Guide 2026 — “Good design is a business investment, not decoration.”  
**Hệ quả CMC:** UI “đẹp thoáng” nhưng empty lớn + CTA mờ = đúng anti-pattern “Ferrari nobody uses / go back to Excel”.

### 2. Dashboard: operational vs analytical (NN/g)

- **Operational dashboard:** thông tin **at-a-glance**, hỗ trợ quyết định **ngay** (điểm danh, bài chờ chấm, phiếu chờ duyệt).
- **Analytical:** phân tích sâu hơn, ít time-pressure (doanh thu, funnel O1–O5).
- Dashboard ≠ portal: **không phải** tập hợp link; phải **trả lời câu hỏi** (“có việc gì phải làm?”, “lớp nào hôm nay?”).
- KPI: ~**5–7 metric** max trước khi wallpaper; F-pattern: **hàng KPI trên → queue/trái → panel phụ**.
- Encoding số: **chiều dài / vị trí 2D** > pie/gauge (preattentive).

**Hệ quả CMC:** Cockpit đúng skeleton (metric + task + panel) nhưng khi metric=0 + empty task → **không operational** — trở thành “trang chào”.

### 3. Density + progressive disclosure

- Enterprise: **không bớt thông tin** bằng cách xóa; bớt **cognitive load** bằng hierarchy + disclosure.  
- “Whitespace consumer” trên màn ops **phản tác dụng** (scroll thêm, mất context).  
- Progressive disclosure: primary luôn thấy; advanced khi cần (IxDF, NN/g).  
- Empty state tốt: **prompt action**, không chỉ “không có gì” (SaaS churn literature).

**Hệ quả CMC:** Điểm danh/nhật ký chỉ 1 dropdown giữa biển trắng; table 1 row + 60% canvas trống = **density sai tầng**.

### 4. Multi-role / EdTech product

School/education management best practice:

- **Admin/GĐ:** analytics, duyệt, oversight.  
- **Teacher:** **task-oriented** — lịch, lớp hôm nay, điểm danh, chấm bài, nhận xét (không CRM/finance).  
- **Sale:** pipeline + ghi danh nhanh.  
- Parent/student (LMS): mobile-first, communication.

Mỗi role = **workspace riêng** (dashboard + default path + CTA), không chỉ “cùng shell + filter permission”.  
Teacher pain: admin work lặp (điểm danh, chấm) → UI phải **giảm click, keyboard/touch, queue rõ**.

### 5. Product language & trust

Enterprise copy: **rõ, đồng nhất thuật ngữ**, không quirky.  
Microcopy lỗi phải: **vì sao + làm gì tiếp**.  
Dữ liệu demo/seed lộ trên UI → phá trust “production”.  
RBAC: ẩn action **và** giữ **layout predictable** giữa các role (cùng khung, khác nội dung).

### 6. Pattern dashboard 2026 (tham chiếu Linear/Stripe-style ops)

- Sidebar ~240–280px ổn định.  
- Metric strip **4–6 KPI** có so sánh/delta nếu có.  
- Content grid 12-col; skeleton khi load.  
- **Một primary CTA** / context; secondary không cùng weight.

---

## Áp dụng: đánh giá CMC EDU (có căn cứ research)

### Điểm khớp best practice (giữ)

| Điểm | Mapping kiến thức |
|------|-------------------|
| Shell sidebar + topbar + content | Pattern admin 2026 chuẩn |
| Icon outline + label nav | Nav discoverability (không icon-only) |
| MetricCard + Task panel + side panel | Operational dashboard anatomy đúng |
| List: header + filter + table + CTA | List-page enterprise chuẩn |
| Master-detail chấm bài | Workflow grading đúng nghề |
| Modal + scrim ghi danh | Focused decision surface |
| Menu theo role (GV gọn) | RBAC surface đúng hướng |

### Lệch product type (sửa)

| Hiện trạng nhìn thấy | Research says | Impact UX |
|---------------------|---------------|-----------|
| Whitespace cực lớn trên màn ops | Enterprise cần density + hierarchy | Cảm giác demo, chậm “vào việc” |
| Dashboard metric=0 + empty yên | Operational = actionable glance | Không trả lời “làm gì tiếp?” |
| 1 MetricCard full-width | KPI strip 4–6, F-pattern | Mất weight, trông “thanh rỗng” |
| `giao_vien` / `active` raw | Taxonomy & human labels | Trust & professional perception ↓ |
| Ghi danh + Đăng xuất cùng pill xanh | 1 primary CTA | Hierarchy action mờ |
| Empty không CTA | Empty prompts action | Dead-end, churn mental |
| Teacher = shell filter only | Role workspace task-oriented | GV không “cảm thấy tool của mình” |
| Topbar title lặp H1 page | Header context 1 tầng | Chrome thừa, scroll lãng phí |
| Seed names Timeline P2… | Real-data stress / polish | Nhìn staging, không ops thật |

**Điểm tổng hợp (research-weighted):**

| Trục | Điểm /10 |
|------|----------|
| Visual system consistency | 7.5 |
| Enterprise task efficiency | 5.0 |
| Operational dashboard quality | 5.0 |
| Role personalization (product) | 5.5 |
| Information density fitness | 4.5 |
| Copy / trust / polish | 5.0 |
| Empty & recovery | 4.5 |

---

## Hướng cải thiện trải nghiệm (ưu tiên)

### Tầng A — Product language (P0, ROI cao, rẻ)

1. **Nhãn role tiếng Việt:** Giáo viên, Sale, Giám đốc đào tạo, Giám đốc kinh doanh, Super admin.  
2. **Greeting:** “Xin chào, Phạm Thị Giáo” — không `Xin chào · giao_vien`.  
3. **Status Việt:** Đang hoạt động / Hoàn thành / Chờ duyệt — cấm `active` lẫn EN.  
4. **Logout = secondary**; chỉ 1 primary topbar (vd. Ghi danh khi role có).  
5. **Glossary UI** cố định: Phiếu thu / Cơ hội / Buổi học / Lớp — không đổi tên giữa màn.

### Tầng B — Operational density (P0–P1)

6. **Hai density mode (design token):**  
   - Dashboard: thoáng vừa (giữ premium).  
   - List/ops (điểm danh, phiếu, chấm bài): **row compact hơn ~20–30%**, sticky header.  
7. **Metric strip:** luôn grid 2–4 cột; 1 metric không stretch full; bổ sung metric “hữu ích khi 0” (Lớp hôm nay, Buổi sắp tới, Công tuần này).  
8. **Empty state chuẩn:** icon + 1 câu + **1 primary CTA** (+ optional secondary).  
   - “Không có bài chờ chấm” → “Xem lịch dạy” / “Mở bài tập”.  
9. **Bỏ lặp title:** topbar = module **hoặc** page H1; breadcrumb gọn trong content.

### Tầng C — Role workspaces (P1, product)

10. **Teacher home (operational):**  
    - Hôm nay: list buổi (giờ–lớp–phòng)  
    - Queue: Bài chờ chấm (N)  
    - Shortcut: Điểm danh · Chấm bài · Nhật ký · Chấm công  
    - Không để dashboard “0 + empty dài”.  
11. **Sale home:** O4 sẵn sàng + pipeline compact + CTA Ghi danh nổi; task queue thật.  
12. **GĐ home:** phiếu chờ duyệt + vượt ngưỡng + (tuỳ track) KPI/payroll queue.  
13. **Quick access** cho 3 màn hay dùng / role (pin dưới brand hoặc top of content).

### Tầng D — Workflow friction (P1)

14. **Điểm danh / Nhật ký:** không chỉ dropdown; **preselect lớp hôm nay** hoặc list buổi “cần làm”.  
15. **Chấm công:** CTA primary lớn dưới đồng hồ (không xám mép phải).  
16. **Chấm bài empty:** panel phải có hướng dẫn + link; không “xám chết”.  
17. **Table actions:** menu `⋯` thay cột nút lặp (Đặt lại mật khẩu × N).

### Tầng E — Trust & polish (P2)

18. Display name lớp/HS thân thiện; mã kỹ thuật secondary.  
19. Login 100% Việt; bỏ “Required” EN.  
20. Skeleton/load nhất quán; test empty + 1 row + 50 rows.  
21. (Sau) keyboard shortcuts cho power user GĐ/sale.

---

## Comparative mental model

```text
                    Consumer-minimal (hiện tại lệch)
                    · Nhiều whitespace
                    · Empty yên
                    · 1 metric full width
                    · Chrome lặp
                              │
                              ▼
                    ──────────┼──────────
                              │
                              ▼
                    Enterprise-ops (đích CMC EDU)
                    · Hierarchy trong density
                    · Empty + CTA
                    · KPI strip 3–6 + queue
                    · Role workspace
                    · 1 primary action / context
```

---

## Implementation Recommendations

### Quick start (1 sprint polish)

1. i18n labels role + status + greeting.  
2. Button hierarchy topbar.  
3. EmptyState component: `title, description, primaryAction?`.  
4. MetricCard container `minmax` grid, max 4 cols.  
5. Teacher cockpit: thêm TodaySessions + 4 shortcuts dù metric=0.

### Design system updates

- Tokens: `space-ops` denser scale cho ListPage/DataTable.  
- Component: `RoleBadge` (human label), `EmptyState`, `PageChrome` (1 title source).  
- Doc: “Operational vs marketing density” trong `docs/12-design-system-ui.md` (khi ship).

### Common pitfalls (tránh)

| Pitfall | Vì sao sai |
|---------|------------|
| “Làm thoáng hơn nữa cho premium” | Enterprise users cần density |
| Thêm chart cho dashboard trống | NN/g: dashboard = actionable info, không decoration |
| Copy “vui” / emoji nav | Enterprise clarity + brand đã khóa line icon |
| Cùng dashboard template cho mọi role | EdTech: teacher ≠ sale |
| Chỉ ẩn menu RBAC | Chưa đủ personalization product |

### Success metrics (đo UX)

- Time-to-first-action sau login (GV: mở điểm danh/chấm bài).  
- Clicks tới hoàn tất điểm danh 1 buổi.  
- % session chỉ vào cockpit rồi out (bounce nội bộ).  
- Support “không tìm thấy màn” tickets.  
- UAT: 5 user / role hoàn thành 3 task core không hướng dẫn.

---

## Resources & References

### Authority

- Nielsen Norman Group — *Dashboards: Making Charts and Graphs Easier to Understand*  
  https://www.nngroup.com/articles/dashboards-preattentive/  
- Interaction Design Foundation — Progressive disclosure  
  https://ixdf.org/literature/topics/progressive-disclosure  
- Fuselab — *Enterprise UX Design Guide 2026*  
  https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/

### Patterns / industry

- Dashboard patterns 2026 (sidebar, 4–6 KPI, density) — art-of-styleframe / ops SaaS references  
- School management UX by role (teacher task-oriented vs admin analytics) — Cleveroad SMS guide (summary via search; site may block fetch)  
- Role-based nav + personalized dashboards in legacy modernization — SkinSFactory / enterprise redesign literature

### Internal evidence (repo)

- Screenshots: `plans/260802-1425-local-sim-experience-setup/e2e-screenshots/`  
- Nav authority: `apps/admin/src/shell/nav-registry.ts`  
- Cockpit: `apps/admin/src/pages/cockpit.tsx`  
- Tokens: `packages/ui/src/tokens.css`, `premium.css`

---

## Appendices

### A. Glossary (product terms for UI)

| Term nội bộ | Hiển thị đề xuất |
|-------------|------------------|
| giao_vien | Giáo viên |
| giam_doc_dao_tao | Giám đốc đào tạo |
| giam_doc_kinh_doanh | Giám đốc kinh doanh |
| sale | Sale / Nhân viên kinh doanh |
| super_admin | Quản trị hệ thống |
| active (class) | Đang hoạt động |
| Operational dashboard | Tổng quan thao tác (việc hôm nay) |
| Analytical dashboard | Báo cáo / phân tích |

### B. Persona → primary job (1 câu)

| Role | Job-to-be-done UI |
|------|-------------------|
| Giáo viên | Hôm nay dạy gì → điểm danh → chấm bài → nhật ký |
| Sale | Cơ hội O4 → ghi danh → theo pipeline |
| GĐĐT | Duyệt tiền / lớp / chất lượng dạy |
| GĐKD | Doanh thu / phiếu / sale team |
| Super admin | User, facility, audit |

### C. Unresolved questions

1. UAT người thật (M0) chưa chạy — research + screenshot chưa thay được quan sát field (tablet điểm danh, wifi yếu).  
2. Product có muốn **density toggle** user-level hay hard-code theo page type?  
3. LMS vs Admin: có unified design language không, hay cố ý tách mobile parent?  
4. Có roadmap “teacher mobile PWA” không — ảnh hưởng attendance touch targets.

---

## Next steps đề xuất

1. **Chốt P0** với product owner: language + button hierarchy + empty CTA + teacher shortcuts.  
2. **1 wireframe** Teacher operational home + List phiếu thu dense (không full rebrand).  
3. **UAT 30 phút / role** với checklist 3 task — ghi time-to-complete.  
4. Chỉ khi P0 ổn mới gen full visual redesign — tránh “đẹp hơn nhưng vẫn rỗng”.

---

*Report path: `plans/260802-research-ui-ux-product-eval/reports/research-ui-ux-product-eval.md`*
