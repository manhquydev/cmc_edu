---
title: Siết design system CMC Console
status: completed
priority: P0
effort: medium
branch: develop
tags: [design-system, console, crm]
created: 2026-08-13
---

# Plan — Siết design system CMC Console

**Tạo:** 2026-08-13 · **Base branch:** `develop` · **Trạng thái:** landed — A–D trên develop (#124–#125, #127–#129, #132–#135)
**Nguồn quyết định:** `plans/reports/decisions-owner-260813-0120-design-system.md` + `plans/reports/decisions-ba-260813-0800-outstanding-issues.md`
**Nguồn bằng chứng:** `plans/reports/audit-260813-0052-ds-impeccable-synthesis.md` + 5 report lane
**PM sync:** `plans/reports/pm-260813-0837-design-system-hardening.md`

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
| **A** | Chốt precedence bằng test + diệt token ma thật | [phase-A-precedence-pin.md](./phase-A-precedence-pin.md) | ~3–5h | **đã vào develop** (#124) |
| **B** | Authority split trong tài liệu + phủ cổng đang thủng | [phase-B-docs-and-gates.md](./phase-B-docs-and-gates.md) | ~3–5h | **đã vào develop** (#125) |
| **C** | Kanban CRM thôi nói dối số (nhịp-1-only) | [phase-C](./phase-C-crm-kanban-truth.md) | ~0.5 ngày | **đã vào develop** (#127, #128) |
| 03 | Kanban CRM | [phase-03](./phase-03-crm-kanban-truth.md) | — | **superseded** bởi C (Q2 đảo về nhịp-1-only) |
| 04 / **D** | A11y bàn phím | [phase-D](./phase-D-a11y-datatable-keyboard.md) | — | **đã vào develop** (#134 DataTable, #135 :focus-visible) |
| 06 | Primitive LMS | [phase-06](./phase-06-lms-primitives.md) | — | **đóng** — BA Q5; lot 0 đã vào #125 |
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

- [ ] `decl(astryx-theme-cmc.css) ∩ decl(console.css) === ∅`, có test tự động chứng minh — **AC cũ, red-team bác**; A giữ collision + pin bằng `console-precedence.test.ts`
- [ ] Không còn CSS var nào được `var()` mà không khai báo ở đâu; có cổng CI chặn — A diệt 1 token ma; cổng `check:css-vars` (phase 02) không làm
- [ ] Không màn hình nào hiển thị con số mà thẻ bên dưới mâu thuẫn — C local RTL xanh; chưa PR/`ui-e2e`
- [ ] Bốn trang danh sách mở được dòng bằng bàn phím; primitive Console có `:focus-visible` — phase 04 hoãn
- [x] `docs/README.md` không còn chỉ frontend sang ngôn ngữ đã khai tử; có grep-check trong CI — #125 `check:doc-authority`
- [ ] LMS còn `<15` inline style; bỏ `user-scalable=no` — `user-scalable=no` gỡ ở #125; `<15` inline **không** (BA Q5 đóng, ratchet baseline 61)
- [ ] `typecheck-and-test` + `ui-e2e` xanh sau từng phase — A+B CI xanh trên PR; C chưa có PR

## Không nằm trong plan này

Phương án A (hội tụ canvas/border/text về một ngôn ngữ thị giác); dark mode; visual regression testing;
hợp nhất Console vào LMS; Tailwind; `data-theme` có tên.

## Rủi ro đã biết

| Rủi ro | Trạng thái |
|---|---|
| Không có VRT nên thay đổi pixel lọt lưới | **mở** — BA Q3 hoãn VRT; A pin precedence bằng jsdom, không soi mắt 3 màn |
| Agent tương lai set lại tên biến đã xóa | **đóng** — A không xóa tên; thay bằng test pin giá trị resolve |
| Agent đổi `console.css` / remap Astryx mà không biết | **mở, đã giảm** — `console-precedence.test.ts` + mapping upstream |
| Nhịp 1 phase 03 làm rồi bỏ dở nhịp 2 | **đóng** — BA Q2 cắt nhịp 2; C = nhịp-1-only |
| Phase C local, chưa PR | **mở** — user cấm push; `typecheck-and-test` + `ui-e2e` chưa chạy trên PR |
| Repo chính đang ở nhánh khác với nhiều file sửa dở | **mở** — mỗi phase branch riêng từ `develop` |
