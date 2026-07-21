# Journal kỹ thuật — Session 2026-07-06 (P1 build → audit → P2-Foundation)

## Đã làm (theo dòng thời gian)
1. Đọc thật toàn bộ 40 docs (TL00–31 + harness) trước khi code.
2. Build P1 (Định danh & Ghi danh) 8 WF qua Harness: CRM, cổng tiền, provisioning idempotent, enrollment, guardian, LMS OTP, huỷ/hoàn. → commit, PR.
3. Audit per-module (4 agent) → fix (RLS defense-in-depth ADR0042, ngưỡng mắt-thứ-hai, OTP hash…). → commit.
4. **Deep review theo hành trình/mồ côi/toàn vẹn** (3 agent) → bắt lỗi hệ thống audit per-module bỏ sót.
5. Remediation A/B/C + verify adversarial (bắt thêm R1/R2 trong bản fix) → merge PR #1 về main.
6. P2-Foundation: model lớp + auto-session + đóng seam classBatchId (FK+validate). → branch + push.

## Quyết định kỹ thuật đáng ghi
- **RLS defense-in-depth (ADR0042):** app `scoped()` là lớp 1, Postgres RLS là backstop. **Bài học chí mạng:** RLS là no-op cho role owner/superuser/BYPASSRLS → phải connect app bằng role không đặc quyền (`cmc_app`) hoặc RLS im lặng vô dụng. `withFacility` set_config transaction-LOCAL cho pooling.
- **Provisioning tách tx tiền (ADR0041)** cần một retry actor — ban đầu quên → tiền mồ côi. Worker reconcile phải phát hiện orphan theo **thiếu bất-kỳ-bước** (student/guardian/enrollment/account), không chỉ "thiếu student".
- **Ngưỡng cổng tiền** phải chặn tổng quát (approver=GĐĐT/super_admin khi vượt), không chỉ self-approve.
- **Seam bằng FK thật + validate**, không convention (đã học từ RLS: convention tuột).

## Bài học quy trình (quan trọng nhất)
- **Audit per-module KHÔNG đủ.** Nó verify từng unit đúng nhưng bỏ sót đứt gãy end-to-end + mồ côi (provisioning tạo StudentAccount nhưng không tạo Guardian → PH thấy rỗng; không có worker → tiền mồ côi; không có hàng đợi HITL). **Cần review theo hành trình + tính khép kín như một cổng thường trực**, không chỉ per-module.
- **Adversarial verify bản fix cũng bắt lỗi** (R1/R2) — luôn verify remediation, đừng tin "đã fix".
- Delegate qua subagent + verify độc lập bằng grep/test (không tin claim) hoạt động tốt cho khối lượng lớn.

## Trạng thái cuối
main = P1 hardened (merged). Branch `feat/p2-foundation-class-ops` = P2-Foundation (chưa merge). ~157 api test + packages xanh, RLS bật, coverage giữ ngưỡng.

## Nợ/follow-up đã ghi (backlog + docs)
Real Entra SSO (stub fail-closed) · Graph/Brevo transport (worker có seam) · claim-code PH tự link con · reconcile worker scheduler runtime + backoff · P2-Teaching (điểm danh/bài tập/chấm/nhận xét AI/ảnh lớp) · FK createdById/approvedById (pha user) · cấp role cmc_app ở staging/prod.
