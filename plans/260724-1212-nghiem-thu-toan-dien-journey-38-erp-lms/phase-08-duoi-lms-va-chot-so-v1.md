---
phase: 8
title: "Đuôi LMS xuyên suốt + chốt sổ trạng thái v1"
status: pending
priority: P1
effort: "2-3d"
dependencies: [4, 7]
---

# Phase 8: Đuôi LMS xuyên suốt + chốt sổ v1

## Overview
Chứng minh vòng đời đầy đủ tới NGƯỜI DÙNG CUỐI: 3–5 journey xuyên ERP→LMS (admin tạo → phụ huynh/học viên THẤY), rồi chốt sổ trạng thái v1 — sản phẩm ① của advise: bức tranh sống/chết không còn ô "không biết".

## Requirements
- Functional: tối thiểu 3 journey xuyên suốt: (a) điểm danh ERP → parent thấy trên LMS; (b) chấm bài/assessment ERP → student thấy điểm; (c) cộng sao → student đổi quà → GĐ duyệt redemption ERP. Phiên LMS dùng `mintLmsSession` (login KHÔNG phải nghiệp vụ ở đây — D1); bản parent ĐÃ bơm cache `children` (RT-6, Phase 4) nên màn chọn con hoạt động; dữ liệu ERP tạo theo trình tự vai thật.
- Non-functional (RT-2/3 + validate V1, user 2026-07-24): **sổ v1 = artifact job `ui-e2e` full-suite (mỗi push)** (journeys.json) + git SHA + lệnh regen + **bảng tổng kết commit được** trong report chốt (đếm per trạng thái, per đợt) — KHÔNG phải con trỏ tới file gitignored local. <!-- Updated: Validation Session 1 - V1 per-push --> Docs cập nhật đúng phạm vi (codebase-summary: coverage mới; KHÔNG viết lại architecture).
- **Ràng buộc V4 (user 2026-07-24):** CI chết vì billing (chi tiết: plan.md Session 2 / phase-03 (g)). Bước 3–4 dưới đây KHÔNG chạy được cho tới khi minutes được khôi phục. Phase 8 vẫn hoàn thành mọi phần khác; sổ v1 kết thúc ở trạng thái **"blocked on CI billing"** kèm bảng tổng kết từ run local đánh dấu ADVISORY (không phải sổ v1). Không hạ nguồn chính danh xuống local để lách.
- **Điều kiện env cho negative (RT-15):** negative RLS/consent chỉ có giá trị khi env chạy dùng secret session RIÊNG (không phải dev-default committed trong repo) — ghi điều kiện này vào spec + runbook; nếu env local dev-default thì negative được đánh dấu "điều kiện env chưa đạt", không tính bằng chứng.

## Architecture
Journey xuyên app: context ERP (cookie staff) tạo dữ liệu qua UI admin → context LMS (mintLmsSession) mở app lms (preview 4174) và assert NHÌN THẤY bằng text hiển thị — không id xuyên context (§4.3 áp cả xuyên-app). Điểm nối provision từ Phase 6.

## Related Code Files
- Create: `apps/e2e/tests/journeys/lms-attendance-parent-view.journey.ui.spec.ts`, `lms-grade-student-view.journey.ui.spec.ts`, `lms-stars-redeem-cycle.journey.ui.spec.ts` (+2 tùy triage)
- Modify: `scripts/acceptance-report/flow-manifest.ts` (journey cho flow có đuôi LMS), `docs/codebase-summary.md` (mục coverage), `docs/runbook-uat-golive.md` (trỏ sổ v1 làm đầu vào kịch bản UAT M0)

## Implementation Steps (TDD)
1. Falsification trước cho (a): parent của HỌC SINH KHÁC không thấy dữ liệu điểm danh vừa tạo (RLS/consent negative) → viết đỏ, chứng minh gate, rồi viết positive.
2. Viết (b), (c) cùng khuôn; mỗi journey mới 4 lần xanh liên tiếp.
3. **Nghi thức full-suite cuối (RT-9, duy nhất tại đây):** 4× liên tiếp TOÀN suite trên nguồn chính danh (job `ui-e2e` full-suite — V1), với luật thành văn: pass-sau-retry = flake phải ghi sổ điều tra nhưng KHÔNG reset chuỗi; fail thật ở spec cũ → sửa spec/ghi statusReason rồi chạy lại từ đầu chuỗi; kết quả từng run ghi vào report chốt.
4. Regen sổ từ artifact CI (RT-2/3, V1): xác nhận Success Criteria toàn plan (38/38 + ≥5 LMS, 0 unknown); **sổ v1 = SHA + link artifact + lệnh regen + bảng tổng kết commit vào report chốt** — không con trỏ gitignored.
5. Cập nhật 2 docs; đối chiếu từng claim với sổ thật trước khi ghi (luật documentation-management).
6. Report chốt plan: tổng flow proven/đỏ/không-đường-UI + danh sách sửa đề xuất theo ưu tiên, GỒM 3 finding sản phẩm RT-15 (OTP plaintext-at-rest outbox; secrets dev-default; client parseLmsToken không verify) — đầu vào plan sửa kế tiếp.

## Success Criteria
- [ ] ≥3 journey ERP→LMS xanh 4 lần liên tiếp, negative RLS/consent thật kèm điều kiện env-secret được ghi nhận
- [ ] Full-suite 4× liên tiếp trên nguồn chính danh với luật retry/reset thành văn
- [ ] Sổ v1: 38/38 ERP + ≥5 LMS trạng thái máy-chứng, 0 "không biết"; định nghĩa sổ v1 = SHA + artifact + bảng tổng kết commit được
- [ ] Danh sách sửa-theo-ưu-tiên (gồm 3 mục RT-15) bàn giao plan kế tiếp; không sửa app trong plan này
- [ ] Docs khớp sổ; typecheck/lint/test xanh toàn workspace

## Risk Assessment
- Consent-gate ảnh/evidence (TL12) có thể chặn parent view hợp lệ → negative case phải phân biệt "bị chặn do consent" (đúng) vs "không render" (bug) — assertion theo thông điệp UI cụ thể.
- Cám dỗ sửa bug ngay khi thấy đỏ ở bước cuối → bất biến plan giữ nguyên: ghi sổ, bàn giao.
