# Quyết định chủ dự án — design system CMC Console (2026-08-13)

**Nguồn:** audit song song 4 lane grok + đối chứng Claude (`audit-260813-0052-ds-impeccable-synthesis.md`),
vòng 2 brainstorm/advise (`brainstorm-260813-0120-q1/q2`, `phase-spec-260813-0120-doc-authority/lms-primitives`).
**Người quyết:** agent thay mặt chủ dự án, theo yêu cầu tự giải quyết câu treo.
**Trạng thái:** đã chốt, đã dựng plan `plans/260813-0120-design-system-hardening/`.
**Chưa thi hành dòng code nào.**

---

## Q1 — Ai sở hữu token bên trong `.o_web_client`?

### Chốt: B-narrow — tách tên biến, KHÔNG dựng "hai theme có tên"

Chủ sở hữu:
- `:root` `--cmc-*` → `packages/ui/src/tokens.css`
- API Astryx (`--font-size-*`, `--color-text-*`, `--font-family-*`, `--text-*`, `--radius-*`) → `packages/ui/src/astryx-theme-cmc.css`, **kể cả bên trong shell**
- `.o_web_client` **chỉ được khai báo** `--console-*`; `--cmc-*` là inherit, không khai lại

### Hai chỗ lập trường ban đầu của tôi SAI, đã sửa

**Sai 1 — "B không đổi pixel".** Sai. Xóa 17 tên trùng trên `.o_web_client` thì Astryx và `h1–small`
(`console.css:434-441`) inherit ngược lên `:root` CMC: `--font-size-lg` 15→16px, `--font-size-2xl` 18→24px.
`ui-e2e` không bắt được thay đổi này. B là A thu nhỏ, **không** phải đường tránh pixel. Chấp nhận: đây là
lần duy nhất thang chữ trở thành một thang, và 3 màn hình soi bằng mắt rẻ hơn dựng visual regression bây giờ.

**Sai 2 — "test giao 3 file là đủ".** Sai. `tokens ∩ console` vốn **đã rỗng**. Xung đột thật là
`astryx-theme-cmc.css ∩ console.css` = **17 tên**. Nguy hiểm hơn: khối `--text-*` (`console.css:387-426`)
**không nằm trong giao 3 file** nhưng vẫn cướp API Astryx qua theme-neutral import — một test giao 3 file
sẽ **xanh** trong khi `--text-body-size` vẫn đè primitive. Gate đúng phải là `decl(astryx) ∩ decl(console) === ∅`
**cộng** allowlist `decl(console) ⊆ {--console-*}`.

### Rủi ro chấp nhận có ý thức

Không có visual regression. Biện pháp bù: (1) test cross-file bắt mọi tái phạm tên biến; (2) soi mắt đúng
3 màn — list, detail, dashboard; (3) PR nhỏ, một mục đích, dễ revert. Chấp nhận rủi ro chữ nhích 1px ở vài
chỗ đổi lấy việc chấm dứt một bất biến không thể test.

### Không làm bây giờ

Phương án A (hội tụ canvas/border/text về `--cmc-*`) — để PR riêng, sau, khi có mắt người hoặc VRT.
Không dựng `data-theme=cmc-soft|console-odoo`. Không đụng dark mode.

---

## Q2 — Kanban CRM nói dối con số

### Chốt: GIỮ board · nhịp 1 nhãn hóa · nhịp 2 query per-stage — nhịp 2 KHÔNG tuỳ chọn

### Chỗ lập trường ban đầu của tôi SAI

Tôi nêu hai mệnh đề **đối nhau**: "không hiển thị số không khớp thẻ" (⇒ badge = số thẻ đang render) và
"empty chỉ khi `stageCounts===0`" (⇒ badge vẫn là tổng server). Không thể cùng đúng. Tệ hơn, badge =
`stageCounts` đang bị **khóa bằng test** (`pipeline.test.tsx:13-14,58-60,153-166` — ghi rõ: đừng đếm `items`),
nên đổi badge sang số thẻ là **đảo contract đã test**, không phải vá nhỏ.

