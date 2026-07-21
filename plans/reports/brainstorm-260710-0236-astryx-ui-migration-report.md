# Brainstorm Report — Migrate UI CMC sang Astryx (Meta design system)

- **Date:** 2026-07-10 02:36 (+07)
- **Session:** /brainstorm — "nghiên cứu chọn lựa công nghệ UI cho hệ thống nội bộ sang xịn mịn, nghiên cứu repo facebook/astryx"
- **Status:** APPROVED (user) — design duyệt kèm spike gate
- **Flags:** none

## 1. Problem statement

UI hiện tại bị đánh giá "chắp vá, không chuyên nghiệp". Mục tiêu: hệ thống nội bộ (admin ERP + LMS) đạt chất lượng thị giác "sang xịn mịn", nhất quán, không lắp ghép icon rời rạc.

**Problem-first inversion:** vấn đề gốc là *thực thi thiết kế* (màn chưa áp đủ chuẩn TL12), không phải công nghệ. Đã trình bày thẳng cho user; user vẫn chọn migrate toàn bộ sang Astryx — quyết định có chủ đích, kèm van an toàn spike gate.

## 2. Scout findings (hiện trạng)

- Monorepo pnpm@10 + turbo; Node ≥22; React 19 + Vite 6 + TS 5.7.
- Frontend: `apps/admin` (ERP desktop-first), `apps/lms` (parent/student, mobile-first). Cùng dùng Mantine 7.17 + tRPC 11 + TanStack Query + react-router 7.
- Design system nội bộ: `packages/ui` (@cmc/ui) — 10 component (PageHeader, DataTable, StatusBadge, EmptyState, StatCard, FilterBar, MasterDetail, CmcTabs, ConfirmDialog, ResultPanel) + `tokens.css`. Peer dep Mantine 7.
- Chuẩn thiết kế: `docs/12-design-system-ui.md` (TL12) — Apple-minimal + ERP density, brand `#0071E3`, semantics màu, WCAG 2.1 AA, tiếng Việt, pattern trang, login LMS 2-tab.
- Footprint: **58 file** import trực tiếp `@mantine/core` (apps + packages/ui); ~65 tsx trong admin+lms.
- Bối cảnh: đang trong go-live sprint (journal 260709), UAT chạy.

## 3. Astryx research (verified 2026-07-10)

- Repo: https://github.com/facebook/astryx — Meta open-source, MIT, ~7.4k stars, **Beta v0.1.4 (2026-07-08)**. "Grew inside Meta 8 years, powers 13,000+ apps."
- 150+ component React, TypeScript strict. Styles author bằng StyleX nhưng **consumer không cần StyleX** — precompiled CSS, override bằng className/Tailwind/CSS thường.
- Vite: hỗ trợ chính thức, "no build plugin" — chỉ CSS imports + theme provider.
- Theming: toàn bộ token là **CSS custom properties**; 7 theme sẵn (neutral khuyến nghị làm nền); dark mode built-in.
- Setup: `@astryxdesign/core` + `@astryxdesign/theme-neutral` + `@astryxdesign/cli`; import `reset.css` → `astryx.css` → `theme.css`. CLI: `npx astryx init`, component docs, codemods, MCP server (agent-ready).
- Pattern sẵn: table pages, detail layouts, form wizards, data entry — khớp nhu cầu ERP.
- **Chưa verify được từ docs:** yêu cầu React version/peer deps chính xác; chất lượng DataTable ở mật độ ERP; i18n tiếng Việt. → thuộc phạm vi spike.

