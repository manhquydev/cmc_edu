# Phân xử red-team — plan siết design system (2026-08-13)

**Plan:** `plans/260813-0120-design-system-hardening/`
**Reviewer:** 4 lens (assumption-destroyer, failure-mode, scope-critic, fact-checker/security), tất cả verify trên
worktree sạch `develop@69ab8fc`. Cộng một pass xác minh độc lập của orchestrator.
**Kết quả tổng: plan bị bác ở phần cốt lõi.** Quyết định Q1 trước đó **bị đảo ngược**, có bằng chứng đo được.

---

## Điều quan trọng nhất: Q1 đã sai, và đây là bằng chứng

Quyết định cũ: "xóa 17 tên trùng + khối `--text-*` khỏi `console.css` để tách tên biến."
Cảnh báo cũ: "chỉ đổi 2 bậc chữ — `lg` 15→16, `2xl` 18→24."

**Cảnh báo đó sai.** Lane failure-mode nạp thật `tokens.css` + `astryx-theme-cmc.css` + `console.css` (đã cắt)
vào jsdom trên fixture `.o_web_client` trong `[data-astryx-theme=neutral]` rồi **đo**:

| Biến | Hiện tại | Sau khi xóa | Đổi |
|---|---|---|---|
| `--text-display-2-size` | 22px | 32px | **+45%** |
| `--text-display-1-size` | 24px | 32px | +33% |
| `--text-heading-2-size` | 16px | 18px | |
| `--text-heading-3-weight` | 600 | 700 | |
| `--text-label-size` | 13px | 14px | |
| `--text-supporting-size` | 12px | 13px | |
| `--text-code-size` | 13px | 14px | |
| `--text-supporting-leading` | 1.5 | 1.6667 | |

Diện tiêu thụ: **48 file** trong `apps/admin/src` render `<Heading>`/`<Text>`. Nghiệm thu cũ là "soi mắt 3 màn,
tìm h1 to hơn navbar" — người soi sẽ **không** đi tìm label form +1px hay metric +45%.

**Và đây mới là chỗ then chốt:** khối `--text-*` trong `console.css` **không phải lỗi**. Nó chính là **cơ chế**
để admin có typography đặc kiểu Odoo. Xóa nó = thổi phồng chữ toàn admin về mặc định Astryx. Cái sai duy nhất
là nó **không được ghi ra là cố ý** và **không có test nào chốt giá trị resolve**.

**Đảo quyết định:** không tách tên biến nữa. **Giữ nguyên precedence hiện tại, ghi ra rằng nó cố ý, và chốt
nó bằng test.** Bất biến "không thể test" — vốn là lý do tồn tại của cả phase — trở nên có thể test mà
**không dịch một pixel nào**. Chi phí tụt từ 0.5–1 ngày xuống ~2–4 giờ, rủi ro thị giác về 0.

Lý do đảo hợp lệ theo luật dự án: audit đưa **bằng chứng mới đo được**, không phải quan ngại trừu tượng.

## Đòn thứ hai: xóa `--text-*` sẽ mở đường cho hồi quy tự-động-merge

`console-astryx-remap.test.ts:16,58-65` là **cổng tự động duy nhất** hiện chốt remap `--text-*`. Sau khi xóa,
nguồn giá trị chỉ còn trong `node_modules` (`@astryxdesign/theme-neutral/dist/theme.css:98-139`), mà jsdom
**im lặng bỏ qua** `@import` đó (probe: `--text-body-size => ""`). Người thực thi chỉ còn hai lựa chọn tệ:
xóa assertion (mất cổng) hoặc hardcode giá trị upstream (test nói dối khi Astryx bump).

Cộng với `dependabot-auto-merge.yml` tự merge patch/minor khi CI xanh ⇒ **một bản bump Astryx đổi
`--text-label-size` sẽ tự merge, không ai xem.** Đây là lỗ hổng quy trình, không chỉ lỗi CSS.

**Nhận:** thêm test chốt **mapping upstream** — `readFileSync` thẳng `theme-neutral/dist/theme.css`, assert
`--text-label-size` phải trỏ `--font-size-base`, `--text-heading-3-weight` phải trỏ `--font-weight-bold`,
bọc `it.skipIf(!existsSync(...))`. Đỏ khi upstream đổi remap — đúng thứ cần.

---

## Bảng phân xử

