# Brainstorm Report — Phủ Toàn Cảnh 33 Luồng + Sync TL25

- Date: 2026-07-18 04:23 · Session: /brainstorm · Status: APPROVED by user
- Predecessor: plans/260717-1213-so-nghiem-thu-song (v1 shipped d8ba223 — 9 luồng P1, engine verified)
- Input: acceptance-report/verification.json @ commit 3107c98

## 1. Problem Statement

Dashboard "Sổ Nghiệm Thu Sống" v1 hoạt động nhưng chỉ phủ 9/33 luồng (cụm P1, ~27% dự án).
114 orphan procedures thực chất là luồng P2/P3/P4 chưa khai manifest (shift:9, kpi:7, exercise:6,
rewards:6, submission:6, assessment:5, classBatch:5, payslip:5…). Mục tiêu gốc "nhìn toàn cảnh
tình trạng dự án" mới đạt 1/4. Kèm nợ docs: TL25 lệch code 4 chỗ đã flag (NOTE trong flow-manifest.ts).

## 2. Options Evaluated

| # | Option | Verdict |
|---|---|---|
| A | Mở rộng manifest phủ đủ 33 luồng + ADMIN | **Chọn** — giá trị/giờ cao nhất; engine đã chứng minh; routine đã định trong plan gốc (phase-01 step 8) |
| B | Fix bug P1-07 (LMS login redirect, test.fixme) | Đợt sau — bug thật + điều kiện gate 3 Phase 4, nhưng không chặn coverage |
| C | Dựng synthetic-seed DB → mở gate Phase 4 | Hoãn — nặng nhất, infra bị PO hạ ưu tiên, vẫn vướng B ở gate 3 |
| D | Sync TL25 4 route lệch | **Chọn** — gộp vào A (15 phút, cùng vùng file) |

User chọn A+D; B là ứng viên đợt kế tiếp.

## 3. Design (approved)

1. **`scripts/acceptance-report/flow-manifest.ts` 9 → ~34 luồng:**
   - P2 (8): classBatch, classSession, schedule, attendance, curriculumUnit/exercise/submission, assessment/reportCard, sessionEvidence — chép TL25 §2, đối chiếu code, NOTE khi lệch (pattern đã dùng cho P1).
   - P3 (11): checkInOut, manualPunch, shift, compensation/compensationPolicy/salaryTier/payslip, kpi.
   - P4 (5): gift, rewards, parentMeeting, testAppointment, afterSale.
   - ADMIN (~4-5): KHÔNG có trong TL25 — seed từ code + plans/260716-1047-super-admin-completion (facilities, users, network-ip, audit-log, shift-config).
2. **Whitelist orphan** (`verify.ts` INFRA_NAMESPACE_WHITELIST): khi ADMIN flows nhận `user`/`audit`/`facilityNetwork` làm expected → rút 3 namespace này khỏi whitelist, chỉ giữ `health`, `lmsAuth`. Orphan detection phủ cả vùng admin.
3. **TL25 sync (docs/25-ma-tran-truy-vet-p1.md):** sửa 4 route lệch đã flag (`/finance/receipts/new`→`/finance/new`; `/finance/receipts/:id`→`/finance/:id`; `/finance/reconciliation`→`/ops/recon`; enrollment route→`/admin/students/:id`) + lệch mới lộ ra khi chép P2-P4. CHỈ sửa giá trị route/procedure sai thực tế — không đụng nội dung thiết kế của corpus.

## 4. Acceptance Criteria

- `pnpm acceptance:report` sạch, < 30s, mọi cụm P1-P4+ADMIN hiện trên cả 2 tab
- Orphan giảm từ 114 → kỳ vọng < 20 (phần dư = ứng viên whitelist mới hoặc luồng thiếu docs thật — liệt kê trong report kết thúc, không ép về 0)
- Không false-red: luồng mới nào đỏ phải là thiếu thật hoặc lệch docs đã NOTE, không phải lỗi scanner
- TL25 hết lệch tại 4 điểm đã biết; lệch mới (nếu có) được sửa cùng đợt
- Drift test vẫn pass sau mở rộng (rename 1 procedure P3 → flow đó partial)

## 5. Out of Scope

Phase 4 evidence/screenshots (vẫn GATED), fix bug P1-07, route/model orphan detection, mobile layout.

## 6. Risks

- **TL25 P2-P4 lệch code nhiều hơn P1** (P1 đã lệch 4 chỗ) → mỗi lệch vài phút đối chiếu; là giá trị của tool (lộ drift), không phải blocker. Nguồn đối chiếu cuối cùng luôn là code.
- **ADMIN cluster không có docs nguồn** → seed từ code + plan 260716; đánh dấu rõ trong manifest là "nguồn: code" thay vì WF-code TL25.
- **Whitelist rút gọn làm lộ orphan hạ tầng thật** (vd `user.*` procedures thuần infra) → cho phép whitelist ở mức procedure nếu cần, không quay lại whitelist cả namespace.

## 7. Next Steps

`/ck:plan` với report này — dự kiến 2 phase: (P1) manifest P2+P3+P4 + TL25 sync + whitelist adjust, (P2) ADMIN cluster + orphan triage cuối + regenerate + verify. Effort thấp, chủ yếu data-entry có đối chiếu.

## Unresolved Questions

- Orphan còn lại sau phủ đủ (~<20): quyết whitelist procedure-level hay tạo flow mới — quyết trong lúc làm, theo bản chất từng procedure.
