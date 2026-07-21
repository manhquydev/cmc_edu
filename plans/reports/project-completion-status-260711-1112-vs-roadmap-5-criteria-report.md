# Tình trạng hoàn thiện CMC EDU v2 — đối chiếu roadmap — 2026-07-11

Nguồn: `docs/project-roadmap.md` (5 tiêu chí Done + bảng M0-M4), `docs/uat-checklist-go-live.md` (Go/No-Go),
`plans/*/plan.md` (checkbox progress), git log, build/deploy verify trực tiếp hôm nay (session này).

## Tóm tắt 1 dòng

**Dự án đang ở M0 (go-live sprint), chưa qua cổng Go/No-Go. 0/5 tiêu chí "Kết quả Cuối cùng" đạt trọn vẹn — tiêu chí #3 (hạ tầng production thật) chưa bắt đầu, còn tự nhận self-host local trên máy dev, chưa có VPS thật.**

## 1. Đối chiếu 5 tiêu chí "Định nghĩa Kết quả Cuối cùng" (roadmap §1)

| # | Tiêu chí | Trạng thái | Evidence |
|---|---|---|---|
| 1 | Nghiệp vụ khép kín 100% (TL25 trace matrix, P4 đóng nốt) | 🟡 Partial | P1-P3 complete (SSO, flow audit) theo `codebase-summary.md`. P4 (lịch test, after-sale, họp PH đầy-cuối) = milestone M2, **chưa tạo plan** ("tạo khi M1 gần xong"). |
| 2 | AI agent là công dân thật (MCP+RLS+audit, eval, PII-guard) | 🔴 Chưa bắt đầu | Milestone M3, roadmap ghi "Chưa". Không có plan/code recon-agent nào trong `plans/` hiện tại. |
| 3 | Hạ tầng production thật (VPS thật, hết local-sim, backup R2/S3 remote+drill) | 🔴 Chưa đạt | **Xác nhận trực tiếp từ bạn hôm nay:** "hiện chưa self host lên VPS mà sẽ self host local trên thiết bị". `docker compose -p cmcv2-prod` đang chạy trên chính máy dev này, không phải VPS. Backup R2 đã cấu hình + drill pass (2026-07-09) nhưng hạ tầng chính vẫn local-sim. |
| 4 | Multi-facility (tất cả cơ sở CMC live, RLS isolation vận hành thật) | 🔴 Chưa bắt đầu | Milestone M4, roadmap ghi "Chưa" — phụ thuộc M1→M2→M3 trước. |
| 5 | Vòng học hỏi đóng (PR+gates, không hotfix tay, postmortem thật dùng) | 🟡 Partial (thực hành, chưa có bằng chứng formal) | Git history cho thấy toàn bộ thay đổi qua PR (#24-#32) + gates — thực hành tốt. Nhưng không tìm thấy incident/postmortem template nào đã dùng thật (chỉ có journal — gần nhưng không chính thức là postmortem). |

## 2. Milestone M0-M4 (roadmap §3)

| Milestone | Roadmap ghi | Thực tế hôm nay | Plan progress |
|---|---|---|---|
| **M0** Go-live sprint | "Đang chạy — Phase 1 PR#24 CI xanh" (stale, ghi lúc 07-07) | Đã xa hơn nhiều: SSO+ENV+flow-audit+UAT-run1/2 xong. Build regression hôm nay tưởng thật hoá ra false-alarm (node_modules local) — **đã resolve, xanh 100%**. Brevo OTP đã fix + redeploy + verify container/key. | `260707-2308-golive-sprint...` **73%** (16/22) — phase-04-uat-gonogo còn 0/5 |
| **M1** Pilot ổn định + VPS thật | "Chưa" | Chưa bắt đầu phần VPS thật (xác nhận hôm nay). Chỉ có Phase 4 (hardening code, không liên quan VPS) đã xong. | `260710-0228-m1-pilot...` **16%** (13/83) — Phase 1 (decision gate + provision VPS) = 0/11, chưa chạm |
| **M2** P4 completion | "Chưa" | Chưa tạo plan | — |
| **M3** AI crawl→walk | "Chưa" | Chưa tạo plan | — |
| **M4** Multi-facility | "Chưa" | Chưa tạo plan | — |

## 3. Go/No-Go checklist (`uat-checklist-go-live.md` §4) — 7/10 tiêu chí đạt

| Đạt (7) | Còn thiếu (3) |
|---|---|
| G1 E2E 2 run PASS · G4 0 CRITICAL/HIGH code-block · G5 restore drill PASS · G6 isolation PASS · G8 `ALLOW_DEV_AUTH` absent · G9 `TEST_OTP_SEAM` absent · G10 session secrets distinct | **G2** 6 role sign-off table chưa ký · **G3** cutover probe RT-2 chưa chạy · **G7** second-person env-check chưa ký |

**Section 5 (quyết định GO/NO-GO chính thức): còn trống — chưa có meeting/quyết định nào được ghi nhận.**

## 4. Build/deploy state (verify trực tiếp session này, 2026-07-11)

- `pnpm build`/`typecheck`/`test`/`lint`: **100% xanh** (14/14, 26/26, 21/21, sạch) — sau khi phát hiện+fix node_modules local stale.
- Self-host local Docker stack (`cmcv2-prod`, chạy trên máy dev, KHÔNG phải VPS): 7 container `Up`/`healthy`, LMS+admin+api+worker+postgres+minio+nginx đều verify sống.
- Brevo OTP: root cause tìm ra (`.env.prod` line hỏng) + fix + redeploy + key mới (89 ký tự đúng) đã load vào container `worker`. Chưa test gửi OTP thật (EmailOutbox rỗng, không có request thật để quan sát).

## Câu hỏi chưa giải quyết

- G2/G3/G7 (Go/No-Go) cần người thật thực hiện (sign-off, chạy probe, second-person check) — không thể tự động hoá qua agent.
- M1 (VPS thật) chưa có ETA — roadmap §5 ghi "VPS thật (mua/thuê+DNS) — Chưa" từ 2026-07-08, chưa cập nhật.
- Brevo OTP chưa verify end-to-end bằng gửi thật — cần tài khoản test cụ thể nếu muốn xác nhận 100%.
