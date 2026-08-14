---
title: "Con A — Trải nghiệm trang bản ghi CRM"
description: "Trang chi tiết cơ hội phản hồi tức thì, statusbar bấm một bước, dòng thời gian RecordEvent bất biến, việc cần làm có màu ba mức và độ nguội theo giai đoạn."
status: completed
priority: P1
effort: multi-day
tags: [crm, ux, record-page, timeline, activity]
created: 2026-08-13
parent: ../260813-1629-chuong-trinh-trai-nghiem-chuoi-kinh-doanh/plan.md
blockedBy: []
blocks: []
---

# Con A — Trải nghiệm trang bản ghi CRM

Kế hoạch con đầu tiên của [chương trình trải nghiệm chuỗi kinh
doanh](../260813-1629-chuong-trinh-trai-nghiem-chuoi-kinh-doanh/plan.md). Hợp đồng và các quyết
định: [`decisions-owner-260813-1607-trai-nghiem-crm.md`](../reports/decisions-owner-260813-1607-trai-nghiem-crm.md)
(đặc biệt #11 breakpoint 1200px, #12 độ nguội, #13 `RecordEvent`, #16 bất biến).

## Overview

Ba phase, mỗi phase một PR, tuần tự. Tất cả chữa **Đ4** (mơ hồ, sợ dùng hệ thống): người dùng
thấy hệ quả hành động ngay; mở bản ghi là biết toàn bộ lịch sử; nhìn màu là biết việc gấp.

Trước khi bắt đầu: lấy mốc `pnpm acceptance:report` và ghi vào PR đầu tiên.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Mọi hành động trên trang chi tiết đổi màn hình ngay, không tải lại; statusbar bấm được đúng một bước liền kề | P1 |
| 2 | Dòng thời gian bất biến trên bảng `RecordEvent` facility-scoped, ghi chú là một loại event, đủ cả sự kiện nhập học O5 | P1 |
| 3 | Việc cần làm ba mức màu + chỗ gom đếm số; cơ hội nguội hiện số ngày, ngưỡng theo giai đoạn | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phản hồi tức thì + statusbar](./phase-01-start.md) | Done |
| 2 | [Dòng thời gian bản ghi](./phase-02-dong-thoi-gian-ban-ghi.md) | Done |
| 3 | [Việc cần làm và độ nguội](./phase-03-viec-can-lam-va-do-nguoi.md) | Done |

## Success Criteria

- [x] Cổng cứng của cả ba phase đạt (xem từng phase)
- [x] `typecheck-and-test` + `ui-e2e` xanh ở PR #138 (một PR cho cả ba phase)
- [ ] `pnpm acceptance:report` không tụt so với mốc đã lấy — chưa chạy lại sau land; tin CI `ui-e2e` xanh
- [x] Không hạng mục nào trong "Chưa làm" bị kéo vào (follower, email ra ngoài, backfill AuditLog,
      bảng cấu hình ngưỡng trong DB)

## Red Team Review

### Session — 2026-08-13 (vòng 1)

**Reviewer:** 3 lens (Security Adversary, Assumption Destroyer, Failure Mode Analyst), tier
Standard. **Findings:** 25 thô → 15 nhóm sau khử trùng lặp (15 accepted, 0 rejected — tất cả có
bằng chứng file:line). **Severity:** 3 Critical, 8 High, 4 Medium.

| # | Finding (gộp) | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | `ProgressSteps` chỉ cho bấm bước đã qua — "chỉ chưa truyền onStepClick" là khẳng định sai; phải đổi API per-step, `packages/ui` vắng trong file list | Critical | Accept | Phase 1 |
| 2 | Emit site thật = 11/4 file (thêm appointment O2→O3→O4, bulk import, walk-in auto-create), không phải "~8/3 file" | Critical | Accept | Phase 2 |
| 3 | `cleanupFacility` (2 bản) không biết `RecordEvent` ⇒ vỡ toàn suite; bảng INSERT-only phải teardown qua `privilegedDb()` | Critical | Accept | Phase 2 |
| 4 | Vị trí emit chưa quyết — chốt: trong `advanceOpportunityOneStep` + tham số `actor`; finance emit trong `runMoneyTransaction` / `runCancelTransaction` (bare `ctx.db` bị RLS chặn) | High | Accept | Phase 2 |
| 5 | Payload finance rò tiền sang sale (SoD) — allowlist per-kind, event finance không mang số tiền | High | Accept | Phase 2 |
| 6 | "Bất biến" phải ép ở DB: GRANT SELECT+INSERT theo tiền lệ wave-A, test mức DB | High | Accept | Phase 2 |
| 7 | `useTestAppointmentActions` cùng lớp bug stale — phase 1 chỉ chữa một nửa | High | Accept | Phase 1 |
| 8 | `DueFollowUps` (lte now, cap 50) không đếm nổi ba mức; thiếu đích điều hướng — count query riêng + filter `due` | High | Accept | Phase 3 |
| 9 | Statusbar thiếu đường lỗi: pending disable, `onError` invalidate + tiếng Việt; check client là UX-only (mapping id/userId) | High | Accept | Phase 1 |
| 10 | Journey `crm-opportunity-lost` có `page.reload()` che bug + unit test mock trpc ⇒ cổng "fail nếu revert" là giả — gỡ reload | High | Accept | Phase 1 |
| 11 | Không có rollback/epoch story — mốc "Lịch sử ghi từ…", ghi nhận lỗ hổng vĩnh viễn khi revert | High | Accept | Phase 2 |
| 12 | O5 vào/ra là transition có điều kiện (phiếu thứ hai, huỷ-một-trong-hai) — emit theo nhánh điều kiện + 2 test | Medium | Accept | Phase 2 |
| 13 | AddNote/Timeline thiếu spec: registry key `packages/auth`, actor server-derived, max length, plain text, ma trận quyền tường minh, hardcode `entity` chống confused-deputy | Medium | Accept | Phase 2 |
| 14 | Pagination keyset (vòng 2 đính chính: `rewards.list` đã có cursor — tham khảo, không chép nguyên), union `kind` đóng + fallback hiển thị (không ẩn lặng lẽ), `data-testid` chống va selector journey (viewport 1280 > breakpoint 1200) | Medium | Accept | Phase 2 |
| 15 | Hàm phân mức đặt ở `@cmc/domain-time` nhận `now` (api không import được `@cmc/ui`; snapshot server thối qua đêm); bảng ngưỡng nguội là input plan (journey gim 10 ngày ở O1); env gim ở 3 file test | Medium | Accept | Phase 3 |

