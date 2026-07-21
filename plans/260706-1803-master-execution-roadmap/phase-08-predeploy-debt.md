# Phase PD — Pre-deploy debt (chạy trước khi go-live; nhiều mục CẦN credentials từ user)

## Goal
Trả các nợ chỉ cấp bách khi cận deploy (TL03/TL08/TL31 P0-debt) — không chặn build nghiệp vụ.

## Checklist (mỗi mục = 1 story harness khi tới)

### Cần user cung cấp (stop-conditions — hỏi MỘT LẦN khi vào phase)
- [ ] **Entra SSO thật** (@azure/msal-node — TL18): tenant/client-id/secret → thay dev-header (đã fail-closed); session ký + hết hạn cho staff & LMS.
- [ ] **Email transport thật**: Graph (nội bộ) + Brevo (PH) creds → cắm vào relay worker seam (QĐ 0013/0030).
- [ ] **Object store** (MinIO/S3): endpoint/keys → impl `@cmc/storage` thật (PDF, ảnh) + **backup DB off-box** (TL03 P=32) + test restore.
- [ ] **LLM provider key** (nếu bật walk-phase AI T3/P5).

### Không cần user (tự làm được)
- [ ] Provision role **`cmc_app` không đặc quyền trên staging/prod** + kiểm tra RLS thật sự áp (ADR 0042 — RLS im lặng vô hiệu nếu app connect bằng owner). Script kiểm tra tự động khi boot.
- [ ] Worker runtime: process riêng (PM2/systemd/container) cho reconcile+relay, interval config; healthcheck.
- [ ] **CI-hardening** (CI-lite đã vào từ T1 — GitHub Actions, deviation vs TL29-Jenkins ghi nhận): thêm lint + e2e critical vào pipeline, branch protection bắt buộc CI xanh, coverage report công khai.
- [ ] **TL30 threat-checklist story:** liệt kê từng threat CAO (T4/T19/T9/T13/T16/T12/T2/T18) → trỏ test âm tính hiện hữu hoặc bổ sung (fix validate: "threat cao có test âm tính" phải có owner cụ thể).
- [ ] Trusted-proxy config cho `x-forwarded-for` (ADR 0039 caveat — chống giả IP chấm công).
- [ ] Rate-limit tầng HTTP (OTP đã có app-level; thêm reverse-proxy level).
- [ ] Mã hoá cột PII nếu/khi thêm CCCD/bank (TL08 §3 — hiện chưa có cột nào).
- [ ] Threat model TL30 rà lại: mỗi threat CAO có test âm tính (đa số đã có — checklist hoá).
- [ ] Seed/migration production plan (Facility đầu tiên qua seed có kiểm soát; super_admin bootstrap đã có bypass).

## Acceptance
Checklist sạch · `story verify-all` xanh · runbook deploy ngắn trong docs (dev-prod-cicd kế thừa concept v1).

## Ghi chú
Phase này có thể chạy song song/chen giữa P3→P5 nếu user cấp creds sớm; mặc định xếp cuối trước UI-integration.
