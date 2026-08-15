# Plan: Live UAT Test Campaign + End-to-End Audit Capture (pre-handoff)

**Created:** 260815-1616 | **Branch:** feat/back-before-design | **Live:** erp.clawcmc.io.vn / hoc.clawcmc.io.vn (fresh DB)

## Outcome
1. **Real-environment test campaign** (mô phỏng người dùng thật) chạy toàn hệ thống trên LIVE domain
   trước khi giao user — bắt lỗi thật, không phải chỉ chạy test có sẵn.
2. **Hệ thống audit bắt trọn lỗi end-to-end**: mọi lỗi runtime (client + server) được capture
   (GlitchTip/Sentry) kèm context (user, session, URL, correlation) — khi user báo lỗi chỉ cần mã
   lỗi/ngữ cảnh, không cần video/ảnh.

## Constraints
- Live system: chỉ dùng prod compose + .env.prod; giữ tunnel; DB fresh hiện tại.
- Không phá vỡ luồng nghiệp vụ hiện có; thay đổi code đi qua build + redeploy + verify.
- Client DSN không được lộ nội bộ (glitchtip-web không resolve từ browser user) → dùng same-origin forward.
- Test chạy trên dữ liệu thật-fresh — tạo dữ liệu test phải ghi lại để dọn (hoặc chấp nhận).

## Non-goals
- Không viết lại product code ngoài phần audit capture.
- Không đụng VPS Caddy/9router.
- Không chạy load test (ngoài scope).

## Acceptance
A1. Playwright suite môi trường thật chạy được với baseURL https://erp.clawcmc.io.vn + https://hoc.clawcmc.io.vn, mô phỏng ≥ 5 luồng nghiệp vụ chính (login admin, tạo học viên, ghi danh, phiếu thu, lớp/buổi học, LMS parent view).
A2. Mọi lỗi trong lúc test bị bắt: console errors, page errors, failed requests → evidence trong báo cáo.
A3. Client error capture hoạt động: lỗi React/JS trên admin+lms → gửi same-origin → API → GlitchTip (verify bằng cách gây lỗi có chủ đích).
A4. Server capture hoạt động (tRPC onError) + correlation: 1 lỗi gây ra → 1 event GlitchTip có thể tra cứu theo mã lỗi.
A5. Báo cáo nghiệm thu: danh sách lỗi tìm được + bằng chứng capture + hướng dẫn vận hành (cách tra cứu lỗi khi user báo).

## Phases
- **P1 Scout** (subagents song song): e2e/auth + observability — in progress.
- **P2 Design chốt** (dựa trên scout): kiến trúc client capture + danh sách journeys.
- **P3 Audit capture implementation** (Part B): client global error handler + error boundary + same-origin
  report endpoint (admin/lms → api) + error code UX; giữ nguyên contracts.
- **P4 Rebuild + redeploy live** từ nhánh (cache build), verify không vỡ.
- **P5 Real-env test suite implementation** (Part A): specs Playwright target live domain, mô phỏng human.
- **P6 Run campaign** trên live + thu thập audit evidence + dọn dữ liệu test.
- **P7 Fix lỗi tìm được + re-verify.**
- **P8 Review (code-reviewer) + báo cáo + journal.**

## Risks / Rollback
- Redeploy có downtime ngắn (down -v không dùng — chỉ up --build).
- Lỗi capture phải fail-open (không block traffic nếu GlitchTip chết) — giữ nguyên nguyên tắc instrument.ts.
- Dữ liệu test tạo trên DB fresh: chấp nhận (UAT) + ghi log tạo gì.

## P2 — Design contract (chốt sớm để các job implement song song không xung đột)

### A. Client → API error report (same-origin)
- **Endpoint (API)**: `POST /api/track-error` (raw route trong apps/api server — cùng pattern route hiện có;
  hoặc tRPC mutation public `error.report` nếu raw route không tiện). Body JSON:
  `{ "code": string | null, "message": string, "stack": string | null, "url": string, "userAgent": string,
  "route": string | null, "kind": "unhandledrejection" | "window.onerror" | "react-boundary" | "console-error",
  "extra": object | null }`
- **Response**: `{ "ok": true, "code": "<10-char correlation code>" }` — API sinh code nếu client chưa có.
- **API behavior**: capture qua Sentry.captureException/message với `extra: { clientReport: body, userAgent } `,
  và log structured kèm correlation code. Fail-open: nếu Sentry/GlitchTip chết → chỉ log, không 5xx.
