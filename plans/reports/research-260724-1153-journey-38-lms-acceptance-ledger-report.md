# Research Report: Mở rộng nghiệm thu journey 38/38 ERP + LMS

**Date:** 2026-07-24 11:53 (+07) · **Stage:** research (pipeline: research → brainstorm → plan --tdd → red-team → validate; STOP trước cook)
**Input contract:** advise 260724 (đã user-confirm): per-flow journey expansion, ERP→LMS xuyên suốt, quét-hết-rồi-sửa, sổ 4-trạng thái, không siêu-kịch-bản Ngày-0, không sửa `packages/auth`.
**Method:** 3 Explore agents đọc code (file:line verified) + 1 web search (Playwright auth/scale). KHÔNG nghiên cứu lại Q5.

## Executive Summary

Cả ba vùng đều RẺ hơn dự kiến. (1) Hạ tầng LMS-OTP-cho-test **đã tồn tại**: OTP plaintext nằm trong `EmailOutbox.payload`, bảng không RLS, e2e đã có `readOtpCode()`/`drainEmailOutboxOnce()`. (2) Sổ nghiệm thu: đổi contract nhỏ, biết trước từng điểm vỡ — nhưng lộ **lỗ fabrication** (journey coverage là đếm khai báo, không kiểm pass) phải vá trong cùng đợt. (3) Journey staff hiện **inject cookie ký, không login UI** — tiền lệ nội bộ khớp best practice Playwright (storageState), cởi nút cho LMS. Ẩn số duy nhất còn lại là **runtime thật/spec** (số 5–10 phút của agent mâu thuẫn config 30s/test — chưa đo, cấm dùng làm căn cứ).

## Q1 — Hạ tầng phiên LMS cho journey

**Verdict: gần như zero plumbing mới.**

- OTP: `LoginOtp.codeHash` chỉ lưu hash (`schema.prisma:928-950`); nhưng `requestOtpEmail` đồng thời ghi `EmailOutbox` row với `payload:{kind:'otp', code}` **plaintext** (`apps/api/src/lms-auth/router.ts:418-425`). Cả 2 bảng **không facility-RLS** (system-wide có chủ đích) → e2e đọc thẳng qua Prisma role `cmc_app`.
- Helper sẵn có trong `apps/e2e/src/db.ts`: `readOtpCode(phone)` (:80-103, brute-force 10^6 mã vs SHA256, sub-second) và `drainEmailOutboxOnce()` (:873-877, chạy `relayEmailOutbox` một nhịp — worker không cần chạy nền).
- Student first-login: `loginStudent` trả `{sessionToken, mustChangePassword}` (router.ts:516-609) → UI redirect `/student/change-password` (login.tsx:170) → màn này CHỈ cho logout; mở khóa duy nhất là parent `resetChildPassword` (router.ts:615-654). **Hệ quả thiết kế: journey kích hoạt học viên bắt buộc 2 vai (parent+student).**
- Seams hợp lệ khác: `TEST_OTP_SEAM=1` → `_testSeamCode` trong response (non-prod, router.ts:39-40,442-443); `x-dev-lms-user` DevHeaderWriter (DEV build only, login.tsx:219-278,326).
- Tiền lệ ops-smoke (mục 5, ops-smoke.sh:291-349): enqueue qua Prisma, poll `status='sent'`, **không đọc hộp thư** — journey tái dùng nguyên khuôn.
- Lưu ý: `parseLmsToken` là base64url **chưa ký** (P0-debt HMAC) — nếu chọn inject session LMS, cơ chế inject sẽ đổi khi nợ đó được trả.

## Q2 — Sổ trạng thái 4 mức

**Verdict: contract change gọn, nhưng PHẢI vá lỗ fabrication cùng lúc.**

- Schema hiện tại: `FlowEntry` (types.ts:6-31) required `id/displayName/cluster/actorRoles/expected{trpc,uiRoutes,models}`; optional `uiEvidenceSpec?`, `journey?` (đường dẫn spec).
- "9/38" = `flows.filter(f => f.journey).length` (verify.ts:217) — **đếm khai báo**. `checkJourneyCoverage` (verify.ts:59-72) chỉ check file tồn tại + chuỗi `test(`, WARN-only. KHÔNG kiểm: spec pass lần chạy gần nhất, flow-ID khớp, procedure/route giao thật. Badge tự thú "Có bài kiểm ≠ xanh" (acceptance-tab.ts:43). → khai `journey:` file ma vẫn render đẹp.
- Điểm vỡ khi FlowStatus 3→6 giá trị (`built|partial|missing` + `red-fixme|not-yet-written|no-ui-path`): `acceptanceState()`/`stateBadge()`/counts (acceptance-tab.ts:19,26,60-63), `statusLabel()`/counts (builder-tab.ts:8-10,91-95), console summary (verify.ts:206-218), consumer ngoài của verification.json (chưa xác định — unresolved).
- Cần thêm `statusReason?: {code, detail}` (lý do fixme / bằng chứng grep no-UI-path).
- Luật chống gắn-sai H2 đã thành văn (flow-manifest.ts:52-85, F1 để trần có chủ đích): chỉ gắn journey khi giao procedure/route thật với flow — plan phải giữ nguyên tắc này.

