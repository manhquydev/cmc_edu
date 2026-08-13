> **SUPERSEDED 2026-08-13 sau red-team 4 lens.** Không thi hành file này nguyên trạng.
> Phán quyết: `plans/reports/redteam-adjudication-260813-0139-design-system.md`.
> Phần còn hiệu lực đã chuyển sang `phase-A-precedence-pin.md` / `phase-B-docs-and-gates.md`.

# Phase 02 — Diệt token ma, dựng cổng CI

**Trạng thái:** superseded — không thi hành; token ma thật xử lý ở phase A; cổng `check:css-vars` không làm · **Công:** 0.5 ngày · **Branch:** `fix/phantom-token-guard` từ `develop`
**Phụ thuộc:** phase 01 (để cổng mới không đỏ vì lý do khác)
**Bằng chứng:** `plans/reports/audit-260813-0052-ds-claude-crosscheck.md` (P1 phantom tokens),
`plans/reports/audit-260813-0052-ds-l1-foundations.md` §197 "ghost references" — hai lane độc lập cùng tìm ra

## Vấn đề

Ba biến CSS đang được `var()` trong production nhưng **không được khai báo ở đâu cả**:

| Biến | Tiêu thụ tại | Ghi chú |
|---|---|---|
| `--console-border` | `apps/admin/src/pages/attendance/shifts-detail.tsx:113,114` | |
| `--console-bg-subtle` | `apps/admin/src/pages/attendance/shifts-detail.tsx:116` | |
| `--cmc-text-supporting` | `apps/admin/src/pages/crm/report.tsx:136` | **không có fallback**, đã nằm trong `dist` |

Không cổng nào bắt được: `ui-ratchet.mjs` cố ý bỏ qua `var()`, repo không có stylelint, TypeScript không
type được CSS var. Biến ma render ra rỗng — màu biến mất, viền biến mất, im lặng.

## Việc

### 1. Xử lý 3 biến

Với mỗi biến, chọn **một** trong hai: khai báo nó ở file chủ sở hữu đúng (theo luật phase 01), hoặc thay chỗ
tiêu thụ bằng biến đã tồn tại. Ưu tiên phương án 2 nếu đã có biến tương đương — đừng đẻ thêm token.

`--cmc-text-supporting` xử lý trước: nó không fallback và đã ship.

### 2. Script cổng — `scripts/check-css-vars.mjs`

~30 dòng. Quét `packages/ui/src/**/*.css` + `apps/*/src/**/*.{css,tsx}`:

- Thu tập **declared**: `/(--[a-z0-9-]+)\s*:/` trong file CSS
- Thu tập **consumed**: `/var\(\s*(--[a-z0-9-]+)/` ở mọi nơi, kể cả trong `style={{}}` của TSX
- Fail nếu `consumed \ declared ≠ ∅`, **trừ** biến có fallback `var(--x, y)` (được phép, nhưng in ra cảnh báo)
- In `file:line` cho từng hit

Thêm `package.json` script `check:css-vars`, wire vào `.github/workflows/ci.yml` ngay sau các check UI hiện có
(`ui-ratchet`, `check-ui-frames`).

### 3. Test cho chính script

Node test nhỏ: fixture có 1 biến ma → script exit 1; fixture sạch → exit 0. Không để script chỉ được kiểm bằng
việc nó tình cờ xanh trên HEAD.

## Nghiệm thu

- [ ] `pnpm check:css-vars` xanh trên `develop`
- [ ] Đã chứng minh script bắt được: chèn tạm 1 biến ma → đỏ
- [ ] Ba biến trên không còn xuất hiện trong tập `consumed \ declared`
- [ ] `typecheck-and-test` xanh, script chạy trong CI

## Rủi ro

Script quét TSX có thể bắt nhầm biến sinh động (template literal). Nếu gặp: cho phép allowlist tối thiểu,
ghi lý do ngay trong file script, **không** nới điều kiện fail. `WS_CSS` trong `shifts.tsx:42` là template
literal chứa ~20 hex thô — nằm ngoài phase này nhưng script sẽ chạm tới nó, ghi nhận đừng sửa vội.