- **Client (admin + lms)**: 1 util `reportError()` + hook vào `window.onerror`, `unhandledrejection`,
  React ErrorBoundary ở root; gửi fetch same-origin `/api/track-error` (không credentials bắt buộc — đã có cookie
  session; fire-and-forget). KHÔNG hiển thị stack cho user — hiển thị mã lỗi ngắn:
  "Đã có sự cố — mã lỗi: XXXXXXXXXX" (toast/overlay nhỏ).

### B. Error code UX (tra cứu khi user báo)
- Code 10 ký tự [A-Z0-9], sinh client-side (crypto.randomUUID → hash 10) hoặc server; hiển thị trong
  ErrorBoundary + trên console.error. User chỉ cần gửi mã → tra GlitchTip (search code) + log api (grep code).

### C. Server-side audit (kiểm tra/hoàn thiện)
- Giữ nguyên capture hiện có (tRPC onError, route catch, worker drain). Bổ sung: gắn correlation code vào
  log entries + event extra. Verify nginx log có real client IP (đã fix real_ip từ Phase 7 plan UAT).

### D. Real-env test suite (Playwright, live domains)
- Config mới trong apps/e2e (hoặc project mới `live-uat`): baseURL `https://erp.clawcmc.io.vn` +
  `https://hoc.clawcmc.io.vn`, workers=1 (tránh xung đột dữ liệu), retries=0, video/trace on-failure.
- Journey mô phỏng human (theo runbook checklist): login super_admin → tạo học viên → ghi danh → phiếu thu →
  tạo lớp/buổi → LMS parent xem; mỗi spec capture: pageerror, console error, requestfailures → assert 0 lỗi.
- Helper: login qua UI (không API token) — đúng quá trình human.

## P5 — Live suite design (từ scout e2e-live, constraints đã xác nhận)

- **Project riêng trong apps/e2e** (`live-uat`): baseURL https://erp.clawcmc.io.vn (admin) +
  https://hoc.clawcmc.io.vn (lms) — 2 project hoặc project riêng per domain. KHÔNG webServer,
  globalSetup chỉ health-check (KHÔNG chạm cmc_prod — assertNotProdDatabase chặn tên DB cmc_prod;
  không teardown).
- **Auth**: staff email/password (cmc_staff_session cookie, Secure → context phải https; cookie domain
  erp./hoc.clawcmc.io.vn). Super-admin bootstrap hiện CÒN dùng được (chưa ai login — mustChangePassword
  đang chờ). Setup spec: đăng nhập → đổi password → lưu password mới ra file gitignored
  (`apps/e2e/.live-credentials.json`) để các spec sau + lần chạy sau dùng (idempotent: thử bootstrap rồi
  thử saved). OTP: đọc EmailOutbox qua docker exec (không có TEST_OTP_SEAM).
- **Rate limit pacing**: staff-login 5r/m → 1 login/worker, reuse session cookie 8h; lmsAuth OTP 30s
  cooldown, 5/15min; workers=1.
- **Tạo dữ liệu**: super_admin tạo staff các vai (sale/GĐKD/GĐĐT/GV) qua UI /admin/users; Course/ClassBatch
  không có UI → tạo qua tRPC với session super_admin (pattern lms-login.ui.spec.ts).
- **Evidence**: output riêng (`plans/reports/uat-live-<ts>/result.json` + markdown) — KHÔNG ghi vào
  acceptance-results/journeys.json; ghi log dữ liệu đã tạo.
- **Journey ưu tiên** (mô phỏng human, theo runbook §5): setup roles → ADM-02 tạo tài khoản →
  P1-01 CRM funnel → P1-02 tạo phiếu → P1-03 duyệt phiếu (2 vai) → P1-05 kích hoạt ghi danh →
  P2-01 tạo lớp/buổi → P2-02 điểm danh → P1-07 parent login OTP + xem con → ADM-04 audit log.
  Mỗi spec: capture pageerror/console error/requestfailure → assert 0 lỗi + ghi evidence.

## Execution log (P3–P7, 2026-08-15) — DONE

**P3 ✅ Audit capture implemented** (3 subagents, disjoint ownership):
- `apps/api/src/lib/track-error-route.ts` (+test 7/7) — POST /api/track-error: unauthenticated, 64KB cap→413,
  missing message→400, pino {reqId, clientCode, kind, url, message}, fail-open Sentry capture (tags clientCode/reqId/kind/url).
