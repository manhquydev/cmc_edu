# Phase B — Đóng authority split + phủ cổng đang thủng

**Trạng thái:** sẵn sàng thi hành · **Công:** ~3–5h · **Branch:** `docs/console-authority` (worktree đã dựng)
**Thay cho:** phase 05 + phần rẻ nhất của phase 06
**Đặc tả dòng-theo-dòng:** `plans/reports/phase-spec-260813-0120-doc-authority.md`
**Căn cứ bổ sung:** `plans/reports/redteam-adjudication-260813-0139-design-system.md`

## Luật rút ra từ red-team, áp cho toàn phase

`package.json` có script `check:ui-a11y-roles` (kèm `scripts/check-ui-a11y-roles.mjs` 124 dòng **và** file
test) nhưng **không workflow nào chạy nó**. Một cổng chết còn tệ hơn không có cổng: tài liệu sẽ chép nó vào
bảng Verification và mọi người tin là đang được bảo vệ.

⇒ **Mọi thứ phase này thêm vào phải được wire vào CI trong cùng PR.** Không có ngoại lệ.

## Việc

### 1. Sửa authority split trong tài liệu

Theo đúng `plans/reports/phase-spec-260813-0120-doc-authority.md` mục 1 và 2:
`docs/README.md:15,41` · `docs/12-design-system-ui.md` (`:8-9`, `:23-30`, `:76-80`, `:87`, `:95-101`, `:111-116`) ·
`design-system/cmc-edu/{STRUCTURE,PAGE-FRAMES,MASTER}.md` · `packages/ui/llms.txt:79` · comment chết ở
`packages/ui/src/index.ts:166-169` và `console.css:1394` (**giữ** `primitives.ts:35-41` và
`console-navbar.tsx:8`).

### 2. Ghi ra luật precedence — hạng mục MỚI, quan trọng nhất của phase

`docs/design-system-console.md` phải nói rõ, vì đây chính là phát hiện gốc của cả đợt audit:

> Bên trong `.o_web_client`, `console.css` **cố ý** thắng API Astryx (`--font-size-*`, `--color-text-*`,
> `--font-family-*`, `--text-*`) để tạo mật độ kiểu Odoo. Đây là thiết kế, không phải tai nạn cascade.
> Ngoài shell (LMS), Astryx/CMC thắng. Luật này được chốt bằng
> `packages/ui/src/console/console-precedence.test.ts` (phase A).

Kèm hai mục còn thiếu: Astryx one-door tại `primitives.ts` (gồm SideNav re-export `:35-41`, **không** phải
shell), và bảng cổng CI **đúng** — liệt kê đủ cổng đang chạy, không phải "hai cổng".

### 3. Hồi sinh cổng chết

Wire `check:ui-a11y-roles` vào `.github/workflows/ci.yml` cạnh `check:ui-ratchet` / `check:ui-frames`.
Nếu nó **đỏ** trên `develop` ⇒ **dừng, không sửa code app để ép xanh**. Ghi lại kết quả và báo cáo —
đó là một phát hiện riêng, không phải việc của phase này.

### 4. Mở phủ cổng sang LMS

`scripts/ui-ratchet.mjs:50` và `scripts/check-ui-frames.mjs:13` hardcode `apps/admin/src/pages`. Thêm
`apps/lms/src` mua gần hết giá trị của phase 06 cũ (1–3 ngày) với chi phí ~1h.

**Bắt buộc đọc cơ chế baseline trước khi mở scope.** LMS có ~77 inline style; nếu ratchet là zero-tolerance
thì mở scope sẽ đỏ ngay. Cách đúng: ghi số hiện tại của LMS làm **baseline** (chặn cái mới, dung thứ cái cũ).
**Nếu việc mở scope cần nhiều hơn là thêm một mục baseline ⇒ DỪNG, báo cáo, đừng ép.**

### 5. Cổng tài liệu

Thêm `scripts/check-doc-authority.mjs` theo đặc tả mục 3 của file spec, **và wire ngay vào CI** (luật ở đầu
phase này). Kèm test node nhỏ: chèn chuỗi cấm vào fixture → đỏ; HEAD sạch → xanh.

### 6. Hai sửa đọc cho LMS

- `apps/lms/index.html:6` — xóa `maximum-scale=1.0, user-scalable=no`, giữ `width=device-width, initial-scale=1.0`
- Meta bài `2xs`→`sm`: `student/home.tsx:90`, `exercise.tsx:149,153`, `homework-results.tsx:64`.
  **Không** đụng `login.tsx:210,257,272` hay `session-evidence.tsx:116,139` (không phải meta bài)

## Nghiệm thu

- [ ] `rg -n 'AppFrame|\.ck-surface|\.sh-\*|tpl-wrap|\.premium-|premium\.css'` trên tập allowlist = 0
- [ ] Mọi script mới/hồi sinh đều **có mặt trong `.github/workflows/ci.yml`**
- [ ] `check:doc-authority` đã chứng minh đỏ được
- [ ] `docs/design-system-console.md` có mục precedence và bảng cổng CI đúng
- [ ] TL12 vẫn là SoT cho LMS; `primitives.ts` vẫn export SideNav
- [ ] `pnpm typecheck` xanh

## Rủi ro

`check:ui-a11y-roles` có thể đỏ trên `develop` (nó chưa từng chạy trong CI). Đó là kết quả hợp lệ — báo cáo,
đừng vá code app để ép xanh. Mở scope ratchet sang LMS có thể lộ ra nhiều vi phạm hơn dự tính; baseline là
đường thoát đúng, ép xanh bằng cách nới điều kiện fail là sai.
