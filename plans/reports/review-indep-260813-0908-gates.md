# PASS_WITH_CONCERNS

Độc lập trên `develop` `bc986bd` (cổng từ PR #125 / `af85b78`). Không đọc `plans/reports/` hay `plans/260813-*`. Soi script + `ci.yml` + tự chèn / tự chạy. Reviewer: `ak-engineer:code-reviewer`. Cây thí nghiệm đã restore (sạch).

Cổng **không chết**: vi phạm chuẩn → đỏ; `check:ui-a11y-roles` **có** chạy blocking trong job required `typecheck-and-test`. Baseline **61 khớp đếm sống**. Admin pages **không bị nới**. Có đường lách xanh thật.

---

## Lỗ hổng (kèm lệnh + output)

### H1 — `check-doc-authority` allowlist bỏ sót kit đang dạy chrome nghỉ hưu (HEAD đã xanh giả)

Allowlist 8 file. `VIEW-GRAMMAR.md` / `STYLING-BRIDGE.md` / `docs/design-system-console.md` **không** nằm trong list.

```text
$ rg -n 'AppFrame|\.sh-' design-system/cmc-edu/VIEW-GRAMMAR.md design-system/cmc-edu/STYLING-BRIDGE.md
VIEW-GRAMMAR.md:22:LMS (TL12):       AppFrame + SideNav
STYLING-BRIDGE.md:72:| `default` | … · `.sh-cta` |
# + .sh-cta--secondary / .sh-cta--ghost / .sh-item (L73–98)

$ pnpm check:doc-authority
# 8 files clean.  EXIT:0
```

Chèn `AppFrame leftover` vào `docs/design-system-console.md` hoặc `README.md` gốc → **vẫn EXIT 0**. Cổng bắt token trong allowlist, không bắt file authority sống ngoài list.

Bypass khác trên allowlist (cùng TL12): `appframe` / `App\u200bFrame` / `App\nFrame` → EXIT 0. Ít gặp hơn H1.

### H2 — `ui-ratchet` chỉ dính đúng `style={{` + literal trần

Chuẩn `style={{ padding: 99 }}` trên LMS/admin **đỏ** (xem phần vững). Các dạng JSX hợp lệ sau **xanh, total vẫn 61**:

| Chèn vào `apps/lms/src/pages/student/home.tsx` | exit |
|---|---|
| `style = {{ padding: 99 }}` | 0 |
| `style={ { padding: 99 } }` | 0 |
| `const s = { padding: 99 }; style={s}` | 0 |
| `style={{ padding: \`99px\` }}` | 0 |
| `style={{ ['padding']: 99 }}` | 0 |
| `style={{ background: '#ff0000' }}` | 0 |
| `style={{ padding: 8 + 0 }}` | 0 |

Đối chứng: `backgroundColor: '#ff0000'` → **exit 1**, `home.tsx: 2 -> 3`. `background` không nằm FAMILY.color (chỉ `backgroundColor`).

Nguyên nhân: `src.indexOf('style={{')` + `literalValue()` chỉ nhận số/`'...'`/`"..."`. Header script tự nhận under-count.

`apps/admin/src/lib/enroll-picker.tsx` + `style={{ padding: 99 }}` → EXIT 0 (scan chỉ `apps/admin/src/pages`). #125 không nới pages; lỗ ngoài pages là scope cũ.

### H3 — `check-ui-frames --strict` dual-title cắt 600 ký tự

`pnpm check:ui-frames` (= `--strict`) bắt `title=` gần `<PageHeader` (exit 1). Đẩy `title=` ra offset 1306 từ `<PageHeader` trên `opportunity-detail.tsx` (file có `EntityHeader`):

```text
EntityHeader files with PageHeader title= (review): 0
bulkListsOk (≥5): true
# pnpm check:ui-frames  EXIT:0
```

Không `--strict` (gọi script trần) cũng xanh dù dual-title gần — CI an toàn vì `package.json` gắn `--strict`.

### H4 — Test a11y/frames không có đường đỏ cô lập

`check-ui-a11y-roles.test.mjs` / `check-ui-frames.test.mjs` chỉ assert HEAD sạch exit 0. Rewrite script thành `process.exit(0)` → `test:ui-*` vẫn xanh. CI sống nhờ bước `pnpm check:…` đi trước `&& test`. `doc-authority` + `ui-ratchet` thì có inject fail-path (ratchet chỉ inject admin, không LMS).

---

## Câu hỏi thực nghiệm — trả lời

### (1) Cổng có thật sự bắt vi phạm?

**Có, với dạng tác giả test.** Tự chèn:

```text
# AppFrame → docs/12-design-system-ui.md
FAIL docs/12-design-system-ui.md:176  AppFrame
1/8 files failed.  EXIT:1

# AppFrame comment → packages/ui/src/index.ts:247  EXIT:1
# .premium- → TL12:176  EXIT:1
# strip design-system-console khỏi hàng **Frontend dev** README:15  EXIT:1
# AppFrame dòng khác của README  EXIT:1

# LMS home.tsx  style={{ padding: 99 }}
Total violations: 62
  - apps/lms/src/pages/student/home.tsx: 2 -> 3   EXIT:1

# admin pages/classes/index.tsx  style={{ padding: 99 }}
  - apps/admin/src/pages/classes/index.tsx: 0 -> 1   EXIT:1
# admin gap:12 (exemption của file khác)  cũng 0 -> 1  EXIT:1

# FilterBar xoá role="search"
FAIL FilterBar … missing: role="search"   EXIT:1

# opportunity-detail PageHeader title="Dual title probe"
STRICT FAIL: dual-title PageHeader title= … (1)   EXIT:1
```

Admin **không bị nới**: file pages thêm literal mới vẫn đỏ `0 -> 1`. Baseline chỉ grandfather LMS.

### (2) `check:ui-a11y-roles` có chạy trong job required không?

**Có. Không phải cổng chết.**

`.github/workflows/ci.yml` job `typecheck-and-test` (không `continue-on-error` cấp job):

```yaml
- name: UI a11y role smoke          # L121–124
  run: pnpm check:ui-a11y-roles && pnpm test:ui-a11y-roles
```

Không `continue-on-error` trên step này (khác matrix/acceptance). `package.json` có script. Branch protection `develop` + `main` đều require `typecheck-and-test` (+ `ui-e2e`). `on.push` không lọc nhánh → push develop chạy. Run CI `af85b78` trên develop: success.

### (3) `ratchet-baseline.json` 61 có khớp đếm sống?

**Khớp.**

```text
$ pnpm check:ui-ratchet
  Pages scanned:         83
  Files with violations: 11
  Total violations:      61
  No file exceeded its baseline count.   EXIT:0

$ node scripts/ui-ratchet.mjs --json
totalViolations 61  increased []  perFile sum 61
# 11 file LMS; không file admin

$ python3 -c '…sum(baseline.values())…'
nfiles 11  sum 61
# 3+5+8+3+11+4+6+1+10+8+2 = 61
```

---

## Xác nhận vững

- 4 bước CI (frames / ratchet / a11y / doc-authority) nằm trong `typecheck-and-test`, blocking, không `continue-on-error`.
- `pnpm check:ui-frames` = `--strict` (bulk ≥5 + dual-title).
- Allowlist + `FORBID` thống nhất: chèn đúng token / đúng file → đỏ. `requireLine` Frontend-dev bắt mất `design-system-console`.
- Ratchet LMS mới + admin pages mới → đỏ. Exemption theo bộ ba `(file, prop, value)` — không lan file khác. Compact `style={{padding:99}}` và `margin: '99px'` vẫn đếm.
- a11y 8/8 trên HEAD; cắt marker → đỏ. `role='search'` cũng đỏ (fail-closed, không lách).
- Unit: 13/13 pass trên HEAD sạch (`node --test` bốn file test).
- Husky không chạy các cổng này (chỉ eslint + gitleaks) — CI là lớp bắt.

## Không làm

Không sửa cổng trong review này. Ưu tiên nếu sửa: (1) thêm VIEW-GRAMMAR + STYLING-BRIDGE (+ console doc) vào allowlist rồi dọn L22 / `.sh-*`; (2) ratchet nhận `style\s*=\s*\{\s*\{` và `background`; (3) dual-title không cắt 600; (4) fail-path test cho a11y + LMS ratchet.

LANE DONE gates
