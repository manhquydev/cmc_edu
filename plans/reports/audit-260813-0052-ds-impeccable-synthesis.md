# Tổng hợp audit design system CMC Console theo impeccable

**Ngày:** 2026-08-13 · **Base:** `develop` @ `69ab8fc` · **Worktree:** `audit/design-system-impeccable`
**Chế độ:** audit-only (không sửa code, không commit) · **Điều phối:** herdr, 4 pane grok song song + 1 subagent Claude đối chứng độc lập

## Cách đọc báo cáo này

5 agent chạy **độc lập, không thấy kết quả của nhau**, trên hai harness khác nhau (grok TUI và Claude Code). Giá trị nằm ở **chỗ chúng trùng nhau** — finding nào được hai harness độc lập tìm ra bằng cùng `file:line` thì gần như chắc đúng; finding chỉ một lane thấy thì cần đọc kỹ hơn.

| Lane | Agent | Phạm vi | Report |
|---|---|---|---|
| L1 | grok `ds-tokens` | token / scale / contrast / dark mode | `audit-260813-0052-ds-l1-foundations.md` |
| L2 | grok `ds-components` | component, trạng thái, a11y, form | `audit-260813-0052-ds-l2-components.md` |
| L3 | grok `ds-drift` | doc↔code drift, biên admin/LMS | `audit-260813-0052-ds-l3-drift.md` |
| L4 | grok `ds-lms` | LMS + nhất quán liên ứng dụng | `audit-260813-0052-ds-l4-lms.md` |
| X | Claude `ui-ux-designer` | đối chứng độc lập toàn hệ | `audit-260813-0052-ds-claude-crosscheck.md` |

**Toàn bộ là phân tích tĩnh.** Không build, không mở browser, không chạy test. Mọi kết luận về pixel thật và về việc test có xanh hay không đều **chưa được xác minh**.

---

## Điểm số

| | L1 Foundations | L4 LMS |
|---|---:|---:|
| Accessibility | 2/4 | 1/4 |
| Performance | 3/4 | 3/4 |
| Responsive | 3/4 | 2/4 |
| Theming | 1/4 | 2/4 |
| Implementation Integrity | 1/4 | 2/4 |
| **Tổng** | **10/20** | **10/20** |

Hai lane độc lập, hai phạm vi khác nhau, cùng ra 10/20 "Acceptable — significant work needed". Điểm thấp nhất ở cả hai đều là **Theming + Implementation Integrity**, không phải a11y hay perf. Đây là bệnh cấu trúc, không phải bệnh bề mặt.

---

## P0 — xếp theo độ tin cậy của bằng chứng

### P0-A · Ba không gian token cùng khai một quyết định, không có luật thắng thua và không có test nào kiểm

**Được hai harness độc lập tìm ra** — grok L1 (P0-2) và Claude cross-check (P0), cùng chỉ vào cùng file.

`--cmc-*` (tokens.css), `--console-*` (console.css) và pin Astryx (astryx-theme-cmc.css) cùng định nghĩa **trùng tên** cho cùng quyết định, khác giá trị:
- radius control: 12px / 4px / 3px
- `--font-size-2xl`: 24px vs 18px
- `--font-size-*` và `--color-text-*`: pin Astryx đặt trên `:root` (`astryx-theme-cmc.css:63-81`) **thua** `.o_web_client` (`console.css:371-431`) vì lồng DOM — `main.tsx:39` ngoài, `shell.tsx:130` trong.

Cái quyết định giá trị nào thắng là **thứ tự lồng DOM**, không phải bất kỳ thứ gì được ghi ra.

Nguy hiểm nhất là phần test: mọi test CSS trong repo đều là `readFileSync + includes` trên **một file**. Claude xác nhận **không có test nào mở hai file CSS và so sánh** — nghĩa là bất biến duy nhất thực sự quan trọng (giá trị được resolve tại component) không thể bị bắt lỗi, về mặt cấu trúc. Tệ hơn: `astryx-theme-cmc.test.ts:16-24` khẳng định một bảo đảm mà comment của chính nó nói là đúng "bất kể console.css", trong khi `console-astryx-remap.test.ts:42-50` (L1) / `:87` (Claude) assert **kẻ thắng ngược lại**. Hai test xanh, hai ý định mâu thuẫn.

