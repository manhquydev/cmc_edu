---
phase: 4
title: "UAT-GoNoGo"
status: in-progress
priority: P1
dependencies: [2, 3]
---

# Phase 4: UAT-GoNoGo

## Overview
Cổng cuối trước vận hành pilot (task #9): e2e critical 2 lần xanh liên tiếp trên prod-config,
email live send, UAT người thật theo kịch bản chuỗi liên vai từ Phase 3 (audit) trong
`docs/uat-checklist-go-live.md`, biên bản go/no-go. Phủ CẢ staff ERP (Entra thật) lẫn LMS.
Cập nhật brainstorm 260708-0906 + red-team 2026-07-08: mailbox Graph licensed ĐÃ SẴN SÀNG (user xác
nhận). Gate G7 chuyển thành **G7-nhẹ** (user chốt sau red-team F-S5): người thứ hai (~15 phút, theo
checklist có sẵn, không cần deploy) chạy lại `env-check.sh` + xem boot-checks API + grep xác nhận
`ALLOW_DEV_AUTH`/`TEST_OTP_SEAM` vắng trong `.env.prod` → ký xác nhận. Full-redeploy G7 gốc dời M1
(deploy VPS thật = clean-room run tự nhiên) — biên bản ghi "G7-light PASS; full G7 deferred to M1".

## Requirements
- Functional: mọi mục Section 1 (e2e critical) + Section 2 (UAT người thật) PASS; staff login Entra thật + role gating nav; email Brevo (PH) + Graph (nội bộ) mỗi loại ≥1 gửi thật; AI draft LLM thật; PII-guard reject verify.
- Non-functional: env-guard TRƯỚC mỗi lần chạy e2e; flake rerun 1 lần, tái diễn → sửa isolation, không nới test.
- **Prerequisite từ Phase 1**: e2e staff specs đã refactor mode-switching (nếu chưa → gate này bất khả thi); **[RESOLVED 2026-07-09, commit `8a0f8f2`]** `lms-auth-two-tier.test.ts` (13 stub rỗng, 0 assertion) đã XÓA thay vì un-skip — coverage đối kháng tương đương chạy thật ở e2e (`kind-isolation.spec.ts` + `lms-auth.spec.ts`, xanh dưới Mode-B). Xem `docs/uat-checklist-go-live.md:59-60`.

## Architecture
Auth prod-config (dev-header TẮT): LMS = Mode-B bearer (`createSignedLmsClient`+`mintParentToken`);
staff = Mode-B cookie (`createSignedStaffClient`+`mintStaffCookie`, RT-β). Login Entra THẬT verify tay.
**Lưu ý phạm vi e2e**: `global-setup.ts:68-73` spawn tsx API server RIÊNG (không phải docker stack) →
e2e xanh KHÔNG validate images/nginx/boot-checks của cmcv2-prod. Thêm smoke tầng HTTP hit trực tiếp
stack docker (health + `/auth/login` 302 — đã làm ở Phase 2 bước 6) để phủ khoảng trống này.
`docs/uat-checklist-go-live.md` = bản ghi chính thức.

## Related Code Files
- Modify: `docs/uat-checklist-go-live.md` (Run 1/Run 2, Section 2, biên bản go/no-go).
- Sửa code chỉ khi UAT lộ bug → fix-forward: mỗi fix 1 branch/PR/gates, retest mục liên quan.

## Implementation Steps
0. **Redeploy nếu cần (red-team F-FM1 — CRITICAL, bắt buộc trước mọi bước khác)**: đọc verdict
   REDEPLOY REQUIRED/NOT trong báo cáo Phase 3. Nếu REQUIRED (≥1 fix-forward PR land sau lần build
   image Phase 2): rebuild images từ main mới nhất + `docker compose -p cmcv2-prod up -d` + chạy lại
   SSO smoke (Phase 2 bước 6) + boot-checks. Lý do: e2e spawn server tsx riêng từ code mới
   (`global-setup.ts` spawn ngoài docker) nên e2e xanh KHÔNG chứng minh stack docker có fix — UAT
   người thật + biên bản GO phải chạy trên binary chứa fix.
1. Pre-check: Prerequisites + G1–G10 tick từ Phase 2 (G7 = G7-nhẹ, xem Overview — người thứ hai chạy
   env-check + boot-checks + grep dev-seam, ký tên; không chặn bởi full-redeploy);
   Phase 3 audit đóng (0 CRITICAL code-fix mở, CRITICAL sản-phẩm đã có quyết định user, PR Section 2
   checklist đã merge TRƯỚC khi tick bất kỳ ô nào — tránh merge nuốt tick);
   e2e specs mode-switching xong; lms-auth suite un-skip xanh.
1b. **Chốt nhân sự UAT** (user quyết, dựa khuyến nghị số người tối thiểu từ Phase 3 bước 7):
   đủ 7 tester đúng chức danh HOẶC rút gọn 2–3 người đóng nhiều vai staff + 1 PH/HS thật.
   Stop-condition nếu chưa sắp được lịch (e2e + email live vẫn chạy trước, bước 2–5).
2. **Env-guard + secret hygiene**: echo xác nhận cả 2 DATABASE_URL trỏ DB staging (KHÔNG dữ liệu thật); NODE_ENV=production. E2E ký bằng `STAFF_SESSION_SECRET`/`LMS_SESSION_SECRET` **throwaway ≠ secret pilot stack** (`mintStaffCookie` là forge super_admin không re-check DB — leak = giả mạo trong TTL cookie, mint mặc định 1h, session thật maxAge ~8h; không revocation RT-ε). Nếu buộc dùng secret trùng stack → rotate secret pilot sau khi chạy xong. Assert e2e-secret ≠ pilot-secret trong env-guard.
3. E2E critical Run 1 (`pnpm --filter @cmc/e2e test`) → ghi checklist; Run 2 liên tiếp → ghi. 2/2 PASS bắt buộc.
4. **Cap tổng (chống loop vô hạn)**: fail → fix-forward → reset đếm, NHƯNG tối đa 4 cặp-Run HOẶC 1 ngày làm việc. Vượt → bắt buộc ghi NO-GO (chuỗi flake mới liên tục = tín hiệu isolation hỏng, không phải sắp xanh).
5. Email live: 1 Brevo (inbox test PH) + 1 Graph (hộp nội bộ — mailbox licensed đã sẵn sàng, user xác nhận 2026-07-08); xác nhận nhận, không lộ payload log.
6. UAT người thật theo docs/29 + Section 2 **bản chuỗi liên vai từ Phase 3**: mỗi chuỗi chạy xuyên vai
   theo thứ tự (vd. sale tạo opp→phiếu → duyệt → provisioning → PH OTP xem con), verify expected state
   sau từng bước; vẫn phủ: staff Entra login + nav theo role, receipt→approve over-threshold,
   attendance+lifecycle, exercise PDF+grade+sao, check-in IP (trusted-proxy), AI draft→sửa→confirm,
   PII reject, LMS parent OTP + student password.
7. Tổng hợp findings: bug → fix-forward + retest; mục fail sau 2 vòng → NO-GO kèm lý do.
8. Quyết định GO/NO-GO:
   - **GO** → ký biên bản; TaskUpdate #9 → completed; changelog; chốt scope pilot 1 cơ sở + kích hoạt hướng C (P4 thiếu + P5 agent + chuyển VPS thật).
   - **NO-GO/teardown** → `docker compose -p cmcv2-prod down` (giữ volume chờ post-mortem, hoặc `down -v` nếu user xác nhận); note xử lý/rotate secret `.env.prod`; dọn vị trí backup dump **local VÀ remote (red-team F-S7): xoá/di dời dump PII trên bucket R2 + revoke R2 API token** — bỏ quên = dump trẻ em + tiền nằm vĩnh viễn trên cloud dưới token có thể rò; ghi lý do NO-GO. Stack `restart: unless-stopped` (compose:29,51,...) sẽ tự bật lại qua reboot + giữ 80/443 nếu KHÔNG teardown → bắt buộc bước này.

## Tiến độ thực thi (2026-07-09 — phần TỰ ĐỘNG)

Cook chạy phần tự động hoá được; phần UAT người thật + GO/NO-GO vẫn chờ user.

**Đã làm + xanh:**
- **Bước 0 F-FM1 — REDEPLOY DONE 2026-07-11** từ main `5c2cd2e`: rebuild 4 images (Astryx UI #28/#29
  + P4 hardening #31 + reconcile #32), áp 2 migration pending (`emailoutbox_index`,
  `reconcile_schema_drift`) qua socat sidecar, `up -d`. Verify: boot-checks không FATAL · env-check
  OK prod (22 vars) · dev-seams vắng · health 200 · SSO smoke 302 → microsoftonline · SPA 200.
  UAT người thật giờ chạy trên binary chứa đủ fix. (Lưu ý: PR #30 premium-design-language còn mở —
  nếu quyết UAT phủ layer đó thì land #30 rồi redeploy nhanh lại bằng build cache.)
- **G1 — e2e critical 2/2 xanh liên tiếp** dưới Mode-B (`NODE_ENV=production`): Run 1+2 mỗi lần
  17 passed / 1 skipped (skip = `TEST_OTP_SEAM`, đúng — seam tắt ở prod). DB throwaway `cmc_staging`
  (drop sau khi xong) tách hẳn `cmc_prod`; secret throwaway ≠ pilot; env-guard assert cả 2 trước khi chạy.
- **G5/G6/G8/G9/G10** tick trong checklist (restore drill, isolation, ALLOW_DEV_AUTH/TEST_OTP_SEAM vắng,
  2 session secret distinct).
- **Bug Mode-B thật (sửa fix-forward, commit `a554b97`):** 2 spec LMS (`kind-isolation`,
  `attendance-grading`) dùng helper dev-header cục bộ → dưới prod-config token UNAUTHORIZED trước
  kind-gate (4 test đỏ). Gom về factory mode-aware chung. Prerequisite Phase 1 C2 sót 2 helper này.

**PHÁT HIỆN chặn — prerequisite lms-auth KHÔNG như plan giả định:**
`apps/api/src/lms-auth/lms-auth-two-tier.test.ts` (13 test) **là STUB rỗng** — mỗi `it()` chỉ có
comment, 0 assertion, `describe.skip`. Plan ghi "un-skip xanh trước Run 1" giả định đây là test thật
bị gác vì thiếu DB; thực tế un-skip = **fake green** (test rỗng pass vô nghĩa) — còn tệ hơn skip vì
che gap. KHÔNG fake-green. Kiểm chứng: các kịch bản đối kháng của file này (kind gate, sibling scope,
lockout, no-leak, resetChildPassword scoping, OTP no-leak) **đã được phủ thật** ở tầng e2e
(`kind-isolation.spec.ts` + `lms-auth.spec.ts`, chạy xanh Mode-B lần này). → Khuyến nghị user quyết:
**(a)** xoá file stub (coverage đã ở e2e — giảm nhiễu), hoặc **(b)** implement 13 test vitest thật
(sub-project riêng, cần DB fixtures) nếu muốn coverage tầng unit. Không tự quyết — đây là user decision.

**CHỜ user (không tự động được):**
- Bước 1b: nhân sự UAT · Bước 5: email live (inbox thật xác nhận) · Bước 6: UAT người thật (Entra
  login thật + 5 kịch bản chuỗi) · Bước 8: ký biên bản GO/NO-GO.
- Escrow `BACKUP_ENCRYPTION_PASSPHRASE` + Azure MFA hardening (kế thừa Phase 2).

## Addendum 2026-07-10 (verify session 260710-0215 — sau khi gap-closure 260710-0005 land)

- **Blocker mới bước 5 (email live):** `BREVO_API_KEY` trong `.env.prod` local-sim trả **401 Key not
  found** (live-verify 2026-07-10) — chưa từng có email Brevo thật gửi thành công end-to-end. User
  phải rotate/verify key TRƯỚC bước 5; pipeline code (enqueue→worker→transport) đã verify đúng.
- **Gate tự động bổ sung TRƯỚC Run UAT:** rerun e2e Mode-B (`pnpm --filter @cmc/e2e test`,
  NODE_ENV=production, throwaway `cmc_staging`) trên main SAU commit series gap-closure
  `640bd45..ad61163` — lần xanh 2026-07-09 là trước khối code này. KB1 bước 7 (OTP email thật) giờ
  khả thi; KB1 bước 8 đã amend (ad61163).
- **ctv_mkt: RESOLVED — giữ dormant** (PO 2026-07-10, role-reality: role mới chỉ khi doanh thu thật +
  người thật). Bỏ item "ctv_mkt decision pending" khỏi điều kiện GO/NO-GO.
- Unit gate hiện trạng: 524/525 (1 fail pre-existing `finance/receipt-get.test.ts` fixture RLS —
  không thuộc scope UAT, fix ở plan M1 hardening). Typecheck 26/26, build 14/14 xanh 2026-07-10.

## Success Criteria
- [x] e2e critical 2 lần liên tiếp PASS (Run 1+2 có ngày+kết quả); lms-auth suite un-skip xanh trước Run 1. (Mode-B 2026-07-11 Run 1+2 xanh — ticked 2026-07-12; needs one more post-redeploy re-run after Brevo rotation)
- [ ] Email Brevo + Graph mỗi loại ≥1 gửi thật thành công.
- [ ] Mọi flow UAT người thật PASS (gồm staff Entra login thật + role nav).
- [x] E2E dùng throwaway secret (hoặc rotate sau); env-guard assert e2e-secret ≠ pilot-secret. (env-guard implemented — ticked 2026-07-12)
- [ ] Biên bản go/no-go ký; NẾU NO-GO: teardown + secret disposal thực hiện. Tracker #9 + changelog cập nhật.

## Risk Assessment
- Nguy cơ lớn nhất: e2e nhầm DB dữ liệu thật → env-guard bước 2 bắt buộc, dừng nếu nghi ngờ.
- Prod signing secret sprawl vào e2e runner → dùng throwaway hoặc rotate; leak = forge super_admin 8h.
- UAT người thật cần lịch + nhân sự user — stop-condition nếu chưa sắp (e2e + email live vẫn chạy trước).
- Fix trong UAT dễ scope-creep → mỗi fix 1 PR nhỏ; cap 2 vòng/finding + cap tổng 4 cặp-Run.
- NO-GO không teardown → stack squat 80/443 + Entra seed lưu vĩnh viễn trên máy dev.
