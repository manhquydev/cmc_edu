# Phase 1 — Đo runtime baseline + quyết định F-B (PROVISIONAL)

**Plan:** `plans/260724-1212-nghiem-thu-toan-dien-journey-38-erp-lms/phase-01-do-runtime-baseline.md`
**Ngày đo:** 2026-07-24 15:05–15:12 (+07)
**Branch/HEAD:** `acceptance-journey-38-lms` @ `a57e71d`
**Env:** synthetic-seed (`cmc-synth-pg`, port 55432, `--fresh` recreate rồi seed lại)

## Cấu hình máy đo

| Hạng mục | Giá trị |
|---|---|
| CPU | AMD Ryzen 7 5800H, 16 logical cores |
| RAM | 39 GB |
| Node / pnpm | v24.18.0 / 10.24.0 |
| Playwright | `workers: 1`, `fullyParallel: false` (config hiện hành, không đổi) |

Lệnh đo (2 lần liên tiếp, lần 1 warm build, lấy **cả hai** vì lệch không đáng kể):

```
PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium --reporter=json
```

JSON reporter ghi ra file ngoài repo (scratchpad) — không đụng worktree, không
đụng `.gitignore`. Workspace `pnpm build` chạy 1 lần trước cả 2 run.

## Kết quả thô

| | Run 1 | Run 2 | Lệch |
|---|---|---|---|
| Wall clock | 197 s | 198 s | +0.5% |
| Playwright `stats.duration` | 195.9 s | 196.1 s | +0.1% |
| Tests | 17 expected / 0 unexpected / 0 flaky | 17 / 0 / 0 | — |
| Exit code | 0 | 0 | — |

Lệch giữa 2 run **0.1–0.5%**, dưới xa ngưỡng 30% của phase → không cần run 3.

## Bảng timing per-spec (13 spec, giây)

| # | Spec | Run 1 | Run 2 | Loại |
|---|---|---:|---:|---|
| 1 | `screen-role-capture.ui.spec.ts` | 126.8 | 127.2 | **capture (artifact generator)** |
| 2 | `journeys/checkin-offsite-approval.journey.ui.spec.ts` | 20.1 | 19.9 | journey |
| 3 | `journeys/session-assessment-roster.journey.ui.spec.ts` | 5.0 | 5.0 | journey |
| 4 | `journeys/enrollment-second-class.journey.ui.spec.ts` | 3.8 | 3.7 | journey |
| 5 | `journeys/receipt-approve-negation.journey.ui.spec.ts` | 3.6 | 3.6 | journey |
| 6 | `journeys/checkin-punch.journey.ui.spec.ts` | 2.7 | 2.7 | journey |
| 7 | `journeys/rewards-redeem-approval.journey.ui.spec.ts` | 2.5 | 2.6 | journey |
| 8 | `journeys/finance-receipt.journey.ui.spec.ts` | 2.4 | 2.4 | journey |
| 9 | `lms-login.ui.spec.ts` | 2.3 | 2.4 | UI spec (không phải journey) |
| 10 | `journeys/crm-receipt.journey.ui.spec.ts` | 1.8 | 1.9 | journey |
| 11 | `journeys/payroll-roster.journey.ui.spec.ts` | 1.8 | 1.8 | journey |
| 12 | `journeys/gift-config-nav.journey.ui.spec.ts` | 1.6 | 1.6 | journey |
| 13 | `admin-shell.ui.spec.ts` | 1.3 | 1.3 | UI spec (không phải journey) |

**Tổng test duration** ≈ 175 s. **Overhead** (globalSetup + 2 preview webServer
build/boot) ≈ 21 s.

### Median TÍNH RIÊNG trên 10 journey (RT-14)

Sorted (run 1): 1.6 · 1.8 · 1.8 · 2.4 · 2.5 · 2.7 · 3.6 · 3.8 · 5.0 · 20.1

- **Median journey = 2.6 s**
- Mean journey = 4.5 s (bị kéo bởi outlier)
- Max journey = 20.1 s (`checkin-offsite-approval`, 2 vai)

`screen-role-capture` (126.8 s = **65% tổng runtime**) là artifact generator, cost
profile khác hẳn — liệt kê riêng, KHÔNG vào median, đúng RT-14.