Hệ quả thật: Astryx Button/Text/Heading trong admin render theo thang Odoo (15px `lg`, 10px `4xs`), không theo thang CMC mà cầu nối tuyên bố đã pin. LMS (không có console.css) nhận thang còn lại. Cùng một component, hai app, hai kích cỡ chữ — do tai nạn cascade.

### P0-B · Hai ngôn ngữ thị giác trong cùng một shell admin

grok L1 (P0-1) + Claude (cùng kết luận, khác cách diễn đạt: "system-shaped ở lớp class, stylesheet ở lớp token").

`tokens.css:9-76` (CMC ấm, raised card) vs `console.css:12-74,79` (Odoo lạnh `#f8f9fa`, sheet 4px) vs khối flatten `console.css:1170-1379`. Cùng một trang sơn card ấm cạnh chrome lạnh. Người vận hành không hình thành được mô hình thị giác ổn định.

Kèm theo P0-3 của L1: tập màu **không đóng**. `tokens.css:4` tuyên bố "một xanh tương tác `#0071E3`" — sai trong production: login tự chế `#4f7dfb` (`login.css:23,43-46`), funnel `#5eb0ff` (`console.css:1560`), FullCalendar `#3788d8`. `--console-success/info/warning/danger` khai mà **không ai dùng**.

### P0-C · Token ma đang chạy trong production

Claude tìm độc lập, L1 gọi là "ghost references" (§197) — hai lane trùng nhau.

`--console-border`, `--console-bg-subtle` (`shifts-detail.tsx:113,114,116`) và `--cmc-text-supporting` (`crm/report.tsx:136`, **không fallback**, đã nằm trong `dist`) được tiêu thụ nhưng **không khai ở đâu cả**. Ratchet cố ý bỏ qua `var()`, không có stylelint, TS không type được CSS var. Không cổng nào bắt được. Claude ước tính ~30 dòng script là chặn vĩnh viễn.

### P0-D · Bàn phím không hoàn tất được tác vụ chính

Chỉ L2 phủ, chưa có lane thứ hai xác nhận, nhưng `file:line` cụ thể.

Không `:focus-visible` trên primitive L2 (`console.css:111-205` navbar, `:330-365,449-456` kanban). Tương tác lồng `role="button"` trong `pipeline.tsx:137-238` — screen reader đọc cả thẻ CRM như button chứa button. Mở dòng **chỉ bằng chuột** ở `receipt-list.tsx:227`, `classes/index.tsx:449`, `users.tsx:351`, `students/index.tsx:133`. Vi phạm WCAG 2.1.1 / 2.4.7 / 4.1.2.

### P0-E · Kanban CRM nói dối con số

L2, và đây là lỗi **nghiệp vụ** chứ không phải thẩm mỹ.

`pipeline.tsx:34,287-293,342-351,506-508`: `count` mỗi cột lấy tổng từ server, nhưng thẻ hiển thị là **một trang phẳng 20 bản ghi**. Sale nhìn thấy cột ghi "Đã kiểm tra 8" mà bên dưới là "Chưa có". Board không dùng được để ra quyết định.

### P0-F · Tài liệu chia đôi quyền authority

L3: `docs/README.md:15,41` vẫn chỉ "Frontend dev → TL12", trong khi `docs/design-system-console.md:21` tự xưng là "sole evergreen design authority for apps/admin". Một agent frontend mới đi theo README sẽ implement **ngôn ngữ đã bị khai tử** (AppFrame / SideNav / `ck-*` / `tpl-*` / `.premium-`). `design-system/cmc-edu/{STRUCTURE,PAGE-FRAMES,MASTER}.md` cũng còn mô tả thế giới cũ.

---

## Chỗ hai bên nhìn khác nhau — và vì sao không mâu thuẫn

**L3 nói tài liệu console *đúng*: 28 VERIFIED / 8 DRIFT / 2 UNVERIFIABLE.** Mọi path trong bảng Implementation surface đều tồn tại. `ck-*`/`tpl-*`/`odoo-*`/`sh-*` có **0 selector CSS sống và 0 className sống**. `premium.css` đã xóa thật, không ai import. LMS không import `console.css`, admin không phát `lms-*`. Pin Odoo `7de220c9` **có** được assert trong `console-tokens.test.ts`.

