> **SUPERSEDED 2026-08-13 sau red-team 4 lens.** Không thi hành file này nguyên trạng.
> Phán quyết: `plans/reports/redteam-adjudication-260813-0139-design-system.md`.
> Phần còn hiệu lực đã chuyển sang `phase-A-precedence-pin.md` / `phase-B-docs-and-gates.md`.

# Phase 05 — Đóng authority split trong tài liệu

**Trạng thái:** chưa bắt đầu · **Công:** 0.5–1 ngày · **Branch:** `docs/console-authority` từ `develop`
**Đặc tả chi tiết (dùng khi thi hành):** `plans/reports/phase-spec-260813-0120-doc-authority.md`
**Bằng chứng:** `plans/reports/audit-260813-0052-ds-l3-drift.md`

## Vấn đề

Bản thân `docs/design-system-console.md` **đúng** về bản đồ code của nó (28 VERIFIED / 8 DRIFT). Nguy hiểm
nằm ở chỗ khác: `docs/README.md:15,41` vẫn chỉ "Frontend dev → TL12", mà TL12 và bộ
`design-system/cmc-edu/*` vẫn mô tả thế giới đã khai tử (AppFrame, SideNav, `ck-*`, `tpl-*`, `.premium-`).
Với dự án mà agent AI đọc tài liệu để biết viết UI theo ngôn ngữ nào, **tài liệu sai nguy hiểm ngang code sai**.

## Quyết định

TL12 **sửa tại chỗ**, không chỉ đóng dấu superseded. Banner đã có ở `:8-13` nhưng agent đọc thẳng §1/§4.5 —
đóng dấu không cứu được. TL12 giữ vai SoT cho **LMS + `--cmc-*`**; phần chrome và class-prefix trong thân bài
viết lại theo CMC Console.

## Việc (chi tiết dòng-theo-dòng ở file đặc tả)

1. `docs/README.md:15,41` — tách đường: admin → `design-system-console.md`, LMS/tokens → TL12
2. `docs/12-design-system-ui.md` — `:8-9`, `:23-30`, `:76-80`, `:87`, `:95-101` (xóa cả khối App frame), `:111-116`
3. `design-system/cmc-edu/STRUCTURE.md` `:3,18,70` · `PAGE-FRAMES.md` `:13-16,25-27,68,155` · `MASTER.md` `:146,152-153,164-168`
4. `packages/ui/llms.txt:79` — `premium.css` → `console.css` (file này đang chỉ agent import file đã bị xóa)
5. Comment chết: **sửa** `packages/ui/src/index.ts:166-169` và `console.css:1394`; **giữ**
   `primitives.ts:35-41` (one-door Astryx, xóa là đổi public contract) và `console-navbar.tsx:8` (negative example đúng)
6. `docs/design-system-console.md` — **hết im lặng**, thêm 2 mục:
   - Astryx one-door tại `primitives.ts` (gồm SideNav re-export `:35-41`), ghi rõ không phải shell
   - Hai cổng CI đang chạy: `check:ui-ratchet` (`scripts/ui-ratchet.mjs`), `check:ui-frames`
     (`scripts/check-ui-frames.mjs --strict`), wire tại `.github/workflows/ci.yml:112-119`

## Cổng kiểm chứng — `scripts/check-doc-authority.mjs`

Không có test nào assert "tài liệu không trỏ sai", và với một người vận hành thì soi mắt không đủ.
Script allowlist cứng, exit 1 nếu còn hit, in `file:line`:

| Path | Cấm |
|---|---|
| `docs/README.md` | đường frontend thiếu `design-system-console` |
| `docs/12-design-system-ui.md` | `AppFrame`, `.premium-`, `--sh-*` |
| `design-system/cmc-edu/{STRUCTURE,PAGE-FRAMES,MASTER}.md` | `AppFrame`, `.ck-surface`, `.sh-*`, `tpl-wrap` |
| `packages/ui/llms.txt` | `premium.css` |
| `packages/ui/src/index.ts` | comment `.sh-*` |

**Không** quét `plans/` hay changelog (ở đó những chuỗi này là lịch sử, đúng chỗ).
Test node nhỏ: chèn chuỗi cấm vào fixture → fail; HEAD sạch → pass. Wire vào `typecheck-and-test`.

## Nghiệm thu

- [ ] `pnpm check:doc-authority` xanh, và đã chứng minh nó đỏ được
- [ ] `rg -n 'AppFrame|\.ck-surface|\.sh-\*|tpl-wrap|\.premium-|premium\.css'` trên allowlist = 0
- [ ] TL12 vẫn là SoT cho LMS; `primitives.ts` vẫn export SideNav
- [ ] `docs/design-system-console.md` đã nhắc Astryx và hai cổng CI

## Ngoài scope

`design-system/cmc-edu/VIEW-GRAMMAR.md:22`, `STYLING-BRIDGE.md` — cùng pattern, để phase sau.