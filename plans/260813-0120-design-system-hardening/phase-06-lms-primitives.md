> **SUPERSEDED 2026-08-13 sau red-team 4 lens.** Không thi hành file này nguyên trạng.
> Phán quyết: `plans/reports/redteam-adjudication-260813-0139-design-system.md`.
> Phần còn hiệu lực đã chuyển sang `phase-A-precedence-pin.md` / `phase-B-docs-and-gates.md`.

# Phase 06 — Primitive LMS mỏng

**Trạng thái:** đóng — BA Q5; lot 0 (`user-scalable=no` + meta 2xs→sm) đã vào #125 · **Công:** 1–3 ngày · **Branch:** `refactor/lms-primitives` từ `develop`
**Phụ thuộc:** phase 01 (ý nghĩa `--cmc-*` đã ổn định), phase 04 (hoặc đã chốt backlog a11y)
**Đặc tả chi tiết (dùng khi thi hành):** `plans/reports/phase-spec-260813-0120-lms-primitives.md`
**Bằng chứng:** `plans/reports/audit-260813-0052-ds-l4-lms.md`

## Vì sao vẫn làm dù không P0

LMS **không có P0 chặn việc** — học viên nộp bài, xem điểm, đổi quà đều được. Nhưng 77 `style={{}}` đang là
khuôn mẫu để trang LMS tiếp theo copy. Trích 6 class + 2 component chặn drift với chi phí thấp và không
đụng `console.css`.

## Quyết định đã chốt

**Giữ tách chrome, chia sẻ lớp token đã có, làm lớp primitive LMS mỏng.**

Không hợp nhất Console vào LMS (2498 dòng Odoo tràn vào app cho trẻ và phụ huynh; touch 44px vs control 33px).
Không tách token riêng cho LMS (nhân đôi `#0071E3`/Inter, đẻ vendor giả). Không mang Tailwind vào (hệ thứ ba).

**Component, không layout route.** Router hiện tại `/parent` và `/student` là `Guard + Suspense + Outlet`
(`routes/index.tsx:46-63`, `:66-80`), và chrome **không** đồng nhất giữa các trang: home có brand+actions,
trang trong có back+title+spacer, `change-password.tsx:33` không có topbar. Layout route sẽ ép một khung lên
mọi child — sai. Dùng `LmsTopbar`/`LmsPage` nhận slot `leading`/`brand`/`trailing`.

## Class trích ra `apps/lms/src/app.css`

| Class | Số lần lặp |
|---|---:|
| `.lms-card` | 9 |
| `.lms-topbar__spacer` | 7 (`style={{width:60}}`) |
| `.lms-btn-block` | 8 |
| `.lms-page--flush` | 5 |
| `.lms-card--interactive`, `.lms-grid-2`, `.lms-grid-3` | 1 mỗi loại |

~40 `style` còn lại là `marginTop/Bottom` — **không** biến thành class, chuyển sang `Stack`/`HStack` `gap`.
Mục tiêu còn `<15` inline, không phải 0.

## Lô PR (mỗi lô xanh CI độc lập)

| Lô | Việc |
|---|---|
| **0** | Hai sửa đọc, tách riêng vì rẻ và có ích ngay: xóa `maximum-scale=1.0, user-scalable=no` khỏi `apps/lms/index.html:6`; meta bài `2xs`→`sm` tại `student/home.tsx:90`, `exercise.tsx:149,153`, `homework-results.tsx:64` |
| **1** | Thêm class + `LmsTopbar`/`LmsPage`, gắn **một** trang `homework-results.tsx` |
| **2** | Parent còn lại: `home`, `session-evidence`, `report-card`, `consent-settings`, `reset-child-password` |
| **3** | Student: `home`, `exercise`, `gifts` |
| **4** | `login.tsx`, `change-password.tsx`, loader `routes/index.tsx:31`; quét inline còn lại |

**Cấm gộp lô 2+3** — parent và student cùng lúc thì khó bisect khi `ui-e2e` đỏ.

## Chứng minh không hồi quy (không có VRT)

E2E hiện assert URL + `getByRole`/`getByText`, **không** assert class CSS ⇒ đổi class an toàn nếu giữ nguyên
copy và role. Tái dùng: `lms-login.ui.spec.ts`, `journeys/lms-parent-otp-login`, `lms-student-activation`,
`lms-parent-evidence-consent`, `lms-grade-parent-view`, `lms-stars-redeem-cycle`.

## Nghiệm thu

- [ ] `apps/lms` còn `<15` inline style
- [ ] Bỏ được `user-scalable=no`, học sinh zoom được
- [ ] Không import `@cmc/ui/console.css`, không thêm primitive vào `packages/ui`
- [ ] Mỗi lô xanh `typecheck-and-test` + `ui-e2e` trước khi sang lô kế

## Ngoài scope

Merge Console, Tailwind, dark mode, đổi title enum/UUID trên UI, ConfirmDialog cho đổi quà.