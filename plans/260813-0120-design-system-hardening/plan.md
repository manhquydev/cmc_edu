# Plan — Siết design system CMC Console

**Tạo:** 2026-08-13 · **Base branch:** `develop` · **Trạng thái:** draft, chưa thi hành
**Nguồn quyết định:** `plans/reports/decisions-owner-260813-0120-design-system.md`
**Nguồn bằng chứng:** `plans/reports/audit-260813-0052-ds-impeccable-synthesis.md` + 5 report lane

## Vấn đề

Audit song song (4 lane grok + 1 đối chứng Claude, đều dùng impeccable) chấm CMC Console **10/20** và LMS
**10/20**, thủng ở **Theming + Implementation Integrity**. Bệnh gốc: ba không gian token khai trùng tên cho
cùng quyết định, kẻ thắng do thứ tự lồng DOM quyết định, và **không test nào bắt được** vì mọi test CSS đều
là `readFileSync` một file. Kèm bốn P0 hữu hình: token ma đang chạy production, kanban CRM hiển thị số sai
cho sale, bàn phím không mở được dòng, tài liệu chỉ agent tương lai sang ngôn ngữ đã khai tử.

## Nguyên tắc xuyên suốt

- Một người vận hành, code phần lớn do AI sinh ⇒ **CI là đội review**. Không phase nào được "xong" mà không
  có cổng tự động chứng minh nó không tái phát.
- Không có visual regression. Mọi phase phải nêu rõ cách chứng minh không hồi quy **mà không cần VRT**.
- Branch + PR cho từng phase. Không commit thẳng `main`/`develop` cục bộ.
- Required checks: `typecheck-and-test` + `ui-e2e` phải xanh trước khi gọi bất kỳ phase nào là done.

## Phases — bản sau red-team (2026-08-13)

Plan gốc 6 phase đã qua red-team 4 lens; **phần cốt lõi bị bác bằng số đo**, quyết định Q1 bị đảo.
Phán quyết: [`plans/reports/redteam-adjudication-260813-0139-design-system.md`](../reports/redteam-adjudication-260813-0139-design-system.md).

| # | Phase | File | Công | Trạng thái |
|---|-------|------|-----:|-----------|
| **A** | Chốt precedence bằng test + diệt token ma thật | [phase-A-precedence-pin.md](./phase-A-precedence-pin.md) | ~3–5h | **thi hành** |
| **B** | Authority split trong tài liệu + phủ cổng đang thủng | [phase-B-docs-and-gates.md](./phase-B-docs-and-gates.md) | ~3–5h | **thi hành** |
| 03 | Kanban CRM | [phase-03](./phase-03-crm-kanban-truth.md) | — | **chặn** — cần quyết định sản phẩm về `stageCounts` |
| 04 | A11y bàn phím | [phase-04](./phase-04-a11y-keyboard.md) | — | **hoãn** — đổi mục tiêu sang `data-table.tsx:146-161` |
| 06 | Primitive LMS | [phase-06](./phase-06-lms-primitives.md) | — | **hoãn** — phần rẻ nhất đã gộp vào phase B |
| 01, 02, 05 | — | superseded | — | thay bằng A và B |

Từ 6–11 ngày xuống ~1 ngày cho phần có bằng chứng đáng làm ngay.

## Vì sao thu hẹp

Red-team đo bằng jsdom probe: kế hoạch cũ (xóa 17 tên trùng + khối `--text-*`) đổi 8 vai trò chữ trên toàn
admin, tới **+45%**, diện tiêu thụ 48 file — trong khi phần cảnh báo của plan chỉ nêu 2 bậc. Và khối
`--text-*` **không phải lỗi**: nó là cơ chế tạo mật độ kiểu Odoo. Hướng đúng là **giữ nguyên precedence, ghi
ra rằng nó cố ý, chốt bằng test** — cùng bảo đảm, **không dịch pixel nào**, rẻ hơn nhiều.

Phase 02 sai tiền đề (2/3 token có fallback; script theo đặc tả cho 9–48 false positive). Phase 03 chứa một
thay đổi contract `stageCounts` mâu thuẫn với chính nó, và `stageCounts` là **một** field nuôi cả funnel lẫn
badge lẫn `cockpit.tsx:250-256` — không thể vừa giữ vừa đổi, phải để chủ dự án chốt. Phase 04 định xóa đúng
đường bàn phím **đang chạy được**. Phần đắt của phase 06 được thay bằng một dòng mở rộng scope ratchet.

## Tiêu chí nghiệm thu toàn plan

- [ ] `decl(astryx-theme-cmc.css) ∩ decl(console.css) === ∅`, có test tự động chứng minh
- [ ] Không còn CSS var nào được `var()` mà không khai báo ở đâu; có cổng CI chặn
- [ ] Không màn hình nào hiển thị con số mà thẻ bên dưới mâu thuẫn
- [ ] Bốn trang danh sách mở được dòng bằng bàn phím; primitive Console có `:focus-visible`
- [ ] `docs/README.md` không còn chỉ frontend sang ngôn ngữ đã khai tử; có grep-check trong CI
- [ ] LMS còn `<15` inline style; bỏ `user-scalable=no`
- [ ] `typecheck-and-test` + `ui-e2e` xanh sau từng phase

## Không nằm trong plan này

Phương án A (hội tụ canvas/border/text về một ngôn ngữ thị giác); dark mode; visual regression testing;
hợp nhất Console vào LMS; Tailwind; `data-theme` có tên.

## Rủi ro đã biết

| Rủi ro | Giảm thiểu |
|---|---|
| Không có VRT nên thay đổi pixel lọt lưới | Phase 01 bắt buộc soi mắt 3 màn (list/detail/dashboard); PR nhỏ, dễ revert |
| Agent tương lai set lại tên biến đã xóa | Test cross-file đỏ ngay trên PR |
| Nhịp 1 phase 03 làm rồi bỏ dở nhịp 2 | Hai nhịp nằm cùng một phase, không tách sang backlog |
| Repo chính đang ở nhánh khác với nhiều file sửa dở | Mỗi phase cắt branch riêng từ `develop`, không rebase lên nhánh đang dở |
