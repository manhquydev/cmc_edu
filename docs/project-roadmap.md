# CMC EDU v2 — Project Roadmap (vision đích cuối + milestone sống)

> Nguồn sự thật cho **hướng đi sau go-live**. Chốt với PO 2026-07-08, cập nhật 2026-07-10 (Astryx migration spike GO).
> Milestone **quality-gated, không date-gated** — qua milestone khi exit criteria đo được pass,
> không ép deadline. Plan chi tiết tạo **just-in-time** khi milestone sắp bắt đầu (tránh drift —
> bài học plans 260706-1803 / 260707-2128). Trạng thái build lịch sử P0→P5: TL31.

---

## 1. Định nghĩa Kết quả Cuối cùng (Definition of Final Done)

CMC EDU v2 đạt đích khi **cả 5** điều sau đúng:

1. **Nghiệp vụ khép kín 100%** — mọi hàng Ma trận Truy vết (TL25) đủ Vai trò→WF→API→UI→Test→ADR,
   không ô mồ côi. P4 đóng nốt: lịch test, after-sale case, họp PH đầy-cuối (TL28).
2. **AI agent là công dân thật** — recon agent HOTL + teacher-assist draft chạy trên dữ liệu thật
   qua MCP + RLS + audit; eval (TL29 §5) đạt ngưỡng mới mở auto; không quyền duyệt tiền;
   không gửi PII/ảnh trẻ ra LLM không kiểm soát (TL08 §7, TL30).
3. **Hạ tầng production thật** — VPS thật (hết local-sim), TLS/DNS thật, backup R2/S3 remote +
   restore drill định kỳ pass (RT-13), runbook second-person.
4. **Multi-facility** — tất cả cơ sở CMC hiện có chạy trên cùng stack; RLS isolation chứng minh
   bằng vận hành thật (không chỉ test âm tính).
5. **Vòng học hỏi đóng** — incident/postmortem template dùng thật; mọi thay đổi qua PR + gates;
   không hotfix tay trên prod.

**Loại khỏi phạm vi v2** (giữ nguyên quyết định TL16): huy hiệu · bảng xếp hạng · chứng chỉ tự động ·
duyệt lên cấp. SaaS hoá/multi-tenant ngoài CMC: **không trong vision này** (cần brainstorm riêng nếu đặt ra).

## 2. UI Design System Migration: Phases 3–4 COMPLETE (2026-07-10)

> ℹ️ **2026-07-11:** một scout build phát hiện `pnpm build`/`typecheck` FAIL với ~30x `TS2307`
> (`@astryxdesign/core/*` subpath) trên máy dev này — **đã RESOLVED cùng ngày**: root cause là
> `node_modules` cục bộ bị stale/thiếu gói (147 gói lệch, kể cả thiếu hẳn `eslint`), không phải bug
> Astryx/code thật. Sau `pnpm install --frozen-lockfile` sạch: build/typecheck/lint 100% xanh trở lại.
> Xác nhận thêm: container `cmcv2-prod-lms` (local self-host qua Docker) build thành công độc lập và đang
> chạy tốt suốt — chưa từng bị ảnh hưởng vì `Dockerfile.lms` luôn cài fresh trong container. Chi tiết:
> `docs/project-changelog.md` mục `[2026-07-11]`.

