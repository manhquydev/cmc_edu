---
phase: 5
title: "Go Mantine + docs TL12 + full e2e QA"
status: completed
effort: "2-3 ngày"
priority: P1
dependencies: [3, 4]
---

# Phase 5: Gỡ Mantine + cập nhật docs TL12 + full e2e QA

## Overview

Dọn sạch Mantine khỏi toàn repo (đây là phase DUY NHẤT được gỡ dependency `@mantine/*` — rollback
policy), cập nhật tài liệu design system sang nền tảng Astryx (giữ nguyên chuẩn
semantics/states/a11y), chạy full verification + supply-chain audit và nghiệm thu acceptance
criteria toàn plan. Kết thúc: merge `feat/astryx-migration` → main qua PR.

## Requirements

- Functional: không còn dấu vết Mantine trong code lẫn dependency graph.
- Non-functional: docs khớp thực tế; bundle ≤ +15% baseline Phase 1; full e2e (API + UI) xanh;
  audit sạch/triaged.

## Related Code Files

- Modify: `apps/admin/package.json`, `apps/lms/package.json`, `packages/ui/package.json`
  (xoá `@mantine/core` + `@mantine/hooks` — hooks là phantom dep 0 import), `pnpm-lock.yaml`
  (qua `pnpm install`)
- Modify: `docs/12-design-system-ui.md` (nguồn nền tảng Mantine→Astryx; giữ §1 triết lý, §3
  semantics, §4 states, §5 patterns, §6 a11y, §9 login LMS; sửa mô tả token/thang chữ nếu đổi)
- Modify: `docs/18-tech-stack-va-chuan-ky-thuat.md` (stack UI), `docs/codebase-summary.md`,
  `docs/system-architecture.md` (nếu nhắc Mantine)
- Delete: mọi CSS/util Mantine-specific còn sót

## Implementation Steps

1. Quét tàn dư: `rg -i "mantine" -g '*.{ts,tsx,css,json}' -g '!pnpm-lock.yaml' -g '!plans/**' -g '!docs/journals/**'`
   → xử lý từng kết quả (code = xoá/thay; docs = cập nhật; journal/plan cũ = giữ nguyên, là lịch sử).
2. Xoá `@mantine/core` + `@mantine/hooks` khỏi 3 package.json; `pnpm install`; xác nhận
   `rg "@mantine" pnpm-lock.yaml` = 0.
3. **Supply-chain gate lần cuối** (red-team F4): `pnpm audit --prod` sạch/triaged +
   `npm audit signatures` pass; diff transitive tree so snapshot Phase 1, ghi nhận thay đổi.
4. Full verification trên toàn bộ workspace (hiện 15 package — số thực tế lấy từ
   `turbo run typecheck --dry-run` lúc chạy): `pnpm typecheck` + `pnpm build` + `pnpm test`
   (lưu ý root test filter loại @cmc/e2e) + API e2e + **UI e2e**:
   `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`.
5. Đo bundle admin + lms, so baseline Phase 1 → ghi vào
   `plans/260710-0236-astryx-ui-migration/reports/final-verification.md`. Vượt +15% → điều tra
   (tree-shaking, atomic CSS trùng) — bất ngờ lớn ở đây khó xảy ra vì đã spot-check từ Phase 1.
6. Cập nhật docs (Related Code Files); verify liên kết + claim đúng thực tế.
7. Visual QA tổng: checklist TL12 §10 trên các màn chính admin (desktop + tablet) và LMS (mobile);
   screenshot bằng chứng vào reports/.
8. Đối chiếu 6 acceptance criteria trong plan.md → tick từng mục kèm bằng chứng; báo user nghiệm thu.
9. PR merge `feat/astryx-migration` → main (adversarial review theo protocol repo); cập nhật 2 plan
   bị block: `260707-2308-golive-sprint` (UAT chạy lại trên UI mới) và `260707-0915-ui-implementation`
   (UI work còn lại build trên Astryx).

## Success Criteria

- [x] Lệnh quét AC#1 (dạng `-g '*.{ts,tsx,css,json}'`) = 0 VÀ lockfile sạch @mantine
- [x] Audit + signatures pass; dep-tree diff so Phase 1 được ghi nhận
- [x] typecheck + build + test + API e2e + UI e2e xanh (số liệu vào final-verification.md)
- [x] Bundle admin/lms ≤ +15% baseline (số đo cụ thể)
- [x] docs/12, docs/18, codebase-summary, system-architecture cập nhật khớp thực tế
- [x] 6 acceptance criteria plan.md tick đủ, user xác nhận nghiệm thu
- [x] PR merge main xong; 2 plan bị block được cập nhật ghi chú trạng thái

## Risk Assessment

- **UI e2e selector khác biệt sau reset flip** → spec viết theo role/label từ Phase 2 nên chịu
  được; nếu vẫn vỡ, sửa spec theo hành vi (không nới lỏng assertion).
- **Bundle vượt 15%** → hiếm vì spot-check từ Phase 1; nếu xảy ra: kiểm tra CSS trùng/tree-shaking,
  còn vượt thì trình user quyết định chấp nhận hay tối ưu thêm (kèm số liệu).
- **Merge conflict với main sau nhiều tuần** → đã giảm bằng rebase cadence; PR cuối chia theo
  thư mục nếu quá lớn để review được.