| # | Finding | Lens | Mức | Phán |
|---|---|---|---|---|
| 1 | Xóa `--text-*` đổi 8 vai trò chữ, tới +45%, 48 file tiêu thụ | failure-mode | CRITICAL | **Nhận** → đảo Q1, không xóa nữa |
| 2 | Xóa `--text-*` giết cổng tự động duy nhất chốt remap Astryx; dependabot auto-merge | failure-mode | HIGH | **Nhận** → thêm test mapping upstream |
| 3 | Phase 03 nhịp 2 đổi contract `stageCounts` (search) mâu thuẫn chính nhịp 1; `stageCounts` là MỘT field nuôi cả funnel lẫn badge | scope-critic + fact-checker | CRITICAL | **Nhận** → gỡ "sửa kèm" khỏi plan; đây là quyết định sản phẩm, không phải drive-by |
| 4 | Regex `/(--[a-z0-9-]+)\s*:/` bắt nhầm BEM modifier trước pseudo (`.console-sc--planned::before`) → gate phase 01 đỏ trên code đúng, và tạo vùng mù cho gate phase 02 | assumption-destroyer + failure-mode + orchestrator | HIGH | **Nhận** → parser phải chỉ nhận declaration trong thân block; fixture âm bắt buộc |
| 5 | Phase 02 sai tiền đề: 2/3 token có fallback; script theo đặc tả cho 48 false positive từ `WS_CSS` template literal | cả 3 lens + orchestrator | HIGH | **Nhận** → phase 02 co lại còn 1 dòng sửa thật + parser xử template literal |
| 6 | `check:ui-a11y-roles` tồn tại, có test, **không workflow nào chạy** — cổng chết | scope-critic + fact-checker | HIGH | **Nhận** → wire nó; sửa "hai cổng CI" thành ba trong tài liệu |
| 7 | `ui-ratchet.mjs:50` + `check-ui-frames.mjs:13` hardcode `apps/admin/src/pages` → thêm `apps/lms/src` (~1h) mua gần hết giá trị phase 06 (1–3 ngày) | scope-critic | MEDIUM | **Nhận** → thay phần lớn phase 06 bằng một dòng mở rộng scope |
| 8 | Phase 04 item 2 sẽ **xóa đường bàn phím đang chạy được** (`pipeline.tsx:137-145` đã có `tabIndex` + `onKeyDown` có guard); chỗ hỏng thật là `data-table.tsx:146-161` | scope-critic + failure-mode | HIGH | **Nhận** → đổi mục tiêu phase 04 sang data-table dùng chung |
| 9 | `KanbanCard onClick` là fix hỏng: `console-kanban.tsx:70-77` render `<button>` bọc children mà `pipeline.tsx:230-238` nhét `<Button>` vào → HTML không hợp lệ, tệ hơn cái nó thay | fact-checker | HIGH | **Nhận** → bỏ khuyến nghị đó khỏi phase 04 |
| 10 | `KanbanColumnProps` không cần nới: `title` vốn đã `ReactNode`; có consumer thứ hai `teaching/schedule.tsx:241` không có trong plan | scope-critic | MEDIUM | **Nhận** → bỏ thay đổi public contract |
| 11 | Phase 01/04/05 cùng sửa `console.css`; 02 và 05 cùng sửa `ci.yml` → xung đột merge và khó bisect | failure-mode | HIGH | **Nhận** → gộp lại còn 2 PR, xem dưới |
| 12 | Phase 03 nhịp 2 giải bài đã ship: pager `pipeline.tsx:537-559` render trong kanban view không có guard `view === 'table'`; `?stage=` đã lọc server-side | scope-critic + assumption-destroyer | HIGH | **Nhận một phần** → hạ nhịp 2 xuống "đo trước, làm sau"; tiền đề "sale không với tới thẻ" yếu hơn plan tưởng |
| 13 | `astryx-theme-cmc.test.ts` viết lại theo đặc tả là bất khả thi nếu không đụng file phase 01 ghi "không đụng" | fact-checker | MEDIUM | **Nhận** → moot sau khi đảo Q1 |
| 14 | Phase 06 e2e gate rỗng nghĩa: `/parent/report-card`, `/parent/reset-password`, `/student/exercise` không có e2e chạm tới; `apps/lms/src` không có file test nào | assumption-destroyer | MEDIUM | **Nhận** → ghi rõ giới hạn, đừng gọi là "chứng minh" |
| 15 | Thẩm quyền: "owner decision" do agent viết thay, và agent đó đã đổi ý hai lần trong một phiên | scope-critic | — | **Ghi nhận, chuyển cho chủ dự án.** Xem mục dưới |