### Chốt lại

Không giấu số. **Nói thật phần thiếu:**
- Badge hiện `visible/total` (vd. `1/5`) khi hai số lệch; chỉ hiện `count` khi khớp
- Empty state chỉ khi `count === 0`. Khi `count > 0 && items === 0` → copy riêng "0 trên trang này · N ở giai đoạn",
  **cấm** dùng `.console-kanban-empty` "Chưa có"
- Funnel giữ tổng — đó mới là số để ra quyết định

Nhịp 1 **chưa** hết nói dối ở mức công cụ: sale vẫn không chạm được 7 thẻ ngoài trang 1, và `stageCounts`
cố ý bỏ qua `search` (`router.ts:483-491`) nên lọc theo tên vẫn ra số facility-wide. Vì vậy **nhịp 2 nằm cùng
plan, không phải backlog**. Làm nhịp 1 rồi dừng = để sale quyết trên con số họ không với tới.

Nhịp 2 **không cần endpoint mới**: `opportunityListInput.stage` (`router.ts:102,450`) và `stageCounts`
(`:474-495`) đã có. Làm 5 `useQuery` theo stage + pager per cột. Chỉ mở endpoint `opportunityBoard` nếu đo
được 5 round-trip là chậm — không mở trước.

**Cấm:** nâng `PAGE_SIZE` lên 100 rồi gọi là xong. Vỡ ở bản ghi thứ 101 và CI không bắt.

---

## Q3 — Plan hay PR nhỏ?

### Chốt: cả hai — plan 6 phase, phase 01 chính là PR nhỏ nhất cầm máu

Không có mâu thuẫn giữa hai lựa chọn. Plan tồn tại để thứ tự và điều kiện tiên quyết không bị quên giữa các
phiên; phase 01 vẫn là một PR ~70 LOC.

**Thứ tự đã chốt và lý do:**

1. **Token isolation** (Q1) — rẻ nhất, và là thứ duy nhất hiện không cổng nào bắt được
2. **Token ma** (`--cmc-text-supporting` không fallback, đã vào `dist`) — ~30 dòng script chặn vĩnh viễn
3. **Kanban CRM** — đặt **trước** a11y, xem dưới
4. **A11y P0** — focus-visible, `role="button"` lồng, mở dòng bằng bàn phím
5. **Doc authority** + grep-check CI
6. **LMS primitives** — không P0, phụ thuộc phase 1 và 4

**Vì sao kanban đứng trước a11y** (đây là chỗ tôi đảo thứ tự severity của audit): sale đang ra quyết định
tuyển sinh trên con số sai — đó là lỗi nghiệp vụ đang gây hại mỗi ngày. Bàn phím không dùng được là lỗi
tiếp cận thật, nhưng với ERP nội bộ vận hành bằng chuột thì nó chưa làm ai quyết định sai. Nếu có nhân sự
phụ thuộc bàn phím hoặc có ràng buộc tuân thủ tiếp cận, thứ tự này phải đảo lại.

---

## Ghi chú cách làm việc rút ra

Bốn lane grok được giao *lập trường sơ bộ của chủ dự án kèm lệnh phản biện thẳng* thay vì câu hỏi trung tính.
Hai trong ba lập trường bị bác bằng bằng chứng `file:line` cụ thể (không phải bằng lý lẽ chung chung). Giao
việc kiểu này đắt hơn hỏi trung tính nhưng ra quyết định chắc hơn — giữ cách này cho các câu hỏi thiết kế sau.

## Câu còn treo (không chặn plan)

1. Có nhân sự nào phụ thuộc bàn phím / có ràng buộc tuân thủ tiếp cận không? Nếu có, đảo phase 03 ↔ 04.
2. Phương án A (hội tụ một ngôn ngữ thị giác) — làm sau phase 01, hay bỏ hẳn và sống với hai bảng màu có tên?
3. Có dựng visual regression không? Nếu có thì làm trước phase 01 sẽ rẻ hơn nhiều so với làm sau.