## Dự phóng

Số spec sau triage tạm dùng **~40** (Phase 2 sẽ cấp con số chính xác) → thêm
**~30 journey** so với 10 hiện có.

Công thức: `tổng dự phóng = runtime hiện tại (196 s) + 30 × chi-phí-mỗi-journey`

| Kịch bản | Chi phí/journey | Tổng local | ×2 (CI thấp) | ×4 (CI cao) |
|---|---:|---:|---:|---:|
| Lạc quan (median) | 2.6 s | 274 s ≈ **4.6′** | 9.1′ | 18.3′ |
| Bi quan (dùng journey chậm nhất hiện có làm đơn giá) | 20.1 s | 799 s ≈ **13.3′** | 26.6′ | 53.3′ |

Hệ số runner CI **2–4×** là giả định (runner GitHub 2-core vs Ryzen 7 16-core),
**chưa kiểm chứng bằng số đo thật** — xem mục Cảnh báo.

Dải dự phóng CI: **[9′ … 53′]**. Cận trên bi quan vẫn **dưới ngưỡng 90′** của D2.

## Verdict F-B (PROVISIONAL)

> **Giữ full-suite `ui-chromium` serial (`workers: 1`), chạy mỗi push — KHÔNG cần
> nightly, KHÔNG cần shard.**

Căn cứ: cận trên bi quan 53′ < 90′ (ngưỡng lỏng D2), với biên an toàn ~40%.

Điều kiện chốt cứng (chưa đạt): cần số đo từ **lần chạy full-suite CI đầu tiên**.

### Cảnh báo về tính provisional (V4)

Verdict này **không thể chốt cứng ở thời điểm hiện tại**: CI của repo đang chết vì
**billing** — mọi run từ 2026-07-17 fail trong 3–4 giây với 0 step được thực thi
(run gần nhất `30077288512` trên `a57e71d`; YAML hợp lệ, Actions `enabled`, repo
private → hết Actions minutes/spending limit). Không có số đo runner CI nào tồn
tại và cũng không thể tạo ra cho tới khi minutes được khôi phục.

Hệ quả: hệ số 2–4× vẫn là **giả định**, không phải số đo. Verdict giữ nguyên
trạng thái PROVISIONAL cho tới lần chạy CI thật đầu tiên.

### Rủi ro đã biết với dự phóng

1. **Journey mới có thể đắt hơn journey cũ.** 10 journey hiện có nghiêng về
   1-2 vai; đợt ghi-danh/vận-hành-lớp (Phase 6) nhiều vai và nhiều bước hơn.
   Cột "bi quan" đã dùng đơn giá 20.1 s (journey 2-vai đắt nhất) để hấp thụ
   phần này, nhưng nếu journey 3-4 vai trở thành phổ biến thì đơn giá thực có
   thể vượt 20 s. → Cập nhật số thật sau mỗi đợt (Phase 5/6/7).
2. **`screen-role-capture` chiếm 65% runtime hiện tại** và không co lại khi thêm
   journey. Nếu cần cắt runtime sau này, đây là mục tiêu rẻ nhất (tách khỏi
   full-suite thành job riêng) — nhưng KHÔNG làm trong plan này.
3. Retry CI (`retries: 1` khi `CI=true`) có thể nhân đôi chi phí spec đỏ; dự
   phóng trên giả định 0 retry.

## Đối chiếu Success Criteria phase

- [x] Bảng timing thật cho 13/13 spec (2 lần chạy; median tính trên 10 journey)
- [x] Dự phóng dải [thấp, cao] có công thức + hệ số CI hiện rõ
- [x] Verdict serial/nightly/shard ghi thành văn, đánh dấu PROVISIONAL kèm điều
      kiện chốt cứng — và kèm lý do vì sao điều kiện đó hiện không đạt được (V4)

## Câu hỏi chưa giải quyết

- Hệ số runner CI thật (2–4× là giả định) — chỉ đo được khi Actions minutes được
  khôi phục.
- Số spec chính xác sau triage — Phase 2 đang chạy; dự phóng dùng tạm ~40.