**Bác:** không finding nào bị bác vì thiếu bằng chứng — cả bốn lane đều trích `file:line`.

## Bảo mật: sạch, và không bịa ra để lấp chỗ

`crm.opportunityList` gate `requirePermission` (`router.ts:442`), nhét `facilityId` vào where **trước** khi
push `stage` (`:449` → `:450`), bọc `withFacility` RLS (`:473`); hai aggregate re-scope ở `:488,491`. Query
per-stage **không** rò dữ liệu xuyên facility. Hai script mới không nhận tham số, không spawn shell. Không
phase nào thêm dependency.

---

## Vấn đề thẩm quyền — cần chủ dự án đọc

Lane scope-critic chỉ thẳng: `decisions-owner-260813-0120-design-system.md:5` ghi *"Người quyết: agent thay
mặt chủ dự án"*, và agent đó đã đổi lập trường hai lần trong một phiên. Nó dùng điểm này để bác phase 01.

Đánh giá công bằng: **điểm quy trình đúng, nhưng nó không tự bác được kỹ thuật.** Cái thật sự bác phase 01 là
bảng số đo +45%, không phải chuyện ai ký. Tuy vậy ghi nhận nguyên tắc: một thay đổi typography toàn app
không nên đi qua chữ ký agent. Sau khi đảo Q1, phase còn lại **không dịch pixel nào**, nên vấn đề thẩm quyền
tự tiêu — và đó là thêm một lý do nữa để chọn hướng đã đảo.

---

## Plan sau phân xử: 6 phase → 2 PR

| PR | Nội dung | Rủi ro thị giác | Công |
|---|---|---|---|
| **A — Chốt precedence + diệt token ma** | Ghi đúng sự thật vào `astryx-theme-cmc.test.ts` (console thắng trong shell, **cố ý**); thêm test cross-file chốt giá trị resolve tại `.o_web_client`; thêm test mapping upstream `theme-neutral` (`skipIf`); sửa `--cmc-text-supporting` ở `report.tsx:136` | **Không** | ~3–5h |
| **B — Tài liệu + phủ cổng** | Sửa authority split (README, TL12, `design-system/cmc-edu/*`, `llms.txt`, comment chết); **ghi ra luật precedence** vào `design-system-console.md`; wire cổng chết `check:ui-a11y-roles`; sửa "hai cổng" → ba; mở scope ratchet/frames sang `apps/lms/src`; bỏ `user-scalable=no`; meta bài `2xs`→`sm` | Không (trừ 2 sửa đọc, có chủ đích) | ~3–5h |

**Hoãn có lý do, không phải bỏ:**
- **Phase 03 (kanban)** — chặn bởi một quyết định sản phẩm: `stageCounts` nên là tổng facility hay tổng theo
  bộ lọc? Một field đang nuôi cả funnel lẫn badge; không thể vừa giữ vừa đổi. Cần chủ dự án chốt.
- **Phase 04 (a11y)** — đổi mục tiêu sang `data-table.tsx:146-161`; **không** đụng `pipeline.tsx:137-145`
  (đang chạy được) và **không** dùng `KanbanCard onClick` (HTML không hợp lệ). Cần một pass thiết kế lại.
- **Phase 06 (LMS)** — phần đắt bị thay bằng một dòng mở rộng scope ratchet (nằm trong PR B). Phần trích class
  giữ lại trong backlog, giá trị thấp hơn hẳn sau khi ratchet đã phủ.

Từ 6–11 ngày xuống ~1 ngày cho phần có bằng chứng đáng làm ngay.

## Câu treo chuyển cho chủ dự án

1. `stageCounts`: tổng facility (giữ contract F7) hay tổng theo bộ lọc đang áp? Phase 03 đứng đây.
2. Chấp nhận typography admin giữ nguyên như hiện tại vĩnh viễn (hướng đã đảo), hay vẫn muốn hội tụ về một
   thang chữ ở một PR riêng có VRT trước?
3. Có nên dựng visual regression không — nó là thứ duy nhất biến "3 màn soi mắt" thành cổng thật.