## Q3 — Khuôn scale 38+ specs

**Verdict: helpers scale được ngay; runtime là fork duy nhất.**

- **Auth staff journeys = inject cookie ký HMAC** (`mintStaffCookie` per role context, spec :61-65) — KHÔNG login UI thật, KHÔNG dev-header (VITE proxy same-origin nên chỉ cookie đi qua). Khớp khuyến nghị chính thức Playwright (storageState/session injection). §4.2/§4.3 quản nav+data, không quản login.
- Isolation: `workers:1, fullyParallel:false` (playwright.config.ts:59); **1 facility ephemeral/RUN** (global-setup.ts:79-130) dùng chung, cleanup FK-ordered per-spec; vai sau tìm dữ liệu bằng text hiển thị (`findInList` poll 10s/200ms), không truyền id.
- Flake controls: CI retries:1; `assertEntryAbsent` settled-wait (chờ cockpit render trước khi kết luận vắng, menu-nav.ts:99-112); assert positive-trước-absence; nghi thức 4-lần-xanh.
- **Runtime CHƯA ĐO**: agent ước 5–10 phút/spec nhưng config `timeout: 30_000`/test (:63) và 17 specs từng chạy 4 lần liên tiếp trong CI — mâu thuẫn. HÀNH ĐỘNG: đọc timing thật từ log job `ui-e2e` (ci.yml:175-267) trước khi quyết song song hóa. Chỉ nếu tổng runtime dự phóng vượt ngưỡng CI chấp nhận mới trả giá refactor: facility per-worker + port per-worker (`findFreePort` đã có) hoặc shard matrix CI.
- Break-at-scale (chỉ khi song song hóa): facility dùng chung, port 3999 cố định, preview rebuild `reuseExistingServer:false`, DB pool size.

## Forks chuyển cho stage brainstorm

| # | Fork | Options |
|---|---|---|
| F-A | Cơ chế phiên LMS trong journey thường (login không phải nghiệp vụ đang test) | (1) luôn login UI thật qua OTP-outbox · (2) login-flow chỉ trong journey chuyên về login/activation, còn lại inject session LMS (mirror tiền lệ cookie staff; vướng token chưa ký) |
| F-B | Runtime 38+ specs | (1) đo trước, giữ serial nếu đủ rẻ · (2) per-worker facility parallel · (3) CI shard matrix. Quyết SAU khi có số đo |
| F-C | Nguồn sự thật của sổ | (1) giữ khai báo + thêm ingestion kết quả Playwright JSON (pass/fail per spec → per flow) · (2) status tay + verify chéo tồn tại. Lỗ fabrication nghiêng mạnh về (1) |
| F-D | Gom đợt viết journey | (1) theo role-chain giống nhau · (2) theo `cluster` sẵn trong manifest |

## Sources

- Code: 3 Explore agent reports (file:line trong thân bài; spot-check được bằng Read).
- Web: [Playwright Auth docs](https://playwright.dev/docs/auth) · [Currents.dev auth guide](https://currents.dev/posts/testing-authentication-with-playwright-the-complete-guide) · [TestDino auth patterns](https://testdino.com/blog/playwright-authentication) · [TestQuality flaky playbook 2026](https://testquality.com/playwright-flaky-tests-diagnostic-playbook-2026/) · [BrowserStack storageState](https://www.browserstack.com/guide/playwright-storage-state)

## Unresolved Questions (cập nhật 11:58)

1. ~~Runtime từ log CI~~ → **KHÔNG có dữ liệu CI**: job `ui-e2e` chỉ tồn tại trong ci.yml chưa commit; 5 run main gần nhất fail ~2s (lỗi mức workflow, ngoài scope). → Đo local thành task đầu plan; F-B là decision gate theo ngưỡng đo (đề xuất: tổng dự phóng 38 specs > 45 phút CI thì mới trả giá parallel/shard).
2. ~~Consumer verification.json~~ → **RESOLVED**: chỉ `verify.ts` dùng verification.json; `FlowStatus` chỉ khai trong `types.ts`. Đổi enum an toàn.
3. LMS token chưa ký (P0-debt): nếu chọn F-A(2) inject session, thiết kế inject phải ghi rõ sẽ đổi khi HMAC signing land.
4. (Ngoài scope, cần báo user) 5 run CI main gần nhất fail sau ~2 giây — nghi lỗi workflow/runner/billing, không phải test đỏ.
