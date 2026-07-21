---
phase: 5
title: "UAT — E2E staging + go/no-go"
status: pending
priority: P1
dependencies: [4]
effort: "3-5 ngày"
---

# Phase 5: UAT — E2E staging + go/no-go

## Overview
Chạy e2e critical + UAT theo `docs/29-test-plan.md` trên stack ENV (chế độ staging, dữ liệu giả) → biên bản go/no-go. Vận hành "làm thật theo cấu trúc dự án" (quyết định user): mọi bước qua harness story + docs, không đốt cháy giai đoạn với dữ liệu trẻ em.

## Requirements
- Functional: e2e critical suite (`apps/e2e/`) xanh khi trỏ vào stack staging; UAT checklist người-thật cho các luồng chính; sự cố phát hiện → fix qua đúng protocol (branch/PR/CI).
- Non-functional: dữ liệu UAT = giả 100%; xoá sạch trước go-live; nhật ký vận hành ghi lại mọi sự cố + cách xử lý.

## Tiền đề: e2e hiện KHÔNG trỏ staging được (RT-4)
Suite `apps/e2e/` hiện **tự spawn API server local qua tsx** (`global-setup.ts:61-97`), cần DB trực tiếp (`APP_DATABASE_URL`/`DATABASE_URL` teardown xoá per-run), auth bằng `x-dev-user` super_admin (`trpc-client.ts:23-30`), và **không có luồng Entra nào**. `TEST_OTP_SEAM` chết khi `NODE_ENV=production` (`lms-auth/router.ts:38-39`). Vì vậy "config trỏ staging URL" là bất khả thi như viết ban đầu.

**Quyết định (V3): MODE B — local prod-config + session-injection.**
- e2e chạy trên **stack local prod-config** (`NODE_ENV=production`, boot-check thật, SSO middleware thật, seam OFF, **dev-header đã gỡ hẳn — V2**).
- Automated staff flows (phiếu thu/điểm danh/chấm bài...): **session-injection** — global-setup mint session token ký hợp lệ bằng cùng signing secret (thay `x-dev-user` cũ ở `trpc-client.ts:23-30`). Cần helper session-injection mới trong `apps/e2e/`.
- Auth Entra staff + LMS OTP: **verify MANUAL** 1-2 case (email thật). Ghi rõ e2e KHÔNG auto-cover Entra/OTP → bù bằng manual checklist.
- **AI nhận xét (V4 bật go-live):** thêm 1 luồng UAT cho AI draft (GV xem→sửa→confirm) + kiểm guard PII không lộ tên/SĐT ra vendor.

## Tests first (TDD)
UAT chính là lớp test cuối — định nghĩa PASS trước khi chạy:
1. **E2E critical (mode B, session-injection):** phiếu thu create→approve (over-threshold role-elevation) · điểm danh + session lifecycle · bài tập PDF upload/chấm (qua S3 thật) · sao/quà · chấm công IP (trusted-proxy thật) · **AI nhận xét draft (V4)**. Staff auth qua session-injection; Entra + LMS OTP verify manual.
2. **UAT checklist người-thật** (theo docs/29): mỗi vai trò (GĐKD, GĐĐT, sale, kế toán, giáo viên, phụ huynh, học sinh) đi hết luồng trên thiết bị thật (tablet điểm danh, mobile LMS); gồm GV dùng AI nhận xét.
3. **Go-live cutover probe (RT-2):** trên stack prod thật (NODE_ENV=production, ALLOW_DEV_AUTH unset), gửi `x-dev-user`/`x-dev-lms-user` giả → phải 401. Đây là bước bắt buộc trong go/no-go, KHÔNG bỏ.
4. **Tiêu chí go:** 0 CRITICAL/HIGH mở · e2e critical xanh 2 run liên tiếp · cutover probe 401 · restore drill pass (host khác, RT-13) trong tuần UAT · runbook người thứ hai làm theo thành công.

## Related Code Files
- Modify: `apps/e2e/*` — mode B (V3): stack local prod-config; **thêm helper session-injection** (mint token ký) thay `x-dev-user` ở `trpc-client.ts:23-30`; giữ/điều chỉnh `global-setup.ts` cho seed fixture (không dev-header). KHÔNG chỉ "đổi URL".
- Create: `docs/uat-checklist-go-live.md` (checklist + biên bản go/no-go + cutover probe RT-2 + luồng AI nhận xét V4), nhật ký vận hành trong `docs/journals/`

## Implementation Steps
1. **Mode B (V3):** dựng stack local prod-config; implement helper session-injection cho automated staff flows; chuẩn bị manual auth Entra/LMS OTP.
2. Chạy e2e critical; fix qua protocol chuẩn nếu đỏ. Entra/OTP verify manual.
3. UAT người-thật theo checklist; log sự cố → triage (CRITICAL/HIGH chặn go).
4. Restore drill lặp lại 1 lần (host khác, RT-13) trong tuần UAT.
5. Họp go/no-go: đối chiếu tiêu chí. GO → **[RT-2] unset `ALLOW_DEV_AUTH`, restart stack, chạy cutover probe (forged header → 401)** → xoá dữ liệu giả, seed thật, mở cho cơ sở đầu. NO-GO → danh sách chặn + vòng fix.
6. Changelog + journal.

## Success Criteria
- [ ] Mode B (V3): helper session-injection hoạt động; e2e chạy trên local prod-config (không dev-header)
- [ ] E2E critical xanh 2 run liên tiếp (gồm luồng AI nhận xét V4)
- [ ] UAT checklist ký xác nhận đủ các vai trò
- [ ] Cutover probe (RT-2): forged `x-dev-*` header trên prod → 401
- [ ] 0 CRITICAL/HIGH mở tại thời điểm go/no-go
- [ ] Biên bản go/no-go trong docs; dữ liệu giả đã xoá sạch trước go-live

## Risk Assessment
- **e2e không trỏ staging được (RT-4)** → mode B (V3): session-injection cho staff flows, Entra/OTP verify manual — ghi rõ giới hạn coverage (Entra không auto-cover).
- **seam OTP chết ở prod-mode** (`lms-auth/router.ts:38-39`) → LMS e2e cần B hoặc 1-2 case manual email thật.
- UAT phát hiện lỗi lớn SSO/LMS → quay lại PD-1 branch mới, không hotfix tay trên prod.
- Lịch người-thật UAT phụ thuộc vận hành cơ sở → chốt lịch trước khi vào phase.
