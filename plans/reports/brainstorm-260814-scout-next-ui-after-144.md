# Brainstorm — UI scope after #142–#144 (scout + advice)

**Date:** 2026-08-14  
**Inputs:** Scout on `origin/develop` (`adc49c9` = #144); `design-lab/system/BRIDGE.md`; prior brainstorm after browser audit; kongming advice  
**Index note:** Plan `260814-2154` frontmatter still `active` but work is **merged** — mark completed on next housekeeping.

---

## 1. Đã làm (đã vào `develop`, CI xanh)

| Đợt | Nội dung | PR |
|-----|----------|-----|
| D0–D5 | Lab → token alias, ListPage grammar spike (phiếu thu), SoD banner duyệt | #142 |
| Wave 4A + CRM/courses | `StatusBadge` brand, `CategoryChip`, empty recipe CRM + khoá học | #143 |
| Next wave | Sort/filter rõ hơn; EmptyState icon mặc định; seed phiếu nháp; bỏ chọn-tất-cả dối trên phiếu thu; brand chờ (phiếu nháp + KPI đã nộp + CRM O3/O4); Học viên empty trung thực; CRM `orderBy` whitelist | #144 |

**Trang đã áp grammar (một phần hoặc đủ):** phiếu thu, CRM pipeline/aftersale, khoá học, học viên (under-claim).

---

## 2. Chưa làm / còn treo (có bằng chứng)

### Theo BRIDGE.md

| Wave | Còn lại |
|------|---------|
| **4B** | Trạng thái nút + chỉ báo tab — **chưa mở** |
| **5** | Saved views — chưa |
| **6** | Khoảng cách archetype — chưa |
| **7** | Statusbar geometry — cố ý không đụng |
| **8** | Module tiếp theo ngoài CRM/một phần lists — từng PR |
| **9** | Shell / cockpit — **không được phép** (thiếu quyết định Q-shell) |

### Trang list vẫn empty chữ thường (mẫu traffic cao)

Lớp học, phụ huynh, bài tập, bảng lương, ca làm / check-in, users/facilities/audit — chưa `TableEmptySpec` / recipe đầy đủ.

### Đã quyết định hoãn (giữ nguyên)

- Không tô brand cho payroll `draft`
- Report cards giữ Banner
- Không sort CRM theo tên khách
- Không widen bulk học viên / phiếu thu khi chưa có API ID
- Không redesign kanban / attendance matrix / mass fan-out

---

## 3. Contract đề xuất (đợt tiếp theo)

| Field | Nội dung |
|-------|----------|
| **Outcome** | Một list traffic cao còn under-claim (ưu tiên **Lớp học**) theo checklist BRIDGE: empty có bằng chứng; bulk chỉ trang hiện tại; không bịa sort. |
| **Constraints** | Solo + CI bắt buộc; một concern / PR; không invented maps; OPENEDUCAT chrome; nhãn nút không trùng Playwright. |
| **Non-goals** | Wave 4B (trừ khi owner chọn); kanban depth; mass fan-out; endpoint chọn-tất-cả; Wave 9 shell; payroll/report-cards brand. |
| **Acceptance** | Test empty trung thực trên Classes; không CTA “Chọn tất cả N khớp” dối; `typecheck-and-test` + `ui-e2e` xanh. |

---

## 4. Ba hướng (so sánh)

| | A — Fan-out Lớp học (khuyến nghị) | B — Wave 4B nút/tab | C — API chọn đủ ID phiếu thu |
|--|-----------------------------------|---------------------|------------------------------|
| Giá trị | Staff thấy grammar trên list học thuật tiếp theo | Nền tảng dùng chung | Sửa dối bulk tài chính |
| Chi phí | ~0.5–1 ngày | ~1–2 ngày | ~1.5–3 ngày |
| Rủi ro | Empty-kind lie; e2e name | Đổi label → vỡ journey | SoD + cap ID |
| Lệch BRIDGE Wave 8 | Khớp | Wave 4 còn dở | Wave 5 honesty |

**Kongming:** GO **A**; HOLD B/C làm next-next; NO-GO kanban depth + mass fan-out.

---

## 5. Housekeeping ngay (không phải “wave”)

1. Đóng plan `260814-2154` → `completed` (đã merge #144).  
2. Cập nhật `plans/reports/INDEX-live-260812.md` trỏ cook target mới.  
3. Cập nhật dòng Wave 6/8 trong `BRIDGE.md` (students + #144 polish).

---

## 6. Decision log

| Decision | Status |
|----------|--------|
| Next wave = Classes ListPage empty recipe | **Recommended — awaiting owner** |
| HOLD Wave 4B + receipts matching-IDs | After Classes |
| NO-GO CRM kanban depth / mass fan-out this wave | Recommended |

**Next:** Owner chọn A / B / C (hoặc hybrid) → `/ak:plan`.