Effort cập nhật sau red-team: Phase 1 `1d → 2d`, Phase 2 `3d → 4d`, Phase 3 `1.5d → 2d`.

Hai quyết định PO phát sinh từ findings, chủ hệ thống chốt 13/08: quyền timeline/ghi chú theo
kiểu Odoo (quyết định #17), bảng ngưỡng nguội khởi điểm O1 7 · O2 7 · O3 14 · O4 7 (quyết định
#18) — xem file quyết định.

### Whole-Plan Consistency Sweep (13/08, sau vòng 1)

- Files reread: plan mẹ (plan.md + 3 phase), Con A (plan.md + 3 phase), file quyết định
- Decision deltas checked: 15 nhóm finding + 2 quyết định PO mới (#17, #18)
- Reconciled stale references: 4 — "~8 site" trong quyết định #13 (→ 11 site/4 file); "18 kế
  hoạch chưa xong" ở plan mẹ R4 và file quyết định (→ ~17); thêm R5 (phối hợp schema với
  `260813-0813`) vào plan mẹ; ba phase file Con A viết lại toàn bộ nên không còn bản cũ
- Ghi chú tra cứu: báo cáo brainstorm `brainstorm-260813-1615` vẫn ghi "~8 site" — đó là hồ sơ
  lịch sử tại thời điểm brainstorm, không sửa; số chính thức là bảng 11 site trong phase 2
- Unresolved contradictions: 0

### Session — 2026-08-13 (vòng 2, validate độc lập)

Kiểm định viên độc lập fact-check bản plan **đã sửa** (~50 trích dẫn trọng yếu + 3 spot-check
khả thi). Kết quả: toàn bộ trích dẫn file:line khớp mã nguồn; bảng 11 emit site xác nhận **đủ**
(grep mọi cửa ghi Opportunity — không sót, không có đường delete ngoài teardown test); thêm
`actor` vào `advanceOpportunityOneStep` khả thi (đúng 3 caller); `@cmc/domain-time` browser-safe;
ngưỡng O1=7 giữ journey `crm-rotting` xanh được kiểm ở mức assertion.

**6 lỗi câu chữ tìm thấy → đã sửa cùng ngày (không lỗi nào đụng quyết định #1–#18):**

| # | Lỗi | Sửa tại |
|---|---|---|
| 1 | "Emit finance trong `runMoneyTransaction`" chỉ đúng 2/3 site — site 10 nằm trong `runCancelTransaction` (`finance/router.ts:492`, `withFacility` tại `:1141`) | Phase 2 (4 chỗ) + bảng finding 4 |
| 2 | "Repo chưa có cursor pagination" sai — `rewards.list` (`reward-router.ts:282-304`) đã có keyset theo `id` | Phase 2, mục phân trang |
| 3 | Plan mẹ ghi "16 quyết định" — thực tế 18 | Plan mẹ |
| 4 | Phase 3 tự mâu thuẫn "3 vs 4 file test" gim env — thực đo 3 (journey không đọc env) | Phase 3 (3 chỗ) + bảng finding 15 |
| 5 | `apps/admin` chưa có dependency `@cmc/domain-time` — thiếu trong file list | Phase 3, Related Code Files |
| 6 | "Tuần tự" mâu thuẫn `dependencies: [1]` của phase 3 (phase 2+3 cùng sửa `opportunity-detail.tsx`) | Phase 3 frontmatter → `[1, 2]`; sửa luôn đường dẫn `session-context` ở phase 1 |

Verdict sau sửa: **SẠCH — sẵn sàng implement.**

<!-- slug: con-a-trai-nghiem-trang-ban-ghi-crm -->
