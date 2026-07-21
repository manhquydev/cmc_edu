---
phase: 1
title: TDD fix P1-07 mustChangePassword redirect
status: completed
priority: P1
dependencies: []
effort: 0.5-1 session
---

# Phase 1: TDD fix P1-07 mustChangePassword redirect

<!-- Updated: Red Team R1 2026-07-18 — 3 bounce-source candidates (không phải 1), preconditions, UX-severity framing -->

## Overview

Sửa bug thật chặn HS đổi mật khẩu mặc định: login trả `mustChangePassword: true` nhưng bị bounce
về `/student/home`. TDD: un-fixme test characterization → thấy FAIL thật → prove root cause →
fix tối thiểu → xanh.

**Mức độ (R1-S5):** bug là **UX-severity, không phải security-severity** — cưỡng chế đổi mật khẩu
được enforce server-side tại `assertPasswordNotExpired` (apps/api/src/trpc.ts:309-327): mọi
MUTATION của student mustChangePassword bị `forbidden`; queries (xem bài, danh sách) miễn trừ
có chủ đích. Client redirect chỉ là advisory UX. Fix guard vì vậy an toàn về security (đã verify:
StudentOnly + kind-guard + API guard đều không đổi).

## Preconditions (R1-A4 — phải có TRƯỚC bước 1)

- Stack e2e chạy được: `APP_DATABASE_URL` trỏ DB throwaway đã migrate (global-setup.ts:99
  requireEnv + assertNotProdDatabase); secrets session như 11 specs hiện dùng.
- Budget: `PLAYWRIGHT_UI=1` build admin+lms ~2min mỗi app + preview 4173/4174 → ~4-5 phút/lượt.
- beforeAll của spec tự provision dữ liệu runtime (lms-login.ui.spec.ts:81-83) — nếu 3 test
  sibling non-fixme đã từng xanh trên máy này thì env đủ; nếu chưa từng chạy ui-chromium, dựng
  env trước bằng chính script Phase 2 (trong trường hợp đó chạy Phase 2 bước env TRƯỚC Phase 1).

## Architecture — 3 nguồn bounce ứng viên (R1-A1/S1: KHÔNG phải 1)

Scout đầy đủ các navigate-in-render trên student path:

1. **`login.tsx:290-294` — ứng viên mạnh (chờ capture chốt, R2-M1)**: LoginPage root guard,
   shape THẬT: `if (session) { const dest = session.kind === 'parent' ? '/parent/home' :
   '/student/home'; navigate(dest) }` — đã phân nhánh parent/student, NHƯNG student-arm bounce
   vô điều kiện bất kể mustChangePassword. Lưu ý mâu thuẫn logic giữa các ứng viên: lập luận
   "session đúng thì guard 2 không bounce" giả định session hydrated — trái với mechanism lag
   của ứng viên 2; chỉ capture mới phân định được. Fix nếu trúng: thêm nhánh mustChangePassword
   vào student-arm, **parent-arm `/parent/home` GIỮ NGUYÊN** (regression risk).
2. **`change-password.tsx:27-30`**: `if (session && !session.mustChangePassword)` — chỉ bounce
   sai khi session stale/thiếu field (`!undefined`=true); field optional (trpc.ts:36).
3. **`home.tsx:93-97` — gương ping-pong**: `if (session?.mustChangePassword)
   navigate('/student/change-password')` — cùng anti-pattern navigate-in-render; có thể tạo
   vòng lặp change-password→home→change-password khi session state lệch pha giữa các render.

Hypothesis cũ (fixme comment 2026-07-10: context lag) CHƯA verify — bước 2 capture URL sequence
+ localStorage + component-mount trace để chốt navigate NÀO fire, TRƯỚC khi fix (F1/F3).

Fix theo bằng chứng (F2 đã điều chỉnh R1-A5): phần **behavioral** là sửa đúng điều kiện guard
tại nguồn đã chứng minh (ứng viên chính: login.tsx:291 phải phân nhánh theo mustChangePassword
như else-branch 169-172 đã làm đúng); phần **hygiene** là chuyển các render-navigate liên quan
sang `<Navigate>` — làm cho cả 3 điểm đã chạm, KHÔNG bán hygiene như thuốc chữa.

## Related Code Files

- Modify: `apps/lms/src/pages/login.tsx` (root guard :290-294 — ứng viên chính)
- Modify: `apps/lms/src/pages/student/change-password.tsx` (guard `=== false` + `<Navigate>`)
- Modify: `apps/lms/src/pages/student/home.tsx` (guard :93-97 → `<Navigate>`)
- Modify: `apps/e2e/tests/lms-login.ui.spec.ts` (bỏ `test.fixme`; cập nhật comment KNOWN BUG)
- Đọc-only: `apps/lms/src/lib/session-context.tsx`, `apps/lms/src/lib/trpc.ts`
  (sửa chỉ khi capture chứng minh root cause nằm ở storage/context — F3, ghi lý do)

## Implementation Steps

1. Verify preconditions (mục trên); **un-fixme** test; chạy `PLAYWRIGHT_UI=1 --project=ui-chromium
   -g "mustChangePassword"` → xác nhận FAIL với hành vi bounce (reproduce — không fix trước khi đỏ).
2. Capture mechanism: URL sequence + localStorage tại từng bước + đánh dấu guard nào fire
   (tạm console.log 3 điểm hoặc Playwright page events) → chốt nguồn bounce thật trong 3 ứng viên.
3. Fix behavioral tại nguồn đã chứng minh + hygiene `<Navigate>` cho cả 3 điểm; xoá comment
   "do not fix this logic here" (hết hiệu lực), thay bằng comment invariant; xoá console.log tạm.
4. Chạy lại test filter → PASS; chạy full ui-chromium (cả 2 ui specs + test mới un-fixme) +
   9 API specs → pass nguyên trạng.
5. Typecheck apps/lms + lint; grep 0 `test.fixme` trong lms-login.ui.spec.ts; grep 0
   `navigate(` trong render-body 3 file đã sửa.

## Success Criteria

- [x] Bước 1 FAIL thật reproduce (received `/student/home`); bước 2 capture browser-console CHỐT nguồn: `LoginPage root guard fired, session.mCP=true` → clobber (ứng viên 1, KHÔNG phải hypothesis change-password 2026-07-10)
- [x] Test PASS thật dưới PLAYWRIGHT_UI=1 (4/4 lms-login specs); pre-existing fails (attendance ×5, admin-shell ×2) proven trên clean HEAD, không do đợt này
- [x] Diff trong 4 file listed; session-context/trpc KHÔNG đổi (root cause là render-race, không phải storage)
- [x] Không còn navigate-in-render trên student path (3 guard → `<Navigate>`, grep verify)
- [x] Typecheck (lms/e2e/db exit 0) + lint sạch

## Risk Assessment

- **Sửa login.tsx:291 ảnh hưởng parent flow** → root guard hiện bounce cả parent lẫn student?
  (đọc kỹ :286-294 khi implement — nếu guard chung, phân nhánh theo kind + mustChangePassword,
  test parent tab vẫn pass là AC).
- **Ping-pong chỉ tái hiện được một phần trên máy nhanh** → capture bước 2 dựa URL trace không
  dựa cảm quan; nếu không reproduce được sau 3 lần chạy → ghi nhận + dừng theo F3, không fix mò.
- **UI build 4-5 phút mỗi vòng** → dùng `-g` filter trong vòng lặp, full suite 1 lần cuối.
