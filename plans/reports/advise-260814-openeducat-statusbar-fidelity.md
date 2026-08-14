# Advise — OpenEduCat statusbar vs CMC (pack 14/16)

**Date:** 2026-08-14  
**Authority:** `/home/manhquy/Downloads/openeducat-ui-pack` + `OPENEDUCAT-VISUAL-CONTRACT.md`  
**Scope:** form statusbar only (not website 31–33, not CRM pipeline kanban).

## Verdict

CMC đã có chevron clip-path + lavender current, nhưng **không sát pack** vì đặt sai khung: thanh nằm trên canvas xám, full-width, viền trắng. Pack 14/16 đặt ribbon **hàng đầu trong sheet trắng, căn phải**. Viền trắng trên canvas xám trông “lạ”; trên sheet trắng thì **khung biến mất**. Đó là lý do “khung / bo góc” vẫn sai dù mũi tên đã có.

## Exact requirements (đã khóa bởi contract + pack)

1. Statusbar **trong** `.console-form-sheet`, hàng đầu, `justify-content: flex-end`.
2. Cao 33px, text-only, ôm chữ.
3. Inactive = `--console-gray-100` + viền `--console-gray-300` theo silhouette.
4. Current = `--console-statusbar-current` `#e0d9f1` + viền `--console-brand-purple`.
5. Bo 4px **chỉ hai đầu thanh**; khớp giữa = V nhọn; đoạn cuối **cụt**.
6. `#0071E3` không xuất hiện trên statusbar.

## Non-goals

- Port OWL / XML.
- Chatter Send message (P2, phase-04).
- Đổi nghiệp vụ CRM / nhãn tiếng Việt.
- Clone website builder.

## What to do / not do

**Do:** chuyển slot `statusbar` vào sheet; viền xám trên nền trắng; giữ API `ProgressSteps`.  
**Don’t:** khung chữ nhật bọc cả thanh; căng đều 5 cột; tô current tím đặc chữ trắng (trừ ribbon Draft inverted ở pack 18/24 — contract chọn lavender như pack 14 Done).

## Auto applied this session

- `DetailPage`: statusbar = first child of `.console-form-sheet`.
- `console.css`: inactive gray-100 + gray-300 stroke; sticky selector theo sheet.
- Tests: `detail-page.test.tsx`, `console-cp-sheet.test.ts`.