**Claude nói tài liệu *thổi phồng*.** `:21` tuyên bố authority duy nhất trong khi `primitives.ts:16` export Button từ `@astryxdesign/core` — tài liệu chứa **0 lần** chữ "Astryx". Bảng token `:79` quảng cáo `--console-success: #28a745` mà toàn repo không ai dùng.

Hai kết luận này **cùng đúng**: L3 kiểm những gì tài liệu *nói* (chính xác), Claude kiểm những gì tài liệu *bỏ sót* (Astryx, và cả hai cổng CI đang thật sự chặn drift hằng ngày). Phán quyết hợp nhất: **tài liệu đúng về bản đồ code của nó, nguy hiểm ở chỗ nó im lặng — và cái giết người là authority split với TL12, không phải sai sót nội tại.**

Claude cũng nêu một điểm công bằng mà không lane nào khác thấy: tài liệu **under-sell** phần nghiệm thu. Hai ratchet `ui-ratchet.mjs` (baseline zero-tolerance `{}`) và `check-ui-frames.mjs --strict` đang chặn drift mỗi ngày nhưng **không có mặt** trong bảng Verification của doc. Và doc **không** overclaim về test: `:117` ghi rõ visual regression còn treo.

---

## LMS — không có P0

L4 kết luận rõ: **không có P0 design nào chặn học viên nộp bài / xem điểm / đổi quà.**

85 dòng `app.css` **không phải** một design system độc lập — nó là shell tiêu thụ token, chung DNA `@cmc/ui` với admin, cộng chrome cố ý tách khỏi Console. Chỗ yếu là pages tự chế card/grid/spacer: **77 `style={{`** thay vì class `lms-*` hoặc primitive sẵn có.

Khuyến nghị của L4 (kèm chi phí/rủi ro): **giữ tách chrome + chia sẻ lớp token đã có + hoàn thiện primitive LMS mỏng**. ~1–3 ngày agent, không đụng `console.css`, rủi ro thấp vì không đổi contract API. L4 **phản đối** hợp nhất Console vào LMS (2498 dòng Odoo tràn vào app cho trẻ/phụ huynh; touch 44px vs control 33px), phản đối tách token riêng cho LMS (nhân đôi `#0071E3`/Inter), và phản đối mang Tailwind vào (hệ thứ ba).

Hai vấn đề đọc được đáng sửa sớm: `user-scalable=no` trong viewport (chặn zoom, với học sinh), và meta bài dùng cỡ `2xs` 12px.

---

## Nếu chỉ làm được một việc

**P0-A.** Không phải vì nó xấu nhất trên màn hình — mà vì nó là thứ duy nhất **không có cổng nào bắt được, về mặt cấu trúc**. Bốn P0 còn lại đều hữu hình: ai đó sẽ nhìn thấy, hoặc test sẽ chạm tới được. Xung đột token thì mọi test hiện tại đều mù theo thiết kế (`readFileSync` một file), nên nó âm thầm xấu đi mỗi lần thêm CSS. Việc rẻ nhất chặn đứng nhóm này: một test **cross-file** so giá trị resolve tại `.o_web_client`, cộng script ~30 dòng bắt token ma (P0-C).

## Điều chưa xác minh được

- Pixel thật: không build, không browser. Kết luận về thứ tự font-size suy ra từ cascade + lồng DOM, có test hiện hữu hậu thuẫn, **không phải quan sát trực tiếp**.
- Test hiện có đang xanh hay đỏ: chưa chạy.
- Nội bộ Astryx StyleX, và độ trung thực với pin Odoo — `console-tokens.test.ts:29-32` chỉ assert chuỗi hash xuất hiện trong comment CSS, không so giá trị.
- L2 tự ghi nhận: P0-1 (board nói dối số) và P0-2 (bàn phím) **chưa xác minh trên browser**.

## Câu hỏi còn treo

1. Chọn chủ sở hữu nào cho `.o_web_client` — console chrome tiêu thụ `--cmc-*` (một ngôn ngữ), hay tài liệu hóa **hai theme có tên** không dùng chung tên biến? L1 nêu cả hai, không tự quyết.
2. Kanban CRM: sửa query theo stage, hay bỏ board cho tới khi query khớp cột?
3. Có nâng audit này thành plan thực thi không, hay để P0-A + P0-C thành một PR nhỏ trước?
