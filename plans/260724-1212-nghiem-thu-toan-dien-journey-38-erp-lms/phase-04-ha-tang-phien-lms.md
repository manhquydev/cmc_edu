---
phase: 4
title: "Hạ tầng phiên LMS + 2 journey login/activation (TDD)"
status: partial
completed: 'L-01 + mintLmsSession + helper OTP/sweep (2026-07-24)'
remaining: 'L-02 student-activation — chặn bởi 2 câu hỏi thiết kế, xem report'
report: 'plans/reports/phase-04-ha-tang-phien-lms-260724-1620-report.md'
priority: P1
effort: "2d"
dependencies: [2]
---

# Phase 4: Hạ tầng phiên LMS + 2 journey login/activation

## Overview
Mở cánh LMS: wrapper `mintLmsSession()` (D1/A2 **đã hiệu chỉnh RT-1**: token LMS ĐÃ ký HMAC — `apps/api/src/lms-auth/session-token.ts:50,78`; helper mint ĐÃ tồn tại — `mintParentToken`/`mintStudentToken`, `apps/e2e/src/session-injection.ts:41,61`) + 2 journey mà login/kích hoạt LÀ nghiệp vụ, đi qua UI login thật với OTP đọc từ outbox DB.

## Requirements
- Functional:
  - (a) `mintLmsSession({kind, ...})` tại `apps/e2e/src/journey/mint-lms-session.ts` — **wrapper mỏng**: GỌI `mintParentToken`/`mintStudentToken` sẵn có rồi ghi session JSON vào browser storage đúng khuôn `StoredLmsSession` (`apps/lms/src/lib/trpc.ts:26-37`); **`session-injection.ts` vẫn là file duy nhất biết định dạng token** (RT-1). **Bản parent bơm cache `children` từ DB** (RT-6, user 2026-07-24 duyệt carve-out: `parent/home.tsx:124` render từ cache login-time; wrapper đọc guardian-link theo định danh test của run, ghi chú carve-out ngay trong code).
  - (b) Journey L-01 parent-OTP-login (login LÀ nghiệp vụ): nhập email tab phụ huynh → đọc `payload->>'code'` từ EmailOutbox qua helper **trong `db.ts`** (RT-11: KHÔNG tạo module mới — thêm reader email-keyed cạnh `getEmailOutboxStatusByReceiptId` db.ts:883, chịu được payload đã scrub bởi worker) → gõ mã → vào trang phụ huynh. Falsification: mã sai → lỗi generic no-leak.
  - (c) Journey L-02 student-activation 2-vai — **trình tự đã sửa theo RT-5** (`resetChildPassword` XÓA cờ, router.ts:637): provision qua chuỗi ERP thật (receipt approve — xem (d)) → student login lần đầu bằng mật khẩu mặc định provisioning → GẶP gate `mustChangePassword` → assert màn `/student/change-password` (logout-only) → parent (inject session) `resetChildPassword` qua UI → student login mật khẩu mới → thẳng `/student/home` (cờ đã false). Falsification: login mật khẩu cũ sau reset → bị chặn. **Mâu thuẫn "không hardcode mật khẩu mặc định" giải quyết tường minh:** spec KHÔNG hardcode literal — đường thay thế là ERP staff `student.resetPassword` (router có sẵn, `apps/api/src/student/router.ts:93-97`) đặt mật khẩu biết-trước có cờ mustChangePassword; nếu triage Phase 2 xác nhận màn UI cho thao tác đó tồn tại thì dùng UI, không thì nghi thức ngoại lệ.
  - (d) **Chuỗi provision đúng thực tế (RT-10/AD#9):** provisioning chạy TRONG `finance.receiptApprove` (`provision-from-receipt.ts`), outbox OTP chỉ enqueue khi ParentAccount có email; email upsert throw P2002 nếu địa chỉ đã thuộc account khác; `requestOtpEmail` trả `{ok:true}` câm lặng khi không enqueue → journey PHẢI: sinh **email + phone unique per-run**; helper OTP-poll timeout in message chẩn đoán "có thể chưa enqueue: kiểm ParentAccount.email".
  - (e) **Vệ sinh xuyên run (RT-10):** beforeAll sweep theo định danh của run: `LoginOtp` **theo email** (cleanup hiện chỉ xoá theo phone — db.ts:606; rate-limit 5 req/15' đếm rows email), `EmailOutbox` theo `to`, `ParentAccount` sót từ run crash (reuse-by-phone của provisioning). Sweep chạy TRƯỚC spec, chịu được run trước chết giữa chừng.
- Non-functional: đuôi `.journey.ui.spec.ts` (H5); không `goto` màn đích, không truyền id giữa vai trong nghiệp vụ (§4.2/§4.3); tham số của `mintLmsSession` là định danh test do chính spec sinh ra (email/phone unique) — lookup key ghi rõ trong helper, không mượn id từ context ERP.

## Architecture
- Token: tái dùng `mintParentToken`/`mintStudentToken` (secret parity dev-default như staff — điều kiện env cho negative tests ghi ở Phase 8/RT-15). Wrapper chỉ own việc: mint → dựng `StoredLmsSession` (+`children` cho parent) → ghi storage → mở app lms (preview 4174 đã có, playwright.config.ts:47-48).
- OTP: reader email-keyed mới trong `db.ts` (fallback: `readOtpCode` brute-force từ `LoginOtp.codeHash` không sợ scrub — chọn 1 trong 2 làm chính khi implement, ghi lý do).
- **Sửa doc cũ (RT-1):** `docs/system-architecture.md:76` còn ghi "unsigned placeholder — P0-debt" — cập nhật 1 dòng trỏ RT-1 remediation (`session-token.ts`), nợ còn lại thật sự là client `parseLmsToken` không verify chữ ký (`apps/lms/src/lib/lms-session.tsx:39`) — đã vào sổ bàn giao RT-15.

## Related Code Files
- Create: `apps/e2e/src/journey/mint-lms-session.ts` (wrapper storage + children), `apps/e2e/tests/journeys/lms-parent-otp-login.journey.ui.spec.ts`, `apps/e2e/tests/journeys/lms-student-activation.journey.ui.spec.ts`
- Modify: `apps/e2e/src/db.ts` (reader OTP email-keyed + sweep LoginOtp-by-email/EmailOutbox-by-to/ParentAccount leftovers), `docs/system-architecture.md` (1 dòng sửa claim cũ), `scripts/acceptance-report/flow-manifest.ts` (gắn journey P1-06/P1-07 theo phân công Phase 2)
- KHÔNG sửa: `apps/api/**`, `apps/lms/**`, `packages/**`; KHÔNG tạo `read-otp-from-outbox.ts` (RT-11)

## Implementation Steps (TDD — đỏ trước)
0. Đọc `apps/e2e/tests/lms-login.ui.spec.ts` (Scope#9): spec này ĐÃ phủ no-leak error (:144) và redirect mustChangePassword (:168) — ghi rõ L-01/L-02 chỉ phủ **delta choreography** (vòng OTP-outbox thật; chu trình reset 2 vai); quyết định giữ/gộp spec cũ ghi vào report phase.
1. Sweep + unique-identity helpers trong db.ts; test đỏ cho reader OTP email-keyed (fixture row outbox + row đã scrub).
2. L-01: falsification trước (mã sai → lỗi generic, không vào được) → đỏ phần positive → viết positive với reader thật → xanh.
3. `mintLmsSession` wrapper (+children cho parent); smoke: inject parent → mở trang phụ huynh thấy đúng con của run.
4. L-02 theo trình tự (c); falsification mật-khẩu-cũ.
5. Chạy cả 2 journey 4 lần liên tiếp (nghi thức phase này giữ 4× vì chỉ 2 spec); đo timing feed Phase 1.
6. Gắn `journey:` cho P1-06/P1-07 theo H2 + phân công từ triage Phase 2.

## Success Criteria
- [ ] L-01, L-02 xanh 4 lần liên tiếp; falsification negative có thật trong spec; không flake do rate-limit (nhờ unique identity + sweep)
- [ ] `session-injection.ts` vẫn là chủ duy nhất của định dạng token (grep: không file mới nào mint token); wrapper chỉ ghi storage + children
- [ ] Không đụng `apps/api`, `apps/lms`, `packages/auth`; không có module OTP mới ngoài db.ts
- [ ] Dòng doc cũ system-architecture.md:76 đã sửa đúng thực tế
- [ ] P1-06/P1-07 nhận trạng thái từ ingestion Phase 3

## Risk Assessment
- Chuỗi provision cần bước không-UI chưa lường (triage Phase 2 đi trước; nếu vướng → nghi thức ngoại lệ: grep + user duyệt ngày thật).
- Cache `children` bơm tay lệch schema `StoredLmsSession` khi app đổi — wrapper đọc type từ `apps/lms/src/lib/trpc.ts` qua import type nếu khả thi, không copy tay.
- Mật khẩu mặc định provisioning: tuyệt đối không hardcode literal trong spec; nếu cả 2 đường (c) đều bất khả qua UI → dừng hỏi user, không tự chế.
