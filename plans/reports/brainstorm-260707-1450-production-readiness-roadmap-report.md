# Brainstorm — Đánh giá sẵn sàng vận hành + lộ trình go-live CMC EDU v2

Date: 2026-07-07 · Mode: markdown (no --html/--wiki) · Branch: main @ 9e7bf24

## 1. Câu hỏi
Dự án sắp vận hành thật được chưa? Codebase sạch chưa, có nhánh lạc không? Kế hoạch tiếp theo hướng tới triển khai vận hành thật.

## 2. Findings (facts, evidence-backed)

### Trạng thái hoàn thành
- Backend roadmap (master-execution-roadmap): 8 phase, US-010..029 — **xong toàn bộ**, merge qua PR #1–#11 (all MERGED, verify bằng `gh pr list`).
- UI plan (260707-0915-ui-implementation): 9 phase ERP admin + LMS — **all done** 2026-07-07, gồm auth 2 tầng LMS, e2e spec, docs sync.
- Typecheck: **26/26 xanh** (chạy 2026-07-07 14:52).
- Test: fail 366/401 ban đầu = **DB dev `cmc-pg` bị tắt**, không phải lỗi logic. Sau khi bật DB: chỉ còn **1 test fail thật** ở `@cmc/auth`.

### Test fail duy nhất — test drift, không phải regression
- `packages/auth/src/index.test.ts:68` kỳ vọng `giao_vien` bị chặn `student.lookup`.
- Commit a26939f (UI) **chủ đích** thêm `giao_vien` (comment: attendance name resolution qua `student.getManyByIds`, RLS + facilityId predicate). Test chưa cập nhật.
- Fix: cập nhật test theo quyết định đã document (1 dòng).

### Vệ sinh git — SẠCH
- Working tree clean, 0 stash, 1 worktree, không nhánh local lạc.
- 8 nhánh remote `feat/*` = đầu nhánh cũ của PR đã **squash-merge** → chỉ cần xoá dọn, không có công việc bỏ rơi.
- ⚠️ **main ahead 2 commit chưa push** (a26939f UI + 9e7bf24 teacher-mvp) → chưa qua CI remote. Trong đó có test đang đỏ → push ngay sẽ đỏ CI.

### Kết luận thẳng: CHƯA vận hành thật được
Code-complete nhưng 4 tích hợp ngoài đang stub (phase PD): Entra SSO (staff auth = dev-header), email transport (OTP phụ huynh chỉ chạy dev/e2e), object store (PDF/ảnh qua seam stub), LLM key. Cộng: cmc_app non-privileged + RLS check prod, worker runtime, trusted-proxy, rate-limit HTTP, backup off-box + restore test, seed production, runbook.

## 3. Quyết định user (2026-07-07)
1. Hạ tầng: **Docker Compose trên VPS**.
2. Credentials: **có đủ cả 4** (Entra SSO, Brevo/Graph, S3/MinIO, LLM key).
3. Vận hành: làm thật theo đúng cấu trúc dự án — harness + docs + protocol hiện có.
4. Môi trường: **tạo stack Docker MỚI cô lập hoàn toàn** khỏi `cmcnew-prod-*` (không dùng chung network/volume/port).

## 4. Lộ trình đề xuất (5 phase, ~1.5–2.5 tuần)

| Phase | Nội dung | Gate |
|---|---|---|
| G0 | Xanh hoá main: fix test drift `student.lookup`, full gates, push 2 commit, CI xanh, xoá 8 nhánh remote stale (verify tip == PR head trước khi xoá) | reviewer nhẹ |
| PD-1 | Tích hợp thật: Entra SSO (@azure/msal-node, session ký + expiry staff & LMS) · email Brevo/Graph vào relay worker seam · `@cmc/storage` S3/MinIO thật · LLM key | **adversarial (auth)** + reviewer |
| PD-2 | Hardening: `cmc_app` non-privileged + RLS boot-check · worker runtime container riêng + healthcheck · trusted-proxy x-forwarded-for · rate-limit HTTP · CI-hardening (lint + e2e critical + branch protection) · TL30 threat checklist owner | reviewer |
| ENV | Stack compose prod mới cô lập (project name/network/volume/port riêng) · backup DB off-box + **test restore** · seed production (facility đầu + super_admin bootstrap) · runbook deploy trong docs | reviewer |
| UAT | e2e critical trên staging stack · UAT theo docs/29 test-plan · nhật ký vận hành · go/no-go | stop-condition nếu đỏ |

Protocol: giữ nguyên master-roadmap protocol (branch per phase, harness intake+story, gates xanh, PR, changelog). Stop-conditions kế thừa: migration mất dữ liệu, creds sai, review-fix >2 vòng.

### Rủi ro chính
- Entra SSO thay dev-header là điểm dễ vỡ nhất (mọi auth path đi qua) → adversarial bắt buộc, giữ dev-header sau env-gate cho e2e.
- Backup/restore chưa từng test → phải test restore thật trước khi nhận dữ liệu trẻ em thật.
- 2 commit chưa push là single-point-of-loss → G0 làm đầu tiên.

## 5. Success metrics
- CI xanh trên main sau push; 0 nhánh remote stale.
- Login staff qua Entra thật; OTP phụ huynh nhận qua email thật; PDF upload/download qua S3 thật.
- RLS boot-check pass với cmc_app trên stack prod; restore DB thành công từ backup off-box.
- Runbook deploy tồn tại trong docs; UAT checklist pass.

## Unresolved questions
- VPS cụ thể (IP/specs) và domain/TLS chưa xác định — cần khi vào phase ENV.
- LLM bật ngay ở go-live hay sau UAT (đề xuất: sau UAT, draft-only theo TL08 §7).
