---
phase: 3
title: "Flow-Audit-Business"
status: completed
priority: P1
dependencies: [2]
---

# Phase 3: Audit luồng nghiệp vụ (trước UAT)

## Overview
Kiểm chứng ngược hệ thống đang chạy so với thiết kế: trace 28 WF TL25 ↔ code, hồ sơ 9 role ↔ nghiệp vụ,
bản đồ chuỗi liên vai, đối chiếu mâu thuẫn tài liệu. Output = báo cáo findings + kịch bản UAT chuỗi
liên vai thay Section 2 rời rạc. Chèn theo brainstorm 260708-0906 (user chốt phương án A: audit trước
UAT, GO lùi ~1 ngày). TL25 tuyên bố "không mồ côi" nhưng cột Test ghi "file sẽ viết" — tuyên bố trên
giấy, phase này kiểm chứng bằng code thật.

## Requirements
- Functional: 28/28 WF có verdict (đủ/mồ-côi-ô-nào, kèm file:line); 9/9 role có hồ sơ quyền-vs-nghiệp-vụ;
  ≥5 chuỗi liên vai kiểm chứng từng khớp nối; danh sách mâu thuẫn tài liệu + nguồn-sự-thật đề xuất.
- Non-functional: mỗi finding PHẢI kèm bằng chứng file:line (chống false-positive từ agent trace);
  audit read-only — KHÔNG sửa code trong phase này; fix đi PR riêng theo protocol fix-forward.

## Architecture
Nguồn đối chiếu 4 chiều:
1. **Thiết kế**: `docs/25-ma-tran-truy-vet-p1.md` (28 WF P1–P4) · `docs/14` (catalog 9 role §1, ma trận quyền §5) · ADR-B (`docs/16`, cổng tiền/SoD).
2. **Code quyền**: `packages/auth/src/index.ts` — `ROLES` (:10-20) + `PERMISSIONS` registry (:41-174) + `can()` (:180-192); wiring `requirePermission('module','action')` tại `apps/api/src/trpc.ts:129` — **2 tham số tách rời, KHÔNG phải key chấm** (grep `finance.receiptApprove` match 0 call-site; phải split-dot khi trace).
3. **Code API/UI**: routers glob `apps/api/src/**/*router*.ts` = **31 file** (26 file `router.ts` + 5 file hyphen: `class/schedule-router.ts`, `class/class-session-router.ts`, `class/class-batch-router.ts`, `rewards/gift-router.ts`, `rewards/reward-router.ts` — 5 file này mang gate cho WF P2-01/P4-01/P4-02, KHÔNG được bỏ sót); root `apps/api/src/router.ts`; UI staff `apps/admin/src/pages/<area>` + `apps/admin/src/routes`; LMS `apps/lms`.
4. **Kiểm chứng**: unit/integration test colocated `*.test.ts` · e2e `apps/e2e/tests/*.spec.ts` · `docs/uat-checklist-go-live.md`.

## Leads đã verify trong brainstorm 2026-07-08 (bake sẵn — audit khỏi khám phá lại)
- **L1 — TL25 P1-03 lệch code — ĐÃ PRE-RESOLVED (validate user 2026-07-08)**: code `finance.receiptApprove
  = [giam_doc_kinh_doanh, giam_doc_dao_tao, ke_toan]` (`index.ts:50`, comment ADR-B chỉ loại `sale`)
  là **nguồn sự thật đúng**; UAT checklist §2.4 khớp; TL25 ghi GĐKD-only là doc lỗi thời. Audit KHÔNG
  cần escalate mục này — chỉ còn việc: sửa TL25 P1-03 (PR doc, MEDIUM) + xác nhận không chỗ nào khác
  trong docs lặp claim GĐKD-only.
- **L2 — cskh/ctv_mkt/hr KHÔNG mồ côi quyền nhưng nghi mồ côi UI/test/UAT**: registry có cấp quyền
  (cskh: crm.opportunityList, guardian.approveLink/listPendingLinks, parentAccount.updateEmail, punch;
  ctv_mkt: chỉ opportunityList + punch — gần-mồ-côi; hr: punch, shift.submit, kpi.submit, gift.list,
  rewards.manage, parentMeeting.manage, testAppointment.manage). Nhưng: không WF nào trong TL25 nêu tên
  3 role này; UAT checklist §2 không có mục cho họ. → audit trả lời: UI nav cho 3 role này hiển thị gì,
  test nào phủ, có cần thêm mục UAT không.
- **L3 — cột Test TL25 aspirational**: chỉ ~6/28 spec file tồn tại (red-team verify 2026-07-08). Verdict
  bước 2 = **tồn-tại/vắng** per WF; KHÔNG hứa "pass" cho file chưa viết. Test đang có chạy qua gates
  thường (`pnpm test`); e2e critical chạy ở Phase 4 — không chạy Playwright riêng trong phase này.
