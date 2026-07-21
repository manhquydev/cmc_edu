---
phase: 2
title: "M2 P4 completion"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2 (M2) — P4 completion (đóng ô mồ côi TL25 cụm P4)

## Overview
Đóng nốt cụm P4 (gắn kết & sau bán) để trace matrix TL25 khép kín hoàn toàn. **Scout 2026-07-08:
backend P4 ĐÃ CÓ ĐỦ** — routers `gift`, `rewards`, `parentMeeting`, `testAppointment`, `afterSale`
đều mount trong `router.ts`. Gap thật = **UI + test coverage**, không phải build backend mới. Điều
chỉnh vs report cũ (brainstorm 260707-2308 tưởng "lịch test + after-sale chưa thấy").

## Requirements
- **Functional:** UI đầy-cuối cho 3 luồng còn thiếu màn: họp PH (WF-P4-03), lịch test (WF-P4-04),
  after-sale case (WF-P4-05). Đổi quà/gift (WF-P4-01/02) đã có UI (`engagement/rewards.tsx`,
  `engagement/gifts.tsx`) — audit đầy-cuối.
- **Non-functional:** acceptance TL28 pass mỗi WF; trace matrix TL25 cụm P4 không ô Test/UI trống; gates xanh.

## Gap đã xác định (scout 2026-07-08)
- **Backend đủ:** `apps/api/src/{appointment,after-sale,meeting,rewards}/router.ts` + `gift-router.ts`.
- **Test có:** `after-sale.test.ts`, `parent-meeting.test.ts`, `rewards/redeem-refund.test.ts`.
- **Test thiếu:** `appointment/` (testAppointment) KHÔNG có test file → bổ sung.
- **UI có:** `engagement/gifts.tsx`, `engagement/rewards.tsx`.
- **UI thiếu:** màn họp PH, lịch test (TestAppointment), after-sale case → tạo mới theo TL02/TL12 pattern.

## Implementation Steps
1. **Audit backend P4 vs TL28:** đối chiếu 5 router với acceptance WF-P4-01..05; ghi deviation nếu có
   (code-reality thắng, ghi decision note — tiền lệ blockLms).
2. **Bổ sung test testAppointment:** lifecycle (schedule → confirm → complete/cancel) + RLS negative
   (cross-facility) + gate role. Coverage tương đương after-sale.test.ts.
3. **UI họp PH (WF-P4-03):** màn schedule/complete/cancel + nhắc; gate role GĐ/sale; theo pattern
   `apps/admin/src/pages/` hiện có. `ck:scenario` liệt kê edge trước build.
4. **UI lịch test (WF-P4-04):** màn TestAppointment; gate role; deep-link URL (TL06).
5. **UI after-sale (WF-P4-05):** màn case lifecycle (create → advance → resolve → close); gate role.
6. **Trace matrix close:** append TL25 cụm P4 — mỗi WF đủ Vai trò→WF→Story→API→UI→Test→ADR, 0 ô trống.
7. **Harness mỗi màn:** cook → code-review → test → scenario → docs. Sao/tiền chạm → adversarial review.

## Success Criteria
- [ ] UI 3 luồng thiếu (họp PH, lịch test, after-sale) hoàn chỉnh, gate role đúng.
- [ ] testAppointment có test lifecycle + RLS negative; các router P4 khác coverage đủ.
- [ ] Acceptance TL28 (WF-P4-01..05) pass; deviation ghi note nếu có.
- [ ] Trace matrix TL25 cụm P4 không ô trống; gates typecheck/test/build xanh.
- [ ] roadmap doc cập nhật M2 completed.

## Risk Assessment
- Tưởng "build backend mới" → thực ra chỉ UI+test; scope nhỏ hơn, tránh over-build (YAGNI).
- Sao/tiền trong reward redemption chạm → adversarial review bắt buộc (append-only StarTransaction).
- UI mới cần wireframe (TL02/TL12) — nếu thiếu, `ck:scenario` + design pattern hiện có làm nguồn.
- Consent ảnh trẻ (nếu after-sale/meeting đính ảnh) → TL08§7 che PII, không auto-publish.
