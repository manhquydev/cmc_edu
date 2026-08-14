# D0→D5 thực thi — design system từ lab tới production

**Date:** 2026-08-14
**Đầu vào:** `plans/reports/redteam-adjudication-260814-design-lab.md` (5 lens, verdict "chưa freeze-ready")
**Phạm vi:** `design-lab/system/`, `DESIGN.md`, `packages/ui`, `apps/admin`, `apps/api` (một trường DTO)
**Comp of record:** `.impeccable/screenshots/comp-of-record/` (chụp lại sau khi sửa; ảnh `system-v2/` cũ không còn dùng)

## Kết quả kiểm chứng

| Gate | Kết quả |
|------|---------|
| `pnpm typecheck` | 34/34 task xanh |
| `pnpm test` | 29/30 task xanh. Task đỏ duy nhất là `@cmc/api#test`, toàn bộ 982 lỗi là `createPrismaClient: neither APP_DATABASE_URL nor DATABASE_URL is set` — thiếu database cục bộ, không phải hồi quy. **Phải xác nhận lại trên CI.** |
| `@cmc/ui` | 203 → 214 test xanh (11 test mới cho grammar danh sách) |
| `apps/admin` finance | 71 test xanh (4 test mới cho cổng duyệt) |
| Lab, đo trong browser thật | 30 tổ hợp trang × viewport: không lỗi console, không tràn ngang, không còn tone sai, không còn `data-subject` |

## D0 — toàn vẹn lab (đã xong)

Đo được trước và sau, không dựa vào ảnh cũ.

- **`--space-5` không tồn tại** khiến `.metric` và `.sheet` đo ra `padding: 0px`. Thêm `--space-wide` vào Layer 2 và sửa 6 điểm dùng. Đo lại: `.metric` = `24px 20px`, `.sheet` = `20px`.
- **Đuôi `system.css` hỏng** (một rule mồ côi sau dấu `}` cuối). Xoá, đồng thời phát hiện chuỗi thay thế ăn lẹm `.synth-banner` và khôi phục. Ba file CSS cân bằng ngoặc.
- **Focus ring là cơ chế sai, không phải thiếu.** `box-shadow` bị cắt bởi mọi vùng `overflow` và mất hẳn trong forced-colors. Chuyển sang `outline` thật + fallback `Highlight`. Nhấn Tab thật trong browser: `outline: rgb(113, 99, 158) solid 2px`, offset `2px`.
- **Flat-By-Default bị rò** ở hai chỗ: `box-shadow` trên `.palette` và `linear-gradient` trên `.sticky-actions`. Thay bằng hairline + nền đặc. Hệ thống giờ đúng là một shadow duy nhất (toast).
- **Layer 3 đọc primitive** (`--btn-pad-x`, `--statusbar-current-bg`) → trỏ qua Layer 2. Print dùng hex thô → dùng primitive, và làm đậm mực muted/faint cho giấy.
- **Tương phản: sửa nhiều hơn phần đã báo.** Không chỉ badge danger; ink `amber-600` trên tint của nó chỉ 3.07 và `green-600` chỉ 3.15 — cả hai fail AA mà vòng review trước không bắt. Thêm bậc ink 700 cho cả bốn hue (4.79–6.16). Ba bậc xám dịch xuống một bước: muted `#63636b` (5.95), faint `#71717a` (4.83), và `--text-disabled` là mực duy nhất dưới AA, chỉ dùng cho control disabled/placeholder mà WCAG miễn.
- **Inter 550** được `DESIGN.md` yêu cầu nhưng không nằm trong 11 thẻ font. Đã thêm.
- **Density bị localStorage ghi đè page default**, nên Audit (dense-by-trade) mất mặc định compact. Lưu theo từng trang; đo lại: Audit 32px, chín trang còn lại 40px.
- Breakpoint lệch tài liệu (1180/900 so với 1100/860/640) → khớp lại, và rail giờ bung thành hai cột dưới queue như `DESIGN.md` mô tả.
- Hành động dòng không còn ẩn toàn bộ khi nghỉ: hành động chính luôn hiện, chỉ hành động phụ mới `data-reveal="hover"`.