- **L4 — mutation gate ngoài registry là có thật**: `shift.cancel` (`apps/api/src/shift/router.ts:267`)
  dùng check inline owner-or-director, KHÔNG qua `requirePermission` — phương pháp trace xuôi từ
  PERMISSIONS key sẽ mù với dạng này (lý do bước 1 phải đảo chiều liệt kê).
- **L5 — cột "API (quyền)" TL25 đã drift khỏi code, không grep cơ học 1:1 được**: TL25 `checkInOut.punch`
  vs code `checkIn.punch` (`index.ts:128`); TL25 `shift.register` vs code `shift.submit` (`index.ts:137`);
  TL25 `gift.archive` không tồn tại; TL25 `exercise.create/publish (assessment.*)` vs code
  `exercise.manage` (`index.ts:99`). → bước 2 cần bảng alias/chuẩn hoá; bản thân drift = finding MEDIUM
  (sửa TL25), không phải blocker.

## Related Code Files
- Đọc (read-only): toàn bộ mục Architecture ở trên.
- Create: `plans/reports/flow-audit-{timestamp}-erp-role-wf-trace-report.md` (findings, severity-ranked).
- Modify: `docs/uat-checklist-go-live.md` — thay/bổ sung Section 2 bằng kịch bản chuỗi liên vai.
- Modify (nếu L1 kết luận TL25 sai): `docs/25-ma-tran-truy-vet-p1.md` — PR sửa doc riêng.

## Implementation Steps
1. **Trace tự động quyền ↔ router — ĐẢO CHIỀU** (red-team 2026-07-08: trace xuôi từ key mù với gate
   inline như L4): liệt kê **mọi** `.mutation(`/`.query(` trong `apps/api/src/**/*router*.ts` (31 file),
   phân loại base procedure của từng cái: (a) `requirePermission`-gated — match key bằng transform
   split-dot `requirePermission('module','action')`; (b) `lmsProcedure`/`publicProcedure`/internal
   provisioning — **chủ đích không gate staff** (TL25 P1-04/P1-06/P2-03/P2-05), KHÔNG flag CRITICAL;
   (c) bare `protectedProcedure` với check inline (kiểu `shift.cancel`) — liệt kê + đánh giá check đủ
   chưa; (d) bare `protectedProcedure` KHÔNG check gì — flag CRITICAL. Chiều ngược: key trong
   `PERMISSIONS` không call-site nào = quyền mồ côi.
2. **Trace 28 WF TL25** (agent-assisted, mỗi WF 1 hàng): bước 2a — dựng **bảng alias/chuẩn hoá** cột
   "API (quyền)" TL25 → key registry thật (leads L5 làm sẵn 4 dòng đầu); bước 2b — per WF: API procedure
   tồn tại? · permission (sau chuẩn hoá) khớp? · UI route cột "UI/URL" tồn tại trong
   `apps/admin/src/pages` / LMS? · test spec cột "Test" **tồn tại hay vắng** (theo L3 — không hứa pass)?
   Verdict per-WF kèm file:line; drift tên key ghi finding MEDIUM sửa TL25.
3. **Hồ sơ 9 role**: per role — quyền được cấp (từ registry) · WF tham gia (từ bước 2) · UI nav
   thấy được (role-gating trong `apps/admin/src/shell`/routes) · mục UAT phủ. Dứt điểm L2.
4. **Bản đồ chuỗi liên vai** (≥5 chuỗi, kiểm từng khớp nối dữ-liệu + quyền + test):
   - Ghi danh: sale tạo opp → phiếu thu → duyệt (ai?) → provisioning tài khoản → enrollment active → PH login OTP (P1-01→02→03→04→05→07).
   - Học tập: GĐĐT phát bài → HS nộp → GV chấm+sao → AI draft → GV chốt → PH xem (P2-04→05→06→07→08).
   - Vận hành lớp: GĐĐT tạo lớp sinh buổi → GV điểm danh → evidence cho PH (P2-01→02→08).
   - Nhân sự: punch → manual ticket → duyệt → chốt lương → KPI (P3-01→02→05→06).
   - Sau bán: đổi sao (HS→duyệt→giao) · họp PH · after-sale case → lifecycle (P4-01→03→05).
5. **Đối chiếu mâu thuẫn tài liệu**: quét chéo TL25 ↔ registry ↔ UAT checklist ↔ docs/14 §5 ↔ ADR-B.
   Mỗi mâu thuẫn: nguồn A nói gì / nguồn B nói gì / code làm gì / nguồn sự thật đề xuất. L1 đã
   pre-resolved (code đúng) — thực thi sửa TL25 P1-03 trong PR doc của phase này.
