# Brainstorm: hướng triển khai tiếp theo — redeploy cmcv2-prod (F-FM1)

**Date:** 2026-07-10 23:54 → chốt 2026-07-11
**Decision:** User chốt hướng **A** — redeploy `cmcv2-prod` từ main hiện tại, ngay.

## Problem statement
Sau 2 PR merge hôm nay (#31 P4 hardening, #32 schema reconcile) + Astryx UI migration (#28/#29),
stack pilot `cmcv2-prod` đang chạy binary cũ: admin 2 ngày (thiếu toàn bộ Astryx), lms 32h,
api/worker 23h (thiếu sweep fix + reconcile migration). Plan M0 phase-04 bước 0 (red-team F-FM1
CRITICAL): UAT người thật + biên bản GO phải chạy trên binary chứa fix — e2e xanh không chứng minh
gì cho stack docker (e2e spawn tsx server riêng). GO target 2026-07-12.

## Approaches evaluated
- **A. Redeploy từ main ngay (CHỌN)** — đúng bước 0 phase-04; đóng ô UAT "ENV phase complete";
  tự động hóa được toàn bộ; rollback = image cũ còn nguyên; critical path duy nhất tới GO.
- **A′. Chờ PR #30 land trước** — tránh rebuild 2 lần nếu UAT phủ premium UI layer; bị bác vì
  #30 chưa rõ timeline, GO còn 1 ngày, redeploy lần 2 rẻ (build cache).
- **B. Bảng quyết định VPS (P1)** — bị hoãn: validation log plan M1 nói chốt khi P1 thực thi.
- **C. Review PR #30** — không chọn; PR active của session khác.
- **D. Làm trước M2** — bác: roadmap ghi "tạo khi M1 gần xong", phá quality-gate sequencing.

## Execution plan (theo phase-04 bước 0 + runbook-deploy.md)
1. Rebuild images từ main mới nhất (docker qua Git Bash — ops quirk).
2. `docker compose -p cmcv2-prod up -d` (migrate deploy chạy reconcile migration — đã verify sạch
   trên fresh full-history deploy, PR #32).
3. Boot-checks API/worker không FATAL; env-check; SSO smoke (`/auth/login` 302); health toàn stack.
4. Tick ô UAT checklist "ENV phase complete" + ghi verdict REDEPLOY DONE.

## Risks
- Migration reconcile áp lên cmc_prod (dữ liệu pilot): đã verify zero-residual-drift + CI xanh;
  hành vi duy nhất đổi (classSessionId onDelete) dormant. Rollback path: image cũ + volume giữ nguyên.
- Astryx UI lần đầu chạy trong image prod: smoke UI thủ công sau deploy (login page render).

## Success criteria
Tất cả service healthy; boot-checks PASS; SSO smoke 302; UAT checklist ENV row tick được;
stack chạy đúng commit `5c2cd2e` (main HEAD).

## Unresolved
- PR #30 land sau → cần redeploy lần 2 trước UAT nếu user muốn UAT phủ layer đó (build cache làm rẻ).