## D1 — conflict ledger và hai quyết định (đã xong)

`design-lab/system/CONFLICT-LEDGER.md` là bản đo, thay cho giả định "alias sạch".

**Phát hiện quan trọng: red-team nói quá mức nguy hiểm.** So 121 token public của lab với toàn bộ graph CSS production, **chỉ 1 collision**: `--radius-container` (lab 8px vs contract 4px). Palette lệch giá trị nhưng khác tên nên không xung đột. Đã đổi tên token lab thành `--radius-panel` ⇒ còn 0 collision, và không rule production nào tiêu thụ tên của lab, nên alias là bất biến với UI hiện có.

Hai câu hỏi chặn được giải theo **authority trong repo**, không theo sở thích, vì `OPENEDUCAT-VISUAL-CONTRACT.md` vẫn là authority đã khoá:

- **Q-radius/palette → production thắng.** Bridge alias *tên* của lab lên *giá trị* của production. Hệ quả nói thẳng: component viết theo token lab sẽ ra 4px và palette OpenEduCat trong `apps/admin`, không phải vẻ 6/8px của gallery. Gallery là hướng thị giác và authority về grammar, không phải lời hứa về pixel production.
- **Q-shell → giữ top OS của OpenEduCat** (46px navbar + 58px control panel). Rail 240px của lab là thăm dò; Shared-Chrome Rule chỉ có hiệu lực trong lab. Wave 9 (cockpit theo vai) bị hạ khỏi phạm vi cho tới khi có người quyết.

## D2 — grammar cạnh và độ tinh khiết của tone (đã xong)

- **Rỗng ×3** thành ngữ pháp thật: chưa từng có · bộ lọc quá hẹp · đã xong, mỗi kiểu một câu chuyện và một đường đi tiếp. Có trên `patterns.html` và ba module trọng yếu (CRM, Finance, Teaching).
- **Từ chối quyền ×3**: che (ô giữ chỗ để bảng không nhảy cột), chặn (nút dùng `aria-disabled` nên lý do tới được bàn phím), khước từ (panel nêu tên vai có quyền).
- **ConfirmGate** nêu hậu quả nghiệp vụ chứ không hỏi "bạn có chắc không": huỷ phiếu sinh bút toán đảo, công bố điểm là phụ huynh thấy ngay. Đo trong browser: `Esc` đóng, focus rơi vào nút thoát.
- **Dải lỗi tải và dữ liệu cũ** giữ nguyên bộ lọc, dán nhãn giờ của số liệu cũ thay vì lặng lẽ giả vờ là mới.
- **SoD twin** chứng minh điều khó nhất: cùng một khung, đổi vai thì dòng biến mất, số tiền bị che, cột đổi nghĩa — còn chrome không đổi. Đo được: chuyển sang vai sale ⇒ 2 ô bị che, nút bị chặn có `aria-describedby` trỏ tới lý do.
- **Dọn tone**: chủ đề, vai, loại hành động audit không còn vay `success`/`brand`/`danger`. Thêm trục categorical bốn bậc (`data-category`). KPI "Đạt" từ `warning` thành `success` — đạt ngưỡng là đạt, không phải cảnh báo.
- **Tách bộ ký hiệu RBAC khỏi điểm danh.** Trước đây "V" nghĩa là "vắng" ở lưới này và "không có quyền" ở lưới kia. Giờ RBAC dùng chữ riêng: Có · Không · **Bypass**, và Bypass mang tông nguy hiểm vì đó là ô người kiểm toán cần thấy trước nhất.
- Command palette: nút mở tự ẩn khi trang không có dialog, thay vì để lại control bấm không ra gì.

## D3 — alias token vào production (đã xong, không đổi pixel)

Khối bổ sung ở cuối `packages/ui/src/console.css`, scope `.o_web_client`, không sửa một khai báo cũ nào.