6. **Báo cáo findings** severity-ranked (CRITICAL = tiền/auth/dữ-liệu-trẻ sai gate; HIGH = WF đứt gãy
   chuỗi hoặc mồ côi test; MEDIUM = lệch tài liệu). CRITICAL dạng code-fix → fix-forward PR riêng TRƯỚC
   UAT (cap 2 vòng theo protocol); HIGH/MEDIUM không chạm tiền/auth → ghi nợ ledger sang M2.
   **CRITICAL cần quyết định SẢN PHẨM (không phải code fix — vd. roster duyệt phiếu L1) = stop-condition:
   escalate user, KHÔNG tự quyết.** Nếu stall chờ quyết định/merge >1 ngày làm việc → **park stack**:
   `docker compose -p cmcv2-prod stop` (giữ volume; tránh stack `restart: unless-stopped` chiếm 80/443
   + seed Entra thật nằm chạy trên máy dev suốt thời gian treo); `start` lại khi tiếp tục.
7. **Sinh kịch bản UAT chuỗi liên vai**: viết lại Section 2 `docs/uat-checklist-go-live.md` theo 5 chuỗi
   bước 4 (mỗi chuỗi = 1 kịch bản xuyên vai có thứ tự + expected state sau mỗi bước), kèm khuyến nghị
   số người tối thiểu (input cho quyết định 7-vs-rút-gọn của user ở Phase 4). **Ràng buộc coverage
   (red-team F-S4): mọi role đang giữ ≥1 mutation permission phải xuất hiện trong ≥1 kịch bản** — gồm
   cskh (`guardian.approveLink` index.ts:58, `parentAccount.updateEmail` :106) và hr; kèm **ma trận
   role×permission** phụ lục để chứng minh không role nào rơi khỏi checklist. **Kỷ luật sửa file
   (red-team F-FM3/FM4): chỉ Phase 3 được sửa Section 2**; cùng PR đó phải đối soát lại gate G2
   (Section 4, "all roles in Section 2 signed off") + các pointer "see Section 2" ở Section 1
   (`uat-checklist:59-60`) cho khớp bản mới; land PR này TRƯỚC khi Phase 4 bắt đầu tick bất kỳ ô nào
   (tránh merge-conflict nuốt tick = GO giả).
8. **Bàn giao redeploy (red-team F-FM1 — CRITICAL)**: nếu ≥1 fix-forward PR land lên main SAU khi
   Phase 2 build images → ghi rõ trong báo cáo "REDEPLOY REQUIRED"; Phase 4 bước 0 bắt buộc rebuild
   images + `up -d` + SSO smoke lại trước Run 1. Không có mục này = UAT ký GO trên binary cũ thiếu fix.

## Success Criteria
- [x] Bảng liệt kê ĐẢO CHIỀU đủ mọi `.mutation/.query` của 31 file `*router*.ts`, phân loại (a)-(d);
      0 bare-protectedProcedure-không-check chưa giải thích; 0 key registry mồ côi chưa giải thích.
- [x] 28/28 WF có verdict kèm file:line (22 FULL · 6 PARTIAL UI gap; permission qua bảng chuẩn hoá; test = tồn-tại/vắng).
- [x] 9/9 role có hồ sơ; L2 kết luận (cskh/ctv_mkt/hr → HIGH-1/2/3 UAT gap); L1 pre-resolved → TL25 P1-03 sửa (commit 8a68ae1).
- [x] 5/5 chuỗi liên vai kiểm chứng khớp nối; 0 đứt gãy phát hiện.
- [x] Báo cáo findings: `plans/reports/flow-audit-260708-1338-erp-role-wf-trace-report.md`; 0 CRITICAL code-fix mở; 3 HIGH UAT-gap đã document.
- [x] Section 2 UAT checklist viết lại (commit 8a68ae1): 5 chuỗi kịch bản, G2 updated "10 roles", Phụ lục 2A ma trận; nhân sự tối thiểu 3 người ghi rõ.
- [x] Verdict: **REDEPLOY NOT REQUIRED** (ghi trong báo cáo + Phase 4 bước 0 confirmed).

## Risk Assessment
- Agent trace false-positive/negative → mọi finding bắt buộc file:line; bước 1 dùng liệt-kê-đảo-chiều cơ học làm xương sống, agent chỉ tổng hợp; phân loại (b) chống false-CRITICAL trên lmsProcedure/public/internal.
- Audit lộ nhiều CRITICAL → GO lùi hơn 1 ngày; cap fix-forward 2 vòng, vòng 3 = stop-condition (kế thừa protocol plan). **Lưu ý honest (red-team F-A7): exit "0 CRITICAL mở" phụ thuộc user review/merge PR — "~1 buổi" là effort audit, KHÔNG phải cam kết lịch tường-tận-GO; stall >1 ngày → park stack (bước 6).**
- Scope-creep sang "sửa hết mọi lệch tài liệu" → chỉ CRITICAL chặn GO; MEDIUM ghi nợ M2 (ledger trong báo cáo).
- Phase read-only với code; chỉ 2 file doc được modify (uat-checklist Section 2 + TL25 nếu L1/L5 kết luận sửa doc) — mỗi cái 1 PR riêng.
