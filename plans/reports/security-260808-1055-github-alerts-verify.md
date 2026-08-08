# Verify GitHub Security Alerts — không tin nhãn, đối chiếu code thật

**Ngày:** 2026-08-08 | **Repo:** manhquydev/cmc_edu | **Nhánh:** develop/main
**Nguồn:** GitHub Dependabot / Code scanning (CodeQL) / Secret scanning API — đối chiếu từng cái với source.

## TL;DR

7 cảnh báo mở (3 CodeQL "high" + 4 Dependabot). **Verify từng cái: 0 lỗ hổng thật đang phơi nhiễm.** 3 CodeQL là false-positive / dev-tooling; 4 Dependabot (hono) là advisory thật nhưng **middleware dính lỗi không được import** ⇒ không reachable, và vá bằng 1 patch bump. Secret scanning: sạch. Con số "9 vulns" trong push cũ đã lỗi thời (28 fixed / 1 auto-dismissed / 4 open hiện tại).

## Code scanning (CodeQL) — 3 alert nhãn "high"

| # | Rule | Vị trí | Verify | Verdict |
|---|------|--------|--------|---------|
| 30 | `js/insufficient-password-hash` | `apps/e2e/src/session-injection.ts:34` | Dòng 34 = `createHmac('sha256', secret).update(data).digest('base64url')` — đây là **HMAC-SHA256 ký session token (HS256)**, đúng primitive cho token, KHÔNG phải băm mật khẩu lưu trữ. CodeQL phân loại nhầm. Ngoài ra file là helper **e2e/dev-only** (`mintParentToken`, `DEV_SECRET` có ghi "CHANGE-IN-PROD", override bằng env ở prod). | **False positive** — dismiss (won't fix) kèm lý do. |
| 31 | `js/incomplete-multi-character-sanitization` | `scripts/presentation/check-copy.ts:194` | Regex bóc comment/tag để trích **text hiển thị từ slide HTML do team tự viết**, phục vụ lint "từ cấm". Không phải sanitizer chống XSS, input tin cậy, output không phải quyết định bảo mật. | **Không phải ranh giới bảo mật** — dismiss (used in tests / dev tooling). |
| 32 | `js/bad-tag-filter` | `scripts/presentation/check-copy.ts:182` | Cùng hàm `checkHtmlVisible`, dòng strip `<script>`. Dev-only: chỉ chạy qua `deck:check` + `scripts/presentation/build.ts` trên deck của chính team, không xử lý input người dùng runtime. | **Không phải ranh giới bảo mật** — dismiss. |

Bằng chứng dev-only cho #31/#32: `check-copy.ts` chỉ được gọi bởi `package.json` `deck:check`, `build.ts`, và 2 test — không có đường runtime.

## Dependabot — 4 alert, đều `hono` (runtime)

Cài đặt: **hono@4.12.33**. Cả 4 vá trong **4.12.34** (một patch bump duy nhất).

| # | Sev | Advisory | Middleware dính | Có import? |
|---|-----|----------|-----------------|-----------|
| 30 | medium | ReDoS trong CORS middleware | `hono/cors` | **Không** |
| 31 | medium | DoS trong Language middleware | `hono/language` | **Không** |
| 33 | medium | `memo()` giữ output SSR giữa các request | `hono/jsx` | **Không** |
| 32 | low | Proxy Helper không xoá hop-by-hop headers | `hono/proxy` | **Không** |

Verify reachability: `grep -rnE "hono/(cors|language|proxy|jsx)" apps packages` → **rỗng**. `apps/api` dùng hono chỉ như transport cho tRPC (`trpc.ts` — `basedProcedure`/`protectedProcedure`), không dùng bất kỳ middleware dính lỗi nào ⇒ **4 lỗ hổng không phơi nhiễm**.

**Verdict:** rủi ro thực tế ~0, nhưng bản vá là patch bump `4.12.33 → 4.12.34` (không breaking) đóng cả 4 alert ⇒ nên vá cho sạch tab Security, ưu tiên thấp.

## Secret scanning
0 alert mở. Sạch. (Khớp với nghiệm thu trước: không có secret/`.env` bị commit.)

## PR còn cần xử lý (thực tế)

- **#84** Prisma 6→7, **#83** TypeScript 5→6 — major breaking, đang fail CI, đã comment HELD. Chờ buổi migration riêng (worktree cô lập). Không có PR nào khác đang mở.
- Không có PR mở cho hono (dependabot chưa tạo security PR); nếu muốn vá phải tự bump.

## Hạng mục hành động (đề xuất)

1. **hono → ^4.12.34** (patch, đóng 4 dependabot alert) — PR nhỏ, ưu tiên thấp.
2. **Dismiss 3 CodeQL alert** kèm bằng chứng cụ thể (theo AGENTS.md: dismiss false-positive có bằng chứng): #30 = "won't fix — HMAC token signing (HS256), not password storage; e2e-only helper"; #31/#32 = "used in tests / dev copy-linter on trusted self-authored HTML, not a security sanitizer".
3. **#83/#84** — giữ HELD (không đổi).

## Ghi chú lệch số liệu
Push cũ báo "9 vulnerabilities (1 high, 7 moderate, 1 low)". API hiện tại: dependabot 28 fixed / 1 auto-dismissed / 4 open. Con số push là ảnh chụp lỗi thời (nhiều alert đã đóng qua các bump đã merge). Đây chính là lý do phải đo API trực tiếp thay vì tin message.

## Unresolved / cần quyết
- Có tự bump hono 4.12.34 (qua PR) không, hay chờ dependabot tự mở?
- Có dismiss 3 CodeQL alert kèm bằng chứng luôn không, hay để bạn review evidence trước?
