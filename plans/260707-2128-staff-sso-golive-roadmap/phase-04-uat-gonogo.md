---
phase: 4
title: "UAT-GoNoGo"
status: superseded
supersededBy: "260707-2308-golive-sprint-land-sso-env-uat/phase-03-uat-gonogo.md"
priority: P1
dependencies: [2, 3]
---

# Phase 4: UAT-GoNoGo

## Overview
Cổng cuối trước vận hành thật (task #9): e2e critical 2 lần xanh liên tiếp trên stack prod-config,
email live send, UAT người-thật theo docs/29 + `docs/uat-checklist-go-live.md`, biên bản go/no-go.
Khác plan trước: SSO đã xong (S2) nên UAT phủ CẢ staff ERP lẫn LMS — không còn scope-cut LMS-first.

## Requirements
- Functional: mọi mục Section 1 (e2e critical) + Section UAT người-thật trong checklist tick PASS; staff login qua Entra thật trong UAT; email Brevo (PH) + Graph (nội bộ) gửi thật ít nhất 1 mỗi loại; AI draft dùng LLM thật; PII-guard verify.
- Non-functional: e2e trỏ DB staging/prod-config — TUYỆT ĐỐI không chạy vào DB prod live (env-guard xác nhận trước khi chạy); flake rerun 1 lần, tái diễn thì sửa isolation không nới test.

## Architecture
Dùng `docs/uat-checklist-go-live.md` làm bản ghi chính thức (điền Run 1/Run 2, ký go/no-go).
Auth trong e2e trên production-config (dev-header TẮT): LMS = Mode-B signed bearer (sẵn có);
**staff = Mode-B staff-cookie** mint bằng `STAFF_SESSION_SECRET` (RT-β, util từ S2) — không nới
NODE_ENV, không mở đường tắt server-side. Login Entra THẬT verify riêng bằng tay trong UAT người-thật.

## Related Code Files
- Modify: `docs/uat-checklist-go-live.md` (điền kết quả, biên bản).
- Chỉ sửa code khi UAT lộ bug → fix-forward theo protocol (branch/PR/gate riêng từng fix).

## Implementation Steps
1. Pre-check: Prerequisites section đã tick từ S3 (stack healthy, restore-drill, isolation).
2. Env-guard: xác nhận APP_DATABASE_URL/DATABASE_URL trỏ staging/prod-config (không prod live) trước khi chạy e2e.
3. Chuyển staff specs sang Mode-B staff-cookie (RT-β) khi chạy production-config; e2e critical Run 1 → ghi; Run 2 liên tiếp → ghi (2/2 PASS bắt buộc).
4. Email live: 1 Brevo (PH thật/test inbox) + 1 Graph (hộp thư nội bộ) — xác nhận nhận được, không lộ payload trong log.
5. UAT người-thật theo docs/29: receipt→approve (over-threshold), attendance+lifecycle, exercise PDF (storage đã chốt) + grade + sao, check-in IP (trusted-proxy), AI draft→sửa→confirm, PII reject, **staff login Entra + role gating nav**, LMS parent/student flows.
6. Tổng hợp finding: bug → fix-forward + retest mục liên quan; mục nào fail sau 2 vòng → ghi NO-GO lý do.
7. Ký biên bản go/no-go; cập nhật changelog + tracker (task #8/#9 completed nếu GO).

## Success Criteria
- [ ] e2e critical 2 lần liên tiếp PASS (ghi trong checklist).
- [ ] Email Brevo + Graph mỗi loại ≥1 gửi thật thành công.
- [ ] Mọi flow UAT người-thật PASS (gồm staff Entra login + role nav).
- [ ] Biên bản go/no-go ký; tracker + changelog cập nhật.

## Risk Assessment
- Nguy cơ lớn nhất: chạy e2e nhầm DB prod thật → mất dữ liệu. Env-guard bước 2 là bắt buộc, dừng nếu nghi ngờ.
- UAT người-thật cần lịch + người từ phía user — điều phối ngoài repo (stop-condition nếu chưa sắp được).
- Fix trong UAT dễ scope-creep → mỗi fix 1 PR nhỏ, gate đủ, không gộp.
