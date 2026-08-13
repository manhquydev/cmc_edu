# Phase spec — LMS primitives mỏng

**Không P0.** Xếp **sau** phase token (`--cmc-*` ổn định) và phase a11y (div-click, focus, zoom nếu họ claim `index.html`). Vẫn đáng làm: 1 người + AI, không visual regression — 77 inline là khuôn copy cho trang LMS kế tiếp; trích 6 class + 2 component chặn drift với chi phí thấp, không đụng `console.css`.

**Ngoài scope:** merge Console, Tailwind, dark mode, đổi title enum/UUID, ConfirmDialog đổi quà.

## Điều kiện tiên quyết

- Token phase xong: không đổi ý nghĩa `--cmc-space-*` / `--cmc-radius-xs` / `--cmc-border`.
- A11y phase xong hoặc đã chốt backlog: nếu họ đã bỏ `user-scalable=no` thì **skip Lô 0a**.
- Không import `@cmc/ui/console.css`. Không thêm primitive vào `packages/ui` (LMS-local).

## (1) Class `lms-*` trích (thêm vào `apps/lms/src/app.css`)

Giữ class cũ (`lms-shell` / `lms-topbar` / `lms-page` / `lms-star-hero*` / `lms-child-chip*`). **Không** tạo utility margin.

| Class | Lặp | Inline sẽ thay (file:line) |
|-------|----:|----------------------------|
| `.lms-card` | 9 | `student/home.tsx:77-83`; `parent/home.tsx:29-34,98-103`; `report-card.tsx:86,104,128-133`; `homework-results.tsx:50-54`; `session-evidence.tsx:109-113`; `gifts.tsx:81-87` — `padding:16; border:1px solid var(--cmc-border); border-radius:var(--cmc-radius-xs)` |
| `.lms-card--interactive` | 1 | `student/home.tsx:75-84` (`cursor:pointer` + click). Modifier, không card mới. A11y có thể đổi `div`→`button`; class vẫn giữ. |
| `.lms-topbar__spacer` | 7 | `gifts.tsx:36`; `exercise.tsx:141`; `session-evidence.tsx:67`; `report-card.tsx:63`; `homework-results.tsx:30`; `consent-settings.tsx:41`; `reset-child-password.tsx:59` — `style={{ width: 60 }}` |
| `.lms-grid-2` | 1 | `gifts.tsx:74` — `repeat(2,1fr), gap:12` |
| `.lms-grid-3` | 1 | `session-evidence.tsx:142-146` — `repeat(3,1fr), gap:8` |
| `.lms-page--flush` | 5 | `login.tsx:309`; `change-password.tsx:33`; `exercise.tsx:95,103,121` — padding rem trên `.lms-shell` |
| `.lms-btn-block` | 8 | `login.tsx:36` (`fullWidth`) dùng `:100,:126,:201`; `gifts.tsx:118`; `consent-settings.tsx:71,78`; `reset-child-password.tsx:103`; `change-password.tsx:71` |

Còn lại ~40 `style` là `marginTop/Bottom: 4|8|16|24` — **không** thành class; chuyển `Stack`/`HStack` `gap` (token).

## (2) Component, không layout route

**Chọn:** `LmsTopbar` + `LmsPage` là component trong `apps/lms/src/components/`.

**Không** nhét chrome vào layout `/parent` hay `/student`. Router hiện tại: `/parent` = `ParentOnly`+`Suspense`+`Outlet` (`routes/index.tsx:46-63`); `/student` tương tự (`:66-80`); `/login` đứng ngoài (`:38-44`). Chrome **không** đồng nhất: home = brand+actions (`student/home.tsx:122-132`, `parent/home.tsx:133-141`); trang trong = back+title+spacer; `change-password.tsx:33` không topbar. Layout route sẽ ép một khung lên mọi child — sai. Component nhận slot `leading` / `brand` / `trailing`. `PageLoader` (`routes/index.tsx:29-34`) đổi `.lms-page--flush` centered, không đụng guard.

## (3) Lô PR độc lập, mỗi lô xanh CI

Mỗi lô: `typecheck-and-test` + **chỉ** e2e LMS liệt kê ở (5). Không đổi copy/role/URL.

| Lô | Việc | Rủi ro CI |
|----|------|-----------|
| **0** | Đọc (4) — HTML + `2xs`→`sm` meta bài. 0 class mới. | Selector e2e = role/text, không size. |
| **1** | Thêm class vào `app.css` + `LmsTopbar`/`LmsPage`. Gắn **một** trang: `homework-results.tsx` (topbar+card+back). | 1 journey parent. Rollback = revert 1 page. |
| **2** | Parent còn lại: `home`, `session-evidence`, `report-card`, `consent-settings`, `reset-child-password`. | Evidence + grade journeys. |
| **3** | Student: `home` (card interactive), `exercise` (flush), `gifts` (grid-2+card+btn). | Stars-redeem + login/activation. |
| **4** | `login.tsx` + `change-password.tsx` (flush + btn-block) + `routes/index.tsx:31` loader. Quét `style={{` còn lại → `gap`. Mục tiêu `<15` inline, không `0`. | `lms-login.ui` + OTP + activation. |

Cấm gộp lô 2+3 (cùng lúc parent+student = khó bisect `ui-e2e`).

## (4) Hai sửa đọc — tách Lô 0

1. **Zoom:** `apps/lms/index.html:6` — xóa `maximum-scale=1.0, user-scalable=no`. Giữ `width=device-width, initial-scale=1.0`.
2. **Meta bài `2xs`→`sm`:** `student/home.tsx:90`; `exercise.tsx:149,153`; `homework-results.tsx:64`. **Không** đụng login `:210,:257,:272` hay evidence `:116,:139` (không phải meta bài).

## (5) Chứng minh không hồi quy (không visual regression)

E2E assert **URL + `getByRole`/`getByText`**, không class CSS → đổi class an toàn nếu copy/role giữ nguyên.

Tái dùng (đủ phủ lô):

- `apps/e2e/tests/lms-login.ui.spec.ts` — tab, lỗi login, redirect đổi MK
- `apps/e2e/tests/journeys/lms-parent-otp-login.journey.ui.spec.ts`
- `apps/e2e/tests/journeys/lms-student-activation.journey.ui.spec.ts` — `/login` → change-password → parent reset → `/student/home`
- `apps/e2e/tests/journeys/lms-parent-evidence-consent.journey.ui.spec.ts` — `/parent/evidence`, `/parent/consent`
- `apps/e2e/tests/journeys/lms-grade-parent-view.journey.ui.spec.ts` — `/parent/homework` (“Chờ chấm” / điểm)
- `apps/e2e/tests/journeys/lms-stars-redeem-cycle.journey.ui.spec.ts` — `/student/gifts`, nút Đổi quà

Không cần: `lms-auth.spec.ts`, `kind-isolation.spec.ts` (API). Không thêm screenshot. Gate: required `typecheck-and-test` + `ui-e2e`.
