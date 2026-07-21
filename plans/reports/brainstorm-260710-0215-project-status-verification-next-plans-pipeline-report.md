# Trạng thái dự án (verified) + Pipeline kế hoạch triển khai tiếp theo

**Date:** 2026-07-10 · **Session:** brainstorm 260710-0143/0155/0215 · **Method:** verify trực tiếp
code/gates/container, không tin docs/plan-frontmatter. **Modes:** không --html/--wiki.

---

## 1. Trạng thái verify — plan gap-closure `260710-0005`

**Kết luận: CODE CẢ 4 PHASE ĐÃ XONG, chưa land.** Plan frontmatter vẫn `pending` (tracking lệch);
thực tế ~685 insertions/17 file sửa + ~10 file mới, uncommitted trên `main`.

| Gate | Kết quả | Ghi chú |
|---|---|---|
| Typecheck | ✅ 26/26 | chạy 2026-07-10 session này |
| Build | ✅ 14/14 | full turbo (cached — code đã build trước đó) |
| Unit/integration | ⚠️ 524/525 | 1 fail `finance/receipt-get.test.ts` — **pre-existing trên main, KHÔNG phải regression** (file + helper không nằm trong diff; fixture insert naked `db.receipt.create` không qua `withFacility` → RLS 42501; fix ~2 dòng) |
| Code review Phase 1 (auth) | ✅ DONE_WITH_CONCERNS | C1/C2/M1 đều MET, không blocker bảo mật. 1 **High perf**: `sweepStaleOtpPayloads` không loại row đã scrub → re-UPDATE toàn bộ lịch sử OTP mỗi chu kỳ relay (phình vô hạn; fix: thêm `NOT payload.scrubbed=true`). 1 Medium: cap-count query seq-scan EmailOutbox (chưa index) → gom vào follow-up retention/index. 3 info (cap=DoS lever pilot-accepted; TOCTOU nhẹ; timing side-channel accepted) |
| E2e Mode-B | ⏸️ CHƯA chạy lại sau gap-code | lần xanh gần nhất 2026-07-09 (17 pass/1 skip ×2 run) là TRƯỚC khi có code mới. Cần Mode-B env (throwaway `cmc_staging` + secrets). **Bắt buộc chạy lại khi land** |

**Sự cố vận hành phát hiện trong session:** container `cmc-pg` (dev postgres `cmc_edu` cho unit
test) Exited 31h (reboot máy) → suite treo/fail 286 test toàn artifact DB-down. Đã `docker start
cmc-pg`, rerun → 524/525. Bài học: check `cmc-pg` up trước khi chạy test.

### Blocker credential (ngoài code, chặn acceptance + UAT)
`BREVO_API_KEY` trong `.env.prod` local-sim trả **401 Key not found** (memory ops-quirks 2026-07-10).
Code pipeline OTP verify đúng nhưng **chưa có email Brevo thật nào gửi thành công end-to-end**.
Acceptance "PH nhận OTP inbox thật" + UAT bước 5 "email live" chặn bởi credential → cần rotate/verify
key trước UAT người thật.

## 2. Trạng thái plan go-live `260707-2308` (M0)

Phase 1–3 ✅ Completed. Phase 4 UAT: phần tự động ✅ (e2e 2/2 run xanh, G1/G5/G6/G8/G9/G10 tick;
G7=G7-light, full G7 dời M1). Blocker "lms-auth two-tier stub" đã xử lý (xoá, `8a0f8f2`). Còn lại
**toàn việc người thật**: nhân sự UAT · email live inbox thật (chặn bởi BREVO key) · UAT 5 chuỗi kịch
bản · ký biên bản GO/NO-GO (12/07) · escrow `BACKUP_ENCRYPTION_PASSPHRASE` · Azure MFA hardening.

## 3. Nguyên tắc lọc phạm vi (PO tái khẳng định 2026-07-10)

ERP = cổng nội bộ cho đúng **5 role thật**: sale, giáo viên, GĐ đào tạo, GĐ kinh doanh, IT/super_admin.
LMS = PH + HS. **Không mở rộng role kiểu sách-giáo-khoa** (ctv_mkt/kế toán/CSKH/HR giữ dormant);
role mới chỉ khi mô hình kinh doanh kiếm ra tiền thật + có người thật đảm nhiệm (reactivation path
ADR-D). → Item roadmap "ctv_mkt decision pending before GO/NO-GO" = **resolved: dormant**. Mọi plan
trong pipeline dưới đây không được chứa việc mở role.

## 4. PIPELINE KẾ HOẠCH TRIỂN KHAI (deliverable chính)