- `apps/admin/src/lib/{error-report,error-boundary}.tsx` + main.tsx — window.onerror/unhandledrejection/ErrorBoundary,
  10-char [A-Z0-9] code hiển thị cho user ("Đã có sự cố — Mã lỗi: ..."), dedupe 1/2s max 10/page, fail-open.
- `apps/lms/src/lib/{error-report,error-boundary}.tsx` + main.tsx — cùng pattern.
- nginx: `location = /api/track-error` (limit_req zone=api burst=20, client_max_body_size 64k) trong api-locations.conf.

**P4 ✅ Redeploy live + verify chain**: rebuild 3 images, restart nginx. Verified: bundle chứa capture code
(admin+lms), /api/track-error 200 qua internet, pino reqId+clientCode, GlitchTip nhận event ("verification test").

**P5 ✅ Live suite** (apps/e2e): playwright.live.config.ts (PLAYWRIGHT_LIVE gate, live-admin/live-lms, workers=1,
no webServer, health-only globalSetup), helpers (live-auth rotation+cookie-replay+pacing, live-otp EmailOutbox
readback, live-evidence, live-trcp, live-ui), 6 journey specs.

**P6 ✅ Campaign live — 6/6 PASS (1.6m)**: setup-roles (super-admin rotation + 4 staff qua /admin/users) →
CRM O1→O4 (sale) → receipt + GĐKD approve từ hàng đợi /finance + ghi danh → class + attendance (GĐĐT+GV) →
parent OTP thật (LMS) → audit-log hiển thị hành động campaign. 0 pageError/consoleError/requestFailure.
DB sau campaign: Student=1, Receipt=2, Opportunity=2, Enrollment=2, ClassBatch=2, AuditLog=69 (audit đầy đủ).

**P7 ✅ Bugs trong campaign dev (không phải lỗi hệ thống)**: locator đổi mật khẩu — getByLabel('Mật khẩu mới')
match substring cả "Xác nhận..." (strict violation) và exact:true không khớp name có hậu tố "Required" → fix
bằng regex neo đầu /^Mật khẩu mới/; thêm toBeEnabled race-guard trước click; timeout 90s→180s. Sau fix 6/6 pass.

**A3 ✅ PROVEN end-to-end**: inject lỗi browser có chủ đích (throw trong page) → window.onerror bắt →
/api/track-error (code NG205EP08Y) → pino log → GlitchTip issue #7 "Uncaught Error: DELIBERATE-CLIENT-INJECTION-…".

**Evidence**: plans/reports/uat-live-20260815-170850/ (5 admin specs) + 171015/ (lms spec);
impl reports: impl-260815-{api-track-error,admin-client-capture,lms-client-capture,live-suite}.md;
scout: scout-260815-{observability,e2e-live}.md.

## P8 — Review + fixes (2026-08-15)

**Code-reviewer verdict: APPROVE_WITH_NOTES** — report: plans/reports/review-260815-audit-live-suite.md.
Đã fix ngay (redeploy):
- **HIGH-1 ✅**: /api/track-error tách khỏi zone api 60r/s dùng chung → zone riêng `clienterr` 10r/m burst 10
  (nginx.conf + api-locations.conf; restart nginx — verify active).
- **MEDIUM-3 ✅**: strip query string khỏi `url` trước khi vào pino/Sentry (track-error-route.ts: `split('?')[0]`;
  rebuild api — verify log không còn query).
Còn lại (đã ghi nhận, chờ quyết định user):
- **MEDIUM-1**: campaign tạo data thật trên cmc_prod (staff, opportunity, receipt, enrollment, class, attendance)
  — cần quyết định dọn sau UAT (reset DB hoặc xoá theo ledger).
- **MEDIUM-2**: super-admin đã rotate password (live-auth) — .env.prod stale; 4 staff account có password
  plaintext trong apps/e2e/.live-credentials.json (gitignored). Cần reset/disable trước bàn giao.
- LOW (9): admin reportError thiếu try/catch+keepalive (copy LMS đã có), local-sim nginx chưa có location mới,
  perms credentials 0664, live-otp SQL interpolation, slot attendance 00:00-00:30, v.v. — xem report.

**Trạng thái cuối**: Hệ thống live (feat/back-before-design) healthy; audit capture client+server hoạt động
end-to-end; campaign 6/6 pass 0 lỗi; fixes HIGH/MEDIUM đã deploy. **Chưa commit** (chờ user).

## Bàn giao prod sạch (2026-08-15) — DONE

