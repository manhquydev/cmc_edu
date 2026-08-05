---
phase: 5
title: "Verify + nâng lint error + docs"
status: pending
priority: P1
effort: "0.25d"
dependencies: [2, 3, 4]
---

# Phase 5: Verify + nâng lint error + docs

## Overview

Chứng minh kết quả bằng gate chạy được, nâng lint từ `warn` lên `error` (giờ mới
an toàn vì vi phạm đã dọn), và đồng bộ tài liệu.

## Requirements

**Functional**
- Toàn bộ required check xanh **trên CI**, không chỉ local.
- Lint lên `error` chỉ sau khi worklist về 0.
- `docs/12` §8 trỏ tới SoT, **không** viết lại nội dung lịch sử.

**Non-functional**
- Tuyên bố "done" chỉ dựa trên bằng chứng chạy được.

## Architecture

Vấn đề gốc: chuẩn copy nằm 2 nơi (`docs/12` §8 corpus + `MASTER.md` SoT), không
ai biết nơi nào thắng — nên chuẩn tồn tại mà vẫn bị vi phạm. Phase 1 đã ghi luật
vào SoT (`MASTER.md` + `PAGE-FRAMES.md`); phase này để `docs/12` **trỏ tới** SoT
thay vì cạnh tranh.

Nâng lint `warn` → `error` ở đây (không phải Phase 1) vì đến giờ vi phạm mới hết —
bật sớm sẽ khoá required check suốt đợt.

## Related Code Files

- Modify: `eslint.config.js` — **đây mới là nơi rule được thêm vào lần đầu**
  (Phase 1 chỉ dùng config audit riêng). Thêm ở **object thứ hai**, xem dưới.
- Delete: `eslint.copy-audit.config.js` (đã hết vai trò sau khi rule vào config chính)
- Modify: `docs/12-design-system-ui.md` §8 — thêm con trỏ tới
  `design-system/cmc-edu/MASTER.md` §"Copy / i18n UI". Không viết lại nội dung.
- Verify (read-only): toàn bộ `plan.md` + 5 phase file, `MASTER.md`,
  `PAGE-FRAMES.md`, `pages/cockpit.md`

### ⚠️ Cách thêm rule — object THỨ HAI (vá R2, sửa lại ở R3)

`eslint.config.js` hiện chỉ có **một** config object chứa cả `files`, `ignores`
và `no-restricted-imports` (rule "một cửa" duy nhất repo đang enforce). Trong flat
config, `ignores` cùng object có phạm vi **object đó**. ⇒ Thêm `design-lab.tsx`
vào mảng `ignores` hiện có sẽ **tắt luôn `no-restricted-imports`** cho file đó.

**Bắt buộc:** object thứ hai riêng, giữ object cũ **nguyên vẹn**. Nhưng object 2
phải có **đủ 3 thứ**, thiếu bất kỳ cái nào là CI đỏ:

```js
{
  files: ['apps/admin/**/*.{ts,tsx}', 'apps/lms/**/*.{ts,tsx}'],
  // (1) PHẢI ignores cả main.tsx — object 1 đang ignores chúng, nên hiện
  //     KHÔNG config nào match (`eslint --print-config` → undefined).
  //     Object 2 với files rộng sẽ kéo chúng vào scope lần đầu.
  ignores: ['apps/admin/src/main.tsx', 'apps/lms/src/main.tsx',
            'apps/admin/src/pages/design-lab.tsx',
            'apps/admin/src/pages/design-lab-wireframes.tsx'],
  // (2) PHẢI có parser — thiếu thì ESLint dùng espree, parse error ngay ở
  //     main.tsx:37 (`<StrictMode>`), và ở mọi file .tsx khác.
  languageOptions: { parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
  // (3) PHẢI có linterOptions — nếu không, 14 directive eslint-disable sẵn có
  //     báo "Unused eslint-disable directive" làm nhiễu tiêu chí "0 vi phạm".
  linterOptions: { reportUnusedDisableDirectives: 'off' },
  rules: { 'no-restricted-syntax': ['error', { /* … */ }] },
}
```

Flat config **merge** rules khi 2 object cùng match 1 file ⇒
`no-restricted-imports` ở object 1 **vẫn áp**. (R3 đã kiểm nguyên tắc này.)

## Implementation Steps

1. `pnpm typecheck` — xanh.
2. `pnpm test` — xanh (47 file test admin). **`apps/lms` không có script test.**
3. `pnpm check:ui-frames && pnpm test:ui-frames` — xanh (gate R2 phát hiện bỏ sót).
4. Chạy config audit lần cuối → **0 vi phạm**. Nhóm lint mù (9 vị trí) xác nhận
   riêng bằng checklist grep tay.