Nguyên tắc kế thừa roadmap: quality-gated không date-gated · just-in-time planning · bất biến RLS/
5-role/zod/no-secrets xuyên suốt.

### P-0 — Land gap-closure — ✅ ĐÃ LAND (update 02:30, session song song)
- Commit series trên main: `640bd45` (OTP) → `21b73c6` (visibility) → `326dfcc` (tests) →
  `ad61163` (docs); plan `260710-0005` + 4 phase = completed.
- **Còn mở sau land (chuyển P-1/P-2):** (a) e2e Mode-B chưa rerun sau code mới → điều kiện tiên quyết
  UAT, vào P-1; (b) sweep High + receipt-get fixture chưa fix → vào P-2 hardening (sweep nên fix
  trước khi pilot chạy dài ngày).

### P-1 — Đóng M0: UAT người thật + GO/NO-GO (trước/đúng 12/07, thực thi phase-04 sẵn có)
- Scope (toàn việc điều phối, không code): rotate/verify BREVO_API_KEY + 1 email live thật ·
  chốt nhân sự UAT · chạy UAT 5 chuỗi kịch bản (KB1 đã amend nhờ P-0) · escrow passphrase ·
  Azure MFA hardening · ký biên bản GO/NO-GO.
- Exit: biên bản GO ký (hoặc NO-GO + teardown protocol phase-04 bước 8).
- Phụ thuộc: P-0 land trước (KB1 bước 7 cần OTP email thật).

### P-2 — Plan M1 — ✅ ĐÃ TẠO + RED-TEAM + VALIDATE (update 03:15)
- `plans/260710-0228-m1-pilot-stability-real-vps/` — 6 phases, blockedBy M0 GO.
- Pipeline đủ: plan → red-team 2 reviewer (15 findings: 3C/5H/5M/2L, tất cả ACCEPT + baked, gồm 3
  Critical cutover: role cmc_app từ migration, restore-vào-DB-trống, không rotate passphrase trước
  cutover) → validate 4 quyết định user (VPS = decision-gate P1 · domain = giữ domain Azure đã đăng ký ·
  rubric CRITICAL X=30' · retention 30d). Mâu thuẫn mở: 0. Thực thi khi M0 GO ký.

### P-3 — Plan mới `M2: P4 completion` (tạo khi M1 gần exit)
- Scope: lịch test WF-P4-04 · after-sale case WF-P4-05 · họp PH audit đầy-cuối · đóng ô trống TL25
  cụm P4. Đây là phần nghiệp vụ CHƯA XÂY duy nhất còn lại trong vision — của người thật đang vận hành,
  hợp role-reality.
- Exit: acceptance TL28 pass, trace matrix P4 không ô trống, gates xanh.

### P-4 — Plan mới `M3: AI crawl→walk` (tạo khi M2 gần exit)
- Scope: recon agent HOTL data pilot thật · teacher-assist draft→GV chốt · eval TL29 §5 · PII-guard.
  Agent ≠ role mới — chạy dưới người thật, không quyền tiền. Ngoại lệ roadmap: hạng mục draft-only
  được thí điểm sớm nếu M2 kéo dài.
- Exit: eval đạt ngưỡng, override-rate đo được, agent qua MCP chịu gate/RLS/audit.

### P-5 — Plan mới `M4: multi-facility` (tạo khi M3 gần exit)
- Scope: onboard các cơ sở CMC còn lại (seed + runbook per-facility). Mở rộng theo CƠ SỞ, không theo
  ROLE — vẫn 5 role/cơ sở; nếu doanh thu đòi role mới → ADR mới + người thật (ngoài pipeline này).
- Exit: tất cả cơ sở live, cross-facility isolation audit pass trên vận hành thật.

**Trả lời "nghiệp vụ xây xong chưa":** trong phạm vi go-live M0 — xong (kể cả 2 gap LMS, sau P-0
land). Chưa xây: cụm M2 (3 workflow P4) + AI M3 — đúng thiết kế just-in-time, không phải nợ.

## 5. Việc nhỏ đã gom chỗ (không tạo plan riêng)
- Fix sweep High + receipt-get fixture → P-0. Outbox index/retention → P-2.
- Test-hang observability: rule vận hành "check `cmc-pg` up trước test" → đã ghi memory quirks đủ.

## Unresolved questions
1. BREVO_API_KEY: rotate ở đâu/ai giữ account Brevo? (ngoài repo, chặn P-1 bước email-live)
2. Lịch + nhân sự UAT người thật cho 12/07 đã chốt chưa? (chặn P-1)
3. VPS provider/ngân sách cho M1 (cần trước khi tạo plan P-2)
