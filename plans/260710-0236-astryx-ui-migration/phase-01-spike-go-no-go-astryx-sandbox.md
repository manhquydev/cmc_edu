---
phase: 1
title: "Spike go/no-go Astryx sandbox"
status: completed
effort: "1-2 ngày"
priority: P1
dependencies: []
---

# Phase 1: Spike go/no-go Astryx sandbox

## Overview

Kiểm chứng thực nghiệm Astryx trên stack CMC trước khi cam kết migrate. Đây là **gate cứng**:
fail bất kỳ tiêu chí GO nào → dừng toàn plan, fallback polish Mantine (brainstorm report §4-A).
Không viết code production trong phase này — toàn bộ nằm trong route sandbox, xoá được sạch.

## Requirements

- Functional: sandbox route dev-only trong `apps/admin` render đủ các bài kiểm.
- Non-functional: không ảnh hưởng route/production code hiện có; mọi thứ nằm sau dev-flag.

## Architecture

- **Branch trước tiên:** tạo `git switch -c feat/astryx-migration` từ main mới nhất. Toàn bộ
  plan chạy trên branch này; rebase main mỗi khi go-live sprint land thay đổi đáng kể.
- Cài pin exact (devDep để dễ gỡ nếu NO-GO), **bao gồm peer StyleX** (red-team F2):
  `pnpm add -D --filter @cmc/admin @astryxdesign/core@0.1.4 @astryxdesign/theme-neutral@0.1.4 @astryxdesign/cli@0.1.4 @stylexjs/stylex@0.18.3`
- CSS import thứ tự: `reset.css` → `astryx.css` → `theme.css` (chỉ trong entry sandbox, không đụng
  `main.tsx` global).
- Theme provider Astryx bọc riêng cây sandbox.
- **CLI luôn qua binary pinned** (red-team F6): `pnpm --filter @cmc/admin exec astryx …` —
  KHÔNG dùng `npx astryx` trần ở bất kỳ đâu trong plan.

## Related Code Files

- Create: `apps/admin/src/pages/sandbox/astryx-spike.tsx` (route dev-only)
- Create: `apps/admin/src/pages/sandbox/astryx-spike.css` (CSS imports + thử override token)
- Modify: `apps/admin/src/routes` (đăng ký route sau flag `import.meta.env.DEV`)
- Modify (nếu gate (a) yêu cầu): `apps/admin/vite.config.ts` (StyleX plugin — chỉ trong nhánh spike)
- KHÔNG sửa: `packages/ui`, `apps/lms`, bất kỳ page production nào

## Implementation Steps

0. **Precondition (validation 2026-07-10):** xác nhận khối SSO của plan go-live 260707-2308 đã
   land lên main (`git log` có PR SSO merged). Chưa land → chưa bắt đầu phase này.
1. Tạo branch `feat/astryx-migration` từ main sau khi SSO land. Đo **baseline bundle**: `pnpm --filter @cmc/admin build` +
   `pnpm --filter @cmc/lms build`, ghi kích thước vào
   `plans/260710-0236-astryx-ui-migration/reports/spike-findings.md` (chuẩn cho AC #4).
2. Cài 5 package pin như Architecture. **Supply-chain gate** (red-team F4): chạy
   `pnpm audit --prod` (sạch hoặc triage có ghi nhận) + `npm audit signatures` (verify provenance
   Meta) + snapshot transitive tree (`pnpm why @astryxdesign/core` / `pnpm list --depth 2 --filter @cmc/admin`)
   lưu vào spike-findings. Fail không triage được = NO-GO.
3. `pnpm --filter @cmc/admin exec astryx component --list` → lưu danh sách; đối chiếu 10 component
   @cmc/ui + **inventory ~30 primitive thật đang dùng** (đầy đủ ở Phase 3 Architecture; nặng nhất:
   AppShell, Modal, Select/MultiSelect, NumberInput, Table, Tabs, ScrollArea, Breadcrumbs, NavLink,
   Alert, Skeleton, DatePicker nếu có nhu cầu form tài chính).
4. Dựng sandbox route với các bài kiểm GO/NO-GO:
   - **(a) Build + toolchain**: Vite 6 + React 19 + TS 5.7 build sạch, không unmet-peer chặn,
     dev HMR chạy. **Trả lời dứt điểm:** Astryx precompiled CSS chỉ cần runtime `@stylexjs/stylex`
     hay cần thêm StyleX Vite/Babel plugin? Ghi rõ cấu hình tối thiểu vào spike-findings.
   - **(b) DataTable ERP density**: bảng ≥50 dòng dữ liệu tiếng Việt thật (tên HS, mã CMCx, tiền VND)
     — data 13px, header UPPERCASE 11px, row hover/selected, skeleton loading, empty state.
   - **(c) Token mapping**: override CSS custom properties của theme-neutral bằng token CMC
     (`--cmc-brand #0071E3`, hover `#0055C6`, muted `#E8F1FC`, ink `#003D99`; text scale; radius xs
     4px). Button/Tab/Badge ăn màu brand, focus ring brand, tương phản 4.5:1.
   - **(d) Tiếng Việt**: diacritics đúng mọi weight, truncation/ellipsis không vỡ, nhãn dài
     ("Duyệt & Kích hoạt", "Gửi mã OTP") không tràn nút.
   - **(e) Bundle delta spot-check** (red-team F15): build admin kèm sandbox, so baseline —
     ước lượng delta khi dùng thật. Delta bất thường (>15% chỉ từ vài component) = tín hiệu NO-GO,
     điều tra tree-shaking/atomic CSS trước khi kết luận.
5. Kiểm thêm (không phải gate, ghi nhận): dark mode; a11y keyboard nav Dialog/Tabs.
6. Viết `reports/spike-findings.md`: kết quả (a)–(e) PASS/FAIL, component list + gap, cấu hình
   StyleX tối thiểu, audit results, estimate lại Phase 2–5, khuyến nghị GO/NO-GO.
7. **Gate**: trình user quyết định GO/NO-GO kèm findings. NO-GO → đánh dấu plan `cancelled`,
   mở plan polish Mantine mới. GO → gỡ route sandbox khỏi build production (giữ code tham chiếu
   đến hết Phase 2), sang Phase 2.

## Success Criteria

- [x] Branch `feat/astryx-migration` tạo từ main mới nhất
- [x] Baseline bundle admin + lms được ghi lại
- [x] Supply-chain gate: audit + signatures + dep-tree snapshot có kết quả trong spike-findings.md
- [x] 5 bài kiểm (a)–(e) có kết quả PASS/FAIL rõ ràng; câu hỏi StyleX toolchain được trả lời dứt điểm
- [x] Danh sách component Astryx + gap analysis so với @cmc/ui và ~30 primitive app đang dùng
- [x] Quyết định GO/NO-GO được user xác nhận, ghi vào plan.md
- [x] Không thay đổi nào lọt vào code production ngoài route dev-only (xác nhận qua `vite build --mode production`, 0 byte Astryx trong output)

## Risk Assessment

- **React 19 / StyleX peer-dep conflict** → nếu phải ép peer (force/legacy) thì tính là FAIL bài
  (a) — production không chạy trên peer ép.
- **DataTable thiếu density API** → thử override bằng CSS custom properties/className trước khi
  kết luận FAIL; ghi rõ cách đạt được nếu PASS có điều kiện.
- **Spike kéo dài quá 2 ngày** → tín hiệu NO-GO mềm, báo user.
- **Rollback phase này:** xoá sandbox files + gỡ 5 devDep = về trạng thái main; không có dấu vết.