5. Thêm rule vào `eslint.config.js` ở **object thứ hai** (xem trên), mức `error`.
   Chạy `pnpm lint` → exit 0. Nếu đỏ ⇒ còn vi phạm chưa dọn, **quay lại Phase 3**,
   cấm hạ ngưỡng.
6. **Kiểm rule "một cửa" còn sống:** xác nhận `no-restricted-imports` vẫn áp cho
   `design-lab.tsx` — không được vô hiệu nó khi thêm `ignores`.
   (Số finding hiện tại = 0, nên so số trước/sau **không** chứng minh được gì —
   phải kiểm trực tiếp bằng một import thử hoặc `--print-config`.)
7. Thử `git commit` một file `apps/admin` bất kỳ → lint-staged **không** chặn.
8. Xoá `eslint.copy-audit.config.js`.
9. Push, **chờ CI**: `typecheck-and-test` VÀ `ui-e2e` (gồm `business:verify
   --strict`) xanh. Không tuyên bố done khi mới xanh local.
10. Thêm con trỏ vào `docs/12` §8.
11. **Whole-plan consistency sweep** — đọc lại `plan.md` + 5 phase file, đối chiếu
    code thực tế. Tìm: số liệu lỗi thời, quyết định đã đổi giữa chừng, chuỗi đã
    liệt kê nhưng không còn tồn tại, chuỗi bị revert ở Phase 4, và **artifact
    worklist có còn khớp không**.
12. Đính chính báo cáo brainstorm gốc: ghi rõ các sai lầm đã sửa sau R1+R2
    (chuẩn copy **có** tồn tại ở `MASTER.md`; subtitle **có** được `PAGE-FRAMES.md`
    cấp phép; inventory viết tay sai 2 lần → chuyển sang máy sinh).

## Tests / Validation

| Gate | Lệnh | Ngưỡng |
|------|------|--------|
| Type | `pnpm typecheck` | xanh |
| Unit | `pnpm test` | xanh (47 file admin) |
| Lint @error | `pnpm lint` | exit 0 |
| CI required | `typecheck-and-test` | xanh **trên GitHub** |
| CI required | `ui-e2e` + `business:verify --strict` | xanh **trên GitHub** |
| Nhóm ⚠️tay | checklist chuỗi + grep tay | 0 còn sót |
| Nhất quán | đọc lại toàn plan | 0 mâu thuẫn |

## Success Criteria

- [ ] `typecheck-and-test` xanh **trên CI** (gồm lint + ui-frames + typecheck + test)
- [ ] `ui-e2e` (gồm `business:verify --strict`) xanh **trên CI**
- [ ] Rule đã vào `eslint.config.js` ở **object thứ hai**; `pnpm lint` exit 0
- [ ] Object 2 có đủ `ignores` (gồm **`main.tsx`**) + `languageOptions` + `linterOptions`
- [ ] **`pnpm lint` không có dòng `Parsing error`** ← R3 Critical
- [ ] **`no-restricted-imports` vẫn áp cho `design-lab.tsx`** (kiểm bằng
      `npx eslint --print-config apps/admin/src/pages/design-lab.tsx`, không dựa
      vào so số finding — hiện tại đều bằng 0)
- [ ] `git commit` không bị lint-staged chặn
- [ ] Nhóm lint mù (9 vị trí) xác nhận bằng checklist grep tay
- [ ] `eslint.copy-audit.config.js` đã xoá
- [ ] `docs/12` §8 trỏ tới SoT; nội dung lịch sử không bị viết lại
- [ ] Whole-plan sweep báo 0 mâu thuẫn; artifact worklist còn khớp
- [ ] Báo cáo brainstorm đã đính chính sai lầm R1+R2
- [ ] Backlog đã ghi: 55 chỗ `.message` nguồn backend (**9 chỗ LMS ưu tiên** —
      Prisma error lộ ra phụ huynh), D1/D3 còn lại, JSDoc packages/ui,
      `design-lab.tsx`, **và đổi cơ chế mật khẩu mặc định backend**

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Tuyên bố done khi mới xanh local | Bước 9 bắt buộc chờ CI |
| Nâng `error` khi còn vi phạm → CI đỏ | Bước 5: đỏ ⇒ quay lại Phase 3, **cấm hạ ngưỡng** |
| `ignores` tắt luôn rule "một cửa" | Bước 5 dùng object thứ hai; bước 6 kiểm trực tiếp |
| Nhóm lint mù bị bỏ sót | Checklist grep tay riêng, tách khỏi tiêu chí lint |
| Plan lệch code sau khi sửa | Bước 11 sweep đối chiếu code thật + artifact |
| `docs/12` thành SoT thứ hai | Chỉ thêm con trỏ, cấm viết lại |
| Backlog rơi rụng | Success criteria liệt kê đích danh 5 nhóm |