**Commits (6, trên feat/back-before-design, gốc 0740c36):**
`0b05392` feat(api) · `7bda293` feat(admin) · `1457eea` feat(lms) · `e85fbb7` feat(infra) ·
`386cdac` test(e2e) · `e23da06` docs(plans)

**Reset DB từ đầu (bàn giao sạch):** down -v → up --build → migrate deploy (all applied) → ALTER ROLE cmc_app
(network-auth verify) → seed-super-admin. Xoá .live-credentials.json/.live-run-state.json (stale rotated password).
Backup pre-reset: /tmp/cmc-pre-wipe/cmc_prod-pre-handover-260815.dump.gz.

**Trạng thái bàn giao (verified):**
- DB: AppUser=1 (super_admin), Facility=1, Student/Receipt/ParentAccount/Enrollment/AuditLog = 0 — sạch như hệ thống mới.
- Login bootstrap hoạt động (mustChangePassword=true — đổi mật khẩu ở lần đăng nhập đầu).
- External: erp/hoc /health 200, Admin + LMS UI đúng (pre-design + audit capture).
- Audit chain sống: /api/track-error 200 → GlitchTip issue #9 "handover verification".
- Tunnel VPS 127.0.0.1:8080 active; stack api/worker/postgres/nginx healthy.
- Không còn staff test account; credentials test đã xoá.

**Hướng dẫn vận hành (handover):**
1. Đăng nhập lần đầu: admin@cmcvn.edu.vn + SUPER_ADMIN_PASSWORD (.env.prod) → buộc đổi mật khẩu.
2. Khi user báo lỗi: lấy mã lỗi user thấy → `docker compose -p cmcv2-prod logs api | grep <mã>` (hoặc GlitchTip
   http://127.0.0.1:8000 — issue tag clientCode) → có stack + url + userAgent đầy đủ.
3. Chạy lại campaign test: `cd apps/e2e && PLAYWRIGHT_LIVE=1 pnpm exec playwright test --config=playwright.live.config.ts`
   (tạo data test mới; sau đó reset lại nếu cần).
4. Rollback code: checkout commit cũ + rebuild (quy trình deploy như docs/runbook-deploy.md).

## Login upgrade + handover test (2026-08-15) — DONE

- **Login redesign deploy**: working tree có sẵn bản redesign login (light theme, brand column, portal link)
  chưa build → build lại image admin + deploy. Verify: bundle mới (index-Bz-Iqsdf.js) có đủ
  login-page__brand/features/form/footer; login.test.tsx 10/10 pass.
- **Đăng nhập admin thật (browser, live)**: login bootstrap → buộc đổi mật khẩu → /cockpit →
  shell authenticated ✓ (console chỉ 401 session.me tiền-đăng nhập — dự kiến).
- **Khôi phục bàn giao**: sau test (password bị rotate) → clear hash + re-seed → bootstrap lại
  (mustChangePassword=true, verify login).
- **Commit**: `effceb4` feat(admin): redesign login page (564+/161-).
- Hệ thống: erp/hoc 200, tunnel active, stack healthy.

## Setup khởi tạo + 2 tài khoản Giám đốc (2026-08-15) — DONE

- **2 GĐ đã tạo** (scripts/seed-directors.ts): gdkd@cmcvn.edu.vn (GĐ Kinh doanh, GDKD-001),
  gddt@cmcvn.edu.vn (GĐ Đào tạo, GDDT-001) — mật khẩu đầu Cmcgdkd@2026 / Cmcgddt@2026, buộc đổi khi login lần đầu.
- **Phân quyền**: cấp user.manage cho 2 GĐ (packages/auth/src/index.ts) + 3 guard chống leo thang
  (apps/api/src/user/router.ts): GĐ KHÔNG thể tạo super_admin, reset password super_admin, hay cấp/revoke super_admin.
  Verify live: GĐ tạo được sale (user.create OK), tạo super_admin bị chặn (FORBIDDEN).
- **Commit**: e917812 feat(auth) + effceb4 login redesign + 6 commit audit/live-suite (tổng 9 commit local).
- **Tunnel hardening (VPS)**: thêm /etc/ssh/sshd_config.d/90-cmc-tunnel-keepalive.conf
  (ClientAliveInterval 15, CountMax 3) — dọn session reverse-tunnel chết trong ~45s, hết ôm 8080 gây flap.
  Root cause 3 lần sập tunnel trước đó: sshd stale (từ 15:53) giữ 8080 với forward chết → autossh fail bind → flap → fail2ban ban IP.
- **Trạng thái**: erp/hoc 200; 3 account active (admin super_admin + 2 GĐ); stack healthy.
