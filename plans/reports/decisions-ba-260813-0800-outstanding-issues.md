# Phán quyết BA — giải quyết các vấn đề treo của đợt design-system

**Ngày:** 2026-08-13 (08:00) · **Vai:** BA hiểu dự án · **Model:** Opus 4.8
**Bối cảnh:** `plans/reports/redteam-adjudication-260813-0139-design-system.md`,
`plans/reports/decisions-owner-260813-0120-design-system.md`
**Nguyên tắc nền:** một người vận hành, code phần lớn AI sinh, CI là đội review, chưa có VRT, chưa UAT người thật.

---

## Trạng thái thật (đã kiểm, không theo trí nhớ)

- **#124 và #125 chưa merge**, vẫn OPEN. `develop` đã chạy tiếp tới `259f21f` (#123 thư viện bài tập LMS,
  #126 khôi phục INDEX). Hai PR nằm sau develop 2 commit.
- Đã **rebase cả hai lên develop** (sạch, không conflict), retest: #124 → 153 test pass; #125 → 4 cổng UI
  vẫn PASS (kể cả ratchet — #123 không đẩy inline-style LMS vượt baseline 61). Đã force-push, CI chạy lại.

---

## Q1 (deliverable) — Hai PR: merge theo thứ tự #124 → #125

**Phán quyết:** merge #124 trước, #125 sau, sau khi CI xanh lại trên bản đã rebase.
Lý do thứ tự: `docs/design-system-console.md` trong #125 trỏ tới `console-precedence.test.ts` do #124 tạo.
Đây là ràng buộc bắt buộc, không phải tùy chọn. Hành động merge vào `develop` là outward → cần owner bấm go.

---

## Q2 (câu hỏi sản phẩm thật) — Kanban CRM `stageCounts`

**Phán quyết: GIỮ `stageCounts` facility-wide. Chỉ sửa ngữ nghĩa badge của KanbanColumn. KHÔNG làm query
per-stage (nhịp 2). Đây là ĐẢO NGƯỢC phán quyết "nhịp 2 bắt buộc" của phiên trước.**

Bằng chứng khiến tôi đảo:
- `router.ts:483-495` — `stageCounts` được thiết kế **có chủ đích** facility-wide, luôn loại lost (comment F7
  ghi rõ), độc lập filter. FunnelBar (`pipeline.tsx:486`) tiêu thụ nó là **đúng** — funnel là bức tranh tổng
  sức khỏe pipeline toàn cơ sở.
- Lỗi bị khu trú: KanbanColumn (`pipeline.tsx:504-506`) **mượn lại** con số tổng của funnel như thể nó mô tả
  số thẻ trong cột. Hai ngữ nghĩa, một con số → đó là chỗ nói dối.
- **Work-queue đầy đủ ĐÃ TỒN TẠI:** `view=table` + DataTable (`pipeline.tsx:528-533`) + điều hướng `?stage=`
  từ cockpit. Sale muốn xử lý hết mọi cơ hội ở một giai đoạn thì dùng bảng hoặc bấm vào giai đoạn. **Kanban
  board không cần là nơi truy cập vét cạn** — nó là bức tranh tổng quan.

⇒ Query per-stage (5 query, cache optimistic xuyên key, mâu thuẫn nguồn funnel — toàn bộ độ phức tạp red-team
nêu) là **scope creep, cắt bỏ**.

Cách sửa đúng (nhịp-1-only, ~0.5 ngày, một PR, **không đổi contract server**):
- Badge cột thôi khẳng định tổng facility là số thẻ của nó: hoặc hiện số đang-hiển-thị, hoặc bỏ số (funnel
  đã kể câu chuyện tổng-theo-giai-đoạn rồi).
- Empty state phân biệt `stageCounts[stage]===0` ("giai đoạn này chưa có") với `count>0 && shown===0`
  ("không có trên trang này" → trỏ người dùng sang funnel/bảng).
- Kiểm bằng unit/RTL. Mâu thuẫn red-team tan hoàn toàn vì không đụng ngữ nghĩa `stageCounts`.

**Trạng thái:** sẵn sàng thành một phase thi hành khi owner muốn. Không chặn hai PR.

---

## Q3 — Visual regression testing

**Phán quyết: KHÔNG dựng bây giờ.** Hoãn tới khi có người thứ hai hoặc có một hồi quy thị giác cụ thể chạm
người dùng thật.

Lý do: 5 cổng đang có (`console-precedence.test.ts` #124, `ui-ratchet`, `check-ui-frames`, `ui-a11y-roles`,
`check-doc-authority`) đã phủ đúng loại rủi ro cấu trúc mà VRT nhắm tới. Chi phí định kỳ của VRT (screenshot
flaky, baseline churn mỗi lần đổi thiết kế có chủ đích) không đáng với một người vận hành trước UAT — kết cục
nhiều khả năng là một cổng bị tắt/ngó lơ, đúng bệnh "cổng chết `check:ui-a11y-roles`" ta vừa chữa.

---

## Q4 — A11y bàn phím (DataTable)

**Phán quyết: lỗi thật, xếp thành một phase nhỏ SAU khi hai PR vào. Dùng cách "cột hành động Mở hiển thị rõ",
KHÔNG dùng roving tabindex.**

Lý do: khẩn cấp thấp — ERP nội bộ vận hành bằng chuột, chưa có nhân sự phụ thuộc bàn phím (đảo ngay nếu điều
này đổi). `tabIndex` ngây thơ trên hàng tạo ~140 điểm dừng Tab (red-team). Cách tối thiểu mà đúng: một cột
"Mở" luôn hiện là link thật trong DataTable (`data-table.tsx:146-161`) — truy cập được bằng bàn phím, không
cần máy trạng thái roving-tabindex. Không làm lượt này.

---

## Q5 — Primitive LMS mỏng

**Phán quyết: đóng, gỡ khỏi việc đang làm.**

Lý do: việc mở scope ratchet sang `apps/lms/src` (baseline 61) trong #125 đã chặn drift inline-style **mới** —
đó mới là rủi ro thật. Phần còn lại (trích class) là refactor thẩm mỹ, không tác động người dùng. YAGNI.

---

## Việc còn resolvable lượt này vs cần owner

| Việc | Trạng thái |
|---|---|
| Rebase + CI lại #124/#125 | ✅ đã làm |
| Merge #124→#125 vào develop | ⏳ cần owner bấm go (outward, shared branch) |
| Quyết stageCounts | ✅ đã quyết (đảo về nhịp-1-only) |
| Quyết VRT / a11y / LMS | ✅ đã quyết (hoãn / xếp phase / đóng) |
| Thi hành CRM nhịp-1 | sẵn sàng, không chặn — chờ owner khởi động |

## Câu còn treo (không chặn)

1. Có nhân sự phụ thuộc bàn phím / ràng buộc tuân thủ tiếp cận không? Nếu có, kéo Q4 lên ưu tiên.
2. Owner có muốn tôi thi hành luôn CRM nhịp-1 (đã có spec) sau khi hai PR vào, hay để lượt sau?