Ngoài các milestone dọc tuyến tính M0→M4, **UI migration spike đã hoàn thành Phases 3–4**:
- **Phase 1 (GO):** Mantine v7 → Astryx (beta) — verified không phá build, CSS footprint tốt hơn, zero supply-chain risk.
- **Phase 2 (complete):** All 10 components migrated, theme rebuilt (cmcTheme → AstryxCmcProvider CSS-only), peerDependencies updated. MantineProvider + AstryxCmcProvider coexist (strangler). Workspace clean: build + typecheck + test green. Browser e2e: 4 passing, 1 fixme, 0 failing.
- **Phase 3 (complete, 2026-07-10):** **apps/admin 100% migrated** to Astryx — all 34 page/lib files + shell rewritten. Single-door barrel `@cmc/ui/primitives` created. Apps import ALL UI from `@cmc/ui` only; `rg "@mantine" apps/admin/src` = 0. Migration order (risk-first): shell/AppShell → login → 5 business-area clusters. **ESLint flat config added** (`eslint.config.js`): `no-restricted-imports` enforces one-door rule (ban @mantine/* + @astryxdesign/* in apps/admin/**, whitelist apps/admin/src/main.tsx for reset/theme CSS). Reset flip: apps/admin/src/main.tsx imports @astryxdesign/core/reset.css, dropped MantineProvider + @mantine/core/styles.css (no double-reset conflict). Sandbox deleted. Verification: typecheck + build clean, e2e green (4/4), auth-screen blocking check passed, code-review Approve (0 Critical). Known trade-offs (TODO(astryx-review)): semantic-color enums, Button/Badge variants, Dialog focus-trap, NumberInput thousand-separator, TextArea autosize.
- **Phase 4 (complete, 2026-07-10):** **apps/lms 100% migrated** to Astryx — all 13 files (login + 10 parent/student pages + routes + main.tsx) rewritten. `rg "@mantine" apps/lms/src` = 0. **New @cmc/ui composites:** `TextField` (forwards HTML input attributes—inputMode, maxLength, autoComplete, pattern—that Astryx TextInput omits but passes via ...rest) + `PasswordInput` (composes TextField + show/hide toggle; Astryx lacks native) + `ProgressBar` (added to primitives). **LMS login hardening preserved & e2e-verified:** OTP field autoComplete="one-time-code" + inputMode="numeric" + maxLength=6; password autoComplete="current-password"; phone inputMode="tel"; email type. New non-skippable e2e test asserts these land on real DOM. Generic no-leak error messages preserved. Astryx exact-pinned (0.1.4) to prevent ...rest regression. **Theme-level fixes (LMS mobile QA):** `:focus-visible` brand-outline fallback + `@media (max-width:768px)` 44px min-height touch-target for inputs+buttons (Astryx ~32px < TL12 §7). **ESLint one-door rule extended to apps/lms/**. Reset flip: apps/lms/src/main.tsx imports @astryxdesign/core/reset.css + drops MantineProvider. **Known trade-off:** Astryx TabList ARIA regression (buttons not role=tab/aria-selected)—flagged for future @cmc/ui wrapper. Verification: typecheck + build clean, lint (admin+lms) clean, UI e2e 5 passed + 1 fixme, API e2e 17 passed. Code-review: Approve (0 Critical; 1 Important fragility mitigated).
- **Phạm vi:** Strangler pattern qua Phase 4; bỏ Mantine chỉ ở Phase 5 (không chặn milestone trước). ESLint one-door rule spans admin+lms.
- **Roadmap:** Phase 5 (remove Mantine package deps entirely + full e2e QA + TL12 docs) is final phase.
- **Plan:** `plans/260710-0236-astryx-ui-migration/` (5 pha, gitignored).

Công việc này **song song với M0-M4**, không kéo timeline M0 go-live. **Phase 5 (Mantine dep removal) là next.**

---

## 3. Bản đồ milestone

| # | Milestone | Phạm vi chính | Exit criteria (đo được) | Plan | Trạng thái |
|---|---|---|---|---|---|
| **M0** | Go-live sprint | Land SSO (PR #24) → ENV `cmcv2-prod` local-sim → UAT 2-run + người thật | Biên bản GO ký; e2e critical 2/2 PASS prod-config; email live Brevo+Graph; tracker #8/#9/#10 completed | `plans/260707-2308-golive-sprint-land-sso-env-uat` | **Đang chạy** — Phase 1 PR #24 CI xanh |
| **M1** | Pilot ổn định + VPS thật | Vận hành pilot 1 cơ sở; fix-forward; chuyển VPS thật + TLS/DNS thật; backup R2/S3 remote | ≥2 tuần không CRITICAL; stack trên VPS thật healthy; restore drill pass với R2/S3 remote; runbook cập nhật | tạo khi M0 GO | Chưa |
| **M2** | P4 completion | Lịch test (WF-P4-04) · after-sale case (WF-P4-05) · họp PH audit đầy-cuối · ✅ test coverage P4-adjacent (CLOSED 2026-07-10 via commit 326dfcc) | Acceptance TL28 pass; trace matrix P4 không ô trống; gates xanh; TL25 P4 test refs verified | tạo khi M1 gần xong | Chưa — P4 test-gap sub-item DONE (2026-07-10); other sub-items remain open |
| **M3** | P5 AI crawl→walk | Recon agent HOTL trên data pilot thật · teacher-assist draft→GV chốt · eval plan viết + chạy | Eval đạt ngưỡng TL29 §5; override-rate đo được; PII-guard verify; agent qua MCP chịu gate/RLS/audit | tạo khi M2 gần xong | Chưa |
| **M4** | Multi-facility rollout | Onboard toàn bộ cơ sở CMC còn lại (seed + runbook per-facility) | Tất cả cơ sở live; cross-facility isolation audit pass trên vận hành thật | tạo khi M3 gần xong | Chưa |

Phụ thuộc tuyến tính M0→M1→M2→M3→M4. Ngoại lệ cho phép: hạng mục M3 dạng draft-only (không tiền,
không dữ liệu trẻ ra ngoài) được thí điểm sớm trên data pilot nếu M2 kéo dài — quyết tại plan M3.

## 4. Nguyên tắc vận hành roadmap

- **Just-in-time planning**: plan milestone kế tiếp chỉ tạo khi milestone hiện tại gần exit —
  brainstorm-nhẹ → `/ck:plan` → red-team nếu chạm tiền/auth/dữ-liệu-trẻ → cook.
- **Cập nhật trạng thái tại đây** (cột Trạng thái + link plan) mỗi khi milestone chuyển pha;
  file này là trạng thái sống, TL31 giữ nguyên làm bản đồ thi công gốc.
- **Bất biến xuyên suốt** (không milestone nào được nới): RLS `withFacility`+`cmc_app` ·
  enum 9 giá trị · registry/gán `ACTIVE_ROLES` 5 role (ADR-D amendment) · zod + 5 mã lỗi · không commit secrets · dev-header chỉ non-prod ·
  timestamptz/ICT · sổ tiền/sao append-mindset.
- **Stop-conditions kế thừa** (plan 260707-2128): creds sai · migration mất dữ liệu ·
  thao tác phá huỷ ngoài repo · e2e nghi trỏ DB thật.

## 5. Phụ thuộc ngoài repo (theo dõi)

| Hạng mục | Cần cho | Trạng thái 2026-07-08 |
|---|---|---|
| R2/S3 remote creds (backup) | M0 Phase-2 drill / chậm nhất M1 | Chưa có — user cấp sau |
| Mailbox Graph licensed | M0 Phase-3 email live | Cần xác nhận |
| Lịch + người UAT thật | M0 Phase-3 | Điều phối ngoài repo |
| VPS thật (mua/thuê + DNS) | M1 | Chưa |
| Danh sách + số cơ sở CMC | M4 | Chốt khi lập plan M4 |

> Liên kết: TL31 (phased build gốc) · TL25 (traceability) · TL04/13 (AI strategy) · TL29 (test/eval) ·
> TL30 (threat) · `docs/project-changelog.md` (lịch sử).