Một cái bẫy đáng ghi: test `console-tokens.test.ts` cấm chuỗi `:root` xuất hiện *ở bất kỳ đâu trong file, kể cả comment*. Comment đầu tiên của tôi có nhắc chuỗi đó và làm đỏ gate — đã diễn đạt lại. Đây chính là loại gate mà mô hình một-người-vận-hành cần.

Cố tình **không** alias `--size-nav-width` / `--size-rail-width`: shell topology chưa được quyết.

## D4 — grammar danh sách trong production (đã xong)

- `EmptyState` nhận `kind` và phát ra `data-empty-kind`. `DataTable.empty` nhận thêm dạng `TableEmptySpec` (kind + mô tả + hành động). **Chuỗi mặc định không đổi**: một string trần không tự nhận là câu chuyện nào, vì nó không thể biết. Nhờ vậy 40+ call site cũ không bị đổi chữ ngoài ý muốn.
- Cột sắp xếp được: `aria-sort` đặt trên `th`. Cột sortable mà chưa active vẫn báo `none` chứ không im lặng, nên trình đọc phân biệt được "sắp được, chưa sắp" với "không sắp được". Vì `Table` của Astryx sở hữu `th`, header button vươn lên ô của chính nó để đặt attribute.
- Density trên `DataTable` qua `data-density` trên `.console-list`; 40px vẫn là mặc định contract.
- `BulkActionBar` không còn nói quá phạm vi: khi trang được chọn hết mà còn dòng khớp bộ lọc, nó nói rõ "chỉ các dòng của trang này" và mời chọn rộng hơn. Đây là cách chặn tình huống hành động lên 312 dòng khi người dùng tưởng mình chọn 20.
- Áp thật lên `apps/admin` trang phiếu thu: rỗng-vì-lọc có nút bỏ lọc, rỗng-lần-đầu dẫn sang ghi danh, ba cột sắp xếp được, bulk bar khai báo phạm vi trung thực ("đã chọn N dòng đang tải" — không nhận đã chọn dòng chưa tải).

## D5 — spike SoD/cổng duyệt Finance (đã xong)

Vấn đề gốc: `canApprove` là một boolean gộp ba lý do khác nhau (không có quyền · tự soạn · vượt ngưỡng), nên UI chỉ có thể **ẩn nút**. Người vận hành thấy màn hình không có gì và không biết phải hỏi ai — phiếu tiền đứng im trong im lặng.

Đã thêm trường DTO bổ sung `approvalBlock: 'no-permission' | 'self-created' | 'needs-second-eye'`, tính từ đúng ba điều kiện mà server đã kiểm. UI giờ nêu tên luật và tên người có quyền, và im lặng khi phiếu đã ra khỏi `draft`.

Banner vượt ngưỡng đổi từ `warning` sang `info`: cần người duyệt cấp cao hơn là **trạng thái** của phiếu, không phải lỗi của ai.

Test server cho trường này **chưa chạy được cục bộ** (suite `apps/api` cần database). Bốn test UI đã khoá hành vi hiển thị; trường server phải được CI xác nhận.

## Còn lại, và điều kiện để làm

| Việc | Chặn bởi |
|------|----------|
| Wave 4 atoms (badge/button/tabs) | Không chặn; chưa làm |
| Saved views + URL state trong production | Không chặn; chưa làm |
| Spacing của bốn archetype | Không chặn; nên đi sau wave 4 |
| Module grammar (8 module) | Nên một module một PR; đừng làm song song |
| Cockpit theo vai | **Q-shell** — cần người quyết topology |
| Repaint production sang palette/radii của gallery | **Q-radius** — cần người quyết, kèm ledger giá trị bị ảnh hưởng |

Ba thứ vẫn **không** bridge: hình học chevron statusbar, hình thang funnel, và mọi demo tương tác của lab (kanban drag-drop, cycle điểm danh, nháp bảng điểm, sort client-side) — chúng không có guard quyền, không có guard giai đoạn, không có round trip server.
