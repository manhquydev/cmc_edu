# 2026-08-13 — Design system hardening: audit → 6 PR → review độc lập bắt bug tự ship

**Phiên:** một ngày, điều phối grok qua herdr (nhiều worktree/pane song song) + subagent Claude.
**Kết quả:** 6 PR vào `develop` (#124, #125, #127, #128, #129, #132), mỗi cái CI xanh + auto-merge.
**Đo, không chép:** mọi finding đều tự tái hiện (mutation), không tin báo cáo agent.

## Dòng thời gian

1. **Audit song song** (4 lane grok + 1 đối chứng Claude, đều dùng `impeccable`). CMC Console **10/20**,
   LMS **10/20**. Bệnh gốc: `astryx-theme-cmc.css` và `console.css` khai trùng **17 tên biến**, kẻ thắng do
   cascade; **mọi test CSS là `readFileSync` một file** nên bất biến quan trọng nhất (giá trị resolve tại
   component) không thể bị bắt lỗi.

2. **Plan → red-team 4 lens → red-team ĐẢO chính plan.** Kế hoạch đầu: xóa 17 tên trùng + khối `--text-*`.
   Lane failure-mode nạp thật vào jsdom rồi **đo**: việc đó đổi 8 vai trò chữ toàn admin, tới **+45%**
   (`--text-display-2-size` 22→32px), 48 file tiêu thụ. Khối `--text-*` **không phải lỗi** — nó là cơ chế tạo
   mật độ kiểu Odoo. Hướng đúng: **giữ nguyên precedence, ghi ra rằng nó cố ý, chốt bằng test** — cùng bảo
   đảm, không dịch pixel nào. 6–11 ngày → ~1 ngày.

3. **Ship 3 phase (A/B/C):**
   - **#124** precedence test (test đầu tiên trong repo nạp nhiều CSS cùng lúc) + diệt token ma
     `--cmc-text-supporting`.
   - **#125** đóng authority split (README/TL12/design-system), ghi luật precedence, **hồi sinh cổng chết**
     `check:ui-a11y-roles` (tồn tại kèm test nhưng không workflow nào chạy), thêm `check:doc-authority`, phủ
     ratchet sang LMS (baseline 61).
   - **#127** kanban CRM: badge cột = số thẻ đang hiện (không mượn tổng facility của funnel). BA đảo phán
     quyết "nhịp 2 bắt buộc" sau khi đọc ra `view=table` + `?stage=` đã là work-queue vét cạn.

4. **Review ĐỘC LẬP sau merge** (3 grok chưa từng xây + cấm đọc report + tự đột biến; tôi tự chạy 9 cổng CI
   = PASS và tự tái hiện). Bắt được cái mà 6 review lúc-xây + CI + mutation của tôi đều lọt:
   - **#127 empty-state nói dối dưới filter** — `lost=only`, cột có lost off-page → `facilityCount=0` (server
     loại lost) → in "Chưa có" trên cột thật sự có lost = đảo ngược mục tiêu PR. Tôi phiên trước xem nhẹ là
     "low, BA chấp nhận" vì chỉ xét case search.
   - **cổng doc-authority #125 có lỗ** — `STYLING-BRIDGE.md` dạy "add `.sh-cta--*`" (chỉ dẫn sống tạo class
     nghỉ hưu), ngoài allowlist.
   - **precedence #124 WEAK** — font-size pin cứng OK, nhưng màu là pin-CHUỖI (đột biến fallback-hex → xanh
     giả), `--text-*` role không pin phía console.

5. **Fix-forward:** **#128** empty-state trung thực dưới filter (filtersActive → copy trung tính không số) +
   **#129** dọn `.sh-*` + phủ doc-authority (allowlist 8→10, cùng FORBID) + **#132** pin GIÁ TRỊ màu +
   `--text-*` role + ratchet đếm `background`. Mỗi cái mutation-verified độc lập trước khi mở.

## Bài học (đắt, có bằng chứng)

- **Review độc lập SAU MERGE là lớp bắt lỗi mà review lúc-xây không thay được.** Người xây (kể cả tôi) bị neo
  vào ý đồ; agent độc lập tấn công tổ hợp mới (`lost=only`, fallback-hex) và bắt bug đã lọt qua CI xanh + 6
  review + mutation của chính tôi. Rẻ hơn nhiều một bug sale-facing lọt production.
- **Đo, đừng chép.** Quyết định lớn nhất (không-xóa-token) bị đảo bởi một bảng số jsdom, không phải lý lẽ.
  "green test" ≠ "test chốt bất biến" — phải tự đột biến từng kịch bản, không chỉ cái dễ nhất.
- **Cổng chết còn tệ hơn không cổng** (`check:ui-a11y-roles` có test nhưng không ai chạy → tài liệu tin là
  được bảo vệ). Mọi cổng thêm vào phải wire CI cùng PR.
- **Bẫy môi trường ≠ lỗi diff.** Nhiều "lỗi sẵn có" agent báo thực ra là Prisma chưa generate trong worktree
  (thiếu `packages/db/prisma/.env`); và local `develop` cũ khiến `git diff develop...HEAD` phồng lên. Xác
  minh bằng cách checkout base **trong chính worktree** / so với `origin/develop`.
- **grok load AgentKit qua claude-compat** (`grok inspect` là nguồn đúng) nhưng phải gọi `/ak-engineer:ak-xxx`
  vì tên trần ambiguous.

## Còn treo (backlog)

- **A11y DataTable mở dòng bằng bàn phím** — `plans/260813-0120-design-system-hardening/phase-D-a11y-datatable-keyboard.md`.
  Khẩn cấp thấp (ERP nội bộ dùng chuột). Cách chốt: cột "Mở" link thật ở `data-table.tsx`, KHÔNG roving-tabindex.
  **Đảo ưu tiên cao nếu** có nhân sự phụ thuộc bàn phím / ràng buộc tuân thủ tiếp cận.

## Chỉ mục báo cáo phiên

`plans/reports/audit-260813-0052-ds-impeccable-synthesis.md` · `redteam-adjudication-260813-0139-design-system.md`
· `decisions-ba-260813-0800-outstanding-issues.md` · `review-indep-260813-0918-adjudication.md`
· `research-260813-0908-dev-pipeline.md`.
