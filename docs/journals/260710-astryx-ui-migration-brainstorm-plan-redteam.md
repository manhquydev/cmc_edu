# 2026-07-10 — Astryx UI migration: brainstorm → plan → red-team → validate (plan-only session)

## Việc đã làm
- Brainstorm chọn công nghệ UI "sang xịn mịn": verify repo facebook/astryx (Meta OSS design system,
  beta 0.1.4, StyleX, MIT — có thật, không hallucination). Advisor khuyến nghị polish Mantine (A);
  **user quyết C: migrate toàn bộ sang Astryx, ưu tiên ngay, chấp nhận dời go-live** — kèm spike gate.
  Report: `plans/reports/brainstorm-260710-0236-astryx-ui-migration-report.md`.
- Plan 5 phase: `plans/260710-0236-astryx-ui-migration/` (spike go/no-go → rebuild @cmc/ui →
  admin+lint một cửa → LMS → gỡ Mantine). Blocks go-live UAT + ui-implementation plan (2 chiều).
- Red-team 3 reviewer song song → 23 findings thô → 15 dedup (6 Critical), user apply toàn bộ.
- Validate interview 4 câu → 4 recommended: 2 UI spec tối thiểu, đợi SSO land mới tạo branch,
  tuần tự 3→4, dark mode non-goal.

## Bài học kỹ thuật (đáng nhớ)
- **E2e "xanh" không có nghĩa UI sống**: cả 6 spec apps/e2e là API-tRPC thuần; project `ui-chromium`
  có sẵn trong playwright.config nhưng 0 spec. Root `pnpm test` còn filter loại @cmc/e2e.
- **Scope phải grep, không phỏng đoán**: bảng quy đổi ban đầu chứa Notification/Menu (0 usage),
  bỏ sót AppShell; `@mantine/hooks` là phantom dep. 58 file = 47 app + 11 packages/ui.
- **`cmcTheme` là public API ẩn**: MantineThemeOverride export từ @cmc/ui làm "Phase 2 không đụng
  app" bất khả thi — strangler thuần không tồn tại khi theme type leak.
- **Astryx cần peer `@stylexjs/stylex@^0.18.3`** — docs getting-started không nói rõ, npm view mới lộ.
- **Grep tool (Claude) trả false-negative trên path plan dir** — đối chứng bằng rg trực tiếp; sweep
  nào cũng cần positive control.

## Trạng thái
Plan hoàn chỉnh, consistency sweep 0 contradiction, chưa code. Bước tiếp: đợi SSO land →
`/ck:cook plans/260710-0236-astryx-ui-migration/plan.md` (Phase 1 spike, gate go/no-go trình user).