Nguồn: [github.com/facebook/astryx](https://github.com/facebook/astryx) · [astryx.atmeta.com/docs/getting-started](https://astryx.atmeta.com/docs/getting-started) · [How Astryx works](https://astryx.atmeta.com/blog/how-astryx-works) · [MarkTechPost 2026-06-27](https://www.marktechpost.com/2026/06/27/metas-astryx-brings-a-cli-and-mcp-server-to-an-open-source-react-design-system-agents-can-read/)

## 4. Options evaluated

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Polish pass trên Mantine | Rẻ (ngày), zero rủi ro go-live, giữ 58 file | Không đổi nền tảng | Recommended bởi advisor — user từ chối |
| B. Pilot Astryx 1 surface | Học thật, rủi ro khoanh vùng | 2 hệ component song song = chắp vá mới | Từ chối |
| C. Migrate toàn bộ sang Astryx | 1 hệ thống nhất, nền Meta dài hạn, agent-ready | 2–4 tuần, beta 0.1.4 breaking-change risk, ảnh hưởng go-live | **CHỌN (user decision)** |

**User decisions (2026-07-10, sticky):** (1) hướng C; (2) phạm vi cả admin + LMS đồng đều; (3) ưu tiên ngay — chấp nhận ảnh hưởng lịch go-live; (4) duyệt design kèm spike gate.

## 5. Final design — strangler migration 4 stage

### Stage 0 — Spike go/no-go (1–2 ngày)
Pin `@astryxdesign/core@0.1.4` (exact), route sandbox trong `apps/admin`. Verify: (a) build Vite 6 + React 19 sạch; (b) DataTable đạt density TL12 (data 13px, header UPPERCASE 11px); (c) map token CMC (`--cmc-brand #0071E3`, semantics §3 TL12) vào CSS custom properties Astryx trên nền theme-neutral; (d) tiếng Việt render đúng (font, diacritics, truncation).
**GATE: fail bất kỳ mục nào → dừng migrate, fallback phương án A (polish Mantine).**

### Stage 1 — Rebuild `@cmc/ui` trên Astryx, giữ public API
10 component đổi ruột Mantine→Astryx, props giữ nguyên → app dùng @cmc/ui không sửa. Component Astryx thiếu → tự viết trong @cmc/ui (không giữ Mantine fallback). Theme CMC = file override CSS custom properties (kế thừa `tokens.css`).

### Stage 2 — Quét 58 file import trực tiếp `@mantine/core`
Thay bằng Astryx primitive hoặc @cmc/ui. Thứ tự: shell chung (login, layout) → admin theo khu vực → LMS. Thêm **lint rule cấm app import thư viện UI trực tiếp** — mọi UI qua một cửa @cmc/ui (chống chắp vá tái phát).

### Stage 3 — Gỡ Mantine + docs
Xoá `@mantine/*` khỏi toàn bộ package.json; cập nhật TL12 (đổi nguồn nền tảng, giữ nguyên chuẩn semantics/states/a11y); full e2e + visual QA từng màn theo TL12 §10.

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Beta 0.1.4 breaking changes | Cao | Pin exact version; nâng cấp có chủ đích qua codemod CLI; theo dõi release notes |
| DataTable/i18n không đạt ERP density | Cao | Spike gate Stage 0 — fail thì dừng |
| React 19 peer dep chưa verify | Trung | Spike Stage 0 mục (a) |
| Trễ go-live | Cao | User đã chấp nhận có chủ đích (decision #3); plan phải nêu rõ ảnh hưởng lịch |
| Bundle phình | Thấp | Acceptance: ≤ +15% so hiện tại |
| Component gap giữa chừng | Trung | Tự viết trong @cmc/ui, không mixed-stack lâu dài |

## 7. Acceptance criteria

1. Zero import `@mantine/*` toàn repo (grep = 0).
2. Mọi màn đạt checklist TL12 §10: đủ states, semantics màu §3, WCAG AA §6, ResultPanel cho automation.
3. Full e2e (`apps/e2e`) xanh; typecheck + build turbo xanh.
4. Bundle size admin/lms ≤ +15% baseline.
5. Login LMS 2-tab giữ đúng đặc tả TL12 §9 (OTP cooldown, BLOCKED-ON-COMMS, mustChangePassword).

## 8. Next steps

1. `/ck:plan` từ report này → plan chi tiết theo 4 stage (plan-only session, không code).
2. `/ck:plan red-team` → `/ck:plan validate` → sửa/tối ưu plan bản cuối.
3. Sau khi plan chốt: thực thi Stage 0 spike ở session sau.

## Unresolved questions

- React 19 compat của @astryxdesign/core (chưa có docs công khai) — trả lời tại spike.
- Astryx có DatePicker/Select đủ cho form nghiệp vụ tài chính không — kiểm tại spike (`npx astryx component --list`).
- Ảnh hưởng cụ thể lên mốc go-live (bao nhiêu ngày trượt) — cần PO chốt khi plan có estimate.
